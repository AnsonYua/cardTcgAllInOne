// src/services/effects/BaseAbilityManager.ts
// Handles activated abilities originating from base cards

import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase } from '../../models/GameEnums';
import { PlayerActionEvent, PlayerActionEventData, EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { GameActionValidator } from '../GameActionValidator';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { ExecutionResult } from '../ExecutionResult';
import { EnergyManager } from '../EnergyManager';
import { GameNotificationManager } from '../GameNotificationManager';
import { EffectExecutor } from './EffectExecutor';
import { ConditionalTokenDeployManager, ConditionalTokenPlan } from './ConditionalTokenDeployManager';
import { resolveActivatedAbilitySource } from './ActivatedAbilitySourceResolver';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { CardDataResolver } from './CardDataResolver';
import { EffectTimingWindowUtils } from '../../utils/EffectTimingWindowUtils';
import { SlotCardStateUtils } from '../conditions/SlotCardStateUtils';
import { effectRequiresLinkedSource } from '../../utils/ImplicitEffectConditionUtils';
import { ActivatedAbilityEffectRunner } from './ActivatedAbilityEffectRunner';
import { UnitRestedByEffectTriggeredEffectManager } from './UnitRestedByEffectTriggeredEffectManager';
import { BattlePhaseManager } from '../BattlePhaseManager';

export class BaseAbilityManager {

    static executeBaseAbility(gameEnv: GameEnvironment, event: PlayerActionEvent): ExecutionResult {
        const eventData: PlayerActionEventData = event.data || ({} as PlayerActionEventData);
        const actingPlayerId = typeof eventData.playerId === 'string' ? eventData.playerId : event.playerId;
        const fromBurst = Boolean(eventData.fromBurst);

        console.log(`🏰 Base ability request: player=${actingPlayerId}, fromBurst=${fromBurst}`);

        if (!actingPlayerId) {
            return { success: false, error: 'activateCardAbility requires playerId' };
        }

        const turnCheck = GameActionValidator.ensureTurn(gameEnv, actingPlayerId, fromBurst, {
            actionType: 'activateCardAbility'
        });
        if (!turnCheck.success) {
            return turnCheck;
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
        const timingCheck = BaseAbilityManager.validateActivatedEffectTiming(
            gameEnv,
            actingPlayerId,
            normalizedEffect,
            fromBurst
        );
        if (!timingCheck.success) {
            return {
                success: false,
                error: timingCheck.error || `Effect ${normalizedEffect.effectId} cannot be activated during ${gameEnv.phase}`
            };
        }

        if ((sourceZone === 'unit' || sourceZone === 'pilot') && effectRequiresLinkedSource(normalizedEffect, resolvedCardData)) {
            const linked = SlotCardStateUtils.isCardLinked(gameEnv, sourceCard.carduid);
            if (!linked) {
                return {
                    success: false,
                    error: `Effect ${normalizedEffect.effectId} requires the unit to be linked`
                };
            }
        }

        const costConfig = (effectDefinition as unknown as { cost?: Record<string, unknown> }).cost;
        let sourceRestedForCost = false;
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
                sourceRestedForCost = true;
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
                if (sourceRestedForCost) {
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

        abilityResult = ActivatedAbilityEffectRunner.execute(gameEnv, {
            actingPlayerId,
            sourceCarduid: sourceCard.carduid,
            normalizedEffect,
            costConfig: typeof costConfig === 'object' && costConfig ? (costConfig as Record<string, unknown>) : undefined,
            pendingTokenPlan
        });

        if (!abilityResult.success) {
            if (sourceRestedForCost) {
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
        let requiresTriggeredSelection = false;

        // Rest paid as a unit activated-ability cost counts as "rested by an effect".
        if (sourceRestedForCost && sourceZone === 'unit') {
            const triggerResult = UnitRestedByEffectTriggeredEffectManager.process(gameEnv, {
                sourcePlayerId: actingPlayerId,
                targetPlayerId: actingPlayerId,
                targetCarduid: sourceCard.carduid
            });
            if (!triggerResult.success) {
                return {
                    success: false,
                    error: triggerResult.error || 'Failed to process UNIT_RESTED_BY_EFFECT trigger'
                };
            }
            requiresTriggeredSelection = triggerResult.requiresSelection === true;
        }

        if (oncePerTurn) {
            BaseAbilityManager.markEffectUsed(sourceCard, normalizedEffect.effectId, gameEnv.currentTurn);
        }

        if (!requiresSelection && !requiresTriggeredSelection) {
            const postActionStepResult = BaseAbilityManager.handlePostActionStepActivatedAbility(gameEnv, actingPlayerId);
            if (!postActionStepResult.success) {
                return postActionStepResult;
            }
        }

        console.log(`🏰 Activated ability ${normalizedEffect.effectId} from ${sourceCard.carduid}`);
        return (requiresSelection || requiresTriggeredSelection)
            ? { success: true, requiresSelection: true }
            : { success: true };
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

    private static validateActivatedEffectTiming(
        gameEnv: GameEnvironment,
        actingPlayerId: string,
        effect: EffectDefinition,
        fromBurst: boolean
    ): ExecutionResult {
        const timingWindows = new Set(EffectTimingWindowUtils.getActivationWindows(effect));
        const hasMainPhaseWindow = timingWindows.has('MAIN_PHASE');
        const hasActionStepWindow = timingWindows.has('ACTION_STEP') || timingWindows.has('ACTION');
        const hasExplicitWindow = hasMainPhaseWindow || hasActionStepWindow;
        const actionWindowOpen = BattlePhaseManager.isActionWindowOpen(gameEnv);

        if (actionWindowOpen && hasActionStepWindow) {
            if (!BattlePhaseManager.playerInActiveBattle(gameEnv, actingPlayerId)) {
                return {
                    success: false,
                    error: 'Only players involved in the current battle may use ACTION_STEP abilities'
                };
            }
            return { success: true };
        }

        if (hasActionStepWindow && !hasMainPhaseWindow) {
            return {
                success: false,
                error: actionWindowOpen
                    ? 'Only players involved in the current battle may use ACTION_STEP abilities'
                    : `Effect ${effect.effectId} can only be activated during a valid ACTION_STEP window`
            };
        }

        if (!hasExplicitWindow) {
            return fromBurst || gameEnv.phase === GamePhase.MAIN_PHASE
                ? { success: true }
                : {
                    success: false,
                    error: `Effect ${effect.effectId} cannot be activated during ${gameEnv.phase}`
                };
        }

        if (fromBurst) {
            return { success: true };
        }

        if (!hasMainPhaseWindow) {
            return {
                success: false,
                error: `Effect ${effect.effectId} cannot be activated during ${gameEnv.phase}`
            };
        }

        if (gameEnv.phase !== GamePhase.MAIN_PHASE) {
            return {
                success: false,
                error: `Effect ${effect.effectId} cannot be activated during ${gameEnv.phase}`
            };
        }

        return { success: true };
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

    private static handlePostActionStepActivatedAbility(gameEnv: GameEnvironment, actingPlayerId: string): ExecutionResult {
        if (!BattlePhaseManager.isActionWindowOpen(gameEnv)) {
            return { success: true };
        }

        if (!BattlePhaseManager.playerInActiveBattle(gameEnv, actingPlayerId)) {
            return { success: true };
        }

        const battle = gameEnv.currentBattle;
        if (!battle) {
            return { success: true };
        }

        // Some unit tests and low-level call sites construct partial battle contexts directly.
        // Only run ACTION_STEP progression when the battle context has been fully initialized.
        if (!battle.confirmations || !battle.actionTargets) {
            return { success: true };
        }

        // Re-open the acting player's action-step response window before refreshing legal targets.
        battle.confirmations[actingPlayerId] = false;
        gameEnv.refreshBattleActionTargets();

        const remainingTargets = battle.actionTargets?.[actingPlayerId] || [];
        if (remainingTargets.length > 0) {
            return { success: true };
        }

        return BattlePhaseManager.handleBattleConfirmation(gameEnv, actingPlayerId);
    }

}
