// src/services/PairingEffect.ts
// Pairing effect management - handles PAIRING_COMPLETE triggered effects

import { GameEnvironment } from '../models/GameEnvironment';
import { TargetChoiceManager } from './TargetChoiceManager';
import { GameEvent, EventStatus, EventPriority } from './EventQueue/interfaces/GameEvent';
import { EventType } from '../models/GameEnums';

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

export interface PairingEffectResult {
    success: boolean;
    error?: string;
    message?: string;
    effectsProcessed?: number;
}

export interface PlayCardEventData {
    playerId: string;
    gameId: string;
    carduid: string;
    playAs: string;
    targetUnit?: string;
    fromBurst?: boolean;
    slotName?: string;
}

export interface CardPlacementResult {
    success: boolean;
    error?: string;
    isOnPair?: boolean;
    isOnLink?: boolean;
    slotName?: string;
}

export interface EffectCondition {
    type: string;
    target?: string;
    traits?: string[];
    cardTypes?: string[];
    operator?: string;
    value?: number;
    filters?: any;
}

export interface SourceCard {
    carduid: string;
    // REMOVED: cardId - use getCardIdFromUid(carduid) instead
    cardData: any;
    cardType: 'unit' | 'pilot';
}

export interface UnitCard {
    carduid: string;
    // REMOVED: cardId - use getCardIdFromUid(carduid) instead
    cardData: any;
    currentAP?: number;
    currentHP?: number;
}

export interface PilotCard {
    carduid: string;
    // REMOVED: cardId - use getCardIdFromUid(carduid) instead
    cardData: any;
    currentAP?: number;
    currentHP?: number;
}

export interface PairingEffect {
    effectId: string;
    type: string;
    trigger: string;
    action?: string;
    conditions?: EffectCondition[];
    parameters?: {
        value?: number;
        [key: string]: any;
    };
    target?: EffectTarget;
    // Minimal data - we can derive everything else from these two fields
    pairedSlot: string;           // Which slot the pairing occurred in
    sourceCarduid: string;       // Which card triggered the effect
    // Deprecated fields - will be removed after migration
    sourceCard?: SourceCard;
    unitCard?: UnitCard;
    pilotCard?: PilotCard;
}

export interface PairingEventData {
    playerId: string;
    effects: PairingEffect[];
}

export interface EffectDefinition {
    action: string;
    parameters: {
        value?: number;
        [key: string]: any;
    };
}

export interface EffectTarget {
    scope: string;
    type?: string;
    count?: number;
    filters?: any;
}

// ✅ REMOVED: FullPairingEffect interface - no longer needed after simplification
// All execution properties are now directly on PairingEffect interface

export interface PlayerZones {
    zones: {
        [slotName: string]: {
            unit?: UnitCard & { cardData?: any };
            pilot?: PilotCard & { cardData?: any };
        };
    } & {
        [key: string]: any;
    };
}

export interface EffectFilters {
    level?: string;
    hp?: string;
    traits?: string[];
    [key: string]: any;
}

export interface NotificationManager {
    [key: string]: any;
}

export interface CardInfo {
    carduid: string;
    // REMOVED: cardId - use getCardIdFromUid(carduid) instead
    cardData: any;
    cardType: 'unit' | 'pilot';
}

export class PairingEffect implements StandardEffectManager {
    
    // ============ STANDARDIZED INTERFACE IMPLEMENTATION ============
    
    /**
     * Execute effect using standardized interface
     */
    async executeEffect(event: StandardGameEvent, gameEnv: GameEnvironment): Promise<StandardExecutionResult> {
        const startTime = Date.now();
        console.log(`🤝 [STANDARD] Processing Pairing effect for card ${event.data.carduid}`);
        
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
                    message: `Pairing effect validation failed: ${validation.errors.join(', ')}`,
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
        
        const stateChanges: StateChange[] = [];
        const affectedCards: string[] = [];
        
        try {
            // Extract effects from standardized event structure
            const effects = event.data.parameters.conditions || [];
            console.log(`🤝 Processing ${effects.length} pairing effects`);
            
            let processedEffects = 0;
            
            // Process each pairing effect
            for (const effect of effects) {
                console.log(`⚡ Processing Pairing effect: ${effect.type || 'unnamed'}`);
                
                const result = await this.processStandardizedPairingEffect(
                    gameEnv,
                    event.data,
                    effect,
                    stateChanges
                );
                
                if (result.success) {
                    processedEffects++;
                    affectedCards.push(...result.affectedCards);
                    console.log(`✅ Pairing effect processed successfully`);
                }
            }
            
            return {
                success: processedEffects > 0,
                effectsApplied: processedEffects,
                affectedCards,
                stateChanges,
                metadata: {
                    executionTime: Date.now() - startTime,
                    manager: this.getManagerName(),
                    debugInfo: { processedEffects, totalEffects: effects.length }
                }
            };
            
        } catch (error) {
            console.error(`❌ Error in standardized pairing effect execution:`, error);
            return {
                success: false,
                effectsApplied: 0,
                affectedCards,
                stateChanges,
                error: {
                    code: 'EXECUTION_ERROR',
                    message: error instanceof Error ? error.message : 'Pairing effect execution failed',
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
        
        // Validate player exists
        if (!gameEnv.players || !gameEnv.players[event.data.playerId]) {
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
        return `Pairing effects for ${cardId}: ${effectCount} effects to process`;
    }
    
    /**
     * Get manager name for identification
     */
    getManagerName(): string {
        return 'PairingEffectManager';
    }
    
    // ============ STANDARDIZED HELPER METHODS ============
    
    /**
     * Process individual standardized pairing effect
     */
    private async processStandardizedPairingEffect(
        gameEnv: GameEnvironment,
        eventData: any,
        effect: any,
        stateChanges: StateChange[]
    ): Promise<{ success: boolean; error?: string; affectedCards: string[] }> {
        
        try {
            // Use unified TargetChoiceManager for processing
            const result = TargetChoiceManager.processEffectWithTargetChoice(
                gameEnv,
                eventData.playerId,
                eventData.carduid,
                effect
            );
            
            // Track state changes
            if (result.success && result.affectedTargets) {
                for (const target of result.affectedTargets) {
                    stateChanges.push({
                        type: 'CARD_PROPERTY',
                        carduid: target.carduid || target,
                        property: effect.action || 'pairing_effect',
                        oldValue: 'unknown',
                        newValue: 'modified',
                        timestamp: Date.now()
                    });
                }
            }
            
            return {
                success: result.success,
                error: result.error,
                affectedCards: result.affectedTargets?.map(t => t.carduid || t) || []
            };
            
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Pairing effect processing failed',
                affectedCards: []
            };
        }
    }
    
    // ============ DYNAMIC DATA RETRIEVAL HELPERS ============
    
    /**
     * Get pairing data dynamically from minimal effect information
     * ✅ IMPROVED: Single source of truth - derive all data from pairedSlot + sourceCarduid
     */
    private static getPairingData(effect: PairingEffect, gameEnv: GameEnvironment, playerId: string) {
        const player = gameEnv.getPlayer(playerId);
        if (!player?.zones) return null;
        
        const slotZone = (player.zones as any)[effect.pairedSlot];
        if (!slotZone) return null;
        
        return {
            unit: slotZone.unit,
            pilot: slotZone.pilot,
            sourceCard: this.getSourceCardFromUid(effect.sourceCarduid, slotZone),
            slot: effect.pairedSlot
        };
    }
    
    /**
     * Get source card data from UID
     */
    private static getSourceCardFromUid(sourceCarduid: string, slotZone: any) {
        if (slotZone.unit?.carduid === sourceCarduid) {
            return { ...slotZone.unit, cardType: 'unit' };
        }
        if (slotZone.pilot?.carduid === sourceCarduid) {
            return { ...slotZone.pilot, cardType: 'pilot' };
        }
        return null;
    }
    
    /**
     * ✅ IMPROVED: Check for pairing effects and return event directly (consolidated)
     * Eliminates intermediate step and object creation overhead
     */
    static checkForPairingEffectsEvent(eventData: PlayCardEventData, placementResult: CardPlacementResult, gameEnv: GameEnvironment): GameEvent | null {
        console.log("PairingEffect.checkForPairingEffects - pairing detected, checking for triggered effects");
        
        const pairingEffects: PairingEffect[] = [];
        const player = gameEnv.getPlayer(eventData.playerId);
        if (!player || !player.zones) {
            console.log(`⚠️ Player ${eventData.playerId} or zones not found for pairing effect check`);
            return null;
        }

        // Find the slot where the pairing occurred
        const { slot: pairedSlot, unit: pairedUnit } = this.findSlotByCarduid(player as any, eventData.carduid);
        if (!pairedSlot || !pairedUnit) {
            console.log(`⚠️ Could not find paired slot for card ${eventData.carduid}`);
            return null;
        }

        const slotZone = (player.zones as any)[pairedSlot];
        const pilot = slotZone?.pilot;
        
        if (!pilot) {
            console.log(`⚠️ No pilot found in paired slot ${pairedSlot}`);
            return null;
        }

        // Derive cardIds from carduids for logging
        const unitCardId = getCardIdFromUid(pairedUnit.carduid);
        const pilotCardId = getCardIdFromUid(pilot.carduid);
        console.log(`🤝 Checking pairing effects for Unit: ${unitCardId}, Pilot: ${pilotCardId}`);

        // Check both unit and pilot for pairing effects
        const cardsToCheck: CardInfo[] = [
            { carduid: pairedUnit.carduid, cardData: pairedUnit.cardData, cardType: 'unit' },
            { carduid: pilot.carduid, cardData: pilot.cardData, cardType: 'pilot' }
        ];

        for (const cardInfo of cardsToCheck) {
            if (!cardInfo.cardData?.effects?.rules) continue;

            const cardPairingEffects = cardInfo.cardData.effects.rules.filter((rule: any) => 
                rule.type === 'triggered' && rule.trigger === 'PAIRING_COMPLETE'
            );

            for (const effect of cardPairingEffects) {
                // Validate conditions (e.g., trait matching)
                if (this.validatePairingConditions(effect.conditions || [], pairedUnit, pilot, gameEnv)) {
                    // ✅ IMPROVED: Minimal data construction using spread operator
                    const pairingEffect: PairingEffect = {
                        ...effect,                           // Spread all effect properties (effectId, type, trigger, action, conditions)
                        pairedSlot: pairedSlot!,            // Required: slot where pairing occurred
                        sourceCarduid: cardInfo.carduid     // Required: source card that triggered effect
                        // ✅ Removed redundant: sourceCard, unitCard, pilotCard - can be derived from pairedSlot + sourceCarduid
                    };
                    pairingEffects.push(pairingEffect);
                    // Derive cardId from carduid for logging
                    const cardId = getCardIdFromUid(cardInfo.carduid);
                    console.log(`🔗 Found pairing effect: ${effect.effectId} from ${cardInfo.cardType} ${cardId} in slot ${pairedSlot}`);
                }
            }
        }

        console.log(`🔍 Pairing effect check complete: found ${pairingEffects.length} effects`);
        
        // ✅ IMPROVED: Return event directly if effects found, null otherwise
        if (pairingEffects.length === 0) {
            return null;
        }
        
        // Create event directly instead of returning array
        const eventDataObject = {
            playerId: eventData.playerId,
            effects: pairingEffects
        };
        
        const pairingEvent: GameEvent = {
            id: `pairing_${eventData.carduid}_${Date.now()}`,
            type: EventType.PAIRING_EFFECT_TRIGGERED,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            playerId: eventData.playerId,
            data: eventDataObject,
            timestamp: Date.now()
        };
        
        console.log(`🤝 Created Pairing event: ${pairingEvent.id} with ${pairingEffects.length} effects`);
        return pairingEvent;
    }

    /**
     * Process pairing effects - main processing entry point
     *   const eventDataObject = {
            playerId: eventData.playerId,
            effects: pairingEffects
        };
     */
    static processPairingEffect(gameEnv: GameEnvironment, eventData: PairingEventData): PairingEffectResult {
        console.log(`🤝 PairingEffect.processPairingEffect - processing pairing effects`);
        
        try {
            const { playerId, effects } = eventData;
            
            if (!effects || effects.length === 0) {
                console.log(`⚠️ No pairing effects to process`);
                return { 
                    success: true, 
                    message: 'No pairing effects to process',
                    effectsProcessed: 0 
                };
            }
            
            console.log(`🔗 Processing ${effects.length} pairing effect(s) for player ${playerId}`);
            let effectsProcessed = 0;
            
            // Process each pairing effect (no tracking needed - re-pairing is impossible)
            for (const effect of effects) {
                const { effectId } = effect;
                
                console.log(`⚡ Executing pairing effect: ${effectId}`);
                
                // Execute the effect based on its action
                const executionResult = this.executePairingEffectAction(gameEnv, playerId, effect);
                
                if (!executionResult.success) {
                    console.error(`❌ Failed to execute pairing effect ${effectId}: ${executionResult.error}`);
                    continue;
                }
                
                console.log(`✅ Pairing effect ${effectId} executed successfully`);
                effectsProcessed++;
            }
            
            console.log(`✅ Pairing effects processing complete: ${effectsProcessed} effects processed`);
            return { 
                success: true, 
                message: `Successfully processed ${effectsProcessed} pairing effects`,
                effectsProcessed 
            };
            
        } catch (error) {
            console.error(`❌ Error in PairingEffect.processPairingEffect:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Pairing effect processing failed'
            };
        }
    }

    /**
     * Validate pairing effect conditions (trait matching, etc.)
     */
    private static validatePairingConditions(conditions: EffectCondition[], unit: UnitCard, pilot: PilotCard, gameEnv: GameEnvironment): boolean {
        if (!conditions || conditions.length === 0) {
            return true; // No conditions means effect always triggers
        }

        for (const condition of conditions) {
            if (!this.validateSinglePairingCondition(condition, unit, pilot, gameEnv)) {
                return false; // All conditions must pass
            }
        }

        return true;
    }

    /**
     * Validate a single pairing condition
     */
    private static validateSinglePairingCondition(condition: EffectCondition, unit: UnitCard, pilot: PilotCard, gameEnv: GameEnvironment): boolean {
        console.log(`🔍 Validating condition:`, JSON.stringify(condition));

        switch (condition.type) {
            case 'traitMatch':
                return this.validateTraitMatch(condition, unit, pilot);
            case 'cardTypeMatch':
                return this.validateCardTypeMatch(condition, unit, pilot);
            case 'powerThreshold':
                return this.validatePowerThreshold(condition, unit, pilot);
            default:
                console.log(`⚠️ Unknown condition type: ${condition.type}`);
                return false;
        }
    }

    /**
     * Validate trait matching condition
     */
    private static validateTraitMatch(condition: EffectCondition, unit: UnitCard, pilot: PilotCard): boolean {
        const { target, traits } = condition;
        let targetCard;

        switch (target) {
            case 'unit':
                targetCard = unit;
                break;
            case 'pilot':
                targetCard = pilot;
                break;
            case 'any':
                // Check if either card has the required traits
                return this.hasRequiredTraits(unit, traits || []) || this.hasRequiredTraits(pilot, traits || []);
            default:
                console.log(`⚠️ Unknown trait match target: ${target}`);
                return false;
        }

        return this.hasRequiredTraits(targetCard, traits || []);
    }

    /**
     * Check if a card has the required traits
     */
    private static hasRequiredTraits(card: UnitCard | PilotCard, requiredTraits: string[]): boolean {
        if (!card?.cardData?.traits || !Array.isArray(card.cardData.traits)) {
            // Derive cardId from carduid for logging
            const cardId = card ? getCardIdFromUid(card.carduid) : 'unknown';
            console.log(`⚠️ Card ${cardId} has no traits array`);
            return false;
        }

        const cardTraits = card.cardData.traits;
        // Derive cardId from carduid for logging
        const cardId = getCardIdFromUid(card.carduid);
        console.log(`🏷️ Card ${cardId} traits:`, cardTraits, `Required:`, requiredTraits);

        // Check if card has all required traits
        const hasAllTraits = requiredTraits.every(requiredTrait => 
            cardTraits.some((cardTrait: string) => cardTrait === requiredTrait)
        );

        console.log(`✅ Trait match result for ${cardId}:`, hasAllTraits);
        return hasAllTraits;
    }

    /**
     * Validate card type matching condition
     */
    private static validateCardTypeMatch(condition: EffectCondition, unit: UnitCard, pilot: PilotCard): boolean {
        const { target, cardTypes } = condition;
        let targetCard;

        switch (target) {
            case 'unit':
                targetCard = unit;
                break;
            case 'pilot':
                targetCard = pilot;
                break;
            case 'any':
                return this.hasRequiredCardType(unit, cardTypes || []) || this.hasRequiredCardType(pilot, cardTypes || []);
            default:
                console.log(`⚠️ Unknown card type match target: ${target}`);
                return false;
        }

        return this.hasRequiredCardType(targetCard, cardTypes || []);
    }

    /**
     * Check if a card has the required card type
     */
    private static hasRequiredCardType(card: UnitCard | PilotCard, requiredTypes: string[]): boolean {
        if (!card?.cardData?.cardType) {
            return false;
        }

        const cardType = card.cardData.cardType;
        return requiredTypes.includes(cardType);
    }

    /**
     * Validate power threshold condition
     */
    private static validatePowerThreshold(condition: EffectCondition, unit: UnitCard, pilot: PilotCard): boolean {
        const { target, operator = '>=', value = 0 } = condition;
        let targetCard;

        switch (target) {
            case 'unit':
                targetCard = unit;
                break;
            case 'pilot':
                targetCard = pilot;
                break;
            case 'combined':
                const unitPower = this.getCardPower(unit);
                const pilotPower = this.getCardPower(pilot);
                const combinedPower = unitPower + pilotPower;
                return this.compareValues(combinedPower, operator, value);
            default:
                console.log(`⚠️ Unknown power threshold target: ${target}`);
                return false;
        }

        const cardPower = this.getCardPower(targetCard);
        return this.compareValues(cardPower, operator, value);
    }

    /**
     * Get card's current power
     */
    private static getCardPower(card: UnitCard | PilotCard): number {
        return card?.currentAP || card?.cardData?.ap || 0;
    }

    /**
     * Compare values using operator
     */
    private static compareValues(actual: number, operator: string, expected: number): boolean {
        switch (operator) {
            case '>=':
                return actual >= expected;
            case '>':
                return actual > expected;
            case '<=':
                return actual <= expected;
            case '<':
                return actual < expected;
            case '===':
                return actual === expected;
            default:
                console.log(`⚠️ Unknown comparison operator: ${operator}`);
                return false;
        }
    }

    /**
     * Execute specific pairing effect action (draw, heal, etc.)
     * ✅ IMPROVED: Updated to use simplified PairingEffect structure
     */
    private static executePairingEffectAction(gameEnv: GameEnvironment, playerId: string, effect: PairingEffect): { success: boolean; error?: string } {
        // With simplified structure, action and parameters are now directly on the effect
        const { action, parameters = {}, target } = effect;
        
        console.log(`🎯 Executing pairing action: ${action} with parameters:`, parameters);
        
        try {
            switch (action) {
                case 'draw':
                    return this.executePairingDrawEffect(gameEnv, playerId, parameters, target);
                case 'heal':
                    return this.executePairingHealEffect(gameEnv, playerId, parameters, target, effect);
                case 'modifyAP':
                    return this.executePairingModifyAPEffect(gameEnv, playerId, parameters, target, effect);
                case 'modifyHP':
                    return this.executePairingModifyHPEffect(gameEnv, playerId, parameters, target, effect);
                default:
                    console.log(`⚠️ Unknown pairing effect action: ${action}`);
                    return {
                        success: false,
                        error: `Unknown pairing effect action: ${action}`
                    };
            }
        } catch (error) {
            console.error(`❌ Error executing pairing action ${action}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : `Failed to execute ${action}`
            };
        }
    }

    /**
     * Execute draw effect from pairing
     */
    private static executePairingDrawEffect(gameEnv: GameEnvironment, playerId: string, parameters: { [key: string]: any; value?: number }, target: EffectTarget | undefined): { success: boolean; error?: string } {
        const drawCount = parameters.value || 1;
        if (!target) {
            return {
                success: false,
                error: 'No target specified for draw effect'
            };
        }
        const targetPlayerId = target.scope === 'self' ? playerId : gameEnv.getOpponentId(playerId)!;
        
        if (!targetPlayerId) {
            return {
                success: false,
                error: 'Could not determine target player for draw effect'
            };
        }
        
        const player = gameEnv.getPlayer(targetPlayerId);
        if (!player || !player.deck) {
            return {
                success: false,
                error: `Target player ${targetPlayerId} or deck not found`
            };
        }
        
        // Draw cards using GameEngine method
        this.drawCards(player.deck, drawCount);
        
        console.log(`🃏 Drew ${drawCount} card(s) for player ${targetPlayerId} via pairing effect`);
    
        
        return { success: true };
    }

    /**
     * Execute heal effect from pairing
     */
    private static executePairingHealEffect(gameEnv: GameEnvironment, playerId: string, parameters: { [key: string]: any; value?: number }, target: EffectTarget | undefined, effect: PairingEffect): { success: boolean; error?: string } {
        const healAmount = parameters.value || 0;
        console.log(`🩹 Executing pairing heal effect: ${healAmount} HP`);
        
        // Use existing CardEffect system for healing
        const { CardEffect } = require('./CardEffect');
        const healData = {
            cardId: this.getPairingData(effect, gameEnv, playerId)?.unit?.cardId || 'unknown',
            playerId: playerId,
            healAmount: healAmount,
            effectId: effect.effectId,
            triggeredByPairing: true
        };
        
        const result = CardEffect.executeRepairEffect(gameEnv, healData);
        
        if (!result.success) {
            console.log(`❌ Pairing heal effect failed: ${result.error}`);
            return result;
        }
        
        console.log(`✅ Pairing heal effect executed: ${result.message}`);
        return result;
    }

    /**
     * Execute AP modification effect from pairing using unified TARGET_CHOICE system
     * Now supports player choice for strategic target selection (e.g., ST01-006)
     */
    private static executePairingModifyAPEffect(gameEnv: GameEnvironment, playerId: string, parameters: { [key: string]: any; value?: number }, target: EffectTarget | undefined, effect: PairingEffect): { success: boolean; error?: string } {
        const modifyAmount = parameters.value || 0;
        if (!target) {
            return {
                success: false,
                error: 'No target specified for AP modification effect'
            };
        }
        console.log(`⚔️ Executing pairing AP modification: ${modifyAmount > 0 ? '+' : ''}${modifyAmount} AP on ${target.scope} targets`);
        
        try {
            const normalizedTarget = target || effect.target;
            const targetConfig = {
                type: (normalizedTarget?.type as 'unit' | 'pilot' | 'card') || 'unit',
                scope: (normalizedTarget?.scope as 'any' | 'self' | 'opponent') || 'self',
                count: normalizedTarget?.count && normalizedTarget.count > 0 ? normalizedTarget.count : 1,
                filters: normalizedTarget?.filters || {}
            };

            const normalizedEffect = { ...(effect as any), target: targetConfig };
            const pairingData = this.getPairingData(effect, gameEnv, playerId);
            const sourceCarduid = effect.sourceCarduid || pairingData?.unit?.carduid || 'unknown';

            // Use unified TargetChoiceManager directly with normalized structure
            const result = TargetChoiceManager.processEffectWithTargetChoice(
                gameEnv,
                playerId,
                sourceCarduid,
                normalizedEffect
            );
            
            // Return result directly - no unnecessary conversions
            return {
                success: result.success,
                error: result.error
            };
            
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Pairing AP modification failed'
            };
        }
    }
    
    /**
     * Find eligible targets based on target filters
     */
    private static findEligibleTargets(player: PlayerZones, target: EffectTarget): (UnitCard & { cardData?: any })[] {
        const SLOT_ZONES = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];
        const eligibleTargets: any[] = [];
        
        for (const slotName of SLOT_ZONES) {
            const slot = player.zones[slotName];
            if (slot?.unit && target.type === 'unit') {
                const unit = slot.unit;
                
                // Apply filters
                if (this.matchesFilters(unit, target.filters || {})) {
                    eligibleTargets.push(unit);
                }
            }
        }
        
        console.log(`🎯 Found ${eligibleTargets.length} eligible targets for effect`);
        return eligibleTargets;
    }
    
    /**
     * Check if a unit matches the target filters
     */
    private static matchesFilters(unit: UnitCard & { cardData?: any }, filters: EffectFilters): boolean {
        // Level filter
        if (filters.level) {
            const unitLevel = unit.cardData?.level || 0;
            if (!this.compareValues(unitLevel, filters.level.includes('<=') ? '<=' : '>=', 
                                  parseInt(filters.level.replace(/[^\d]/g, '')) || 0)) {
                return false;
            }
        }
        
        // Add more filter types as needed (hp, traits, etc.)
        
        return true;
    }

    /**
     * Execute HP modification effect from pairing
     */
    private static executePairingModifyHPEffect(gameEnv: GameEnvironment, playerId: string, parameters: { [key: string]: any; value?: number }, target: EffectTarget | undefined, effect: PairingEffect): { success: boolean; error?: string } {
        const modifyAmount = parameters.value || 0;
        console.log(`❤️ Executing pairing HP modification: ${modifyAmount > 0 ? '+' : ''}${modifyAmount} HP`);
        
        // Find the paired unit to modify
        const player = gameEnv.getPlayer(playerId);
        if (!player) {
            return {
                success: false,
                error: `Player ${playerId} not found`
            };
        }
        
        // ✅ IMPROVED: Use dynamic data retrieval instead of stored objects
        const pairingData = this.getPairingData(effect, gameEnv, playerId);
        if (!pairingData?.unit) {
            return {
                success: false,
                error: `Could not find unit in slot ${effect.pairedSlot} for HP modification`
            };
        }
        const pairedUnit = pairingData.unit;
        if (!pairingData.unit) {
            return {
                success: false,
                error: `Could not find paired unit for HP modification`
            };
        }
        
        // Apply HP modification
        if (pairedUnit) {
            pairedUnit.currentHP = Math.max(0, (pairedUnit.currentHP || pairedUnit.cardData?.hp || 0) + modifyAmount);
        }
        
        console.log(`✅ Modified ${pairingData.unit.cardId} HP by ${modifyAmount}, new HP: ${pairedUnit?.currentHP}`);
        return { success: true };
    }

    /**
     * Helper method for drawing cards (similar to GameEngine implementation)
     */
    private static drawCards(deck: any, count: number): void {
        for (let i = 0; i < count && deck.mainDeck.length > 0; i++) {
            const drawnCard = deck.mainDeck.shift();
            if (drawnCard) {
                deck._handUids.push(drawnCard);
            }
        }
        console.log(`🃏 Drew ${count} cards, hand size: ${deck._handUids.length}`);
    }

    /**
     * Find slot by card UID (copied from GameEngine to remove dependency)
     */
    private static findSlotByCarduid(player: PlayerZones, carduid: string): { slot: string | null; unit: (UnitCard & { cardData?: any }) | null } {
        const SLOT_ZONES = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];
        
        for (const slotName of SLOT_ZONES) {
            const slot = player.zones[slotName];
            if (slot?.unit?.carduid === carduid) {
                return { slot: slotName, unit: slot.unit };
            }
            console.log("slot data q1111 ",JSON.stringify(slot));
            if (slot?.pilot?.carduid === carduid) {
                return { slot: slotName, unit: slot.unit || null }; // Return unit even if pilot was matched
            }
        }
        
        return { slot: null, unit: null };
    }

    /**
     * Get notification manager (copied from GameEngine to remove dependency)
     */
    private static getNotificationManager(gameEnv: GameEnvironment): NotificationManager {
        // Import dynamically to avoid circular dependencies
        const { GameNotificationManager } = require('./GameNotificationManager');
        return new GameNotificationManager(gameEnv);
    }
}
