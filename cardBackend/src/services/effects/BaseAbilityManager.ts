// src/services/effects/BaseAbilityManager.ts
// Handles activated abilities originating from base cards

import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase } from '../../models/GameEnums';
import { PlayerActionEvent, PlayerActionEventData, EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { GameActionValidator } from '../GameActionValidator';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { DeployTargetManager } from '../DeployTargetManager';
import { ExecutionResult } from '../ExecutionResult';
import { EnergyManager } from '../EnergyManager';
import { EffectExecutor } from './EffectExecutor';
import { ConditionalTokenDeployManager, ConditionalTokenPlan } from './ConditionalTokenDeployManager';

export class BaseAbilityManager {

    static executeBaseAbility(gameEnv: GameEnvironment, event: PlayerActionEvent): ExecutionResult {
        const eventData: PlayerActionEventData = event.data || ({} as PlayerActionEventData);
        const actingPlayerId = typeof eventData.playerId === 'string' ? eventData.playerId : event.playerId;
        const fromBurst = Boolean(eventData.fromBurst);

        console.log(`🏰 Base ability request: player=${actingPlayerId}, fromBurst=${fromBurst}`);

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

        console.log(`🏰 Base ability target carduid=${baseCarduid}, requestedEffectId=${(eventData as any).effectId || 'none'}`);

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

        console.log(`🏰 Base found: rested=${Boolean(baseCard.isRested)}, effectUsage=${JSON.stringify(baseCard.effectUsage || {})}`);

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
        console.log(`🏰 Base effect resolved: effectId=${normalizedEffect.effectId}, type=${normalizedEffect.type || 'none'}, action=${normalizedEffect.action || 'none'}`);
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
        console.log(`🏰 Base cost: energy=${energyCost}, oncePerTurn=${oncePerTurn}, restCost=${costConfig?.['rest'] || costConfig?.['tap'] || 'none'}`);

        if (oncePerTurn && BaseAbilityManager.effectUsedThisTurn(baseCard, normalizedEffect.effectId, gameEnv.currentTurn)) {
            return {
                success: false,
                error: `Effect ${normalizedEffect.effectId} already used this turn`
            };
        }

        const action = EffectExecutor.getEffectAction(normalizedEffect);
        console.log(`🏰 Base action=${action || 'none'}, currentTurn=${gameEnv.currentTurn}, phase=${gameEnv.phase}`);
        let pendingTokenPlan: ConditionalTokenPlan | null = null;
        if (action === 'conditionalTokenDeploy') {
            const tokenPlan = ConditionalTokenDeployManager.buildPlan(gameEnv, actingPlayerId, normalizedEffect);
            if (!tokenPlan.success) {
                return {
                    success: false,
                    error: tokenPlan.error || 'Conditional token deploy requirements not met'
                };
            }
            pendingTokenPlan = tokenPlan.plan!;
            console.log(`🏰 Token plan: slot=${pendingTokenPlan.targetSlot}, token=${pendingTokenPlan.tokenData?.id || pendingTokenPlan.tokenData?.name || 'unknown'}`);
        }

        if (!fromBurst && energyCost > 0) {
            const availableEnergy = EnergyManager.getAvailableEnergy(gameEnv, actingPlayerId);
            console.log(`🏰 Energy check: available=${availableEnergy}, required=${energyCost}`);
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
            abilityResult = ConditionalTokenDeployManager.executePlan(gameEnv, actingPlayerId, baseCard.carduid, pendingTokenPlan!);
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

}
