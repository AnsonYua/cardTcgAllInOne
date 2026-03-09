// src/services/effects/AttackPhaseEffectManager.ts
// Handles ATTACK_PHASE triggered effects for attacking units and attached pilots.

import { GameEnvironment } from '../../models/GameEnvironment';
import { UnitZoneCard, PilotZoneCard, ZoneCard } from '../../models/CardSystem';
import {
    AttackPhaseEffectEvent,
    EffectDefinition,
    PlayerActionEvent,
    QueuedAttackEffectDefinition
} from '../EventQueue/interfaces/GameEvent';
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
import { EffectSelfTargetNormalizer } from '../targets/EffectSelfTargetNormalizer';
import {
    AttackEffectChainContinuation,
    createAttackEffectChainContinuation
} from './attack/AttackEffectChainContinuation';
import { EventFactory } from '../EventQueue/EventFactory';
import { GameNotificationManager } from '../GameNotificationManager';
import { ChoiceEventScheduler } from '../choices/ChoiceEventScheduler';
import { ChoiceDisplayBuilder } from '../choices/ChoiceDisplayBuilder';
import { TargetResolver } from '../targets/TargetResolver';
import { TargetSelectionPipeline } from '../targets/TargetSelectionPipeline';
import { TargetChoicePolicy } from '../choices/TargetChoicePolicy';
import { getEffectEventTrigger } from './timing/EffectTimingAccess';

export interface AttackPhaseEffectResult {
    success: boolean;
    error?: string;
    effectsProcessed?: number;
    requiresSelection?: boolean;
    consumed?: boolean;
    queued?: boolean;
}

type TriggeredEffectRule = EffectDefinition & {
    restrictions?: string[];
};

type AttackSourceContext = {
    playerId: string;
    attackerCarduid: string;
    slotName: string;
    slot: Record<string, unknown> | undefined;
    sources: Array<UnitZoneCard | PilotZoneCard>;
};

type AttackEffectOrderContext = {
    kind: 'ATTACK_EFFECT_ORDER';
    attackPlayerId: string;
    attackerCarduid: string;
    attackNotificationId?: string;
    originalAttackEventData: Record<string, unknown>;
    effects: QueuedAttackEffectDefinition[];
    allEffects: QueuedAttackEffectDefinition[];
};

export class AttackPhaseEffectManager {
    static processAttackPhaseEffects(
        gameEnv: GameEnvironment,
        event: PlayerActionEvent
    ): AttackPhaseEffectResult {
        const collected = this.collectAttackPhaseEffects(gameEnv, event);
        if (!collected.success || !collected.effects) {
            return {
                success: collected.success,
                error: collected.error,
                effectsProcessed: 0
            };
        }

        return this.executeAttackEffectsInline(gameEnv, event, collected.effects);
    }

    static queueAttackPhaseEffects(
        gameEnv: GameEnvironment,
        event: PlayerActionEvent
    ): AttackPhaseEffectResult {
        const collected = this.collectAttackPhaseEffects(gameEnv, event);
        if (!collected.success) {
            return { success: false, error: collected.error };
        }

        const effects = collected.effects || [];
        if (effects.length === 0) {
            return { success: true, effectsProcessed: 0 };
        }

        this.enqueueInitialAttackEffectOrOrderChoice(gameEnv, event, effects);

        return {
            success: true,
            effectsProcessed: effects.length,
            queued: true
        };
    }

    static executeQueuedAttackPhaseEffect(
        gameEnv: GameEnvironment,
        event: AttackPhaseEffectEvent
    ): AttackPhaseEffectResult {
        const attackEvent = EventFactory.createPlayerActionEvent(
            event.data.attackPlayerId,
            event.data.originalAttackEventData.actionType,
            {
                ...event.data.originalAttackEventData,
                playerId: event.data.attackPlayerId,
                actionType: event.data.originalAttackEventData.actionType
            }
        );

        const sourceCard = SlotZoneUtils.getCardByUid(
            gameEnv,
            event.data.effect.sourceCarduid
        ) as UnitZoneCard | PilotZoneCard | null;

        if (!sourceCard) {
            this.queueRemainingEffectOrResume(gameEnv, attackEvent, event.data.remainingEffects, event.id);
            return { success: true, effectsProcessed: 0, consumed: false };
        }

        if (!this.effectStillEligible(gameEnv, attackEvent, sourceCard, event.data.effect)) {
            this.queueRemainingEffectOrResume(gameEnv, attackEvent, event.data.remainingEffects, event.id);
            return { success: true, effectsProcessed: 0, consumed: false };
        }

        const continuation = createAttackEffectChainContinuation(attackEvent, event.data.remainingEffects);
        const applyResult = this.applyAttackEffect(
            gameEnv,
            event.data.attackPlayerId,
            attackEvent,
            sourceCard,
            event.data.effect,
            continuation
        );

        if (!applyResult.success) {
            return applyResult;
        }

        if (applyResult.consumed !== false) {
            this.markEffectUsed(
                sourceCard,
                event.data.effect.effectId || event.data.effect.action || 'attack_effect',
                gameEnv.currentTurn
            );
        }

        if (applyResult.requiresSelection) {
            return { success: true, requiresSelection: true, effectsProcessed: applyResult.consumed === false ? 0 : 1 };
        }

        this.emitAttackEffectStepResolved(gameEnv, event.data.attackPlayerId, sourceCard.carduid, event.data.effect.effectId, event.data.remainingEffects.length);
        this.queueRemainingEffectOrResume(gameEnv, attackEvent, event.data.remainingEffects);

        return {
            success: true,
            effectsProcessed: applyResult.consumed === false ? 0 : 1,
            ...(applyResult.consumed !== undefined ? { consumed: applyResult.consumed } : {})
        };
    }

    static collectAttackPhaseEffects(
        gameEnv: GameEnvironment,
        event: PlayerActionEvent
    ): { success: boolean; error?: string; effects?: QueuedAttackEffectDefinition[] } {
        const sourceContext = this.resolveAttackSources(gameEnv, event);
        if (!sourceContext) {
            return { success: true, effects: [] };
        }

        const queuedEffects: QueuedAttackEffectDefinition[] = [];

        for (const sourceCard of sourceContext.sources) {
            const attackEffects = EffectRuleCatalog.collectEffects(sourceCard.cardData, {
                trigger: 'ATTACK_PHASE',
                fallbackEffectId: 'attack_effect',
                expectedTriggers: ['ATTACK_PHASE']
            });

            for (const effect of attackEffects) {
                if (!this.isAttackPhaseTrigger(effect)) {
                    continue;
                }

                const normalizedEffect = EffectSelfTargetNormalizer.normalize(
                    ensureEffectDefaults({ ...effect }) as TriggeredEffectRule,
                    sourceCard
                ) as TriggeredEffectRule;

                if (!this.sourceConditionsSatisfied(normalizedEffect, sourceCard, gameEnv, sourceContext.playerId)) {
                    continue;
                }

                if (!AttackConditionEvaluator.conditionsSatisfied(normalizedEffect, {
                    gameEnv,
                    playerId: sourceContext.playerId,
                    attackEvent: event,
                    sourceSlot: sourceContext.slot,
                    sourceCard
                })) {
                    continue;
                }

                if (!this.restrictionsAllowUse(normalizedEffect, sourceCard, gameEnv.currentTurn)) {
                    continue;
                }

                queuedEffects.push({
                    ...normalizedEffect,
                    sourceCarduid: sourceCard.carduid
                });
            }
        }

        return { success: true, effects: queuedEffects };
    }

    private static resolveAttackSources(
        gameEnv: GameEnvironment,
        event: PlayerActionEvent
    ): AttackSourceContext | null {
        const eventData = event.data || {};
        const playerId = typeof eventData.playerId === 'string' ? eventData.playerId : undefined;
        const attackerCarduid = typeof eventData.attackerCarduid === 'string' ? eventData.attackerCarduid : undefined;

        if (!playerId || !attackerCarduid) {
            return null;
        }

        const attackerSlotResult = SlotZoneUtils.findSlotNameByUnitUidForPlayer(
            gameEnv,
            playerId,
            attackerCarduid
        );

        if (!attackerSlotResult.found || !attackerSlotResult.slotName || !attackerSlotResult.unit) {
            return null;
        }

        const attackingUnit = attackerSlotResult.unit as UnitZoneCard;
        const slotZone = SlotZoneUtils.getSlotZone(
            gameEnv.players[playerId].zones,
            attackerSlotResult.slotName
        );
        const pairedPilot = slotZone?.slot?.pilot as PilotZoneCard | undefined;

        const sources: Array<UnitZoneCard | PilotZoneCard> = [attackingUnit];
        if (pairedPilot) {
            sources.push(pairedPilot);
        }

        return {
            playerId,
            attackerCarduid,
            slotName: attackerSlotResult.slotName,
            slot: slotZone?.slot as Record<string, unknown> | undefined,
            sources
        };
    }

    private static executeAttackEffectsInline(
        gameEnv: GameEnvironment,
        attackEvent: PlayerActionEvent,
        effects: QueuedAttackEffectDefinition[]
    ): AttackPhaseEffectResult {
        let effectsProcessed = 0;

        for (let index = 0; index < effects.length; index += 1) {
            const effect = effects[index];
            const sourceCard = SlotZoneUtils.getCardByUid(gameEnv, effect.sourceCarduid) as UnitZoneCard | PilotZoneCard | null;
            if (!sourceCard) {
                continue;
            }

            if (!this.effectStillEligible(gameEnv, attackEvent, sourceCard, effect)) {
                continue;
            }

            const continuation = createAttackEffectChainContinuation(attackEvent, effects.slice(index + 1));
            const applyResult = this.applyAttackEffect(
                gameEnv,
                attackEvent.playerId,
                attackEvent,
                sourceCard,
                effect,
                continuation
            );

            if (!applyResult.success) {
                return {
                    success: false,
                    error: applyResult.error,
                    effectsProcessed
                };
            }

            if (applyResult.consumed !== false) {
                this.markEffectUsed(
                    sourceCard,
                    effect.effectId || effect.action || 'attack_effect',
                    gameEnv.currentTurn
                );
                effectsProcessed += 1;
            }

            if (applyResult.requiresSelection) {
                return { success: true, effectsProcessed, requiresSelection: true };
            }

            this.emitAttackEffectStepResolved(gameEnv, attackEvent.playerId, sourceCard.carduid, effect.effectId, effects.length - index - 1);
        }

        return { success: true, effectsProcessed };
    }

    private static effectStillEligible(
        gameEnv: GameEnvironment,
        attackEvent: PlayerActionEvent,
        sourceCard: UnitZoneCard | PilotZoneCard,
        effect: QueuedAttackEffectDefinition
    ): boolean {
        const playerId = attackEvent.playerId;
        const sourceLookup = SlotZoneUtils.findSlotByCarduid(gameEnv.players[playerId]?.zones, sourceCard.carduid);
        const sourceSlot = sourceLookup?.slotName
            ? SlotZoneUtils.getSlotZone(gameEnv.players[playerId].zones, sourceLookup.slotName)?.slot
            : undefined;

        if (!this.sourceConditionsSatisfied(effect, sourceCard, gameEnv, playerId)) {
            return false;
        }

        if (!AttackConditionEvaluator.conditionsSatisfied(effect, {
            gameEnv,
            playerId,
            attackEvent,
            sourceSlot: sourceSlot as any,
            sourceCard
        })) {
            return false;
        }

        if (!this.restrictionsAllowUse(effect, sourceCard, gameEnv.currentTurn)) {
            return false;
        }

        return true;
    }

    private static isAttackPhaseTrigger(effect: EffectDefinition): boolean {
        if (!effect) {
            return false;
        }

        return effect.type === 'triggered' && getEffectEventTrigger(effect) === 'ATTACK_PHASE';
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
        effect: TriggeredEffectRule | QueuedAttackEffectDefinition,
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
        effect: EffectDefinition,
        attackEffectChainContinuation?: AttackEffectChainContinuation
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

        const costIntercept = AttackCostFlowInterceptor.intercept(
            gameEnv,
            playerId,
            attackEvent,
            sourceCard,
            effect,
            attackEffectChainContinuation
        );
        if (costIntercept.handled) {
            return costIntercept.success
                ? {
                    success: true,
                    ...(costIntercept.requiresSelection ? { requiresSelection: true } : {}),
                    ...(costIntercept.consumed !== undefined ? { consumed: costIntercept.consumed } : {})
                }
                : { success: false, error: costIntercept.error || 'Attack cost flow failed' };
        }

        if (action === 'draw_then_discard') {
            const result = DrawThenDiscardManager.processDrawThenDiscardEffect(
                gameEnv,
                playerId,
                sourceCard.carduid,
                effect,
                typeof (attackEvent.data as any)?.attackNotificationId === 'string'
                    ? ((attackEvent.data as any).attackNotificationId as string)
                    : undefined,
                attackEffectChainContinuation
                    ? { attackEffectChainContinuation }
                    : undefined
            );
            if (!result.success) {
                return { success: false, error: result.error };
            }

            if (result.requiresSelection) {
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
                : undefined,
            undefined,
            undefined,
            {
                // ATTACK_PHASE effects already passed AttackConditionEvaluator (event-aware).
                // Generic condition validation can incorrectly reject battle-scoped attack conditions
                // (e.g. attackTargetCardType) before currentBattle is opened.
                skipConditionValidation: true,
                ...(attackEffectChainContinuation
                    ? { choiceContext: { attackEffectChainContinuation } }
                    : {})
            }
        );

        if (!result.success) {
            return { success: false, error: result.error };
        }

        if (result.autoApplied && !result.requiresSelection && (result.affectedTargets?.length ?? 0) === 0) {
            return { success: true, consumed: false };
        }

        if (result.requiresSelection) {
            return { success: true, requiresSelection: true };
        }

        return { success: true };
    }

    private static queueRemainingEffectOrResume(
        gameEnv: GameEnvironment,
        attackEvent: PlayerActionEvent,
        remainingEffects: QueuedAttackEffectDefinition[],
        resumeAfterChoiceEventId?: string
    ): void {
        if (remainingEffects.length > 0) {
            const [nextEffect, ...rest] = remainingEffects;
            const nextEvent = EventFactory.createAttackPhaseEffectEvent({
                attackPlayerId: attackEvent.playerId,
                originalAttackEventData: {
                    ...(attackEvent.data || {}),
                    playerId: attackEvent.playerId
                },
                effect: nextEffect,
                remainingEffects: rest,
                attackNotificationId: typeof (attackEvent.data as any)?.attackNotificationId === 'string'
                    ? ((attackEvent.data as any).attackNotificationId as string)
                    : undefined
            });
            gameEnv.enqueueForProcessing(nextEvent);
            return;
        }

        AttackResumeScheduler.enqueueResumeAttack(
            gameEnv,
            attackEvent,
            resumeAfterChoiceEventId
                ? { resumeAfterChoiceEventId }
                : undefined
        );
    }

    private static emitAttackEffectStepResolved(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effectId: string | undefined,
        remainingEffects: number
    ): void {
        new GameNotificationManager(gameEnv).addNotificationEvent(
            'GAME_ENV_REFRESH',
            {
                playerId,
                reason: 'ATTACK_EFFECT_STEP_RESOLVED',
                sourceCarduid,
                effectId: effectId || 'attack_effect',
                remainingEffects,
                timestamp: Date.now()
            },
            'normal'
        );
    }

    private static enqueueInitialAttackEffectOrOrderChoice(
        gameEnv: GameEnvironment,
        attackEvent: PlayerActionEvent,
        effects: QueuedAttackEffectDefinition[]
    ): void {
        const interactiveCandidates = this.collectInteractiveOrderCandidates(gameEnv, attackEvent, effects);
        if (interactiveCandidates.length <= 1 || !this.shouldPromptForAttackEffectOrder(interactiveCandidates.map((entry) => entry.effect))) {
            this.queueChosenAttackEffect(gameEnv, attackEvent, effects, 0);
            return;
        }

        const options = interactiveCandidates.map((entry, optionIndex) => {
            const optionLabel = this.describeAttackEffectOption(gameEnv, attackEvent.playerId, entry.effect);
            const optionAvailability = this.evaluateAttackEffectOptionAvailability(gameEnv, attackEvent, entry.effect);
            return {
                index: optionIndex,
                label: optionLabel,
                payload: { effectOrderIndex: entry.originalIndex },
                ...(optionAvailability.disabled ? { disabled: true, disabledReason: optionAvailability.reason } : {}),
                display: ChoiceDisplayBuilder.text(optionLabel)
            };
        });

        const enabledOptionIndexes = options
            .filter((option) => option.disabled !== true)
            .map((option) => {
                const rawIndex = (option.payload as any)?.effectOrderIndex;
                return typeof rawIndex === 'number' ? rawIndex : option.index;
            });

        if (enabledOptionIndexes.length <= 1) {
            const selectedIndex = enabledOptionIndexes.length === 1 ? enabledOptionIndexes[0] : 0;
            this.queueChosenAttackEffect(gameEnv, attackEvent, effects, selectedIndex);
            return;
        }

        const choiceEffect = ensureEffectDefaults({
            effectId: 'attack_effect_order',
            type: 'internal',
            trigger: 'CHOICE',
            action: 'attack_effect_order'
        } as any);

        const context: AttackEffectOrderContext = {
            kind: 'ATTACK_EFFECT_ORDER',
            attackPlayerId: attackEvent.playerId,
            attackerCarduid: typeof attackEvent.data?.attackerCarduid === 'string' ? attackEvent.data.attackerCarduid : '',
            ...(typeof (attackEvent.data as any)?.attackNotificationId === 'string'
                ? { attackNotificationId: (attackEvent.data as any).attackNotificationId as string }
                : {}),
            originalAttackEventData: {
                ...(attackEvent.data || {}),
                playerId: attackEvent.playerId
            },
            effects: interactiveCandidates.map((entry) => entry.effect),
            allEffects: effects
        };

        ChoiceEventScheduler.enqueueOptionChoice(gameEnv, {
            playerId: attackEvent.playerId,
            sourceCarduid: context.attackerCarduid || effects[0].sourceCarduid,
            effect: choiceEffect,
            headerText: 'Choose Effect Order',
            promptText: 'Select which attack effect resolves first.',
            defaultOptionIndex: 0,
            layoutHint: 'text',
            availableOptions: options,
            context,
            cardPlayNotificationId: typeof (attackEvent.data as any)?.attackNotificationId === 'string'
                ? ((attackEvent.data as any).attackNotificationId as string)
                : undefined
        });
    }

    static queueChosenAttackEffect(
        gameEnv: GameEnvironment,
        attackEvent: PlayerActionEvent,
        allEffects: QueuedAttackEffectDefinition[],
        selectedEffectOrderIndex: number
    ): void {
        const selectedEffect = allEffects[selectedEffectOrderIndex];
        if (!selectedEffect) {
            return;
        }

        const remainingEffects = allEffects.filter((_effect, index) => index !== selectedEffectOrderIndex);
        const queuedEvent = EventFactory.createAttackPhaseEffectEvent({
            attackPlayerId: attackEvent.playerId,
            originalAttackEventData: {
                ...(attackEvent.data || {}),
                playerId: attackEvent.playerId
            },
            effect: selectedEffect,
            remainingEffects,
            attackNotificationId: typeof (attackEvent.data as any)?.attackNotificationId === 'string'
                ? ((attackEvent.data as any).attackNotificationId as string)
                : undefined
        });
        gameEnv.enqueueForProcessing(queuedEvent);
    }

    private static collectInteractiveOrderCandidates(
        gameEnv: GameEnvironment,
        attackEvent: PlayerActionEvent,
        effects: QueuedAttackEffectDefinition[]
    ): Array<{ effect: QueuedAttackEffectDefinition; originalIndex: number }> {
        const candidates: Array<{ effect: QueuedAttackEffectDefinition; originalIndex: number }> = [];
        effects.forEach((effect, originalIndex) => {
            if (this.isAttackEffectInteractiveCandidate(gameEnv, attackEvent, effect)) {
                candidates.push({ effect, originalIndex });
            }
        });
        return candidates;
    }

    private static isAttackEffectInteractiveCandidate(
        gameEnv: GameEnvironment,
        attackEvent: PlayerActionEvent,
        effect: QueuedAttackEffectDefinition
    ): boolean {
        if (!effect) {
            return false;
        }

        if (effect.optional === true) {
            return true;
        }

        if (effect.cost && typeof effect.cost === 'object') {
            if ((effect.cost as any).destroyFriendlyUnit || (effect.cost as any).discardFromHand || (effect.cost as any).moveFromHandToDeckBottom || (effect.cost as any).moveFromTrashToDeck) {
                return true;
            }
        }

        const sourceCarduid = typeof effect.sourceCarduid === 'string' ? effect.sourceCarduid : '';
        if (!sourceCarduid) {
            return false;
        }

        const preview = this.previewAttackEffectResolution(gameEnv, attackEvent.playerId, sourceCarduid, effect);
        if (!preview.availableTargets || preview.availableTargets.length === 0) {
            return false;
        }

        return TargetChoicePolicy.requiresChoice(preview.targetConfig, preview.availableTargets, effect);
    }

    private static shouldPromptForAttackEffectOrder(
        effects: QueuedAttackEffectDefinition[]
    ): boolean {
        return Array.isArray(effects) && effects.length > 1;
    }

    private static describeAttackEffectOption(
        gameEnv: GameEnvironment,
        playerId: string,
        effect: QueuedAttackEffectDefinition
    ): string {
        const effectId = typeof effect.effectId === 'string' && effect.effectId.length > 0 ? effect.effectId : 'attack_effect';
        const action = typeof effect.action === 'string' && effect.action.length > 0 ? effect.action : 'effect';
        const sourceCarduid = typeof effect.sourceCarduid === 'string' ? effect.sourceCarduid : '';
        const sourceCard = sourceCarduid ? SlotZoneUtils.getCardByUid(gameEnv, sourceCarduid) as UnitZoneCard | PilotZoneCard | null : null;
        const sourceName = typeof sourceCard?.cardData?.name === 'string' && sourceCard.cardData.name.length > 0
            ? sourceCard.cardData.name
            : '';
        const prefix = sourceName ? `${sourceName}: ` : '';
        return `${prefix}${effectId} (${action})`;
    }

    private static evaluateAttackEffectOptionAvailability(
        gameEnv: GameEnvironment,
        attackEvent: PlayerActionEvent,
        effect: QueuedAttackEffectDefinition
    ): { disabled: boolean; reason?: string } {
        const sourceCarduid = typeof effect.sourceCarduid === 'string' ? effect.sourceCarduid : '';
        if (!sourceCarduid) {
            return { disabled: true, reason: 'Missing source card' };
        }

        const sourceCard = SlotZoneUtils.getCardByUid(gameEnv, sourceCarduid) as UnitZoneCard | PilotZoneCard | null;
        if (!sourceCard) {
            return { disabled: true, reason: 'Source card is no longer in play' };
        }

        if (!this.sourceConditionsSatisfied(effect, sourceCard, gameEnv, attackEvent.playerId)) {
            return { disabled: true, reason: 'Source condition not met' };
        }

        const sourceLookup = SlotZoneUtils.findSlotByCarduid(gameEnv.players[attackEvent.playerId]?.zones, sourceCard.carduid);
        const sourceSlot = sourceLookup?.slotName
            ? SlotZoneUtils.getSlotZone(gameEnv.players[attackEvent.playerId].zones, sourceLookup.slotName)?.slot
            : undefined;

        if (!AttackConditionEvaluator.conditionsSatisfied(effect, {
            gameEnv,
            playerId: attackEvent.playerId,
            attackEvent,
            sourceSlot: sourceSlot as any,
            sourceCard
        })) {
            return { disabled: true, reason: 'Attack condition not met' };
        }

        if (!this.restrictionsAllowUse(effect, sourceCard, gameEnv.currentTurn)) {
            return { disabled: true, reason: 'Effect already used this turn' };
        }

        const costAvailability = this.evaluateAttackCostAvailability(gameEnv, attackEvent.playerId, sourceCarduid, effect);
        if (costAvailability.disabled) {
            return costAvailability;
        }

        const action = EffectExecutor.getEffectAction(effect);
        if (!EffectExecutor.actionSupportsNoTargets(action)) {
            const preview = DeployTargetManager.evaluateImmediateResolution(
                gameEnv,
                attackEvent.playerId,
                sourceCarduid,
                effect
            );

            if (preview.noOpNoTargets) {
                return { disabled: true, reason: 'No legal targets' };
            }
        }

        return { disabled: false };
    }

    private static evaluateAttackCostAvailability(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: QueuedAttackEffectDefinition
    ): { disabled: boolean; reason?: string } {
        if (!effect.cost || typeof effect.cost !== 'object') {
            return { disabled: false };
        }

        if ((effect.cost as any).destroyFriendlyUnit) {
            const costConfig = (effect.cost as any).destroyFriendlyUnit;
            const costEffect = ensureEffectDefaults({
                effectId: `${effect.effectId || effect.action || 'effect'}_cost_destroyFriendlyUnit_preview`,
                type: 'internal',
                trigger: 'COST',
                optional: true,
                action: 'destroy',
                target: {
                    ...(costConfig.target || {}),
                    selection: { type: 'player_choice' }
                },
                parameters: {
                    excludeSource: costConfig.excludeSource === true
                }
            } as any);
            const preview = this.previewAttackEffectResolution(gameEnv, playerId, sourceCarduid, costEffect);
            return preview.availableTargets.length === 0
                ? { disabled: true, reason: 'No valid unit available to pay the destroy cost' }
                : { disabled: false };
        }

        if ((effect.cost as any).discardFromHand) {
            const rawCost = (effect.cost as any).discardFromHand;
            const count = typeof rawCost === 'number' ? rawCost : (typeof rawCost?.count === 'number' ? rawCost.count : 1);
            const costEffect = ensureEffectDefaults({
                effectId: `${effect.effectId || effect.action || 'effect'}_cost_discardFromHand_preview`,
                type: 'internal',
                trigger: 'COST',
                optional: effect.optional === true,
                action: 'discardFromHand',
                target: {
                    type: 'card',
                    scope: typeof rawCost?.scope === 'string' ? rawCost.scope : 'self_hand',
                    count,
                    filters: {
                        ...(typeof rawCost?.cardType === 'string' ? { cardType: rawCost.cardType } : {}),
                        ...(Array.isArray(rawCost?.traitsAny) ? { traitsAny: rawCost.traitsAny } : {})
                    },
                    selection: { type: 'player_choice' }
                }
            } as any);
            const preview = this.previewAttackEffectResolution(gameEnv, playerId, sourceCarduid, costEffect);
            return preview.availableTargets.length < count
                ? { disabled: true, reason: 'Not enough cards in hand to pay the discard cost' }
                : { disabled: false };
        }

        if ((effect.cost as any).moveFromHandToDeckBottom) {
            const rawCost = (effect.cost as any).moveFromHandToDeckBottom;
            const count = typeof rawCost?.count === 'number' ? rawCost.count : 1;
            const costEffect = ensureEffectDefaults({
                effectId: `${effect.effectId || effect.action || 'effect'}_cost_moveFromHandToDeckBottom_preview`,
                type: 'internal',
                trigger: 'COST',
                optional: true,
                action: 'moveFromHandToDeckBottom',
                target: {
                    type: 'card',
                    scope: typeof rawCost?.scope === 'string' ? rawCost.scope : 'self_hand',
                    count,
                    filters: typeof rawCost?.filters === 'object' && rawCost.filters ? rawCost.filters : {},
                    selection: { type: 'player_choice' }
                }
            } as any);
            const preview = this.previewAttackEffectResolution(gameEnv, playerId, sourceCarduid, costEffect);
            return preview.availableTargets.length < count
                ? { disabled: true, reason: 'Not enough cards in hand to pay the deck-bottom cost' }
                : { disabled: false };
        }

        if ((effect.cost as any).moveFromTrashToDeck) {
            const rawCost = (effect.cost as any).moveFromTrashToDeck;
            const count = typeof rawCost?.count === 'number' ? rawCost.count : 0;
            const costEffect = ensureEffectDefaults({
                effectId: `${effect.effectId || effect.action || 'effect'}_cost_moveFromTrashToDeck_preview`,
                type: 'internal',
                trigger: 'COST',
                optional: effect.optional === true,
                action: 'moveFromTrashToDeck',
                target: {
                    type: 'card',
                    scope: typeof rawCost?.scope === 'string' ? rawCost.scope : 'self_trash',
                    count,
                    selection: { type: 'player_choice' }
                }
            } as any);
            const preview = this.previewAttackEffectResolution(gameEnv, playerId, sourceCarduid, costEffect);
            return preview.availableTargets.length < count
                ? { disabled: true, reason: 'Not enough cards in trash to pay the deck-return cost' }
                : { disabled: false };
        }

        return { disabled: false };
    }

    private static previewAttackEffectResolution(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition
    ): {
        targetConfig: ReturnType<typeof TargetResolver.resolveTargetConfig>;
        availableTargets: ReturnType<typeof TargetResolver.generateAvailableTargets>;
    } {
        const normalizedEffect = ensureEffectDefaults(effect);
        const targetConfig = TargetResolver.resolveTargetConfig(normalizedEffect);
        let availableTargets = TargetResolver.generateAvailableTargets(
            gameEnv,
            playerId,
            targetConfig,
            sourceCarduid
        );
        availableTargets = TargetSelectionPipeline.apply(gameEnv, availableTargets, normalizedEffect, sourceCarduid);
        return { targetConfig, availableTargets };
    }
}
