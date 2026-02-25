import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { mergeAliasLists, normalizeAliasList } from '../../../utils/NameAliasUtils';

type AliasCarrier = {
    carduid?: string;
    nameAliases?: string[];
};

function findCardByUidEverywhere(gameEnv: GameEnvironment, carduid: string): AliasCarrier | null {
    for (const player of Object.values(gameEnv.players || {})) {
        if (!player) {
            continue;
        }

        for (let i = 1; i <= 6; i += 1) {
            const slot = (player as any)?.zones?.[`slot${i}`];
            if (slot?.unit?.carduid === carduid) {
                return slot.unit as AliasCarrier;
            }
            if (slot?.pilot?.carduid === carduid) {
                return slot.pilot as AliasCarrier;
            }
        }

        const hand = Array.isArray((player as any)?.deck?.hand) ? (player as any).deck.hand : [];
        const inHand = hand.find((card: any) => card?.carduid === carduid);
        if (inHand) {
            return inHand as AliasCarrier;
        }

        const zones = (player as any)?.zones;
        const areaNames = ['trashArea', 'base', 'energyArea', 'shieldArea'];
        for (const areaName of areaNames) {
            const area = Array.isArray(zones?.[areaName]) ? zones[areaName] : [];
            const inArea = area.find((card: any) => card?.carduid === carduid);
            if (inArea) {
                return inArea as AliasCarrier;
            }
        }
    }

    return null;
}

export function applySetNameAliasEffect(
    gameEnv: GameEnvironment,
    sourceCarduid: string | undefined,
    effect: EffectDefinition
): { success: boolean; error?: string } {
    if (!sourceCarduid) {
        return { success: false, error: 'set_name_alias requires sourceCarduid' };
    }

    const aliases = normalizeAliasList(effect.parameters?.alsoTreatedAs);
    if (aliases.length === 0) {
        return { success: false, error: 'set_name_alias requires non-empty parameters.alsoTreatedAs' };
    }

    const sourceCard = findCardByUidEverywhere(gameEnv, sourceCarduid);
    if (!sourceCard) {
        return { success: false, error: `set_name_alias source card not found: ${sourceCarduid}` };
    }

    const currentAliases = normalizeAliasList(sourceCard.nameAliases);
    sourceCard.nameAliases = mergeAliasLists(currentAliases, aliases);

    return { success: true };
}
