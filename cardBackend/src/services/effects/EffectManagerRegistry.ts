// src/services/effects/EffectManagerRegistry.ts
// Centralized registry and router for all effect managers

import { GameEnvironment } from '../../models/GameEnvironment';
import { EventType } from '../../models/GameEnums';
import { GameEvent, RepairEffectEvent, BlockerChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import { StateBasedAction } from '../EventQueue/StateBasedActionEngine';
import { RepairEffectManager } from './RepairEffectManager';
import { PhaseTransitionManager } from './PhaseTransitionManager';
import { GameStateManager } from './GameStateManager';
import { BlockerEffectManager } from './BlockerEffectManager';

// Import standardized interfaces
import { 
    StandardGameEvent, 
    StandardExecutionResult, 
    StandardEffectManager,
    ValidationResult 
} from '../../interfaces/StandardizedInterfaces';
import { eventDataValidator } from '../../validators/EventDataValidator';
import { getCardIdFromUid } from '../../utils/CardUtils';

// Legacy ExecutionResult for backward compatibility
interface ExecutionResult {
    success: boolean;
    error?: string;
}

// Effect manager interface for consistency (legacy)
interface EffectManager {
    executeEffect?: (event: GameEvent, gameEnv: GameEnvironment) => ExecutionResult;
    checkEffects?: (gameEnv: GameEnvironment, ...args: any[]) => StateBasedAction[];
}

// Registry for standardized effect managers
interface ManagerRegistration {
    manager: StandardEffectManager;
    eventTypes: EventType[];
    isActive: boolean;
}

/**
 * Central registry and router for all effect managers
 * Routes events to appropriate specialized managers with standardized interfaces
 */
export class EffectManagerRegistry {
    
    // Registry of standardized managers (future expansion)
    private static standardManagers: Map<EventType, ManagerRegistration> = new Map();
    
    // ============ STANDARDIZED EXECUTION ROUTING ============
    
    /**
     * Execute effect using standardized interfaces with validation
     */
    static async executeStandardEffect(event: StandardGameEvent, gameEnv: GameEnvironment): Promise<StandardExecutionResult> {
        const startTime = Date.now();
        console.log(`🎯 [STANDARD] Routing ${event.type} (${event.id}) to appropriate effect manager`);
        
        // Validate event structure first
        const validation = eventDataValidator.validateEvent(event);
        if (!validation.isValid) {
            console.error(`❌ Event validation failed:`, validation.errors);
            return {
                success: false,
                effectsApplied: 0,
                affectedCards: [],
                stateChanges: [],
                error: {
                    code: 'INVALID_EVENT_STRUCTURE',
                    message: `Event validation failed: ${validation.errors.join(', ')}`,
                    carduid: event.data.carduid,
                    playerId: event.data.playerId,
                    context: validation
                },
                warnings: validation.warnings
            };
        }
        
        try {
            // Check for standardized manager first
            const managerReg = this.standardManagers.get(event.type);
            if (managerReg && managerReg.isActive) {
                console.log(`📋 Using standardized manager: ${managerReg.manager.getManagerName()}`);
                const result = await managerReg.manager.executeEffect(event, gameEnv);
                result.metadata = {
                    ...result.metadata,
                    executionTime: Date.now() - startTime,
                    manager: managerReg.manager.getManagerName()
                };
                return result;
            }
            
            // Fallback to legacy routing for backward compatibility
            console.log(`🔄 Falling back to legacy routing for ${event.type}`);
            const legacyResult = this.executeLegacyEffect(event, gameEnv);
            
            // Convert legacy result to standard format
            return this.convertLegacyResult(legacyResult, event, Date.now() - startTime);
            
        } catch (error) {
            console.error(`❌ Error in standardized routing ${event.type}:`, error);
            return {
                success: false,
                effectsApplied: 0,
                affectedCards: [],
                stateChanges: [],
                error: {
                    code: 'EXECUTION_ERROR',
                    message: error instanceof Error ? error.message : 'Effect execution failed',
                    carduid: event.data.carduid,
                    playerId: event.data.playerId,
                    context: error
                },
                metadata: {
                    executionTime: Date.now() - startTime,
                    manager: 'EffectManagerRegistry'
                }
            };
        }
    }
    
    /**
     * Legacy event execution for backward compatibility
     */
    static executeEffect(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 [LEGACY] Routing ${event.type} to appropriate effect manager`);
        
        try {
            return this.executeLegacyEffect(event, gameEnv);
        } catch (error) {
            console.error(`❌ Error routing ${event.type}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Effect routing failed'
            };
        }
    }
    
    /**
     * Internal legacy routing logic
     */
    private static executeLegacyEffect(event: GameEvent | StandardGameEvent, gameEnv: GameEnvironment): ExecutionResult {
        switch (event.type) {
            case EventType.TRIGGER_HEALING:
                return RepairEffectManager.executeRepairEffect(event as RepairEffectEvent, gameEnv);
            
            case EventType.GAMEPLAY_BEGINS:
            case EventType.PHASE_ADVANCE:
            case EventType.NEXT_PLAYER_TURN:
                return PhaseTransitionManager.executePhaseTransition(event as GameEvent, gameEnv);
            
            case EventType.BLOCKER_CHOICE:
                return BlockerEffectManager.executeBlockerChoice(event as BlockerChoiceEvent, gameEnv);
            
            // TODO: Add other effect types as managers are created
            
            default:
                console.log(`⚠️ No specific manager for ${event.type}, using default success`);
                return { success: true };
        }
    }
    
    /**
     * Convert legacy ExecutionResult to StandardExecutionResult
     */
    private static convertLegacyResult(
        legacyResult: ExecutionResult, 
        event: StandardGameEvent, 
        executionTime: number
    ): StandardExecutionResult {
        return {
            success: legacyResult.success,
            effectsApplied: legacyResult.success ? 1 : 0,
            affectedCards: event.data.carduid ? [event.data.carduid] : [],
            stateChanges: [], // Legacy results don't track state changes
            error: legacyResult.error ? {
                code: 'LEGACY_ERROR',
                message: legacyResult.error,
                carduid: event.data.carduid,
                playerId: event.data.playerId
            } : undefined,
            metadata: {
                executionTime,
                manager: 'LegacyRoute'
            }
        };
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
    
    // ============ MANAGER REGISTRATION METHODS ============
    
    /**
     * Register a standardized effect manager
     */
    static registerStandardManager(
        manager: StandardEffectManager, 
        eventTypes: EventType[],
        isActive: boolean = true
    ): void {
        console.log(`📝 Registering standardized manager: ${manager.getManagerName()}`);
        
        for (const eventType of eventTypes) {
            this.standardManagers.set(eventType, {
                manager,
                eventTypes,
                isActive
            });
            console.log(`  ✅ Mapped ${eventType} to ${manager.getManagerName()}`);
        }
    }
    
    /**
     * Unregister a standardized effect manager
     */
    static unregisterStandardManager(eventType: EventType): void {
        const registration = this.standardManagers.get(eventType);
        if (registration) {
            console.log(`🗑️ Unregistering ${eventType} from ${registration.manager.getManagerName()}`);
            this.standardManagers.delete(eventType);
        }
    }
    
    /**
     * Enable/disable a registered manager
     */
    static setManagerActive(eventType: EventType, isActive: boolean): void {
        const registration = this.standardManagers.get(eventType);
        if (registration) {
            registration.isActive = isActive;
            console.log(`${isActive ? '✅' : '❌'} ${eventType} manager ${isActive ? 'enabled' : 'disabled'}`);
        }
    }
    
    // ============ UTILITY METHODS ============
    
    /**
     * Get enhanced system status for debugging
     */
    static getSystemStatus(): any {
        const standardizedManagers = Array.from(this.standardManagers.entries()).map(([eventType, reg]) => ({
            eventType,
            manager: reg.manager.getManagerName(),
            isActive: reg.isActive
        }));
        
        return {
            standardizedManagers,
            legacyManagers: [
                'RepairEffectManager',
                'PhaseTransitionManager', 
                'GameStateManager'
            ],
            supportedEvents: [
                EventType.TRIGGER_HEALING,
                EventType.GAMEPLAY_BEGINS,
                EventType.PHASE_ADVANCE,
                EventType.NEXT_PLAYER_TURN,
                ...Array.from(this.standardManagers.keys())
            ],
            systemHealth: {
                standardManagersCount: this.standardManagers.size,
                activeManagersCount: Array.from(this.standardManagers.values()).filter(reg => reg.isActive).length,
                validationEnabled: true
            }
        };
    }
    
    /**
     * Validate event and provide detailed feedback
     */
    static validateEventForProcessing(event: any): { 
        isValid: boolean; 
        canProcessStandard: boolean; 
        canProcessLegacy: boolean; 
        validation: ValidationResult 
    } {
        const validation = eventDataValidator.validateEvent(event);
        const hasStandardManager = event.type && this.standardManagers.has(event.type);
        const canProcessLegacy = event.type && [
            EventType.TRIGGER_HEALING,
            EventType.GAMEPLAY_BEGINS,
            EventType.PHASE_ADVANCE,
            EventType.NEXT_PLAYER_TURN
        ].includes(event.type);
        
        return {
            isValid: validation.isValid,
            canProcessStandard: validation.isValid && hasStandardManager,
            canProcessLegacy: canProcessLegacy,
            validation
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
