// src/services/effects/AttackPhaseEffectManager.ts
// Handles ATTACK_PHASE triggered effects for attacking units and attached pilots

import { GameEnvironment } from '../../models/GameEnvironment';
import { UnitZoneCard, PilotZoneCard, ZoneCard } from '../../models/CardSystem';
import { EffectDefinition, PlayerActionEvent } from '../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { EffectExecutor } from './EffectExecutor';
import { EffectRuleCatalog } from './EffectRuleCatalog';
import { DrawThenDiscardManager } from './DrawThenDiscardManager';
import { AttackResumeScheduler } from '../battle/AttackResumeScheduler';
import { DeployTargetManager } from '../DeployTargetManager';
import { AttackConditionEvaluator } from './attack/AttackConditionEvaluator';
import { AttackEffectUsageTracker } from './attack/AttackEffectUsageTracker';
import { AttackCostFlowInterceptor } from '../costs/AttackCostFlowInterceptor';

export interface AttackPhaseEffectResult {
    success: boolean;
    error?: string;
    effectsProcessed?: number;
    requiresSelection?: boolean;
    consumed?: boolean;
}

type TriggeredEffectRule = EffectDefinition & {
    restrictions?: string[];
};

export class AttackPhaseEffectManager {
    static processAttackPhaseEffects(
        gameEnv: GameEnvironment,
        event: PlayerActionEvent
    ): AttackPhaseEffectResult {
        const eventData = event.data || {};
        const playerId = typeof eventData.playerId === 'string' ? eventData.playerId : undefined;
        const attackerCarduid = typeof eventData.attackerCarduid === 'string' ? eventData.attackerCarduid : undefined;

        if (!playerId || !attackerCarduid) {
            return { success: true, effectsProcessed: 0 };
        }

        const attackerSlotResult = SlotZoneUtils.findSlotNameByUnitUidForPlayer(
            gameEnv,
            playerId,
            attackerCarduid
        );

        if (!attackerSlotResult.found || !attackerSlotResult.slotName || !attackerSlotResult.unit) {
            // No unit found – nothing to trigger
            return { success: true, effectsProcessed: 0 };
        }

        const attackingUnit = attackerSlotResult.unit as UnitZoneCard;
        const slotZone = SlotZoneUtils.getSlotZone(
            gameEnv.players[playerId].zones,
            attackerSlotResult.slotName
        );
        const pairedPilot = slotZone?.slot?.pilot as PilotZoneCard | undefined;

        const effectSources: Array<UnitZoneCard | PilotZoneCard> = [attackingUnit];
        if (pairedPilot) {
            effectSources.push(pairedPilot);
        }

        let effectsProcessed = 0;
        let requiresSelection = false;

        for (const sourceCard of effectSources) {
            const attackEffects = EffectRuleCatalog.collectEffects(sourceCard.cardData, {
                trigger: 'ATTACK_PHASE',
                fallbackEffectId: 'attack_effect',
                expectedTriggers: ['ATTACK_PHASE']
            });

            for (const effect of attackEffects) {
                if (!this.isAttackPhaseTrigger(effect)) {
                    continue;
                }

                const normalizedEffect = ensureEffectDefaults({ ...effect }) as TriggeredEffectRule;

                if (!this.sourceConditionsSatisfied(normalizedEffect, sourceCard, gameEnv, playerId)) {
                    continue;
                }

                if (!AttackConditionEvaluator.conditionsSatisfied(normalizedEffect, {
                    gameEnv,
                    playerId,
                    attackEvent: event,
                    sourceSlot: slotZone?.slot
                })) {
                    continue;
                }

                if (!this.restrictionsAllowUse(effect, sourceCard, gameEnv.currentTurn)) {
                    continue;
                }

                const applyResult = this.applyAttackEffect(
                    gameEnv,
                    playerId,
                    event,
                    sourceCard,
                    normalizedEffect
                );

                if (!applyResult.success) {
                    return applyResult;
                }

                if (applyResult.consumed !== false) {
                    this.markEffectUsed(
                        sourceCard,
                        normalizedEffect.effectId || normalizedEffect.action || 'attack_effect',
                        gameEnv.currentTurn
                    );
                    effectsProcessed++;
                }

                if (applyResult.requiresSelection) {
                    requiresSelection = true;
                    break;
                }
            }

            if (requiresSelection) {
                break;
            }
        }

        return { success: true, effectsProcessed, ...(requiresSelection ? { requiresSelection: true } : {}) };
    }

    private static isAttackPhaseTrigger(effect: EffectDefinition): boolean {
        if (!effect) {
            return false;
        }

        return (
            effect.type === 'triggered' &&
            typeof effect.trigger === 'string' &&
            effect.trigger.toUpperCase() === 'ATTACK_PHASE'
        );
    }

    private static sourceConditionsSatisfied(
        effect: EffectDefinition,
        card: UnitZoneCard | PilotZoneCard,
        gameEnv: GameEnvironment,
        playerId: string
    ): boolean {
        if (!effect.sourceConditions || effect.sourceConditions.length === 0) {
            return true;
        }

        try {
            return ContinuousEffectManager.sourceConditionsMet(
                effect,
                card as unknown as any,
                gameEnv,
                playerId
            );
        } catch (error) {
            console.error('❌ Failed to evaluate source conditions for attack effect:', error);
            return false;
        }
    }

    private static restrictionsAllowUse(
        effect: TriggeredEffectRule,
        card: ZoneCard,
        currentTurn: number
    ): boolean {
        const restrictions = effect.restrictions || [];
        const oncePerTurn = restrictions.includes('once_per_turn') || (effect.cost && (effect.cost as any).oncePerTurn === true);
        if (oncePerTurn) {
            const effectId = effect.effectId;
            if (effectId && AttackEffectUsageTracker.hasEffectBeenUsedThisTurn(card, effectId, currentTurn)) {
                console.log(`⚠️ Effect ${effect.effectId} already used this turn for card ${card.carduid}`);
                return false;
            }
        }

        return true;
    }

    private static markEffectUsed(card: ZoneCard, effectId: string, currentTurn: number): void {
        AttackEffectUsageTracker.markEffectUsed(card, effectId, currentTurn);
    }

    private static applyAttackEffect(
        gameEnv: GameEnvironment,
        playerId: string,
        attackEvent: PlayerActionEvent,
        sourceCard: UnitZoneCard | PilotZoneCard,
        effect: EffectDefinition
    ): AttackPhaseEffectResult {
        const action = EffectExecutor.getEffectAction(effect);

        if (!action) {
            return {
                success: false,
                error: 'Attack phase effect missing action'
            };
        }

        if (effect.optional) {
            console.log(`ℹ️ Optional attack effect ${effect.effectId || action} available for card ${sourceCard.carduid}`);
        }

        const costIntercept = AttackCostFlowInterceptor.intercept(gameEnv, playerId, attackEvent, sourceCard, effect);
        if (costIntercept.handled) {
            return costIntercept.success
                ? { success: true, ...(costIntercept.requiresSelection ? { requiresSelection: true } : {}), ...(costIntercept.consumed !== undefined ? { consumed: costIntercept.consumed } : {}) }
                : { success: false, error: costIntercept.error || 'Attack cost flow failed' };
        }

        if (action === 'draw_then_discard') {
            const result = DrawThenDiscardManager.processDrawThenDiscardEffect(
                gameEnv,
                playerId,
                sourceCard.carduid,
                effect
            );
            if (!result.success) {
                return { success: false, error: result.error };
            }

            if (result.requiresSelection && result.choiceEventId) {
                AttackResumeScheduler.enqueueResumeAttackAfterChoice(gameEnv, attackEvent, result.choiceEventId);
                return { success: true, requiresSelection: true };
            }

            return { success: true };
        }

        if (EffectExecutor.actionSupportsNoTargets(action)) {
            const result = EffectExecutor.applyEffectToTargets(gameEnv, effect, [], playerId, sourceCard.carduid);
            return result.success ? { success: true } : { success: false, error: result.error };
        }

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            playerId,
            sourceCard.carduid,
            effect,
            typeof (attackEvent.data as any)?.attackNotificationId === 'string'
                ? ((attackEvent.data as any).attackNotificationId as string)
                : undefined
        );

        if (!result.success) {
            return { success: false, error: result.error };
        }

        if (result.autoApplied && !result.requiresSelection && (result.affectedTargets?.length ?? 0) === 0) {
            // No eligible targets: effect "succeeds but does nothing" and should not consume once-per-turn usage.
            return { success: true, consumed: false };
        }

        if (result.requiresSelection && result.choiceEventId) {
            AttackResumeScheduler.enqueueResumeAttackAfterChoice(gameEnv, attackEvent, result.choiceEventId);
            return { success: true, requiresSelection: true };
        }

        return { success: true };
    }
}
