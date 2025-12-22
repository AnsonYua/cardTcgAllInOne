// src/models/BattleContext.ts
// Runtime battle context tracking for action-step abilities and delayed resolution

export interface ForcedTargetSummary {
    carduid: string;
    zone?: string;
    playerId?: string;
}

export interface ActionStepTargetSummary {
    carduid: string;
    cardId?: string;
    cardName?: string;
    cardType?: string;
    location: string;
    zoneType: 'hand' | 'unit' | 'pilot' | 'base';
    effectIds: string[];
}

export type BattleActionType = 'attackUnit' | 'attackShieldArea';
export type BattleStatus = 'ACTION_STEP' | 'RESOLVING';

export interface BattleContext {
    actionType: BattleActionType;
   attackingPlayerId: string;
    defendingPlayerId: string;
    attackerCarduid?: string;
    targetCarduid?: string;
    targetPlayerId?: string;
    fromBurst?: boolean;
    forcedTarget?: ForcedTargetSummary;
    actionTargets?: Record<string, ActionStepTargetSummary[]>;
    status: BattleStatus;
    openedAt: number;
    confirmations?: {
        [playerId: string]: boolean;
    };
}
