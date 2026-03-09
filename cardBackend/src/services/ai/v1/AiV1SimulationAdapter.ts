import { GamePhase, PlayerActionType } from '../../../models/GameEnums';
import type { PlayerAction } from '../../../models/EventInterfaces';
import { GameEnvironment } from '../../../models/GameEnvironment';
import { processAction } from '../../actions/ActionProcessor';
import { BattlePhaseManager } from '../../BattlePhaseManager';
import { ChoiceConfirmationService } from '../../choices/ChoiceConfirmationService';
import type { BlockerChoiceEvent, BurstEffectChoiceEvent } from '../../EventQueue/interfaces/GameEvent';
import { SlotHealthService } from '../../health/SlotHealthService';
import { GameEnvViewBuilder } from '../../views/GameEnvViewBuilder';
import type { AiActionCandidate, AiDecisionContext, AiSimulationAdapter, AiSimulationResult } from './AiV1Types';
import { GameEnvAiActionAdapter } from './AiV1CandidateEnumerator';
import { GameEnvAiContextAdapter } from './AiV1ContextAdapter';
import { evaluateBoardState, scoreAiCandidates } from './AiV1TacticalScorer';
import { markBurstChoiceNotificationCompleted } from '../../notifications/BurstChoiceNotificationUpdater';

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

const asTargetSelections = (value: unknown): Array<{ carduid: string; zone: string; playerId: string }> => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((entry) => asRecord(entry))
        .map((entry) => ({
            carduid: typeof entry.carduid === 'string' ? entry.carduid : '',
            zone: typeof entry.zone === 'string' ? entry.zone : '',
            playerId: typeof entry.playerId === 'string' ? entry.playerId : ''
        }))
        .filter((entry) => Boolean(entry.carduid && entry.zone && entry.playerId));
};

const isPromptDecisionKind = (kind: string): boolean => [
    'confirmBurstChoice',
    'confirmTargetChoice',
    'confirmBlockerChoice',
    'confirmTokenChoice',
    'confirmOptionChoice'
].includes(kind);

const getPromptChainKey = (context: AiDecisionContext): string => {
    const prompt = context.activePrompt;
    if (!prompt) {
        return 'none';
    }
    const queueHead = context.rawGameEnv?.processingQueue?.[0];
    const queueHeadId = typeof queueHead?.id === 'string' ? queueHead.id : '';
    return [
        prompt.type,
        prompt.eventId,
        queueHeadId,
        context.rawGameEnv?.processingQueue?.length ?? 0
    ].join(':');
};

const toSimulationAction = (context: AiDecisionContext, candidate: AiActionCandidate, clone: GameEnvironment): PlayerAction | null => {
    switch (candidate.decision.kind) {
        case 'playCard': {
            const action = asRecord(candidate.decision.payload?.action);
            return {
                type: PlayerActionType.PLAY_CARD,
                playerId: context.aiPlayerId,
                gameId: '__ai_simulation__',
                carduid: typeof action.carduid === 'string' ? action.carduid : '',
                playAs: typeof action.playAs === 'string' ? action.playAs : undefined,
                targetUnit: typeof action.targetUnit === 'string' ? action.targetUnit : undefined,
                replaceSlot: typeof action.replaceSlot === 'string' ? action.replaceSlot : undefined
            };
        }
        case 'playerAction':
            return {
                type: PlayerActionType.PLAYER_ACTION,
                playerId: context.aiPlayerId,
                gameId: '__ai_simulation__',
                ...asRecord(candidate.decision.payload)
            };
        case 'endTurn':
            return {
                type: PlayerActionType.END_TURN,
                playerId: context.aiPlayerId,
                gameId: '__ai_simulation__',
                currentTurn: clone.currentTurn
            };
        default:
            return null;
    }
};

const collectRemainingHp = (gameEnv: GameEnvironment): Record<string, number> => {
    const remainingHpByCarduid: Record<string, number> = {};
    for (const player of Object.values(gameEnv.players || {})) {
        const zones = asRecord(player?.zones);
        for (const slotName of ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']) {
            const slot = asRecord(zones[slotName]);
            const unit = asRecord(slot.unit);
            const carduid = typeof unit.carduid === 'string' ? unit.carduid : '';
            if (!carduid) {
                continue;
            }
            const slotHealth = SlotHealthService.getSlotRemainingHp(gameEnv, carduid);
            if (typeof slotHealth === 'number') {
                remainingHpByCarduid[carduid] = slotHealth;
                continue;
            }
            const totalHp = Number(unit.originalHP ?? asRecord(unit.cardData).hp ?? 0);
            const damage = Number(unit.damageReceived ?? 0);
            remainingHpByCarduid[carduid] = Math.max(0, totalHp - damage);
        }
    }
    return remainingHpByCarduid;
};

export class AiLocalSimulationAdapter implements AiSimulationAdapter {
    private readonly contextAdapter = new GameEnvAiContextAdapter();
    private readonly actionAdapter = new GameEnvAiActionAdapter();

    private buildInMemoryPersistence(clone: GameEnvironment) {
        return {
            loadGameFromFile: async () => clone,
            saveGameToFile: async () => undefined
        };
    }

    private async executePromptDecision(
        clone: GameEnvironment,
        aiPlayerId: string,
        decision: AiActionCandidate['decision']
    ): Promise<boolean> {
        const payload = asRecord(decision.payload);
        const eventId = typeof payload.eventId === 'string' ? payload.eventId : '';
        if (!eventId) {
            return false;
        }

        const persistence = this.buildInMemoryPersistence(clone);
        let result: { success: boolean } | null = null;

        switch (decision.kind) {
            case 'confirmBurstChoice':
                return this.confirmBurstChoice(
                    clone,
                    aiPlayerId,
                    eventId,
                    Boolean(payload.confirmed)
                );
            case 'confirmTargetChoice':
                result = await ChoiceConfirmationService.confirmTargetChoice(
                    persistence,
                    '__ai_simulation__',
                    aiPlayerId,
                    eventId,
                    asTargetSelections(payload.selectedTargets)
                );
                break;
            case 'confirmBlockerChoice':
                return this.confirmBlockerChoice(
                    clone,
                    aiPlayerId,
                    eventId,
                    asTargetSelections(payload.selectedTargets)
                );
            case 'confirmTokenChoice':
                result = await ChoiceConfirmationService.confirmTokenChoice(
                    persistence,
                    '__ai_simulation__',
                    aiPlayerId,
                    eventId,
                    Number(payload.selectedChoiceIndex ?? 0)
                );
                break;
            case 'confirmOptionChoice':
                result = await ChoiceConfirmationService.confirmOptionChoice(
                    persistence,
                    '__ai_simulation__',
                    aiPlayerId,
                    eventId,
                    Number(payload.selectedOptionIndex ?? 0)
                );
                break;
            default:
                return false;
        }

        return Boolean(result?.success);
    }

    private async processChoiceQueue(clone: GameEnvironment): Promise<boolean> {
        const processingResult = await clone.processEvents();
        if (!processingResult.success) {
            return false;
        }

        if (
            clone.processingQueue.length === 0 &&
            clone.currentBattle?.status === 'ACTION_STEP' &&
            clone.haveBothPlayersConfirmedBattle()
        ) {
            const attackerId = clone.currentBattle.attackingPlayerId;
            if (attackerId) {
                const battleResult = BattlePhaseManager.resolveBattle(clone, attackerId);
                if (!battleResult.success) {
                    return false;
                }

                const postBattleProcessing = await clone.processEvents();
                if (!postBattleProcessing.success) {
                    return false;
                }
            }
        }

        return true;
    }

    private async confirmBurstChoice(
        clone: GameEnvironment,
        aiPlayerId: string,
        eventId: string,
        confirmed: boolean
    ): Promise<boolean> {
        const event = clone.processingQueue.find((entry: any) => entry?.id === eventId) as BurstEffectChoiceEvent | undefined;
        if (!event || event.type !== 'BURST_EFFECT_CHOICE' || event.playerId !== aiPlayerId) {
            return false;
        }

        event.data.userDecisionMade = true;
        event.data.userDecision = confirmed ? 'ACTIVATE' : 'DECLINE';

        const removed = clone.dequeueFromProcessing(event);
        if (removed) {
            clone.processingQueue.unshift(event);
        }

        const success = await this.processChoiceQueue(clone);
        if (!success) {
            return false;
        }

        markBurstChoiceNotificationCompleted(clone, {
            burstEventId: eventId,
            userDecision: confirmed ? 'ACTIVATE' : 'DECLINE'
        });
        return true;
    }

    private markBlockerChoiceNotificationCompleted(
        clone: GameEnvironment,
        eventId: string,
        resolvedTarget?: { carduid: string; zone: string; playerId: string }
    ): void {
        const blockerNotification = clone.notificationQueue?.find(
            (entry: any) => entry?.id === eventId && entry?.type === 'BLOCKER_CHOICE'
        );
        if (!blockerNotification?.payload?.event) {
            return;
        }

        blockerNotification.payload.event.status = 'RESOLVED';
        blockerNotification.payload.event.data = blockerNotification.payload.event.data || {};
        blockerNotification.payload.event.data.userDecisionMade = true;
        blockerNotification.payload.event.data.selectedTarget = resolvedTarget;
        blockerNotification.payload.event.data.userDecision = resolvedTarget ? 'BLOCK' : 'DECLINE';
        blockerNotification.payload.isCompleted = true;
    }

    private async confirmBlockerChoice(
        clone: GameEnvironment,
        aiPlayerId: string,
        eventId: string,
        selectedTargets: Array<{ carduid: string; zone: string; playerId: string }>
    ): Promise<boolean> {
        const event = clone.processingQueue.find((entry: any) => entry?.id === eventId) as BlockerChoiceEvent | undefined;
        if (!event || event.type !== 'BLOCKER_CHOICE') {
            return false;
        }
        if (event.playerId && event.playerId !== aiPlayerId && event.data?.blockingPlayerId !== aiPlayerId) {
            return false;
        }

        const availableTargets = Array.isArray(event.data?.availableTargets) ? event.data.availableTargets : [];
        let resolvedTarget: { carduid: string; zone: string; playerId: string } | undefined;
        const chosenTarget = selectedTargets[0];
        if (chosenTarget) {
            const isValidTarget = availableTargets.some((target: any) =>
                target?.carduid === chosenTarget.carduid
                && target?.zone === chosenTarget.zone
                && target?.playerId === chosenTarget.playerId
            );
            if (!isValidTarget) {
                return false;
            }
            resolvedTarget = {
                carduid: chosenTarget.carduid,
                zone: chosenTarget.zone,
                playerId: chosenTarget.playerId
            };
        }

        event.data.selectedTarget = resolvedTarget;
        event.data.userDecisionMade = true;
        event.data.userDecision = resolvedTarget ? 'BLOCK' : 'DECLINE';

        const removed = clone.dequeueFromProcessing(event);
        if (removed) {
            clone.processingQueue.unshift(event);
        }

        const success = await this.processChoiceQueue(clone);
        if (!success) {
            return false;
        }

        this.markBlockerChoiceNotificationCompleted(clone, eventId, resolvedTarget);
        return true;
    }

    private pickPlannedTargetDecision(
        candidate: AiActionCandidate,
        promptContext: AiDecisionContext
    ): AiActionCandidate['decision'] | null {
        const prompt = promptContext.activePrompt;
        if (!prompt || prompt.type !== 'TARGET_CHOICE') {
            return null;
        }

        const plannedTargets = asTargetSelections(candidate.telemetry?.selectedTargets);
        if (plannedTargets.length === 0) {
            return null;
        }

        const matchedTargets = plannedTargets
            .map((plannedTarget) =>
                prompt.availableTargets.find((availableTarget) =>
                    availableTarget.carduid === plannedTarget.carduid
                    && availableTarget.zone === plannedTarget.zone
                    && availableTarget.playerId === plannedTarget.playerId
                )
            )
            .filter((target): target is NonNullable<typeof target> => Boolean(target));

        if (matchedTargets.length === 0) {
            return null;
        }

        return {
            kind: 'confirmTargetChoice',
            reason: 'v1_simulation_target_choice',
            payload: {
                eventId: prompt.eventId,
                selectedTargets: matchedTargets
            }
        };
    }

    private async resolveFollowUpPrompts(
        baseContext: AiDecisionContext,
        candidate: AiActionCandidate,
        clone: GameEnvironment
    ): Promise<{ success: boolean; reason?: string }> {
        let usePlannedTargetSelection = true;
        const seenPromptStates = new Set<string>();

        for (let index = 0; index < 8; index += 1) {
            const promptView = GameEnvViewBuilder.toPlayerView(clone, baseContext.aiPlayerId);
            const promptContext = this.contextAdapter.buildContext(promptView as never, baseContext.aiPlayerId, clone);
            if (promptContext.windowKind !== 'OWNED_PROMPT' || !promptContext.activePrompt) {
                return { success: true };
            }

            const promptChainKey = getPromptChainKey(promptContext);
            if (seenPromptStates.has(promptChainKey)) {
                return {
                    success: false,
                    reason: `stalled_follow_up_prompt:${promptContext.activePrompt.type}:${promptContext.activePrompt.eventId}`
                };
            }
            seenPromptStates.add(promptChainKey);

            const plannedDecision = usePlannedTargetSelection
                ? this.pickPlannedTargetDecision(candidate, promptContext)
                : null;
            const promptCandidates = this.actionAdapter.enumerateCandidates(promptContext);
            const scoredPromptCandidates = promptCandidates.length > 0
                ? scoreAiCandidates(promptContext, promptCandidates)
                : [];
            const promptDecision = plannedDecision || scoredPromptCandidates[0]?.decision || null;

            if (!promptDecision) {
                return {
                    success: false,
                    reason: `no_follow_up_prompt_decision:${promptContext.activePrompt.type}:${promptContext.activePrompt.eventId}`
                };
            }

            const success = await this.executePromptDecision(clone, baseContext.aiPlayerId, promptDecision);
            if (plannedDecision) {
                usePlannedTargetSelection = false;
            }
            if (!success) {
                return {
                    success: false,
                    reason: `follow_up_prompt_failed:${promptDecision.kind}:${promptContext.activePrompt.eventId}`
                };
            }
        }

        return { success: false, reason: 'follow_up_prompt_limit_reached' };
    }

    async simulateCandidate(context: AiDecisionContext, candidate: AiActionCandidate): Promise<AiSimulationResult | null> {
        if (!candidate.requiresSimulation || !context.rawGameEnv) {
            return null;
        }

        const clone = GameEnvironment.fromJSON(context.rawGameEnv.toPersistenceJSON());
        const isPromptDecision = isPromptDecisionKind(candidate.decision.kind);
        const action = isPromptDecision ? null : toSimulationAction(context, candidate, clone);
        if (!action && !isPromptDecision) {
            return null;
        }

        const beforeView = GameEnvViewBuilder.toPlayerView(clone, context.aiPlayerId);
        const beforeContext = this.contextAdapter.buildContext(beforeView as never, context.aiPlayerId, clone);
        const beforeScore = evaluateBoardState(beforeContext);
        const beforeRemainingHp = collectRemainingHp(clone);
        const beforeCarduids = new Set(Object.keys(beforeRemainingHp));

        if (action) {
            const result = await processAction(clone, action);
            if (!result?.success) {
                return {
                    supported: true,
                    success: false,
                    totalScore: -80,
                    reason: 'simulation_failed',
                    summary: String(result?.error || 'simulation_failed'),
                    destroyedCarduids: [],
                    remainingHpByCarduid: beforeRemainingHp,
                    hpDeltas: {}
                };
            }
        } else {
            const success = await this.executePromptDecision(clone, context.aiPlayerId, candidate.decision);
            if (!success) {
                return {
                    supported: true,
                    success: false,
                    totalScore: -80,
                    reason: 'simulation_failed',
                    summary: 'prompt_simulation_failed',
                    destroyedCarduids: [],
                    remainingHpByCarduid: beforeRemainingHp,
                    hpDeltas: {}
                };
            }
        }

        const followUpPromptResult = await this.resolveFollowUpPrompts(context, candidate, clone);
        if (!followUpPromptResult.success) {
            return {
                supported: true,
                success: false,
                totalScore: -70,
                reason: 'simulation_failed',
                summary: followUpPromptResult.reason || 'follow_up_prompt_failed',
                destroyedCarduids: [],
                remainingHpByCarduid: beforeRemainingHp,
                hpDeltas: {}
            };
        }

        if (candidate.decision.kind === 'endTurn' && clone.phase === GamePhase.END_PHASE) {
            clone.phase = GamePhase.MAIN_PHASE;
        }

        const afterView = GameEnvViewBuilder.toPlayerView(clone, context.aiPlayerId);
        const afterContext = this.contextAdapter.buildContext(afterView as never, context.aiPlayerId, clone);
        const afterScore = evaluateBoardState(afterContext);
        const afterRemainingHp = collectRemainingHp(clone);
        const afterCarduids = new Set(Object.keys(afterRemainingHp));
        const destroyedCarduids = Array.from(beforeCarduids).filter((carduid) => !afterCarduids.has(carduid));

        const hpDeltas: Record<string, number> = {};
        for (const [carduid, remainingHp] of Object.entries(afterRemainingHp)) {
            hpDeltas[carduid] = remainingHp - (beforeRemainingHp[carduid] ?? remainingHp);
        }

        return {
            supported: true,
            success: true,
            totalScore: afterScore - beforeScore,
            reason: 'simulation_complete',
            summary: `delta=${Math.round(afterScore - beforeScore)} destroyed=${destroyedCarduids.length}`,
            destroyedCarduids,
            remainingHpByCarduid: afterRemainingHp,
            hpDeltas
        };
    }
}
