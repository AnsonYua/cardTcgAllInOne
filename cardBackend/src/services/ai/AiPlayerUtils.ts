import type { AiGameEnvView } from './AiViewTypes';

export function getOpponentId(gameEnvView: AiGameEnvView, aiPlayerId: string): string | null {
    if (gameEnvView?.playerId_1 === aiPlayerId) return gameEnvView?.playerId_2 || null;
    if (gameEnvView?.playerId_2 === aiPlayerId) return gameEnvView?.playerId_1 || null;
    const playerIds = Object.keys(gameEnvView?.players || {});
    return playerIds.find((id) => id !== aiPlayerId) || null;
}
