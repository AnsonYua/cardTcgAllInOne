// src/services/effects/ShieldAreaCardDamagedTriggeredEffectManager.ts
// Handles SHIELD_AREA_CARD_DAMAGED triggers that depend on the attacking unit context.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { ShieldAreaCardDamagedTriggeredEvent } from '../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { InPlayTriggeredEffectManager } from './InPlayTriggeredEffectManager';

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

        return InPlayTriggeredEffectManager.processForPlayer({
            gameEnv,
            playerId: attackingPlayerId,
            trigger: 'SHIELD_AREA_CARD_DAMAGED',
            expectedTriggers: ['SHIELD_AREA_CARD_DAMAGED'],
            fallbackEffectId: 'shield_area_card_damaged_triggered_effect',
            defaultTargetScope: 'self',
            preFilter: (rawRule) => {
                const conditions = Array.isArray((rawRule as any).conditions) ? ((rawRule as any).conditions as any[]) : [];
                const eventConds = conditions.filter(
                    (cond) => cond && typeof cond === 'object' && (cond as any).type === 'shieldAreaCardDamagedByBattleDamage'
                );
                if (eventConds.length === 0) {
                    return true;
                }

                return eventConds.every((cond) => {
                    const scope = typeof (cond as any).scope === 'string' ? ((cond as any).scope as string).toLowerCase() : '';
                    if (scope === 'opponent' && defendingPlayerId === attackingPlayerId) {
                        return false;
                    }

                    const defenseAreas = Array.isArray((cond as any).defenseAreas)
                        ? ((cond as any).defenseAreas as any[]).filter((v: any) => typeof v === 'string')
                        : [];
                    if (defenseAreas.length > 0 && !defenseAreas.includes(defenseArea)) {
                        return false;
                    }

                    const filters = (cond as any).sourceUnitFilters && typeof (cond as any).sourceUnitFilters === 'object'
                        ? (cond as any).sourceUnitFilters
                        : {};
                    const traits = Array.isArray(filters.traits) ? filters.traits.filter((t: any) => typeof t === 'string') : [];
                    if (traits.length > 0) {
                        const hasAll = traits.every((trait: string) => attackerTraits.includes(trait));
                        if (!hasAll) {
                            return false;
                        }
                    }

                    return true;
                });
            }
        });
    }
}
