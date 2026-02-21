import type { GameEnvironment } from '../../../models/GameEnvironment';
import { SLOT_ZONES } from '../../../config/gameConstants';

type SourceCard = any;

export function collectStateChangedByEffectSources(
    gameEnv: GameEnvironment,
    playerId: string
): SourceCard[] {
    const player = gameEnv.getPlayer(playerId) || gameEnv.players[playerId];
    if (!player?.zones) {
        return [];
    }

    const sources: SourceCard[] = [];
    for (const slotName of SLOT_ZONES) {
        const slot = (player.zones as any)[slotName];
        if (slot?.unit) sources.push(slot.unit);
        if (slot?.pilot) sources.push(slot.pilot);
    }

    const bases = Array.isArray((player.zones as any).base) ? (player.zones as any).base : [];
    for (const base of bases) {
        if (base?.carduid) {
            sources.push(base);
        }
    }

    return sources;
}
