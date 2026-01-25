import type { GameEnvironment } from '../../models/GameEnvironment';
import type { PlayerZones } from '../../models/Player';
import type { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import { TriggeredEffectProcessor } from './TriggeredEffectProcessor';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';

export class DefenseAreaBattleDamageTriggeredEffectManager {
    static handleShieldCardDestroyed(
        gameEnv: GameEnvironment,
        params: {
            attackingPlayerId: string;
            attackerSlot: string;
        }
    ): { success: boolean; error?: string } {
        return this.process(gameEnv, {
            attackingPlayerId: params.attackingPlayerId,
            attackerSlot: params.attackerSlot,
            defenseArea: 'shield'
        });
    }

    static handleBaseDamaged(
        gameEnv: GameEnvironment,
        params: {
            attackingPlayerId: string;
            attackerSlot: string;
        }
    ): { success: boolean; error?: string } {
        return this.process(gameEnv, {
            attackingPlayerId: params.attackingPlayerId,
            attackerSlot: params.attackerSlot,
            defenseArea: 'base'
        });
    }

    private static process(
        gameEnv: GameEnvironment,
        params: {
            attackingPlayerId: string;
            attackerSlot: string;
            defenseArea: 'shield' | 'base';
        }
    ): { success: boolean; error?: string } {
        const attacker = gameEnv.getPlayer(params.attackingPlayerId);
        if (!attacker?.zones) {
            return { success: true };
        }

        const slotResult = SlotZoneUtils.getSlotZone(attacker.zones as PlayerZones, params.attackerSlot);
        const slot = slotResult.isValid ? slotResult.slot : null;
        const unit = slot?.unit as UnitZoneCard | undefined;
        const pilot = slot?.pilot as PilotZoneCard | undefined;

        if (!unit) {
            return { success: true };
        }

        const sources: Array<UnitZoneCard | PilotZoneCard> = [unit];
        if (pilot) {
            sources.push(pilot);
        }

        for (const sourceCard of sources) {
            const processed = TriggeredEffectProcessor.processForSourceCard(gameEnv, params.attackingPlayerId, sourceCard as any, {
                trigger: 'DEFENSE_AREA_BATTLE_DAMAGE',
                expectedTriggers: ['DEFENSE_AREA_BATTLE_DAMAGE'],
                fallbackEffectId: 'defense_area_battle_damage',
                defaultTargetScope: 'opponent',
                preFilter: (rawRule) => {
                    const parameters = rawRule['parameters'];
                    if (!parameters || typeof parameters !== 'object') {
                        return false;
                    }
                    const defenseAreas = (parameters as any).defenseAreas;
                    if (!Array.isArray(defenseAreas)) {
                        return false;
                    }
                    return defenseAreas.includes(params.defenseArea);
                }
            });

            if (!processed.success) {
                return { success: false, error: processed.error };
            }
        }

        return { success: true };
    }
}

