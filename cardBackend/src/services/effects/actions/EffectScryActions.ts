import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';

export function applyScryTopDeckEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    effect: EffectDefinition
): { success: boolean; error?: string } {
    const parameters = effect.parameters || {};
    const countRaw = parameters['count'] ?? parameters['value'];
    const count = typeof countRaw === 'number' ? countRaw : Number(countRaw) || 0;
    const keep = typeof parameters['keep'] === 'number' ? (parameters['keep'] as number) : 1;

    if (count <= 0) {
        return { success: false, error: 'scry_top_deck requires a positive count' };
    }

    const player = gameEnv.getPlayer(sourcePlayerId);
    if (!player?.deck || !Array.isArray(player.deck.mainDeck)) {
        return { success: false, error: `Player ${sourcePlayerId} deck not found for scry` };
    }

    const revealed = player.deck.mainDeck.splice(0, count);
    if (revealed.length === 0) {
        return { success: true };
    }

    const keepCount = Math.max(0, Math.min(keep, revealed.length));
    const keepCards = revealed.slice(0, keepCount);
    const bottomCards = revealed.slice(keepCount);

    player.deck.mainDeck = keepCards.concat(player.deck.mainDeck, bottomCards);

    console.log(`🔮 Scry ${revealed.length}: kept ${keepCards.length} on top, moved ${bottomCards.length} to bottom`);
    return { success: true };
}
