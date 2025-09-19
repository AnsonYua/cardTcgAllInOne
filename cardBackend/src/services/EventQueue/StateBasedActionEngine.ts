// src/services/EventQueue/StateBasedActionEngine.ts
// Automatic game rule enforcement and illegal state correction

import { GameEvent, EventFactory } from './interfaces/GameEvent';
import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase, EventType } from '../../models/GameEnums';
import { SLOT_ZONES } from '../../config/gameConstants';

// ============ STATE-BASED ACTION INTERFACES ============

export interface StateBasedAction {
    actionId: string;
    type: EventType;
    priority: number;
    description: string;
    affectedCards: string[];
    affectedPlayers: string[];
    autoExecute: boolean;
    data?: any;
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
    private processedRepairActions: Set<string> = new Set();
    
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
        
        // Clean up old repair actions from previous turns (keep only current turn)
        const currentTurn = this.gameEnv.currentTurn;
        const keysToRemove: string[] = [];
        for (const key of this.processedRepairActions) {
            if (!key.includes(`_turn_${currentTurn}`)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => this.processedRepairActions.delete(key));
        
        const actions: StateBasedAction[] = [];
        
        // Check all categories of state-based actions
        actions.push(...this.checkGameStartConditions());
        actions.push(...this.checkDrawPhaseToMainPhase());
        actions.push(...this.checkEndPhaseToNextPlayer());
        actions.push(...this.checkZoneCapacityLimits());
        actions.push(...this.checkHandSizeLimits());
        actions.push(...this.checkResourceLimits());
        actions.push(...this.checkPhaseRequirements());
        actions.push(...this.checkIllegalGameStates());
        
        // Sort by priority (higher number = higher priority)
        actions.sort((a, b) => b.priority - a.priority);
        
        if (actions.length > 0) {
            console.log(`🔍 State-based actions found: ${actions.length}`);
        }
        
        return actions;
    }
    
    
    // ============ SPECIFIC STATE CHECKS ============
    
    /**
     * Check for GAMEPLAY_BEGINS conditions (both players ready and confirmed)
     */
    private checkGameStartConditions(): StateBasedAction[] {
        const actions: StateBasedAction[] = [];
        
        // Only check if we're in REDRAW_PHASE and haven't started yet
        if (this.gameEnv.phase !== GamePhase.REDRAW_PHASE) {
            return actions;
        }
        
        // Ensure both players exist
        if (!this.gameEnv.playerId_1 || !this.gameEnv.playerId_2) {
            return actions;
        }
        
        // Check if both players are ready and confirmed
        const bothPlayersReady = this.gameEnv.playersReady[this.gameEnv.playerId_1] && 
                                this.gameEnv.playersReady[this.gameEnv.playerId_2];
        
        const player1 = this.gameEnv.players[this.gameEnv.playerId_1];
        const player2 = this.gameEnv.players[this.gameEnv.playerId_2];
        const bothPlayersConfirmed = player1?.confirmIsRedraw == true && 
                                    player2?.confirmIsRedraw == true;
        
        console.log(`🔍 GAMEPLAY_BEGINS check: bothReady=${bothPlayersReady}, bothConfirmed=${bothPlayersConfirmed}, phase=${this.gameEnv.phase}`);
        
        if (bothPlayersReady && bothPlayersConfirmed) {
            console.log(`🎯 State-based action detected: GAMEPLAY_BEGINS conditions met`);
            
            actions.push({
                actionId: `game_start_${Date.now()}`,
                type: EventType.GAMEPLAY_BEGINS,
                priority: 200, // High priority for game flow
                description: 'Both players ready and confirmed - start game with resource allocation',
                affectedCards: [],
                affectedPlayers: [this.gameEnv.playerId_1!, this.gameEnv.playerId_2!],
                autoExecute: true
            });
        }
        
        return actions;
    }
    
    /**
     * Check for DRAW_PHASE to MAIN_PHASE transition
     */
    private checkDrawPhaseToMainPhase(): StateBasedAction[] {
        const actions: StateBasedAction[] = [];
        
        // Only check if we're in DRAW_PHASE
        if (this.gameEnv.phase !== GamePhase.DRAW_PHASE) {
            return actions;
        }
        
        // Check if there are no unacknowledged card draw events in the notification queue
        const notificationQueue = this.gameEnv.notificationQueue || [];
        const hasUnacknowledgedCardDrawEvent = notificationQueue.some(event => 
            event.type === 'CARD_DRAWN' &&
            event.metadata?.frontendProcessed === false
        );
        
        console.log(`🔍 DRAW_PHASE check: phase=${this.gameEnv.phase}, hasUnacknowledgedCardDrawEvent=${hasUnacknowledgedCardDrawEvent}`);
        
        if (!hasUnacknowledgedCardDrawEvent) {
            // Also check that we haven't already processed a draw_to_main action recently
            const recentDrawToMainAction = notificationQueue.some(event =>
                event.type === 'PHASE_CHANGE' && 
                event.data?.reason?.includes('Auto-advance') &&
                event.timestamp > (Date.now() - 5000) // Within last 5 seconds
            );
            
            if (!recentDrawToMainAction) {
                console.log(`🎯 State-based action detected: DRAW_PHASE to MAIN_PHASE transition needed`);
                
                actions.push({
                    actionId: `draw_to_main_${Date.now()}`,
                    type: EventType.PHASE_ADVANCE,
                    priority: 180, // High priority for phase transitions
                    description: 'Auto-advance from DRAW_PHASE to MAIN_PHASE (no draw events pending)',
                    affectedCards: [],
                    affectedPlayers: [this.gameEnv.currentPlayer || ''],
                    autoExecute: true
                });
            }
        }
        
        return actions;
    }
    
    /**
     * Check END_PHASE to next player transition
     */
    private checkEndPhaseToNextPlayer(): StateBasedAction[] {
        const actions: StateBasedAction[] = [];
        
        // Check if we're in END_PHASE and need to transition to next player
        if (this.gameEnv.phase === GamePhase.END_PHASE) {
            console.log(`🔄 END_PHASE detected - checking for repair abilities and next player transition`);
            
            // First, check for repair abilities for the current player (only once per cycle)
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
                    const repairActions = this.checkRepairAbilities(currentPlayerId);
                    actions.push(...repairActions);
                    
                    // Set the flag to prevent repeated checking
                    currentPlayer.zones.repairAbilitiesCheckedThisCycle = true;
                } else {
                    console.log(`🩹 Repair abilities already checked this cycle for player ${currentPlayerId}, skipping...`);
                }
            }
            
            // Calculate next player
            const nextPlayerId = this.gameEnv.currentPlayer === this.gameEnv.playerId_1 
                ? this.gameEnv.playerId_2 
                : this.gameEnv.playerId_1;
            
            if (nextPlayerId) {
                console.log(`🎯 State-based action detected: END_PHASE to next player transition (${this.gameEnv.currentPlayer} → ${nextPlayerId})`);
                
                actions.push({
                    actionId: `end_phase_next_player_${Date.now()}`,
                    type: EventType.NEXT_PLAYER_TURN,
                    priority: 10,
                    affectedPlayers: [this.gameEnv.currentPlayer || '', nextPlayerId],
                    affectedCards: [],
                    description: `Transition from END_PHASE to next player: ${nextPlayerId}`,
                    autoExecute: true,
                    data: {
                        currentPlayer: this.gameEnv.currentPlayer,
                        nextPlayer: nextPlayerId,
                        currentTurn: this.gameEnv.currentTurn
                    }
                });
            }
        }
        
        return actions;
    }
    
    /**
     * Check zone capacity limits
     */
    private checkZoneCapacityLimits(): StateBasedAction[] {
        const actions: StateBasedAction[] = [];
        
        // TODO: Check your game's zone capacity rules
        // Examples:
        // - Hand size limits
        // - Battlefield zone limits
        // - Graveyard/deck size issues
        
        Object.values(this.gameEnv.players).forEach(player => {
            console.log(`🔍 Checking zone limits for player: ${player.id}`);
            
            // Example: Hand size limit check
            // if (player.hand.length > MAX_HAND_SIZE) {
            //     actions.push({
            //         actionId: `discard_excess_${player.id}`,
            //         type: 'FORCE_DISCARD',
            //         priority: 90,
            //         description: `Discard to hand limit (${MAX_HAND_SIZE})`,
            //         affectedCards: [],
            //         affectedPlayers: [player.id],
            //         autoExecute: false // Requires player choice
            //     });
            // }
        });
        
        return actions;
    }
    
    /**
     * Check hand size limits
     */
    private checkHandSizeLimits(): StateBasedAction[] {
        const actions: StateBasedAction[] = [];
        
        // TODO: Implement hand size limit checking
        console.log('🔍 Checking hand size limits');
        
        return actions;
    }
    
    /**
     * Check resource and energy limits
     */
    private checkResourceLimits(): StateBasedAction[] {
        const actions: StateBasedAction[] = [];
        
        // TODO: Check energy/resource violations
        console.log('🔍 Checking resource limits');
        
        return actions;
    }
    
    /**
     * Check phase-specific requirements
     */
    private checkPhaseRequirements(): StateBasedAction[] {
        const actions: StateBasedAction[] = [];
        
        // TODO: Check phase-specific game state requirements
        // Examples:
        // - Main phase zone filling requirements
        // - Combat phase attack/block requirements
        // - End phase cleanup requirements
        
        console.log(`🔍 Checking phase requirements for: ${this.gameEnv.phase}`);
        
        return actions;
    }
    
    /**
     * Check for other illegal game states
     */
    private checkIllegalGameStates(): StateBasedAction[] {
        const actions: StateBasedAction[] = [];
        
        // TODO: Check for game-specific illegal states
        // Examples:
        // - Cards in wrong zones
        // - Invalid card combinations
        // - Rule violations
        
        console.log('🔍 Checking for illegal game states');
        
        return actions;
    }
    
    /**
     * Check for repair abilities for the specified player
     */
    private checkRepairAbilities(playerId: string): StateBasedAction[] {
        const actions: StateBasedAction[] = [];
        
        const player = this.gameEnv.players[playerId];
        if (!player || !player.zones) {
            return actions;
        }
        
        // Check all slot zones for units with repair abilities
        for (const slot of SLOT_ZONES) {
            const slotZone = (player.zones as any)[slot];
            
            if (slotZone?.unit) {
                const unit = slotZone.unit;
                const cardData = this.getCardData(unit.cardId);
                
                if (cardData && cardData.effects && cardData.effects.rules) {
                    // Look for repair abilities
                    cardData.effects.rules.forEach((effect: any) => {
                        if (effect.trigger === 'END_OF_TURN' && effect.effect.action === 'heal') {
                            // Create a unique key for this repair action (per turn)
                            const repairKey = `${unit.cardUid}_${effect.effectId}_turn_${this.gameEnv.currentTurn}`;
                            
                            // Only add if we haven't processed this repair action this turn
                            if (!this.processedRepairActions.has(repairKey)) {
                                console.log(`🩹 Found repair ability: ${effect.effectId} on ${unit.cardId}`);
                                
                                // Mark this repair action as processed
                                this.processedRepairActions.add(repairKey);
                                
                                actions.push({
                                    actionId: `repair_${unit.cardUid}_${Date.now()}`,
                                    type: EventType.TRIGGER_HEALING,
                                    priority: 15, // High priority - execute before next player transition
                                    description: `Execute ${effect.effectId} healing for ${unit.cardId}`,
                                    affectedCards: [unit.cardId],
                                    affectedPlayers: [playerId],
                                    autoExecute: true,
                                    data: {
                                        effectType: 'repair',
                                        effectId: effect.effectId,
                                        cardId: unit.cardId,
                                        cardUid: unit.cardUid,
                                        playerId: playerId,
                                        healAmount: effect.effect.parameters.value
                                    }
                                });
                            } else {
                                console.log(`🩹 Repair ability ${effect.effectId} already processed this turn for ${unit.cardId}`);
                            }
                        }
                    });
                    console.log("data for healing event ", JSON.stringify(unit.cardId))
                }
            }
        }
        
        if (actions.length > 0) {
            console.log(`🩹 Found ${actions.length} repair abilities for player ${playerId}`);
        }
        
        return actions;
    }
    
    /**
     * Get card data helper method
     */
    private getCardData(cardId: string): any {
        try {
            const { CardDatabaseManager } = require('../../models/CardSystem');
            return CardDatabaseManager.getCardDetails(cardId);
        } catch (error) {
            console.error(`❌ Error loading card data for ${cardId}:`, error);
            return null;
        }
    }
    
    
    // ============ GAME STATE VALIDATION ============
    
    /**
     * Check if current game state is legal
     */
    isLegalGameState(): boolean {
        const violations = this.findGameStateViolations();
        return violations.length === 0;
    }
    
    /**
     * Find all current game state violations
     */
    findGameStateViolations(): GameStateViolation[] {
        const violations: GameStateViolation[] = [];
        
        // TODO: Implement comprehensive game state validation
        // Check all game rules and constraints
        
        console.log(`🔍 Game state validation: ${violations.length} violations found`);
        return violations;
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