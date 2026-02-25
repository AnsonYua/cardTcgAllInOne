import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';

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

function normalizeAliases(effect: EffectDefinition): string[] {
    const aliases = effect.parameters?.alsoTreatedAs;
    if (!Array.isArray(aliases)) {
        return [];
    }

    const normalized: string[] = [];
    for (const alias of aliases) {
        if (typeof alias !== 'string') {
            continue;
        }
        const value = alias.trim();
        if (value.length === 0) {
            continue;
        }
        if (!normalized.includes(value)) {
            normalized.push(value);
        }
    }
    return normalized;
}

export function applySetNameAliasEffect(
    gameEnv: GameEnvironment,
    sourceCarduid: string | undefined,
    effect: EffectDefinition
): { success: boolean; error?: string } {
    if (!sourceCarduid) {
        return { success: false, error: 'set_name_alias requires sourceCarduid' };
    }

    const aliases = normalizeAliases(effect);
    if (aliases.length === 0) {
        return { success: false, error: 'set_name_alias requires non-empty parameters.alsoTreatedAs' };
    }

    const sourceCard = findCardByUidEverywhere(gameEnv, sourceCarduid);
    if (!sourceCard) {
        return { success: false, error: `set_name_alias source card not found: ${sourceCarduid}` };
    }

    const currentAliases = Array.isArray(sourceCard.nameAliases) ? sourceCard.nameAliases : [];
    const mergedAliases = [...currentAliases];
    for (const alias of aliases) {
        if (!mergedAliases.includes(alias)) {
            mergedAliases.push(alias);
        }
    }
    sourceCard.nameAliases = mergedAliases;

    return { success: true };
}
