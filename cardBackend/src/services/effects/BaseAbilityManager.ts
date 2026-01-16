// src/services/effects/BaseAbilityManager.ts
// Handles activated abilities originating from base cards

import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase } from '../../models/GameEnums';
import { PlayerActionEvent, PlayerActionEventData, EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { GameActionValidator } from '../GameActionValidator';
import { ensureEffectDefaults, validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { DeployTargetManager } from '../DeployTargetManager';
import { ExecutionResult } from '../ExecutionResult';
import { EnergyManager } from '../EnergyManager';
import { CardDatabaseManager, createZoneCard, UnitZoneCard } from '../../models/CardSystem';
import { PlayerCardManager } from '../PlayerCardManager';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { EffectExecutor } from './EffectExecutor';

export class BaseAbilityManager {

    static executeBaseAbility(gameEnv: GameEnvironment, event: PlayerActionEvent): ExecutionResult {
        const eventData: PlayerActionEventData = event.data || ({} as PlayerActionEventData);
        const actingPlayerId = typeof eventData.playerId === 'string' ? eventData.playerId : event.playerId;
        const fromBurst = Boolean(eventData.fromBurst);

        if (!actingPlayerId) {
            return { success: false, error: 'activateBaseAbility requires playerId' };
        }

        const turnCheck = GameActionValidator.ensureTurn(gameEnv, actingPlayerId, fromBurst);
        if (!turnCheck.success) {
            return turnCheck;
        }

        if (!fromBurst && gameEnv.phase !== GamePhase.MAIN_PHASE) {
            return {
                success: false,
                error: `activateBaseAbility only available during MAIN_PHASE (current: ${gameEnv.phase})`
            };
        }

        const baseCarduid = typeof (eventData as Record<string, unknown>).carduid === 'string'
            ? ((eventData as Record<string, unknown>).carduid as string)
            : undefined;

        if (!baseCarduid) {
            return {
                success: false,
                error: 'activateBaseAbility requires carduid'
            };
        }

        const playerState = gameEnv.players[actingPlayerId];
        if (!playerState?.zones?.base || !Array.isArray(playerState.zones.base)) {
            return {
                success: false,
                error: 'Player does not control a base zone'
            };
        }

        const baseCard = playerState.zones.base.find(card => card.carduid === baseCarduid);
        if (!baseCard) {
            return {
                success: false,
                error: `Base ${baseCarduid} not found for player ${actingPlayerId}`
            };
        }

        if (baseCard.isRested) {
            return {
                success: false,
                error: 'Base is already rested'
            };
        }

        const requestedEffectId = typeof (eventData as Record<string, unknown>).effectId === 'string'
            ? ((eventData as Record<string, unknown>).effectId as string)
            : undefined;

        const effectLookup = BaseAbilityManager.findActivatedEffect(baseCard.cardData?.effects?.rules, requestedEffectId);
        if (!effectLookup.success || !('effect' in effectLookup)) {
            return effectLookup;
        }

        const effectDefinition = effectLookup.effect;
        const normalizedEffect = ensureEffectDefaults({ ...effectDefinition });
        if (!fromBurst && !BaseAbilityManager.allowsMainPhase(normalizedEffect)) {
            return {
                success: false,
                error: `Effect ${normalizedEffect.effectId} cannot be activated during MAIN_PHASE`
            };
        }

        const costConfig = (effectDefinition as unknown as { cost?: Record<string, unknown> }).cost;
        let baseRestedForCost = false;
        const energyCost = typeof costConfig?.['resource'] === 'number' ? (costConfig!['resource'] as number) : 0;
        const oncePerTurn = costConfig?.['oncePerTurn'] === true;

        if (oncePerTurn && BaseAbilityManager.effectUsedThisTurn(baseCard, normalizedEffect.effectId, gameEnv.currentTurn)) {
            return {
                success: false,
                error: `Effect ${normalizedEffect.effectId} already used this turn`
            };
        }

        const action = EffectExecutor.getEffectAction(normalizedEffect);
        let pendingTokenPlan: { tokenData: any; targetSlot: string } | null = null;
        if (action === 'conditionalTokenDeploy') {
            const tokenPlan = this.resolveConditionalTokenPlan(gameEnv, actingPlayerId, normalizedEffect);
            if (!tokenPlan.success) {
                return {
                    success: false,
                    error: tokenPlan.error || 'Conditional token deploy requirements not met'
                };
            }
            pendingTokenPlan = tokenPlan.plan!;
        }

        if (!fromBurst && energyCost > 0) {
            const availableEnergy = EnergyManager.getAvailableEnergy(gameEnv, actingPlayerId);
            if (availableEnergy < energyCost) {
                return {
                    success: false,
                    error: `Not enough active energy to pay cost ${energyCost} (available ${availableEnergy})`
                };
            }
        }

        if (costConfig) {
            const requiresRest = costConfig['rest'] === 'self' || costConfig['tap'] === 'self';
            if (requiresRest) {
                baseCard.isRested = true;
                baseRestedForCost = true;
            }
        }

        let energyPayment: { success: boolean; tapped?: any[]; error?: string } | null = null;
        if (!fromBurst && energyCost > 0) {
            energyPayment = EnergyManager.payEnergyCost(gameEnv, actingPlayerId, energyCost);
            if (!energyPayment.success) {
                if (baseRestedForCost) {
                    baseCard.isRested = false;
                }
                return {
                    success: false,
                    error: energyPayment.error || `Failed to pay energy cost ${energyCost}`
                };
            }
        }

        let abilityResult: ExecutionResult;
        if (action === 'conditionalTokenDeploy') {
            abilityResult = this.executeConditionalTokenDeploy(
                gameEnv,
                actingPlayerId,
                baseCard.carduid,
                pendingTokenPlan!
            );
        } else {
            abilityResult = DeployTargetManager.processEffectWithTargetChoice(
                gameEnv,
                actingPlayerId,
                baseCard.carduid,
                normalizedEffect
            );
        }

        if (!abilityResult.success) {
            if (baseRestedForCost) {
                baseCard.isRested = false;
            }
            if (energyPayment?.tapped) {
                energyPayment.tapped.forEach(card => {
                    if (card) {
                        (card as any).isRested = false;
                    }
                });
            }
            return {
                success: false,
                error: abilityResult.error || 'Base ability failed'
            };
        }

        if (oncePerTurn) {
            BaseAbilityManager.markEffectUsed(baseCard, normalizedEffect.effectId, gameEnv.currentTurn);
        }

        console.log(`🏰 Activated base ability ${normalizedEffect.effectId} from ${baseCard.carduid}`);
        return { success: true };
    }

    private static findActivatedEffect(rules: unknown, requestedId?: string): { success: true; effect: EffectDefinition } | ExecutionResult {
        if (!Array.isArray(rules)) {
            return { success: false, error: 'No activated effect available on base' };
        }

        const effect = rules.find(rule => {
            if (!rule || typeof rule !== 'object') {
                return false;
            }

            const definition = rule as EffectDefinition;
            if (requestedId) {
                return definition.effectId === requestedId;
            }
            return definition.type === 'activated';
        }) as EffectDefinition | undefined;

        if (!effect) {
            return {
                success: false,
                error: requestedId ? `Effect ${requestedId} not found on base` : 'No activated effect available on base'
            };
        }

        if (effect.type && effect.type !== 'activated') {
            return {
                success: false,
                error: `Effect ${effect.effectId} is not an activated ability`
            };
        }

        return { success: true, effect };
    }

    private static allowsMainPhase(effect: EffectDefinition): boolean {
        const timingRecord = effect.timing as Record<string, unknown> | undefined;
        const windows = Array.isArray(timingRecord?.['windows'])
            ? (timingRecord!['windows'] as string[]).map(window => window.toUpperCase())
            : [];

        if (windows.length === 0) {
            return true;
        }

        return windows.includes('MAIN_PHASE');
    }

    private static effectUsedThisTurn(baseCard: any, effectId: string, currentTurn: number): boolean {
        const usage = baseCard.effectUsage?.[effectId];
        return Boolean(usage && usage.lastUsedTurn === currentTurn);
    }

    private static markEffectUsed(baseCard: any, effectId: string, currentTurn: number): void {
        if (!baseCard.effectUsage) {
            baseCard.effectUsage = {};
        }
        baseCard.effectUsage[effectId] = { lastUsedTurn: currentTurn };
    }

    private static resolveConditionalTokenPlan(
        gameEnv: GameEnvironment,
        playerId: string,
        effect: EffectDefinition
    ): { success: true; plan: { tokenData: any; targetSlot: string } } | { success: false; error: string } {
        const parameters = effect.parameters || {};
        const player = gameEnv.players[playerId];
        if (!player?.zones) {
            return { success: false, error: 'Player zones unavailable for token deploy' };
        }

        const targetSlot = PlayerCardManager.findFirstEmptySlot(player.zones);
        if (!targetSlot) {
            return { success: false, error: 'No empty unit slot available for token deploy' };
        }

        const unitsInPlay = SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, playerId).length;
        const conditionEntries = Object.entries(parameters)
            .filter(([key]) => key.startsWith('condition'))
            .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

        let selectedToken: any | null = null;
        for (const [, conditionValue] of conditionEntries) {
            if (!conditionValue || typeof conditionValue !== 'object') {
                continue;
            }
            const condition = conditionValue as Record<string, unknown>;
            const unitsRequirement = condition['unitsInPlay'];
            const token = condition['token'];
            if (!token || typeof token !== 'object') {
                continue;
            }

            if (typeof unitsRequirement === 'number' && unitsInPlay === unitsRequirement) {
                selectedToken = token;
                break;
            }

            if (typeof unitsRequirement === 'string' && validateComparisonFilter(unitsInPlay, unitsRequirement)) {
                selectedToken = token;
                break;
            }
        }

        if (!selectedToken) {
            return { success: false, error: 'No matching token condition found for board state' };
        }

        const tokenDataResult = this.resolveTokenData(selectedToken as Record<string, unknown>);
        if (!tokenDataResult.success) {
            return { success: false, error: tokenDataResult.error };
        }

        return { success: true, plan: { tokenData: tokenDataResult.tokenData, targetSlot } };
    }

    private static resolveTokenData(
        token: Record<string, unknown>
    ): { success: true; tokenData: any } | { success: false; error: string } {
        const tokenCardId = typeof token['cardId'] === 'string'
            ? (token['cardId'] as string)
            : typeof token['id'] === 'string'
                ? (token['id'] as string)
                : undefined;

        let baseTokenData = tokenCardId ? CardDatabaseManager.getCardDetails(tokenCardId) : null;

        if (!baseTokenData) {
            const tokenName = typeof token['name'] === 'string' ? (token['name'] as string) : undefined;
            const normalizedName = tokenName
                ? tokenName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
                : '';
            const tokenAp = typeof token['ap'] === 'number' ? (token['ap'] as number) : undefined;
            const tokenHp = typeof token['hp'] === 'number' ? (token['hp'] as number) : undefined;

            const tokenCards = Object.values(CardDatabaseManager.getAllCards()).filter((card: any) =>
                card?.cardType === 'unit' && card?.color === 'Token'
            );

            if (normalizedName) {
                baseTokenData = tokenCards.find((card: any) => {
                    const candidate = (card?.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    return candidate === normalizedName;
                });
            }

            if (!baseTokenData && (tokenAp !== undefined || tokenHp !== undefined)) {
                baseTokenData = tokenCards.find((card: any) => {
                    if (tokenAp !== undefined && card?.ap !== tokenAp) {
                        return false;
                    }
                    if (tokenHp !== undefined && card?.hp !== tokenHp) {
                        return false;
                    }
                    return true;
                });
            }
        }

        if (!baseTokenData) {
            return { success: false, error: 'Token card data not found for conditional deploy' };
        }

        const overrideTraits = Array.isArray(token['traits']) ? (token['traits'] as string[]) : undefined;
        const overrideAp = typeof token['ap'] === 'number' ? (token['ap'] as number) : undefined;
        const overrideHp = typeof token['hp'] === 'number' ? (token['hp'] as number) : undefined;
        const overrideName = typeof token['name'] === 'string' ? (token['name'] as string) : undefined;

        return {
            success: true,
            tokenData: {
                ...baseTokenData,
                name: overrideName || baseTokenData.name,
                traits: overrideTraits || baseTokenData.traits,
                ap: overrideAp ?? baseTokenData.ap,
                hp: overrideHp ?? baseTokenData.hp
            }
        };
    }

    private static executeConditionalTokenDeploy(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        plan: { tokenData: any; targetSlot: string }
    ): ExecutionResult {
        const carduid = PlayerCardManager.createUniqueCardId(plan.tokenData.id);
        const unitCard = createZoneCard(carduid, plan.tokenData.id, plan.tokenData, playerId, 'unit') as UnitZoneCard;

        const player = gameEnv.players[playerId];
        if (!player?.zones) {
            return { success: false, error: 'Player zones unavailable for token deploy' };
        }

        const slotResult = SlotZoneUtils.getSlotZone(player.zones, plan.targetSlot);
        if (!slotResult.isValid || !slotResult.slot) {
            return { success: false, error: `Invalid slot ${plan.targetSlot} for token deploy` };
        }

        slotResult.slot.unit = unitCard;
        console.log(`🪖 Deployed token ${plan.tokenData.name || plan.tokenData.id} to ${plan.targetSlot} (source ${sourceCarduid})`);
        return { success: true };
    }
}
