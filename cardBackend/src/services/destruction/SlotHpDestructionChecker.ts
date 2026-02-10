import type { GameEnvironment } from '../../models/GameEnvironment';
import type { UnitZoneCard } from '../../models/CardSystem';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { getSlotTotals } from '../../utils/FieldValueCalculator';
import { PlayerCardManager } from '../PlayerCardManager';

export class SlotHpDestructionChecker {
    static destroyUnitIfSlotHpZero(gameEnv: GameEnvironment, unitCarduid: string): boolean {
        const lookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, unitCarduid);
        if (!lookup.found || !lookup.playerId || !lookup.slotName) {
            return true;
        }

        const player = gameEnv.getPlayer(lookup.playerId);
        const slotResult = player?.zones ? SlotZoneUtils.getSlotZone(player.zones, lookup.slotName) : null;
        if (!slotResult || !slotResult.isValid || !slotResult.slot) {
            return true;
        }

        const slot = slotResult.slot;
        const slotHp = getSlotTotals(slot).totalHP;
        if (slotHp > 0) {
            return true;
        }

        const unit = slot.unit as UnitZoneCard | undefined;
        if (!unit || unit.carduid !== unitCarduid) {
            return true;
        }

        return PlayerCardManager.destroyUnitInSlot(gameEnv, lookup.playerId, lookup.slotName, unit);
    }
}

