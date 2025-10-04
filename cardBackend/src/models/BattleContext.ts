// src/models/BattleContext.ts
// Runtime battle context tracking for action-step abilities and delayed resolution

import { PlayerActionEventData } from '../services/EventQueue/interfaces/GameEvent';

export type BattleActionType = 'attackUnit' | 'attackShieldArea';
export type BattleStatus = 'ACTION_STEP' | 'RESOLVING';

export interface BattleContext {
    actionType: BattleActionType;
    attackingPlayerId: string;
    defendingPlayerId: string;
    pendingEvent: PlayerActionEventData;
    attackerCarduid?: string;
    targetCarduid?: string;
    targetPlayerId?: string;
    fromBurst?: boolean;
    status: BattleStatus;
    openedAt: number;
    confirmations?: {
        [playerId: string]: boolean;
    };
}
