// src/services/EventQueue/StateBasedActionEngine.ts
// Automatic game rule enforcement and illegal state correction

import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase, EventType } from '../../models/GameEnums';
import { PhaseTransitionManager } from '../effects/PhaseTransitionManager';
import { GameStateManager } from '../effects/GameStateManager';
import { RepairEffectManager } from '../effects/RepairEffectManager';
import { EndTurnTriggeredEffectManager } from '../effects/EndTurnTriggeredEffectManager';

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
        // END_PHASE ordering matters: end-of-turn effects should be queued before NEXT_PLAYER_TURN.
        if (this.gameEnv.phase === GamePhase.END_PHASE) {
            actions.push(...this.collectEndPhaseActions());
        } else {
            actions.push(...PhaseTransitionManager.getAllPhaseTransitionActions(this.gameEnv));
        }

        actions.push(...GameStateManager.getAllGameStateActions(this.gameEnv));
        
        // Actions processed in order found (no priority sorting needed)
        
        if (actions.length > 0) {
            console.log(`🔍 State-based actions found: ${actions.length}`);
        }
        
        return actions;
    }
    
    
    // ============ SPECIFIC STATE CHECKS ============
    
    private collectEndPhaseActions(): StateBasedAction[] {
        const actions: StateBasedAction[] = [];
        const context = this.resolveEndPhaseContext();
        if (!context) {
            return actions;
        }

        const repairActions = this.checkRepairAbilitiesInEndPhase(context.playerId, context.player);
        const endTurnActions = this.checkEndTurnTriggeredEffectsInEndPhase(context.playerId, context.player);
        actions.push(...repairActions);
        actions.push(...endTurnActions);

        // Critical ordering guard:
        // Do not queue NEXT_PLAYER_TURN until all end-of-turn auto effects (Repair/END_OF_TURN triggers)
        // have been drained in prior processing passes.
        if (repairActions.length === 0 && endTurnActions.length === 0) {
            actions.push(...PhaseTransitionManager.getAllPhaseTransitionActions(this.gameEnv));
        }

        return actions;
    }

    private resolveEndPhaseContext(): { playerId: string; player: any } | null {
        if (this.gameEnv.phase !== GamePhase.END_PHASE) {
            return null;
        }

        const playerId = this.gameEnv.currentPlayer;
        if (!playerId) {
            return null;
        }

        const player = this.gameEnv.players[playerId];
        if (!player) {
            console.error(`❌ Current player ${playerId} not found in gameEnv.players`);
            return null;
        }

        if (!player.zones) {
            console.log(`🔧 Initializing zones for player ${playerId}`);
            player.initializeZones();
        }

        return { playerId, player };
    }

    /**
     * Check for repair abilities during END_PHASE (separate from phase transition)
     */
    private checkRepairAbilitiesInEndPhase(playerId: string, player: any): StateBasedAction[] {
        const actions: StateBasedAction[] = [];

        console.log(`🔄 END_PHASE detected - checking for repair abilities`);
        const hasCheckedRepairAbilities = player.zones.repairAbilitiesCheckedThisCycle || false;

        if (!hasCheckedRepairAbilities) {
            console.log(`🩹 Checking repair abilities for player ${playerId}`);
            const repairActions = RepairEffectManager.checkRepairAbilities(this.gameEnv, playerId);
            actions.push(...repairActions);
            // Set the flag to prevent repeated checking
            player.zones.repairAbilitiesCheckedThisCycle = true;
        } else {
            console.log(`🩹 Repair abilities already checked this cycle for player ${playerId}, skipping...`);
        }

        return actions;
    }

    private checkEndTurnTriggeredEffectsInEndPhase(playerId: string, player: any): StateBasedAction[] {
        const actions: StateBasedAction[] = [];
        const hasChecked = player.zones.endTurnEffectsCheckedThisCycle || false;
        if (hasChecked) {
            return actions;
        }

        const endTurnActions = EndTurnTriggeredEffectManager.checkEndTurnTriggeredEffects(this.gameEnv, playerId);
        actions.push(...endTurnActions);
        player.zones.endTurnEffectsCheckedThisCycle = true;
        return actions;
    }
    
    
    
    
    
    // ============ GAME STATE VALIDATION ============
    
    /**
     * Check if current game state is legal (delegated to GameStateManager)
     */
    isLegalGameState(): boolean {
        return GameStateManager.getAllGameStateActions(this.gameEnv).length === 0;
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
