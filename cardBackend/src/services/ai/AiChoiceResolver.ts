import type { AiDecision } from './AiTypes';
import { CHOICE_EVENT_TYPES } from './AiTypes';
import { extractTargetCount } from './AiTargetUtils';

export function decideChoiceIfPending(gameEnvView: any, aiPlayerId: string): AiDecision | null {
    const queue = Array.isArray(gameEnvView?.processingQueue) ? gameEnvView.processingQueue : [];
    const pendingChoices = queue.filter((event: any) =>
        event?.status === 'DECLARED'
        && CHOICE_EVENT_TYPES.has(event?.type)
        && event?.playerId === aiPlayerId
    );
    if (pendingChoices.length === 0) {
        return null;
    }
    const forcedChoice = pendingChoices.find((event: any) => event?.data?.context?.kind === 'FORCED_ATTACK_TARGET');
    const head = forcedChoice || pendingChoices[0];
    const data = head.data || {};
    const eventId = head.id;

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
        const availableTargets = Array.isArray(data.availableTargets) ? data.availableTargets : [];
        const count = extractTargetCount(data?.effect?.target?.count);
        return {
            kind: 'confirmTargetChoice',
            reason: 'resolve_target_choice',
            payload: {
                eventId,
                selectedTargets: availableTargets.slice(0, count)
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
