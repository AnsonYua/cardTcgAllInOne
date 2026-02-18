import { sessionManager } from './SessionManager';

export type PlayerSeatSelector = 'currentPlayer' | 'opponent';

export type TestSession = {
    playerId: string;
    sessionToken: string;
    sessionExpiresAt: number;
};

export const normalizePlayerSeatSelector = (raw: unknown): PlayerSeatSelector => {
    return raw === 'opponent' ? 'opponent' : 'currentPlayer';
};

export const resolvePlayerIdForSelector = (gameEnv: any, selector: PlayerSeatSelector): string | null => {
    const playerIds = [gameEnv?.playerId_1, gameEnv?.playerId_2]
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    const currentPlayerId = typeof gameEnv?.currentPlayer === 'string' ? gameEnv.currentPlayer : '';

    if (selector === 'opponent') {
        if (playerIds.length >= 2 && currentPlayerId) {
            return playerIds.find((id) => id !== currentPlayerId) || playerIds[0] || null;
        }
        if (playerIds.length >= 2) {
            return playerIds[1] || playerIds[0] || null;
        }
    }

    return currentPlayerId || playerIds[0] || null;
};

export const buildTestSessions = (gameId: string, gameEnv: any): TestSession[] => {
    const candidatePlayerIds = [gameEnv?.playerId_1, gameEnv?.playerId_2]
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);

    return candidatePlayerIds.map((playerId) => {
        const session = sessionManager.createSession(gameId, playerId);
        return {
            playerId,
            sessionToken: session.token,
            sessionExpiresAt: session.expiresAt
        };
    });
};
