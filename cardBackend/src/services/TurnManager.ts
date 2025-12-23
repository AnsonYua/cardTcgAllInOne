// src/services/TurnManager.ts
// Encapsulates end-turn and next-player turn transitions

import { GameEnvironment } from '../models/GameEnvironment';
import { GamePhase } from '../models/GameEnums';
import { EndTurnEvent, NextPlayerTurnEvent } from './EventQueue/interfaces/GameEvent';
import { ExecutionResult } from './ExecutionResult';
import { DeployTargetManager } from './DeployTargetManager';
import { EnergyManager } from './EnergyManager';
import { PlayerCardManager } from './PlayerCardManager';
import { ContinuousEffectManager } from './ContinuousEffectManager';

export class TurnManager {
    static handleEndTurn(event: EndTurnEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { playerId, currentTurnNumber } = event.data;
        const fromBurst = event.data.fromBurst || false;

        console.log(`🏁 Processing END_TURN event for player: ${playerId}, turn: ${currentTurnNumber}, fromBurst: ${fromBurst}`);

        try {
            if (gameEnv.currentPlayer !== playerId) {
                return {
                    success: false,
                    error: `Not your turn. Current player: ${gameEnv.currentPlayer}`
                };
            }

            DeployTargetManager.cleanupExpiredTemporaryEffects(gameEnv, playerId);

            gameEnv.phase = GamePhase.END_PHASE;
            console.log(`🏁 Phase set to END_PHASE - state-based actions will handle next player transition`);

            return { success: true };
        } catch (error) {
            console.error(`❌ Error in handleEndTurn:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'END_TURN execution failed'
            };
        }
    }

    static handleNextPlayerTurn(event: NextPlayerTurnEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { currentPlayer, nextPlayer, currentTurn } = event.data;
        console.log(`🔄 Processing NEXT_PLAYER_TURN event: ${currentPlayer} → ${nextPlayer}, turn: ${currentTurn} → ${currentTurn + 1}`);

        try {
            gameEnv.currentPlayer = nextPlayer;
            gameEnv.currentTurn = currentTurn + 1;
            gameEnv.phase = GamePhase.DRAW_PHASE;

            const newPlayer = gameEnv.players[nextPlayer];
            if (newPlayer?.zones) {
                newPlayer.zones.repairAbilitiesCheckedThisCycle = false;
                console.log(`🔄 Reset repair abilities flag for new player: ${nextPlayer}`);
            }

            EnergyManager.untapAllEnergy(gameEnv, nextPlayer);
            EnergyManager.addBasicEnergy(gameEnv, nextPlayer);

            const firstPlayer = gameEnv.players[nextPlayer];
            if (firstPlayer?.deck) {
                PlayerCardManager.drawCards(firstPlayer.deck, 1);
                console.log(`🃏 Drew 1 card for player ${nextPlayer}`);
            }

            try {
                const result = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
                console.log(`✅ Continuous effects processed: ${result.effectsProcessed} processed, ${result.effectsActivated} activated, ${result.effectsDeactivated} deactivated`);
            } catch (error) {
                console.error(`❌ Error processing continuous effects on turn change:`, error);
            }

            return { success: true };
        } catch (error) {
            console.error(`❌ Error in handleNextPlayerTurn:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'NEXT_PLAYER_TURN execution failed'
            };
        }
    }
}
