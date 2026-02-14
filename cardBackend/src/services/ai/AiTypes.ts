export type AiDecisionKind =
    | 'wait'
    | 'chooseFirstPlayer'
    | 'startReady'
    | 'playCard'
    | 'playerAction'
    | 'endTurn'
    | 'confirmBurstChoice'
    | 'confirmTargetChoice'
    | 'confirmBlockerChoice'
    | 'confirmTokenChoice'
    | 'confirmOptionChoice';

export interface AiDecision {
    kind: AiDecisionKind;
    reason: string;
    payload?: Record<string, unknown>;
}

export const SLOT_NAMES = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];

export const CHOICE_EVENT_TYPES = new Set([
    'BURST_EFFECT_CHOICE',
    'TARGET_CHOICE',
    'BLOCKER_CHOICE',
    'TOKEN_CHOICE',
    'OPTION_CHOICE',
    'PROMPT_CHOICE'
]);
