// src/services/effects/EffectManagerRegistry.ts
// Centralized registry and router for all effect managers

import { GameEnvironment } from '../../models/GameEnvironment';
import { EventType } from '../../models/GameEnums';
import { GameEvent } from '../EventQueue/interfaces/GameEvent';
import { StateBasedAction } from '../EventQueue/StateBasedActionEngine';
import { RepairEffectManager } from './RepairEffectManager';
import { PhaseTransitionManager } from './PhaseTransitionManager';
import { GameStateManager } from './GameStateManager';

interface ExecutionResult {
    success: boolean;
    error?: string;
}

// Effect manager interface for consistency
interface EffectManager {
    executeEffect?: (event: GameEvent, gameEnv: GameEnvironment) => ExecutionResult;
    checkEffects?: (gameEnv: GameEnvironment, ...args: any[]) => StateBasedAction[];
}

/**
 * Central registry and router for all effect managers
 * Routes events to appropriate specialized managers
 */
export class EffectManagerRegistry {
    
    // ============ EXECUTION ROUTING ============
    
    /**
     * Route event execution to appropriate effect manager
     */
    static executeEffect(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Routing ${event.type} to appropriate effect manager`);
        
        try {
            switch (event.type) {
                case EventType.TRIGGER_HEALING:
                    return RepairEffectManager.executeRepairEffect(event, gameEnv);
                
                case EventType.GAMEPLAY_BEGINS:
                case EventType.PHASE_ADVANCE:
                case EventType.NEXT_PLAYER_TURN:
                    return PhaseTransitionManager.executePhaseTransition(event, gameEnv);
                
                // TODO: Add other effect types as managers are created
                
                default:
                    console.log(`⚠️ No specific manager for ${event.type}, using default success`);
                    return { success: true };
            }
        } catch (error) {
            console.error(`❌ Error routing ${event.type}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Effect routing failed'
            };
        }
    }
    
    // ============ DETECTION ROUTING ============
    
    /**
     * Get all repair-related state-based actions
     */
    static getRepairActions(gameEnv: GameEnvironment, playerId: string): StateBasedAction[] {
        return RepairEffectManager.checkRepairAbilities(gameEnv, playerId);
    }
    
    /**
     * Get all phase transition-related state-based actions
     */
    static getPhaseTransitionActions(gameEnv: GameEnvironment): StateBasedAction[] {
        return PhaseTransitionManager.getAllPhaseTransitionActions(gameEnv);
    }
    
    /**
     * Get all game state validation-related state-based actions
     */
    static getGameStateActions(gameEnv: GameEnvironment): StateBasedAction[] {
        return GameStateManager.getAllGameStateActions(gameEnv);
    }
    
    // ============ UTILITY METHODS ============
    
    /**
     * Get system status for debugging
     */
    static getSystemStatus(): any {
        return {
            registeredManagers: [
                'RepairEffectManager',
                'PhaseTransitionManager',
                'GameStateManager'
            ],
            supportedEvents: [
                EventType.TRIGGER_HEALING,
                EventType.GAMEPLAY_BEGINS,
                EventType.PHASE_ADVANCE,
                EventType.NEXT_PLAYER_TURN
                // Game state validation events would be added here as they're implemented
            ]
        };
    }
    
    /**
     * Validate that all required managers are available
     */
    static validateManagers(): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        // Check RepairEffectManager
        if (!RepairEffectManager.executeRepairEffect) {
            errors.push('RepairEffectManager.executeRepairEffect not available');
        }
        if (!RepairEffectManager.checkRepairAbilities) {
            errors.push('RepairEffectManager.checkRepairAbilities not available');
        }
        
        // Check PhaseTransitionManager
        if (!PhaseTransitionManager.executePhaseTransition) {
            errors.push('PhaseTransitionManager.executePhaseTransition not available');
        }
        if (!PhaseTransitionManager.getAllPhaseTransitionActions) {
            errors.push('PhaseTransitionManager.getAllPhaseTransitionActions not available');
        }
        
        // Check GameStateManager
        if (!GameStateManager.getAllGameStateActions) {
            errors.push('GameStateManager.getAllGameStateActions not available');
        }
        if (!GameStateManager.isLegalGameState) {
            errors.push('GameStateManager.isLegalGameState not available');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}