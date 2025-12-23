// src/services/PlayerActionExecutor.ts
// Routes PLAYER_ACTION events to the appropriate managers

import { PlayerActionEvent } from './EventQueue/interfaces/GameEvent';
import { GameEnvironment } from '../models/GameEnvironment';
import { ExecutionResult } from './ExecutionResult';
import { GameActionValidator } from './GameActionValidator';
import { BattlePhaseManager } from './BattlePhaseManager';
import { MainPhaseAbilityManager } from './effects/MainPhaseAbilityManager';
import { BaseAbilityManager } from './effects/BaseAbilityManager';

export class PlayerActionExecutor {
    static execute(event: PlayerActionEvent, gameEnv: GameEnvironment): ExecutionResult {
        const eventData = event.data;
        const fromBurst = eventData.fromBurst || false;

        console.log(`🗡️ Processing PLAYER_ACTION event for player: ${eventData.playerId}, actionType: ${eventData.actionType}, fromBurst: ${fromBurst}`);

        try {
            switch (eventData.actionType) {
                case 'attackUnit':
                case 'attackShieldArea': {
                    const turnCheck = GameActionValidator.ensureTurn(gameEnv, eventData.playerId, fromBurst);
                    if (!turnCheck.success) {
                        return {
                            success: false,
                            error: turnCheck.error
                        };
                    }

                    return BattlePhaseManager.initiateAttack(gameEnv, event);
                }

                case 'useCommandCard':
                    return MainPhaseAbilityManager.executeMainPhaseAbility(gameEnv, event);

                case 'activateBaseAbility':
                    return BaseAbilityManager.executeBaseAbility(gameEnv, event);

                case 'confirmBattle':
                    return BattlePhaseManager.handleBattleConfirmation(gameEnv, event.playerId);

                case 'resolveBattle':
                    return BattlePhaseManager.resolveBattle(gameEnv, event.playerId);

                default:
                    return {
                        success: false,
                        error: `Unknown actionType: ${eventData.actionType}`
                    };
            }

        } catch (error) {
            console.error(`❌ Error in PlayerActionExecutor:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'PLAYER_ACTION execution failed'
            };
        }
    }
}
