import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { TargetReference } from '../../EventQueue/interfaces/GameEvent';
import type { AiDecision } from '../AiTypes';
import type {
    AiGameEnvView,
    AiNotificationEvent,
    AiQueueEvent,
    AiSlotName,
    AiSlotView
} from '../AiViewTypes';

export type AiWindowKind =
    | 'SETUP'
    | 'OWNED_PROMPT'
    | 'BLOCKER_STEP'
    | 'ACTION_STEP'
    | 'BATTLE_RESOLVE'
    | 'MAIN_PHASE'
    | 'WAIT';

export type AiActionCandidateKind =
    | 'setup'
    | 'prompt'
    | 'attack'
    | 'playCard'
    | 'activate'
    | 'battleConfirm'
    | 'battleResolve'
    | 'endTurn'
    | 'wait';

export type AiActionCandidateTag =
    | 'lethal_on_target'
    | 'survives_trade'
    | 'dies_on_crackback'
    | 'heals_key_unit'
    | 'sets_up_kill_threshold'
    | 'fails_to_kill';

export interface AiHpSnapshot {
    totalHp: number;
    damageReceived: number;
    remainingHp: number;
    lethalDamageThreshold: number;
    isDestroyed: boolean;
}

export interface AiSlotCombatSnapshot {
    playerId: string;
    slotName: AiSlotName;
    slot: AiSlotView;
    carduid: string;
    name: string;
    ap: number;
    isRested: boolean;
    canAttack: boolean;
    canAttackPlayer: boolean;
    canAttackActiveUnit: boolean;
    hp: AiHpSnapshot;
    keywords: string[];
    valueScore: number;
}

export interface AiSideSummary {
    playerId: string;
    shieldCount: number;
    handCount: number;
    availableEnergy: number;
    totalEnergy: number;
    trashCount: number;
    hasBase: boolean;
    readyAttackers: number;
    totalBoardAp: number;
    totalBoardHp: number;
    units: AiSlotCombatSnapshot[];
    damagedUnits: AiSlotCombatSnapshot[];
    blockers: AiSlotCombatSnapshot[];
}

export interface AiBattleSnapshot {
    status: string;
    actionType: string;
    attackingPlayerId: string | null;
    defendingPlayerId: string | null;
    attackerCarduid: string | null;
    targetCarduid: string | null;
    aiParticipant: boolean;
    aiConfirmed: boolean;
    opponentConfirmed: boolean;
    bothConfirmed: boolean;
    attacker: AiSlotCombatSnapshot | null;
    defender: AiSlotCombatSnapshot | null;
    actionTargetsCount: number;
}

export interface AiOwnedPromptSnapshot {
    eventId: string;
    type: string;
    ownerPlayerId: string;
    allowsDecline: boolean;
    isCompleted: boolean;
    effectAction?: string;
    defaultOptionIndex?: number;
    availableTargets: TargetReference[];
    availableChoices: Array<Record<string, unknown>>;
    availableOptions: Array<Record<string, unknown>>;
    contextKind?: string;
    rawEvent: AiQueueEvent | null;
    rawNotification: AiNotificationEvent | null;
}

export interface AiDecisionContext {
    aiPlayerId: string;
    opponentId: string | null;
    phase: string;
    currentTurn: number;
    currentPlayerId: string | null;
    windowKind: AiWindowKind;
    gameEnvView: AiGameEnvView;
    rawGameEnv?: GameEnvironment;
    self: AiSideSummary;
    opponent: AiSideSummary;
    battle: AiBattleSnapshot | null;
    activePrompts: AiOwnedPromptSnapshot[];
    activePrompt: AiOwnedPromptSnapshot | null;
}

export interface AiActionCandidate {
    candidateId: string;
    kind: AiActionCandidateKind;
    decision: AiDecision;
    windowKind: AiWindowKind;
    estimatedScore: number;
    tags: AiActionCandidateTag[];
    sourceCarduid?: string;
    targetCarduid?: string;
    requiresSimulation?: boolean;
    telemetry?: Record<string, unknown>;
    tacticalScore?: number;
    simulationScore?: number;
    totalScore?: number;
}

export interface AiSimulationResult {
    supported: boolean;
    success: boolean;
    totalScore: number;
    reason: string;
    summary: string;
    destroyedCarduids: string[];
    remainingHpByCarduid: Record<string, number>;
    hpDeltas: Record<string, number>;
}

export interface AiContextAdapter {
    buildContext(gameEnvView: AiGameEnvView, aiPlayerId: string, rawGameEnv?: GameEnvironment): AiDecisionContext;
}

export interface AiActionAdapter {
    enumerateCandidates(context: AiDecisionContext): AiActionCandidate[];
}

export interface AiSimulationAdapter {
    simulateCandidate(context: AiDecisionContext, candidate: AiActionCandidate): Promise<AiSimulationResult | null>;
}
