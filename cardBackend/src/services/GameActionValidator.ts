// src/services/GameActionValidator.ts
// Common validation helpers shared across GameEngine actions

import { GameEnvironment } from '../models/GameEnvironment';

export interface ValidationOutcome {
    success: boolean;
    error?: string;
}

export class GameActionValidator {

    static ensureTurn(gameEnv: GameEnvironment, playerId: string, fromBurst: boolean = false): ValidationOutcome {
        if (!playerId) {
            return {
                success: false,
                error: 'Player ID is required'
            };
        }

        if (!fromBurst && gameEnv.currentPlayer !== playerId) {
            return {
                success: false,
                error: `Not your turn. Current player: ${gameEnv.currentPlayer}`
            };
        }

        return { success: true };
    }
}

