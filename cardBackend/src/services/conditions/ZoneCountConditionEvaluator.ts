import type { GameEnvironment } from '../../models/GameEnvironment';
import { SLOT_ZONES } from '../../config/gameConstants';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';

export class ZoneCountConditionEvaluator {
    static countCardsInZone(
        gameEnv: GameEnvironment,
        playerId: string,
        zoneRaw: unknown
    ): number | null {
        const player = gameEnv.getPlayer(playerId);
        if (!player) {
            return null;
        }

        const zone = typeof zoneRaw === 'string' ? zoneRaw.toLowerCase() : '';
        if (!zone) {
            return null;
        }

        if (zone === 'shield' || zone === 'shieldarea') {
            return Array.isArray(player.zones?.shieldArea) ? player.zones.shieldArea.length : 0;
        }
        if (zone === 'trash' || zone === 'trasharea') {
            return Array.isArray(player.zones?.trashArea) ? player.zones.trashArea.length : 0;
        }
        if (zone === 'energy' || zone === 'energyarea') {
            return Array.isArray(player.zones?.energyArea) ? player.zones.energyArea.length : 0;
        }
        if (zone === 'base') {
            return Array.isArray(player.zones?.base) ? player.zones.base.length : 0;
        }
        if (zone === 'hand') {
            if (typeof player.deck?.getHandSize === 'function') {
                return player.deck.getHandSize();
            }
            const handUids = (player.deck as any)?.handUids;
            return Array.isArray(handUids) ? handUids.length : 0;
        }
        if (zone === 'deck' || zone === 'maindeck') {
            if (typeof player.deck?.getDeckSize === 'function') {
                return player.deck.getDeckSize();
            }
            const deckCards = (player.deck as any)?.mainDeck;
            return Array.isArray(deckCards) ? deckCards.length : 0;
        }

        const slotName = SLOT_ZONES.find((slot) => slot.toLowerCase() === zone);
        if (!slotName) {
            return null;
        }

        const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotName);
        if (!slotResult.isValid || !slotResult.slot) {
            return 0;
        }

        let count = 0;
        if (slotResult.slot.unit) {
            count += 1;
        }
        if (slotResult.slot.pilot) {
            count += 1;
        }
        return count;
    }
}
