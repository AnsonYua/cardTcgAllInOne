// src/services/EventQueue/StateBasedActionEngine.ts
// Automatic game rule enforcement and illegal state correction

import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase, EventType } from '../../models/GameEnums';
import { EffectManagerRegistry } from '../effects/EffectManagerRegistry';

// ============ STATE-BASED ACTION INTERFACES ============

export interface StateBasedAction {
    actionId: string;
    type: EventType;
    autoExecute: boolean;
    data?: any; // Optional data for specific action types
}

export interface GameStateViolation {
    violationType: string;
    severity: 'critical' | 'warning' | 'info';
    description: string;
    affectedEntities: string[];
    suggestedActions: StateBasedAction[];
}

// ============ STATE-BASED ACTION ENGINE ============

export class StateBasedActionEngine {
    private gameEnv: GameEnvironment;
    private checkEnabled: boolean = true;
    
    constructor(gameEnv: GameEnvironment) {
        this.gameEnv = gameEnv;
        console.log('🔍 StateBasedActionEngine initialized');
    }
    
    // ============ MAIN CHECKING INTERFACE ============
    
    /**
     * Check for all state-based actions that need to be performed
     */
    checkForStateBasedActions(): StateBasedAction[] {
        if (!this.checkEnabled) return [];
        
        const actions: StateBasedAction[] = [];
        
        // Check all categories of state-based actions using specialized managers
        actions.push(...EffectManagerRegistry.getPhaseTransitionActions(this.gameEnv));
        actions.push(...this.checkRepairAbilitiesInEndPhase());
        actions.push(...EffectManagerRegistry.getGameStateActions(this.gameEnv));
        
        // Actions processed in order found (no priority sorting needed)
        
        if (actions.length > 0) {
            console.log(`🔍 State-based actions found: ${actions.length}`);
        }
        
        return actions;
    }
    
    
    // ============ SPECIFIC STATE CHECKS ============
    
    
    
    /**
     * Check for repair abilities during END_PHASE (separate from phase transition)
     */
    private checkRepairAbilitiesInEndPhase(): StateBasedAction[] {
        const actions: StateBasedAction[] = [];
        
        // Only check for repair abilities during END_PHASE
        if (this.gameEnv.phase === GamePhase.END_PHASE) {
            console.log(`🔄 END_PHASE detected - checking for repair abilities`);
            
            const currentPlayerId = this.gameEnv.currentPlayer;
            if (currentPlayerId) {
                const currentPlayer = this.gameEnv.players[currentPlayerId];
                if (!currentPlayer) {
                    console.error(`❌ Current player ${currentPlayerId} not found in gameEnv.players`);
                    return actions;
                }
                
                // Initialize zones if needed
                if (!currentPlayer.zones) {
                    console.log(`🔧 Initializing zones for player ${currentPlayerId}`);
                    currentPlayer.initializeZones();
                }
                
                const hasCheckedRepairAbilities = currentPlayer.zones.repairAbilitiesCheckedThisCycle || false;
                
                if (!hasCheckedRepairAbilities) {
                    console.log(`🩹 Checking repair abilities for player ${currentPlayerId}`);
                    const repairActions = EffectManagerRegistry.getRepairActions(this.gameEnv, currentPlayerId);
                    actions.push(...repairActions);
                    
                    // Set the flag to prevent repeated checking
                    currentPlayer.zones.repairAbilitiesCheckedThisCycle = true;
                } else {
                    console.log(`🩹 Repair abilities already checked this cycle for player ${currentPlayerId}, skipping...`);
                }
            }
        }
        
        return actions;
    }
    
    
    
    
    
    // ============ GAME STATE VALIDATION ============
    
    /**
     * Check if current game state is legal (delegated to GameStateManager)
     */
    isLegalGameState(): boolean {
        return EffectManagerRegistry.getGameStateActions(this.gameEnv).length === 0;
    }
    
    /**
     * Find all current game state violations (delegated to GameStateManager)
     */
    findGameStateViolations(): GameStateViolation[] {
        // Import GameStateManager dynamically to avoid circular dependency
        const { GameStateManager } = require('../effects/GameStateManager');
        return GameStateManager.findGameStateViolations(this.gameEnv);
    }
    
    // ============ CONTROL METHODS ============
    
    /**
     * Enable/disable state-based action checking
     */
    setCheckingEnabled(enabled: boolean): void {
        this.checkEnabled = enabled;
        console.log(`🔍 State-based action checking: ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Force immediate state-based action check
     */
    forceStateCheck(): StateBasedAction[] {
        console.log('🔍 Forcing immediate state-based action check');
        return this.checkForStateBasedActions();
    }
    
    // ============ SERIALIZATION ============
    
    /**
     * Serialize engine state
     */
    toJSON(): any {
        return {
            checkEnabled: this.checkEnabled
        };
    }
    
    /**
     * Restore engine from serialized state
     */
    static fromJSON(data: any, gameEnv: GameEnvironment): StateBasedActionEngine {
        const engine = new StateBasedActionEngine(gameEnv);
        engine.checkEnabled = data.checkEnabled !== false;
        return engine;
    }
}