import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { SLOT_ZONES } from '../../config/gameConstants';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';

export class SelfTargetResolver {
    static resolve(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        effect: EffectDefinition
    ): TargetReference[] | null {
        const targetType = typeof effect.target?.type === 'string' ? effect.target.type.toLowerCase() : '';
        const scope = typeof effect.target?.scope === 'string' ? effect.target.scope : '';
        if (scope !== 'self') {
            return null;
        }

        // Slot zone cards (unit/pilot)
        const lookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, sourceCarduid);
        if (lookup.found && lookup.playerId && lookup.slotName && SLOT_ZONES.includes(lookup.slotName as any)) {
            if (targetType === 'unit') {
                const unit = lookup.unit;
                if (unit?.carduid === sourceCarduid) {
                    return [{ carduid: unit.carduid, zone: lookup.slotName, playerId: lookup.playerId, cardData: unit.cardData }];
                }
                return null;
            }

            if (targetType === 'pilot') {
                const pilot = lookup.pilot;
                if (pilot?.carduid === sourceCarduid) {
                    return [{ carduid: pilot.carduid, zone: lookup.slotName, playerId: lookup.playerId, cardData: pilot.cardData }];
                }
                return null;
            }

            // Generic: allow "card" to target either unit or pilot as long as it's the sourceCarduid.
            if (targetType === 'card' || targetType === '') {
                const card = lookup.card;
                if (card?.carduid === sourceCarduid) {
                    return [{ carduid: card.carduid, zone: lookup.slotName, playerId: lookup.playerId, cardData: card.cardData }];
                }
                return null;
            }
        }

        // Base cards live in zones.base (array) and are not part of slot zones.
        if (targetType === 'base') {
            for (const [playerId, player] of Object.entries(gameEnv.players || {})) {
                const bases = player?.zones?.base;
                if (!Array.isArray(bases)) {
                    continue;
                }
                const base = bases.find((b: any) => b?.carduid === sourceCarduid);
                if (base) {
                    return [{ carduid: base.carduid, zone: 'base', playerId, cardData: base.cardData as any }];
                }
            }
        }

        return null;
    }
}
