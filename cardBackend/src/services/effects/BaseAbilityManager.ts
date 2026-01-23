// src/services/effects/BaseAbilityManager.ts
// Handles activated abilities originating from base cards

import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase } from '../../models/GameEnums';
import { PlayerActionEvent, PlayerActionEventData, EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { GameActionValidator } from '../GameActionValidator';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { DeployTargetManager } from '../DeployTargetManager';
import { ExecutionResult } from '../ExecutionResult';
import { EnergyManager } from '../EnergyManager';
import { GameNotificationManager } from '../GameNotificationManager';
import { EffectExecutor } from './EffectExecutor';
import { ConditionalTokenDeployManager, ConditionalTokenPlan } from './ConditionalTokenDeployManager';
import { resolveActivatedAbilitySource } from './ActivatedAbilitySourceResolver';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { CardDataResolver } from './CardDataResolver';
import { PairFromTrashActivatedAbility } from './PairFromTrashActivatedAbility';

export class BaseAbilityManager {

    static executeBaseAbility(gameEnv: GameEnvironment, event: PlayerActionEvent): ExecutionResult {
        const eventData: PlayerActionEventData = event.data || ({} as PlayerActionEventData);
        const actingPlayerId = typeof eventData.playerId === 'string' ? eventData.playerId : event.playerId;
        const fromBurst = Boolean(eventData.fromBurst);

        console.log(`🏰 Base ability request: player=${actingPlayerId}, fromBurst=${fromBurst}`);

        if (!actingPlayerId) {
            return { success: false, error: 'activateCardAbility requires playerId' };
        }

        const turnCheck = GameActionValidator.ensureTurn(gameEnv, actingPlayerId, fromBurst);
        if (!turnCheck.success) {
            return turnCheck;
        }

        if (!fromBurst && gameEnv.phase !== GamePhase.MAIN_PHASE) {
            return {
                success: false,
                error: `activateCardAbility only available during MAIN_PHASE (current: ${gameEnv.phase})`
            };
        }

        const baseCarduid = typeof (eventData as Record<string, unknown>).carduid === 'string'
            ? ((eventData as Record<string, unknown>).carduid as string)
            : undefined;

        if (!baseCarduid) {
            return {
                success: false,
                error: 'activateCardAbility requires carduid'
            };
        }

        console.log(`🏰 Base ability target carduid=${baseCarduid}, requestedEffectId=${(eventData as any).effectId || 'none'}`);

        const sourceResult = resolveActivatedAbilitySource(gameEnv, actingPlayerId, baseCarduid);
        if (!sourceResult.success) {
            return { success: false, error: sourceResult.error };
        }

        const { sourceCard, sourceZone, sourceSlotName } = sourceResult.source;

        if (sourceZone === 'base') {
            console.log(`🏰 Base found: rested=${Boolean(sourceCard.isRested)}, effectUsage=${JSON.stringify(sourceCard.effectUsage || {})}`);
            if (sourceCard.isRested) {
                return {
                    success: false,
                    error: 'Base is already rested'
                };
            }
        }

        const requestedEffectId = typeof (eventData as Record<string, unknown>).effectId === 'string'
            ? ((eventData as Record<string, unknown>).effectId as string)
            : undefined;

        const resolvedCardData = CardDataResolver.resolveWithEffectRules(sourceCard.cardData);
        const effectLookup = BaseAbilityManager.findActivatedEffect(resolvedCardData?.effects?.rules, requestedEffectId);
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
        let restNotificationPending: { playerId: string; carduid: string; zone: string } | null = null;
        const energyCost = typeof costConfig?.['resource'] === 'number' ? (costConfig!['resource'] as number) : 0;
        const oncePerTurn = costConfig?.['oncePerTurn'] === true;
        const restSelf = costConfig?.['restSelf'] === true;
        console.log(`🏰 Base cost: energy=${energyCost}, oncePerTurn=${oncePerTurn}, restCost=${restSelf ? 'restSelf' : costConfig?.['rest'] || costConfig?.['tap'] || 'none'}`);

        if (!ContinuousEffectManager.validateEffectConditions(normalizedEffect, gameEnv, actingPlayerId, sourceCard as any)) {
            return {
                success: false,
                error: `Effect ${normalizedEffect.effectId} conditions are not met`
            };
        }

        if (oncePerTurn && BaseAbilityManager.effectUsedThisTurn(sourceCard, normalizedEffect.effectId, gameEnv.currentTurn)) {
            return {
                success: false,
                error: `Effect ${normalizedEffect.effectId} already used this turn`
            };
        }

        const action = EffectExecutor.getEffectAction(normalizedEffect);
        console.log(`🏰 Base action=${action || 'none'}, currentTurn=${gameEnv.currentTurn}, phase=${gameEnv.phase}`);
        let pendingTokenPlan: ConditionalTokenPlan | null = null;
        if (action === 'conditionalTokenDeploy') {
            if (!ConditionalTokenDeployManager.conditionsSatisfied(normalizedEffect, gameEnv, actingPlayerId)) {
                console.log('🏰 Token deploy conditions not met; skipping effect');
                return { success: true };
            }
            const tokenPlan = ConditionalTokenDeployManager.buildPlan(gameEnv, actingPlayerId, normalizedEffect);
            if (!tokenPlan.success) {
                return {
                    success: false,
                    error: tokenPlan.error || 'Conditional token deploy requirements not met'
                };
            }
            pendingTokenPlan = tokenPlan.plan!;
            console.log(`🏰 Token plan: slots=${pendingTokenPlan.targetSlots.join(', ')}, token=${pendingTokenPlan.tokenData?.id || pendingTokenPlan.tokenData?.name || 'unknown'}`);
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
            const requiresRest = restSelf || costConfig['rest'] === 'self' || costConfig['tap'] === 'self';
            if (requiresRest) {
                if (sourceCard.isRested) {
                    return {
                        success: false,
                        error: 'Card is already rested'
                    };
                }
                sourceCard.isRested = true;
                baseRestedForCost = true;
                const restZone = sourceZone === 'base' ? 'base' : sourceSlotName;
                if (!restZone) {
                    return {
                        success: false,
                        error: 'Failed to determine zone for rested card notification'
                    };
                }
                restNotificationPending = {
                    playerId: actingPlayerId,
                    carduid: sourceCard.carduid,
                    zone: restZone
                };
            }
        }

        let energyPayment: { success: boolean; tapped?: any[]; error?: string } | null = null;
        if (!fromBurst && energyCost > 0) {
            energyPayment = EnergyManager.payEnergyCost(gameEnv, actingPlayerId, energyCost);
            if (!energyPayment.success) {
                if (baseRestedForCost) {
                    sourceCard.isRested = false;
                }
                return {
                    success: false,
                    error: energyPayment.error || `Failed to pay energy cost ${energyCost}`
                };
            }
        }

        if (restNotificationPending) {
            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.addNotificationEvent('CARD_RESTED', {
                playerId: restNotificationPending.playerId,
                carduid: restNotificationPending.carduid,
                zone: restNotificationPending.zone,
                timestamp: Date.now()
            });
        }

        let abilityResult: ExecutionResult;

        const pairFromTrashResult = PairFromTrashActivatedAbility.tryExecuteWithDiscardCost(
            gameEnv,
            actingPlayerId,
            sourceCard.carduid,
            normalizedEffect,
            costConfig
        );
        if (pairFromTrashResult.handled) {
            if (!pairFromTrashResult.success) {
                abilityResult = { success: false, error: pairFromTrashResult.error };
            } else {
                abilityResult = {
                    success: true,
                    ...(pairFromTrashResult.requiresSelection ? { requiresSelection: true } : {})
                };
            }
        } else if (action === 'conditionalTokenDeploy') {
            abilityResult = ConditionalTokenDeployManager.executePlan(gameEnv, actingPlayerId, sourceCard.carduid, pendingTokenPlan!);
        } else if (sourceZone === 'unit' && normalizedEffect.target?.scope === 'self' && normalizedEffect.target?.type === 'unit' && sourceSlotName) {
            const target: TargetReference = {
                carduid: sourceCard.carduid,
                zone: sourceSlotName,
                playerId: actingPlayerId
            };
            abilityResult = EffectExecutor.executeActivatedEffect(
                gameEnv,
                normalizedEffect,
                [target],
                actingPlayerId,
                sourceCard.carduid
            );
        } else {
            abilityResult = DeployTargetManager.processEffectWithTargetChoice(
                gameEnv,
                actingPlayerId,
                sourceCard.carduid,
                normalizedEffect
            );
        }

        if (!abilityResult.success) {
            if (baseRestedForCost) {
                sourceCard.isRested = false;
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
                error: abilityResult.error || 'Activated ability failed'
            };
        }

        const requiresSelection = (abilityResult as any)?.requiresSelection === true;

        if (oncePerTurn) {
            BaseAbilityManager.markEffectUsed(sourceCard, normalizedEffect.effectId, gameEnv.currentTurn);
        }

        console.log(`🏰 Activated ability ${normalizedEffect.effectId} from ${sourceCard.carduid}`);
        return requiresSelection ? { success: true, requiresSelection: true } : { success: true };
    }

    private static findActivatedEffect(rules: unknown, requestedId?: string): { success: true; effect: EffectDefinition } | ExecutionResult {
        if (!Array.isArray(rules)) {
            return { success: false, error: 'No activated effect available on card' };
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
                error: requestedId ? `Effect ${requestedId} not found on card` : 'No activated effect available on card'
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
