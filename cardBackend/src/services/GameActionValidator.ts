// src/services/GameActionValidator.ts
// Common validation helpers shared across GameEngine actions

import { GameEnvironment } from '../models/GameEnvironment';

export interface ValidationOutcome {
    success: boolean;
    error?: string;
}

type EnsureTurnOptions = {
    actionType?: string;
};

export class GameActionValidator {

    static ensureTurn(
        gameEnv: GameEnvironment,
        playerId: string,
        fromBurst: boolean = false,
        opts: EnsureTurnOptions = {}
    ): ValidationOutcome {
        if (!playerId) {
            return {
                success: false,
                error: 'Player ID is required'
            };
        }

        if (!fromBurst && gameEnv.currentPlayer !== playerId) {
            if (GameActionValidator.canActOffTurnInActionStep(gameEnv, playerId, opts.actionType)) {
                return { success: true };
            }
            return {
                success: false,
                error: `Not your turn. Current player: ${gameEnv.currentPlayer}`
            };
        }

        return { success: true };
    }

    private static canActOffTurnInActionStep(gameEnv: GameEnvironment, playerId: string, actionType?: string): boolean {
        const normalizedAction = (actionType || '').toString().trim();
        if (normalizedAction !== 'activateCardAbility' && normalizedAction !== 'useCommandCard') {
            return false;
        }

        const battle = (gameEnv as any)?.currentBattle;
        if (!battle) return false;
        const status = (battle.status || '').toString().toUpperCase();
        if (status !== 'ACTION_STEP') return false;

        const confirmations = battle.confirmations || {};
        if (confirmations[playerId] !== false) return false;

        const actionTargets = battle.actionTargets || {};
        const targets = actionTargets[playerId];
        return Array.isArray(targets) && targets.length > 0;
    }
}
