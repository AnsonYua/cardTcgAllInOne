// src/services/notifications/BattleNotificationEmitter.ts
// Centralized notification helpers for battle-related UI flows

import type { GameEnvironment } from '../../models/GameEnvironment';
import { GameNotificationManager } from '../GameNotificationManager';

export interface AttackRedirectedPayload {
    blockingPlayerId: string;
    attackerPlayerId: string;
    attackerCarduid?: string;
    fromTargetCarduid?: string;
    toTargetCarduid: string;
    blockerCarduid: string;
    timestamp: number;
}

export class BattleNotificationEmitter {
    static emitAttackRedirected(
        gameEnv: GameEnvironment,
        payload: AttackRedirectedPayload,
        priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
    ): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent('ATTACK_REDIRECTED', payload, priority);
    }
}

