// src/services/effects/ShieldAreaCardDamagedTriggeredEffectManager.ts
// Handles SHIELD_AREA_CARD_DAMAGED triggers that depend on the attacking unit context.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { ShieldAreaCardDamagedTriggeredEvent } from '../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { InPlayTriggeredEffectManager } from './InPlayTriggeredEffectManager';
import { withEventConditionNotificationOverride } from './EventConditionNotificationOverride';
import {
    findShieldAreaCardDamagedNotification,
    shieldAreaCardDamagedRuleMatchesEvent
} from './ShieldAreaCardDamagedNotificationContext';

export class ShieldAreaCardDamagedTriggeredEffectManager {
    static executeShieldAreaCardDamagedTriggeredEvent(
        event: ShieldAreaCardDamagedTriggeredEvent,
        gameEnv: GameEnvironment
    ): { success: boolean; error?: string; requiresSelection?: boolean } {
        const {
            attackingPlayerId,
            attackerSlot,
            defendingPlayerId,
            defenseArea
        } = event.data;

        const attacker = gameEnv.getPlayer(attackingPlayerId) || gameEnv.players[attackingPlayerId];
        if (!attacker?.zones) {
            return { success: true };
        }

        const slotResult = SlotZoneUtils.getSlotZone(attacker.zones, attackerSlot);
        const attackerUnit = slotResult.isValid ? slotResult.slot?.unit : null;
        if (!attackerUnit?.carduid) {
            return { success: true };
        }

        const attackerTraits: string[] = Array.isArray(attackerUnit.cardData?.traits) ? attackerUnit.cardData.traits : [];
        const latestNotification = findShieldAreaCardDamagedNotification(gameEnv, event.id);

        return withEventConditionNotificationOverride(gameEnv, latestNotification, () =>
            InPlayTriggeredEffectManager.processForPlayer({
                gameEnv,
                playerId: attackingPlayerId,
                trigger: 'SHIELD_AREA_CARD_DAMAGED',
                expectedTriggers: ['SHIELD_AREA_CARD_DAMAGED'],
                fallbackEffectId: 'shield_area_card_damaged_triggered_effect',
                defaultTargetScope: 'self',
                preFilter: (rawRule) => {
                    return shieldAreaCardDamagedRuleMatchesEvent(rawRule, {
                        attackingPlayerId,
                        defendingPlayerId,
                        defenseArea,
                        attackerTraits
                    });
                }
            })
        );
    }
}
