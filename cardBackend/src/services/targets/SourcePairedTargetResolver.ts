import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetReference } from '../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';

export class SourcePairedTargetResolver {
    static resolve(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        scope: string
    ): TargetReference[] {
        const normalizedScope = typeof scope === 'string' ? scope.toLowerCase() : '';
        if (normalizedScope !== 'source_paired_pilot' && normalizedScope !== 'source_paired_unit') {
            return [];
        }

        const sourceResult = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, sourceCarduid);
        if (!sourceResult.found || !sourceResult.playerId || !sourceResult.slotName) {
            return [];
        }

        const playerId = sourceResult.playerId;
        const player = gameEnv.getPlayer(playerId);
        if (!player?.zones) {
            return [];
        }

        const slotResult = SlotZoneUtils.getSlotZone(player.zones, sourceResult.slotName);
        if (!slotResult.isValid || !slotResult.slot) {
            return [];
        }

        const slot = slotResult.slot;
        if (normalizedScope === 'source_paired_pilot') {
            const pilot = SlotZoneUtils.getPilot(slot);
            if (!pilot?.carduid) {
                return [];
            }
            return [
                {
                    carduid: pilot.carduid,
                    zone: sourceResult.slotName,
                    playerId,
                    cardData: pilot.cardData
                }
            ];
        }

        const unit = SlotZoneUtils.getUnit(slot);
        if (!unit?.carduid) {
            return [];
        }
        return [
            {
                carduid: unit.carduid,
                zone: sourceResult.slotName,
                playerId,
                cardData: unit.cardData
            }
        ];
    }
}

