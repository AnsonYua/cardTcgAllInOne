// src/interfaces/StandardizedInterfaces.ts
// Standardized interfaces for event system and effect processing

import { EventType, EventStatus, EventPriority } from '../models/GameEnums';

// ============ STANDARDIZED EVENT INTERFACES ============

/**
 * Standardized game event structure - replaces BaseGameEvent inconsistencies
 */
export interface StandardGameEvent {
    id: string;
    type: EventType;
    status: EventStatus;
    priority: EventPriority;
    timestamp: number;
    playerId?: string;
    data: StandardEventData;
}

/**
 * Standardized event data structure - replaces 'data: any'
 */
export interface StandardEventData {
    playerId: string;
    gameId?: string;
    carduid: string;                    // Single source of truth - cardId derived via split
    parameters: EffectParameters;
    targets?: TargetData[];
    metadata?: EventMetadata;
}

/**
 * Unified effect parameters structure
 */
export interface EffectParameters {
    action: string;                     // Effect action type
    value: number;                      // Unified numeric parameter (replaces modifier/amount/count)
    scope?: 'SELF' | 'OPPONENT' | 'ALL' | 'TARGET';
    duration?: 'INSTANT' | 'CONTINUOUS' | 'UNTIL_END_TURN' | 'PERMANENT';
    conditions?: EffectCondition[];
}

/**
 * Target selection data
 */
export interface TargetData {
    carduid: string;
    playerId: string;
    zone: string;
    cardData?: any;                     // Optional for display purposes
}

/**
 * Effect condition for filtering targets
 */
export interface EffectCondition {
    type: 'TRAIT' | 'CARD_TYPE' | 'POWER' | 'ZONE' | 'CUSTOM';
    operator: 'EQUALS' | 'CONTAINS' | 'GREATER_THAN' | 'LESS_THAN';
    value: string | number | string[];
}

/**
 * Event metadata for additional context
 */
export interface EventMetadata {
    sourceCardName?: string;
    effectDescription?: string;
    priority?: number;
    isOptional?: boolean;
}

// ============ STANDARDIZED EXECUTION INTERFACES ============

/**
 * Standardized execution result - replaces multiple ExecutionResult variations
 */
export interface StandardExecutionResult {
    success: boolean;
    effectsApplied: number;
    affectedCards: string[];            // Array of carduids
    stateChanges: StateChange[];
    error?: ErrorDetails;
    warnings?: string[];
    metadata?: ExecutionMetadata;
}

/**
 * State change tracking for debugging and rollback
 */
export interface StateChange {
    type: 'CARD_PROPERTY' | 'ZONE_CHANGE' | 'GAME_STATE';
    carduid?: string;
    property?: string;
    oldValue: any;
    newValue: any;
    timestamp: number;
}

/**
 * Detailed error information
 */
export interface ErrorDetails {
    code: string;
    message: string;
    carduid?: string;
    playerId?: string;
    context?: any;
}

/**
 * Execution metadata for analysis and debugging
 */
export interface ExecutionMetadata {
    executionTime: number;              // Milliseconds
    manager: string;                    // Which manager handled the effect
    debugInfo?: any;
}

// ============ EFFECT MANAGER INTERFACE ============

/**
 * Standardized interface that all effect managers must implement
 */
export interface StandardEffectManager {
    /**
     * Execute effect with standardized input/output
     */
    executeEffect(event: StandardGameEvent, gameEnv: any): Promise<StandardExecutionResult>;
    
    /**
     * Validate effect before execution
     */
    validateEffect(event: StandardGameEvent, gameEnv: any): ValidationResult;
    
    /**
     * Get human-readable description of effect
     */
    getEffectDescription(event: StandardGameEvent): string;
    
    /**
     * Get manager name for identification
     */
    getManagerName(): string;
}

/**
 * Validation result for pre-execution checks
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

// ============ EVENT DATA VALIDATOR ============

/**
 * Validator for event data type safety
 */
export interface EventDataValidator {
    /**
     * Validate event structure
     */
    validateEvent(event: any): ValidationResult;
    
    /**
     * Validate event data
     */
    validateEventData(data: any): ValidationResult;
    
    /**
     * Validate effect parameters
     */
    validateParameters(parameters: any): ValidationResult;
}

// ============ TYPE GUARDS ============

/**
 * Type guard for StandardGameEvent
 */
export function isStandardGameEvent(event: any): event is StandardGameEvent {
    return event && 
           typeof event.id === 'string' &&
           typeof event.type === 'string' &&
           typeof event.status === 'string' &&
           typeof event.priority === 'number' &&
           typeof event.timestamp === 'number' &&
           event.data &&
           typeof event.data.carduid === 'string';
}

/**
 * Type guard for StandardEventData
 */
export function isStandardEventData(data: any): data is StandardEventData {
    return data &&
           typeof data.playerId === 'string' &&
           typeof data.carduid === 'string' &&
           data.parameters &&
           typeof data.parameters.action === 'string' &&
           typeof data.parameters.value === 'number';
}