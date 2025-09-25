// src/services/DeployEffectManager.ts
// Deploy effect processing system for ENTERS_PLAY triggered effects

import { GameEnvironment } from '../models/GameEnvironment';
import { EventType } from '../models/GameEnums';
import { CardEffect, EffectResult } from './CardEffect';
import { EventFactory, GameEvent, 
    EventStatus, EventPriority, 
    PlayCardEvent, PlayCardEventData,
    DeployEffectEvent, DeployEffectEventData } from './EventQueue/interfaces/GameEvent';
import { SLOT_ZONES } from '../config/gameConstants';
import { GameValidator } from './GameValidator';
import { TargetChoiceManager } from './TargetChoiceManager';

// Import standardized interfaces
import {
    StandardEffectManager,
    StandardGameEvent,
    StandardExecutionResult,
    ValidationResult,
    StateChange
} from '../interfaces/StandardizedInterfaces';
import { getCardIdFromUid } from '../utils/CardUtils';
import { eventDataValidator } from '../validators/EventDataValidator';

// Legacy ExecutionResult for backward compatibility
export interface ExecutionResult {
    success: boolean;
    error?: string;
}

/**
 * DeployEffectManager handles Deploy (ENTERS_PLAY) effect processing
 * All effects are processed automatically with smart target selection
 * REFACTORED: Now implements StandardEffectManager interface
 * STANDARDIZED: Removed redundant cardId usage, uses carduid.split('_')[0] instead
 */
export class DeployEffectManager implements StandardEffectManager {
    
    // ============ STANDARDIZED INTERFACE IMPLEMENTATION ============
    
    /**
     * Execute effect using standardized interface
     */
    async executeEffect(event: StandardGameEvent, gameEnv: GameEnvironment): Promise<StandardExecutionResult> {
        const startTime = Date.now();
        console.log(`🚀 [STANDARD] Processing Deploy effect for card ${event.data.carduid}`);
        
        // Validate event data
        const validation = this.validateEffect(event, gameEnv);
        if (!validation.isValid) {
            return {
                success: false,
                effectsApplied: 0,
                affectedCards: [],
                stateChanges: [],
                error: {
                    code: 'VALIDATION_FAILED',
                    message: `Deploy effect validation failed: ${validation.errors.join(', ')}`,
                    carduid: event.data.carduid,
                    playerId: event.data.playerId
                },
                warnings: validation.warnings,
                metadata: {
                    executionTime: Date.now() - startTime,
                    manager: this.getManagerName()
                }
            };
        }
        
        // Extract cardId from carduid - no redundant cardId field needed
        const cardId = getCardIdFromUid(event.data.carduid);
        console.log(`📋 Derived cardId: ${cardId} from carduid: ${event.data.carduid}`);
        
        const stateChanges: StateChange[] = [];
        const affectedCards: string[] = [];
        
        try {
            // Build effects data from standardized event structure
            const effects = event.data.parameters.conditions || []; // Effects should be in conditions array
            console.log(`📋 Processing ${effects.length} deploy effects`);
            
            let processedEffects = 0;
            let failedEffects = 0;
            
            // Process each deploy effect
            for (const effect of effects) {
                console.log(`⚡ Processing Deploy effect: ${effect.type || 'unnamed'}`);
                
                const effectResult = await this.processStandardizedEffect(
                    gameEnv, 
                    event.data, 
                    effect, 
                    stateChanges
                );
                
                if (effectResult.success) {
                    processedEffects++;
                    affectedCards.push(...effectResult.affectedCards);
                    console.log(`✅ Deploy effect processed successfully`);
                } else {
                    failedEffects++;
                    console.log(`❌ Deploy effect failed: ${effectResult.error}`);
                }
            }
            
            return {
                success: processedEffects > 0,
                effectsApplied: processedEffects,
                affectedCards,
                stateChanges,
                error: failedEffects > 0 ? {
                    code: 'PARTIAL_FAILURE',
                    message: `${failedEffects} out of ${effects.length} effects failed`,
                    carduid: event.data.carduid,
                    playerId: event.data.playerId
                } : undefined,
                metadata: {
                    executionTime: Date.now() - startTime,
                    manager: this.getManagerName(),
                    debugInfo: { processedEffects, failedEffects }
                }
            };
            
        } catch (error) {
            console.error(`❌ Error in standardized deploy effect execution:`, error);
            return {
                success: false,
                effectsApplied: 0,
                affectedCards,
                stateChanges,
                error: {
                    code: 'EXECUTION_ERROR',
                    message: error instanceof Error ? error.message : 'Deploy effect execution failed',
                    carduid: event.data.carduid,
                    playerId: event.data.playerId,
                    context: error
                },
                metadata: {
                    executionTime: Date.now() - startTime,
                    manager: this.getManagerName()
                }
            };
        }
    }
    
    /**
     * Validate effect before execution
     */
    validateEffect(event: StandardGameEvent, gameEnv: GameEnvironment): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Validate event structure
        const eventValidation = eventDataValidator.validateEvent(event);
        errors.push(...eventValidation.errors);
        warnings.push(...eventValidation.warnings);
        
        // Validate specific deploy effect requirements
        if (!event.data.parameters.conditions || !Array.isArray(event.data.parameters.conditions)) {
            warnings.push('No deploy effects found in event.data.parameters.conditions');
        }
        
        // Validate player exists
        if (!gameEnv.players[event.data.playerId]) {
            errors.push(`Player ${event.data.playerId} not found in game environment`);
        }
        
        // Validate carduid format
        const cardId = getCardIdFromUid(event.data.carduid);
        if (!cardId) {
            errors.push(`Invalid carduid format: ${event.data.carduid}`);
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    /**
     * Get human-readable description of effect
     */
    getEffectDescription(event: StandardGameEvent): string {
        const cardId = getCardIdFromUid(event.data.carduid);
        const effectCount = event.data.parameters.conditions?.length || 0;
        return `Deploy effects for ${cardId}: ${effectCount} effects to process`;
    }
    
    /**
     * Get manager name for identification
     */
    getManagerName(): string {
        return 'DeployEffectManager';
    }
    
    // ============ STANDARDIZED HELPER METHODS ============
    
    /**
     * Process individual standardized effect with state change tracking
     */
    private async processStandardizedEffect(
        gameEnv: GameEnvironment,
        eventData: any,
        effect: any,
        stateChanges: StateChange[]
    ): Promise<{ success: boolean; error?: string; affectedCards: string[] }> {
        
        try {
            // Process effect using unified TargetChoiceManager
            const result = TargetChoiceManager.processEffectWithTargetChoice(
                gameEnv,
                eventData.playerId,
                eventData.carduid,
                effect
            );
            
            // Track state changes for debugging
            if (result.success && result.affectedTargets) {
                for (const target of result.affectedTargets) {
                    // Handle both string and TargetReference types
                    const carduid = typeof target === 'string' ? target : target.carduid;
                    stateChanges.push({
                        type: 'CARD_PROPERTY',
                        carduid: carduid,
                        property: effect.action || 'unknown',
                        oldValue: 'unknown', // Would need to track before/after values
                        newValue: 'modified',
                        timestamp: Date.now()
                    });
                }
            }
            
            return {
                success: result.success,
                error: result.error,
                affectedCards: result.affectedTargets?.map(t => typeof t === 'string' ? t : t.carduid) || []
            };
            
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Effect processing failed',
                affectedCards: []
            };
        }
    }
    
    // ============ LEGACY METHODS (BACKWARD COMPATIBILITY) ============
    
    /**
     * Process Deploy effect triggered by card entering play
     * LEGACY: Updated to eliminate redundant cardId usage
     */
    static processDeployEffect(gameEnv: GameEnvironment, playerId:string, eventData: DeployEffectEventData): any {
        // Extract cardId from carduid instead of using redundant cardId field
        const cardId = getCardIdFromUid(eventData.carduid);
        console.log(`🚀 Processing Deploy effects for card ${cardId} (carduid: ${eventData.carduid})`);
        console.log(`📋 Effects to process: ${eventData.effects?.length || 0}`);
        
        let processedEffects = 0;
        let failedEffects = 0;
        
        try {
            // Ensure effects array exists
            if (!eventData.effects || !Array.isArray(eventData.effects)) {
                console.warn(`⚠️ No effects found for card ${cardId}`);
                return {
                    success: true,
                    processedEffects: 0,
                    failedEffects: 0,
                    message: 'No deploy effects to process'
                };
            }
            
            // Process each Deploy effect automatically
            for (const effect of eventData.effects) {
                console.log(`⚡ Processing Deploy effect: ${effect.effectId || 'unnamed'} (${effect.effect?.action})`);
                
                const result = this.processIndividualEffect(gameEnv, playerId,eventData, effect);
                
                if (result.success) {
                    processedEffects++;
                    console.log(`✅ Deploy effect processed successfully`);
                } else {
                    failedEffects++;
                    console.log(`❌ Deploy effect failed: ${result.error}`);
                }
            }
            
            return {
                success: true,
                processedEffects,
                failedEffects,
                message: `Deploy effects completed: ${processedEffects} successful, ${failedEffects} failed`
            };
            
        } catch (error) {
            console.error(`❌ Error processing Deploy effects:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Deploy effect processing failed'
            };
        }
    }
    
    /**
     * Process individual Deploy effect using unified TargetChoiceManager
     */
    private static processIndividualEffect(gameEnv: GameEnvironment, playerId:string,
        eventData: DeployEffectEventData, effect: any): any {
        console.log(`🔧 Processing Deploy effect for player ${playerId} using unified system`);
        console.log(`📋 Effect data:`, JSON.stringify(effect, null, 2));
        
        try {
            // Process effect using unified TargetChoiceManager
            const result = TargetChoiceManager.processEffectWithTargetChoice(
                gameEnv,
                playerId,
                eventData.carduid,
                effect
            );
            
            // Return result with appropriate message
            return {
                success: result.success,
                error: result.error,
                requiresSelection: result.requiresSelection,
                autoApplied: result.autoApplied,
                message: result.requiresSelection ? "Target selection required" : 
                        result.autoApplied ? `Effect applied to ${result.affectedTargets?.length || 0} target(s)` : 
                        "Effect processed successfully"
            };
            
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Deploy effect processing failed'
            };
        }
    }
    
  
    
    /**
     * Generate available targets based on effect filters
     */
    private static generateAvailableTargets(gameEnv: GameEnvironment, playerId: string, effect: any): any[] {
        const targets: any[] = [];
        
        console.log(`🔍 Generating targets for effect with filters:`, JSON.stringify(effect.target, null, 2));
        
        // Get opponent player ID
        const opponentId = Object.keys(gameEnv.players).find(id => id !== playerId);
        if (!opponentId) {
            console.error(`❌ Could not find opponent for player ${playerId}`);
            return targets;
        }
        
        const opponent = gameEnv.players[opponentId];
        if (!opponent) {
            console.error(`❌ Opponent player ${opponentId} not found`);
            return targets;
        }
        
        console.log(`🎯 Searching opponent ${opponentId} for valid targets`);
        
        // Search opponent's units based on filters
        for (const slotName of SLOT_ZONES) {
            const slot = opponent.zones[slotName];
            if (slot?.unit) {
                const unit = slot.unit;
                console.log(`🔍 Checking unit in ${slotName}: ${unit.carduid} (HP: ${unit.cardData?.hp || 0}, Damage: ${unit.damageReceived || 0})`);
                
                // Apply HP filter if specified
                if (effect.target.filters?.hp) {
                    if (!this.validateHpFilter(unit, effect.target.filters.hp)) {
                        console.log(`❌ Unit ${unit.carduid} failed HP filter: ${effect.target.filters.hp}`);
                        continue;
                    }
                }
                
                // Add valid target (simplified - just essential identifiers)
                const targetRef = {
                    carduid: unit.carduid,
                    zone: slotName,
                    playerId: opponentId
                };
                
                targets.push(targetRef);
                console.log(`✅ Added valid target: ${unit.carduid} in ${slotName}`);
            }
        }
        
        console.log(`🎯 Generated ${targets.length} valid targets`);
        return targets;
    }
    
    /**
     * Parse HP filter string to extract operator and value (e.g., "<=2" → {operator: "<=", value: 2})
     */
    private static parseHpFilter(hpFilter: string): { operator: string; value: number } | null {
        if (typeof hpFilter !== 'string') {
            return null;
        }
        
        // Support multiple comparison operators
        const match = hpFilter.match(/^(<=|>=|<|>|==|!=)(\d+)$/);
        if (match) {
            return {
                operator: match[1],
                value: parseInt(match[2], 10)
            };
        }
        
        return null;
    }

    /**
     * Validate unit against HP filter
     */
    private static validateHpFilter(unit: any, hpFilter: string): boolean {
        const parsedFilter = this.parseHpFilter(hpFilter);
        if (!parsedFilter) {
            console.log(`⚠️ Invalid HP filter format: ${hpFilter}`);
            return false;
        }
        
        const currentHp = (unit?.currentHP || 0) + (unit?.modifyHP || 0);
        const { operator, value } = parsedFilter;
        
        console.log(`🔍 HP filter validation: currentHp=${currentHp} ${operator} ${value}`);
        
        switch (operator) {
            case '<=':
                return currentHp <= value;
            case '>=':
                return currentHp >= value;
            case '<':
                return currentHp < value;
            case '>':
                return currentHp > value;
            case '==':
                return currentHp === value;
            case '!=':
                return currentHp !== value;
            default:
                console.log(`⚠️ Unsupported HP filter operator: ${operator}`);
                return false;
        }
    }

    /**
     * Apply deploy effect to the selected target
     */
    static applyDeployEffectToTarget(gameEnv: GameEnvironment, deployEffect: any, target: any, playerId: string): ExecutionResult {
        console.log(`🎯 Applying deploy effect action: ${deployEffect.effect.action} to target: ${target.carduid}`);

        try {
            // Validate target player using GameValidator
            const playerValidation = GameValidator.validatePlayer(gameEnv, target.playerId);
            if (!playerValidation.isValid) {
                return {
                    success: false,
                    error: playerValidation.error
                };
            }

            // Validate target zone and unit using GameValidator
            const zoneValidation = GameValidator.validateTargetZone(gameEnv, target.playerId, target.zone, target.carduid);
            if (!zoneValidation.isValid) {
                return {
                    success: false,
                    error: zoneValidation.error
                };
            }

            // Get the target unit (validation already confirmed it exists)
            const targetPlayer = playerValidation.player!;
            const slotKey = target.zone as keyof Pick<typeof targetPlayer.zones, 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6'>;
            const targetSlot = targetPlayer.zones[slotKey];
            const targetUnit = targetSlot.unit!; // Non-null assertion since validation confirmed it exists

            // Apply effect based on action type
            switch (deployEffect.effect.action) {
                case "rest":
                    targetUnit.isRested = true;
                    console.log(`💤 Unit ${target.carduid} has been rested by deploy effect`);
                    break;

                case "damage":
                    const damageValue = deployEffect.effect.parameters?.value || 1;
                    targetUnit.damageReceived = (targetUnit.damageReceived || 0) + damageValue;
                    console.log(`🩸 Unit ${target.carduid} takes ${damageValue} damage from deploy effect (total: ${targetUnit.damageReceived})`);
                    break;

                case "modifyAP":
                    const apModifier = deployEffect.effect.parameters?.value || 0;
                    if (!targetUnit.currentAP) {
                        targetUnit.currentAP = targetUnit.cardData?.ap || 0;
                    }
                    targetUnit.currentAP += apModifier;
                    console.log(`⚔️ Unit ${target.carduid} AP modified by ${apModifier} (new AP: ${targetUnit.currentAP})`);
                    break;

                case "modifyHP":
                    const hpModifier = deployEffect.effect.parameters?.value || 0;
                    if (!targetUnit.currentHP) {
                        targetUnit.currentHP = targetUnit.cardData?.hp || 0;
                    }
                    targetUnit.currentHP += hpModifier;
                    console.log(`❤️ Unit ${target.carduid} HP modified by ${hpModifier} (new HP: ${targetUnit.currentHP})`);
                    break;

                default:
                    console.warn(`⚠️ Unknown deploy effect action: ${deployEffect.effect.action}`);
                    return {
                        success: false,
                        error: `Unknown deploy effect action: ${deployEffect.effect.action}`
                    };
            }

            console.log(`✅ Deploy effect ${deployEffect.effect.action} applied successfully to ${target.carduid}`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error applying deploy effect to target:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Deploy effect application failed'
            };
        }
    }



    // ============ CONSOLIDATED DEPLOY EFFECT PROCESSING ============
    
    /**
     * ✅ IMPROVED: Single-step deploy effect processing with proper typed interfaces
     * Consolidates checkForDeployEffects + EventFactory.createDeployEffectEvent into one efficient method
     * Uses DeployEffectEvent and DeployEffectEventData interfaces following PlayCardEvent pattern
     */
    static checkAndQueueDeployEffects(
        eventData: PlayCardEventData,
        playerId:string,
        gameEnv: GameEnvironment
    ): { success: boolean; effectsFound: number; error?: string } {
        try {
            console.log(`🔍 Checking and processing deploy effects for card: ${eventData.carduid}`);
            
            // Get card data from card database
            const { CardDatabaseManager } = require('../models/CardSystem');
            const cardData = CardDatabaseManager.getCardDetailsFromCarduid(eventData.carduid);
            if (!cardData) {
                console.warn(`⚠️ Card data not found for ${eventData.carduid}`);
                return { success: true, effectsFound: 0 }; // Not an error, just no effects
            }
            
            console.log(`📋 Checking deploy effects for card: ${cardData.name} (${eventData.carduid})`);
            
            // Check if card has effects with ENTERS_PLAY trigger
            const deployEffects: any[] = [];
            
            if (cardData.effects && cardData.effects.rules) {
                for (const rule of cardData.effects.rules) {
                    if (rule.trigger === 'ENTERS_PLAY') {
                        deployEffects.push(rule);
                        console.log(`🎯 Found deploy effect: ${rule.effect?.action || 'unknown'}`);
                    }
                }
            }
            
            console.log(`✅ Found ${deployEffects.length} deploy effects for ${eventData.carduid}`);
            
            // If no effects found, return success but no action needed
            if (deployEffects.length === 0) {
                return { success: true, effectsFound: 0 };
            }
            
            // ✅ IMPROVED: Use proper typed EventFactory method (consistent with PlayCardEvent pattern)
            console.log(`🚀 Deploy effects detected: ${deployEffects.length} effects for card ${eventData.carduid}`);
            
            const deployEvent: DeployEffectEvent = EventFactory.createDeployEffectEvent(
                playerId,
                eventData.carduid,
                deployEffects,
            );

            // Queue the properly typed event
            gameEnv.processingQueue.push(deployEvent);
            console.log(`📋 Deploy event queued: ${deployEvent.id} with ${deployEffects.length} effects`);
            
            return { success: true, effectsFound: deployEffects.length };
            
        } catch (error) {
            console.error(`❌ Error in consolidated deploy effect processing:`, error);
            return {
                success: false,
                effectsFound: 0,
                error: error instanceof Error ? error.message : 'Deploy effect processing failed'
            };
        }
    }
    
    /**
     * Execute Deploy effect triggered by card entering play
     */
    static executeDeployEffect(event: DeployEffectEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🚀 Executing DEPLOY_EFFECT_TRIGGERED event: ${event.id}`);

        try {
            // Use DeployEffectManager to process the Deploy effects
            const result = DeployEffectManager.processDeployEffect(gameEnv, event.playerId,event.data);

            if (!result.success) {
                console.log(`❌ Deploy effect processing failed: ${result.error}`);
                return {
                    success: false,
                    error: result.error
                };
            }

            if (result.requiresSelection) {
                console.log(`🎯 Deploy effects require player selection - workflow set up`);
                return {
                    success: true
                };
            }

            console.log(`✅ Deploy effects processed successfully: ${result.message}`);
            return {
                success: true
            };

        } catch (error) {
            console.error(`❌ Error in executeDeployEffect:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Deploy effect execution failed'
            };
        }
    }

    /**
     * Handle TARGET_CHOICE events - unified replacement for DEPLOY_TARGET_CHOICE
     * Now delegates to TargetChoiceManager for consistent processing
     */
    static executeDeployTargetChoice(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Executing TARGET_CHOICE event (legacy DeployEffect method): ${event.id}`);
        console.log(`🔄 Delegating to unified TargetChoiceManager`);

        try {
            // Delegate to unified TargetChoiceManager
            const result = TargetChoiceManager.executeTargetChoice(event, gameEnv);
            
            if (!result.success) {
                console.error(`❌ Unified target choice execution failed: ${result.error}`);
                return {
                    success: false,
                    error: result.error
                };
            }
            
            console.log(`✅ Successfully executed target choice via unified system`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error delegating to TargetChoiceManager:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Target choice delegation failed'
            };
        }
    }
}
