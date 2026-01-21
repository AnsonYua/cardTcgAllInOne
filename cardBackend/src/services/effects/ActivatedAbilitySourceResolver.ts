import { GameEnvironment } from '../../models/GameEnvironment';
import { BaseCard, UnitZoneCard } from '../../models/CardSystem';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';

export interface ActivatedAbilitySource {
    sourceCard: BaseCard | UnitZoneCard;
    sourceZone: 'base' | 'unit';
    sourceSlotName?: string;
}

export type ActivatedAbilitySourceResult =
    | { success: true; source: ActivatedAbilitySource }
    | { success: false; error: string };

export function resolveActivatedAbilitySource(
    gameEnv: GameEnvironment,
    playerId: string,
    carduid: string
): ActivatedAbilitySourceResult {
    const playerState = gameEnv.players[playerId];
    if (!playerState?.zones) {
        return { success: false, error: 'Player zones not available' };
    }

    if (Array.isArray(playerState.zones.base)) {
        const baseCard = playerState.zones.base.find(card => card.carduid === carduid);
        if (baseCard) {
            return {
                success: true,
                source: {
                    sourceCard: baseCard,
                    sourceZone: 'base'
                }
            };
        }
    }

    const slotLookup = SlotZoneUtils.findSlotNameByUnitUidForPlayer(gameEnv, playerId, carduid);
    if (slotLookup.found && slotLookup.unit && slotLookup.slotName) {
        return {
            success: true,
            source: {
                sourceCard: slotLookup.unit,
                sourceZone: 'unit',
                sourceSlotName: slotLookup.slotName
            }
        };
    }

    return {
        success: false,
        error: `Card ${carduid} not found in base or unit slots for player ${playerId}`
    };
}
