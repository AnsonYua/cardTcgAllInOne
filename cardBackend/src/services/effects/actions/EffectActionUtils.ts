import { GameEnvironment } from '../../../models/GameEnvironment';
import { TargetScope } from '../../EventQueue/interfaces/GameEvent';

export function extractNumericValue(parameters?: Record<string, unknown>): number | undefined {
    if (!parameters) {
        return undefined;
    }

    const rawValue =
        parameters['value'] ??
        parameters['amount'] ??
        parameters['modifier'];
    if (typeof rawValue === 'number') {
        return rawValue;
    }

    if (typeof rawValue === 'string') {
        const parsed = Number(rawValue);
        return Number.isNaN(parsed) ? undefined : parsed;
    }

    return undefined;
}

export function resolvePlayerIdsForScope(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    scope: TargetScope | string | undefined
): string[] {
    if (!scope || scope === 'self' || scope === 'SELF') {
        return [sourcePlayerId];
    }

    if (scope === 'opponent' || scope === 'OPPONENT') {
        const opponentId = gameEnv.getOpponentId(sourcePlayerId);
        return opponentId ? [opponentId] : [];
    }

    if (scope === 'any' || scope === 'both') {
        const opponentId = gameEnv.getOpponentId(sourcePlayerId);
        return opponentId ? [sourcePlayerId, opponentId] : [sourcePlayerId];
    }

    return [sourcePlayerId];
}
