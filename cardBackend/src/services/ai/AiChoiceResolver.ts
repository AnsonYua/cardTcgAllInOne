import type { AiDecision } from './AiTypes';
import { CHOICE_EVENT_TYPES } from './AiTypes';
import { extractTargetCount, scoreTargetForAction } from './AiTargetUtils';
import type { AiGameEnvView, AiQueueEvent } from './AiViewTypes';
import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';

type QueueEventData = {
    availableTargets?: unknown[];
    availableChoices?: Array<{ index?: number }>;
    availableOptions?: Array<{ index?: number }>;
    defaultOptionIndex?: number;
    effect?: EffectDefinition;
    context?: { kind?: string };
};

const asQueueData = (event: AiQueueEvent): QueueEventData =>
    (event?.data && typeof event.data === 'object' && !Array.isArray(event.data))
        ? (event.data as QueueEventData)
        : {};

const asTargetReferenceList = (raw: unknown): TargetReference[] => {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw
        .map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
        .map((entry) => ({
            carduid: typeof entry.carduid === 'string' ? entry.carduid : '',
            zone: typeof entry.zone === 'string' ? entry.zone : '',
            playerId: typeof entry.playerId === 'string' ? entry.playerId : '',
            cardData: (entry.cardData && typeof entry.cardData === 'object')
                ? (entry.cardData as Record<string, unknown>)
                : undefined
        }))
        .filter((entry) => Boolean(entry.carduid && entry.zone && entry.playerId));
};

export function decideChoiceIfPending(gameEnvView: AiGameEnvView, aiPlayerId: string): AiDecision | null {
    const queue = Array.isArray(gameEnvView?.processingQueue) ? gameEnvView.processingQueue : [];
    const pendingChoices = queue.filter((event) =>
        event?.status === 'DECLARED'
        && typeof event?.type === 'string'
        && CHOICE_EVENT_TYPES.has(event.type)
        && event?.playerId === aiPlayerId
    );
    if (pendingChoices.length === 0) {
        return null;
    }
    const forcedChoice = pendingChoices.find((event) => asQueueData(event)?.context?.kind === 'FORCED_ATTACK_TARGET');
    const head = forcedChoice || pendingChoices[0];
    const data = asQueueData(head);
    const eventId = typeof head.id === 'string' ? head.id : '';

    if (head.type === 'BURST_EFFECT_CHOICE') {
        return {
            kind: 'confirmBurstChoice',
            reason: 'resolve_burst_choice',
            payload: {
                eventId,
                confirmed: true
            }
        };
    }

    if (head.type === 'TARGET_CHOICE') {
        const availableTargets = asTargetReferenceList(data.availableTargets);
        const effect = data?.effect;
        const count = extractTargetCount(effect?.target?.count);
        const rankedTargets = availableTargets
            .map((target) => ({
                target,
                score: scoreTargetForAction(
                    gameEnvView,
                    target,
                    effect || {},
                    effect?.target?.scope
                )
            }))
            .sort((left, right) => right.score - left.score);
        const optional = effect?.optional === true;
        const shouldDeclineOptional = optional && rankedTargets.length > 0 && rankedTargets[0].score <= 0;
        const selectedTargets = shouldDeclineOptional
            ? []
            : rankedTargets.slice(0, count).map((entry) => entry.target);
        return {
            kind: 'confirmTargetChoice',
            reason: 'resolve_target_choice',
            payload: {
                eventId,
                selectedTargets
            }
        };
    }

    if (head.type === 'BLOCKER_CHOICE') {
        const availableTargets = Array.isArray(data.availableTargets) ? data.availableTargets : [];
        const selected = availableTargets.length > 0 ? [availableTargets[0]] : [];
        return {
            kind: 'confirmBlockerChoice',
            reason: 'resolve_blocker_choice',
            payload: {
                eventId,
                selectedTargets: selected
            }
        };
    }

    if (head.type === 'TOKEN_CHOICE') {
        const availableChoices = Array.isArray(data.availableChoices) ? data.availableChoices : [];
        const selectedChoiceIndex = availableChoices[0]?.index ?? 0;
        return {
            kind: 'confirmTokenChoice',
            reason: 'resolve_token_choice',
            payload: {
                eventId,
                selectedChoiceIndex
            }
        };
    }

    if (head.type === 'OPTION_CHOICE' || head.type === 'PROMPT_CHOICE') {
        const availableOptions = Array.isArray(data.availableOptions) ? data.availableOptions : [];
        const selectedOptionIndex = typeof data.defaultOptionIndex === 'number'
            ? data.defaultOptionIndex
            : (availableOptions[0]?.index ?? 0);
        return {
            kind: 'confirmOptionChoice',
            reason: 'resolve_option_choice',
            payload: {
                eventId,
                selectedOptionIndex
            }
        };
    }

    return null;
}
