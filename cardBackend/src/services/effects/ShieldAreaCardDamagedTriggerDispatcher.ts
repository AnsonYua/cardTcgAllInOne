// src/services/effects/ShieldAreaCardDamagedTriggerDispatcher.ts
// Centralized helper for battle damage to opponent shield area (shields/base).

import type { GameEnvironment } from '../../models/GameEnvironment';
import { EventFactory } from '../EventQueue/EventFactory';
import { TriggerDispatchUtils } from './TriggerDispatchUtils';

export class ShieldAreaCardDamagedTriggerDispatcher {
    static dispatch(params: {
        gameEnv: GameEnvironment;
        attackingPlayerId: string;
        attackerSlot: string;
        defendingPlayerId: string;
        defenseArea: 'shield' | 'base';
        damagedCarduid?: string;
        sourceCarduid?: string;
    }): void {
        const { gameEnv, attackingPlayerId, attackerSlot, defendingPlayerId, defenseArea, damagedCarduid, sourceCarduid } = params;

        if (!attackingPlayerId || !attackerSlot || !defendingPlayerId) {
            return;
        }

        const triggerEvent = EventFactory.createShieldAreaCardDamagedTriggeredEvent({
            playerId: attackingPlayerId,
            attackingPlayerId,
            attackerSlot,
            defendingPlayerId,
            defenseArea,
            damagedCarduid,
            damageSource: 'battle',
            sourceCarduid
        });

        TriggerDispatchUtils.enqueueAndNotify({
            gameEnv,
            triggerEvent,
            notificationType: 'SHIELD_AREA_CARD_DAMAGED',
            payload: {
            playerId: attackingPlayerId,
            attackingPlayerId,
            attackerSlot,
            defendingPlayerId,
            defenseArea,
            damagedCarduid,
            damageSource: 'battle',
            sourceCarduid,
            timestamp: Date.now()
            }
        });
    }
}
