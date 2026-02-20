import type { GameEnvironment } from '../../models/GameEnvironment';

export class ConditionScopeUtils {
    static resolveScopedPlayerId(
        gameEnv: GameEnvironment,
        cardOwnerPlayerId: string | null,
        scope: unknown
    ): string | null {
        if (!cardOwnerPlayerId) {
            return null;
        }

        const normalizedScope = typeof scope === 'string' ? scope.toLowerCase() : 'self';
        if (normalizedScope === 'opponent') {
            return gameEnv.getOpponentId(cardOwnerPlayerId);
        }

        return cardOwnerPlayerId;
    }
}
