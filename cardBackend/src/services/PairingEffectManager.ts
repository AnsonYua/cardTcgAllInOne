// src/services/PairingEffectManager.ts
// Pairing effect management - handles PAIRING_COMPLETE triggered effects

import { GameEnvironment } from '../models/GameEnvironment';
import { TargetChoiceManager } from './TargetChoiceManager';
import { EffectExecutor } from './effects/EffectExecutor';
import {
    PlayCardEventData,
    EventFactory,
    PairingEffectEvent,
    PairingEffectEventData,
    PairingEffectDefinition,
    TargetFilters
} from './EventQueue/interfaces/GameEvent';
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
import { SlotZoneUtils } from '../utils/SlotZoneUtils';
import { getCardTotals } from '../utils/FieldValueCalculator';
import { eventDataValidator } from '../validators/EventDataValidator';
import { ensureEffectDefaults, normalizeEffectRule } from '../utils/EffectNormalizationUtils';

export interface PairingEffectResult {
    success: boolean;
    error?: string;
    message?: string;
    effectsProcessed?: number;
}

export interface CardPlacementResult {
    success: boolean;
    error?: string;
    isOnPair?: boolean;
    isOnLink?: boolean;
    slotName?: string;
}

export type EffectCondition = Record<string, unknown> & {
    type: string;
    target?: string;
    traits?: string[];
    cardTypes?: string[];
    operator?: string;
    value?: number;
    filters?: any;
};

export interface UnitCard {
    carduid: string;
    // REMOVED: cardId - use getCardIdFromUid(carduid) instead
    cardData: any;
}

export interface PilotCard {
    carduid: string;
    // REMOVED: cardId - use getCardIdFromUid(carduid) instead
    cardData: any;
}

export interface PairingEffect extends PairingEffectDefinition {
    conditions?: EffectCondition[];
    parameters?: PairingEffectParameters;
    target?: EffectTarget;
}

export interface PairingEffectParameters extends Record<string, unknown> {
    value?: number;
}

export interface EffectTarget {
    scope: string;
    type?: string;
    count?: number;
    filters?: TargetFilters;
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

export class PairingEffectManager implements StandardEffectManager {
    
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
            const normalizedEffect = ensureEffectDefaults(effect);
            const result = TargetChoiceManager.processEffectWithTargetChoice(
                gameEnv,
                eventData.playerId,
                eventData.carduid,
                normalizedEffect
            );
            
            // Track state changes
            if (result.success && result.affectedTargets) {
                for (const target of result.affectedTargets) {
                    // Handle both string and TargetReference types
                    const carduid = typeof target === 'string' ? target : target.carduid;
                    stateChanges.push({
                        type: 'CARD_PROPERTY',
                        carduid: carduid,
                        property: normalizedEffect.action || 'pairing_effect',
                        oldValue: 'unknown',
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
                error: error instanceof Error ? error.message : 'Pairing effect processing failed',
                affectedCards: []
            };
        }
    }
    
    // ============ DYNAMIC DATA RETRIEVAL HELPERS ============
    
    /**
     * ✅ IMPROVED: Check for pairing effects and return event directly (consolidated)
     * Eliminates intermediate step and object creation overhead
     */
    static checkForPairingEffectsEvent(
        eventData: PlayCardEventData,
        gameEnv: GameEnvironment,
        playerId: string
    ): PairingEffectEvent | null {
        console.log("PairingEffectManager.checkForPairingEffects - pairing detected, checking for triggered effects");
        
        const pairingEffects: PairingEffect[] = [];
        const player = gameEnv.getPlayer(playerId);
        if (!player || !player.zones) {
            console.log(`⚠️ Player ${playerId} or zones not found for pairing effect check`);
            return null;
        }

        // Find the slot where the pairing occurred
        const { slotName: pairedSlot, unit: pairedUnit } = SlotZoneUtils.findSlotByCarduid(player.zones, eventData.carduid);
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

        // Check both unit and pilot for pairing effects
        const cardsToCheck: CardInfo[] = [
            { carduid: pairedUnit.carduid, cardData: pairedUnit.cardData, cardType: 'unit' },
            { carduid: pilot.carduid, cardData: pilot.cardData, cardType: 'pilot' }
        ];

        for (const cardInfo of cardsToCheck) {
            const rawRules = Array.isArray(cardInfo.cardData?.effects?.rules)
                ? cardInfo.cardData.effects.rules
                : [];

            for (const rawRule of rawRules) {
                const normalizedEffect = this.normalizePairingRule(rawRule, pairedSlot!, cardInfo.carduid);
                if (!normalizedEffect) {
                    continue;
                }

                if (!this.validatePairingConditions(normalizedEffect.conditions || [], pairedUnit, pilot, gameEnv)) {
                    continue;
                }

                pairingEffects.push(normalizedEffect);
                const cardId = getCardIdFromUid(cardInfo.carduid);
                console.log(`🔗 Found pairing effect: ${normalizedEffect.effectId} from ${cardInfo.cardType} ${cardId} in slot ${pairedSlot}`);
            }
        }

        console.log(`🔍 Pairing effect check complete: found ${pairingEffects.length} effects`);
        
        // ✅ IMPROVED: Return event directly if effects found, null otherwise
        if (pairingEffects.length === 0) {
            return null;
        }
        
        // Create event directly instead of returning array
        const pairingEvent = EventFactory.createPairingEffectEvent(
            playerId,
            eventData.carduid,
            pairingEffects
        );

        console.log(`🤝 Created Pairing event: ${pairingEvent.id} with ${pairingEffects.length} effects`);
        return pairingEvent;
    }

    private static normalizePairingRule(rule: unknown, pairedSlot: string, sourceCarduid: string): PairingEffect | null {
        if (!rule || typeof rule !== 'object') {
            return null;
        }

        const raw = rule as Record<string, unknown>;
        const triggerValue = raw['trigger'];
        const resolvedTrigger = typeof triggerValue === 'string'
            ? triggerValue
            : triggerValue && typeof triggerValue === 'object' && typeof (triggerValue as Record<string, unknown>)['event'] === 'string'
                ? (triggerValue as Record<string, unknown>)['event'] as string
                : undefined;

        if (resolvedTrigger !== 'PAIRING_COMPLETE') {
            return null;
        }

        const normalized = normalizeEffectRule(raw, {
            fallbackEffectId: 'pairing_effect',
            expectedTriggers: ['PAIRING_COMPLETE'],
            defaultTrigger: 'PAIRING_COMPLETE',
            requireAction: true,
            defaultTargetScope: 'self',
            includePairedMetadata: {
                pairedSlot,
                sourceCarduid
            }
        }) as PairingEffect | null;

        if (!normalized) {
            console.log(`⚠️ Skipping pairing rule without actionable effect`);
            return null;
        }

        return normalized;
    }

    /**
     * Process pairing effects - main processing entry point
     */
    static processPairingEffect(gameEnv: GameEnvironment, playerId: string, eventData: PairingEffectEventData): PairingEffectResult {
        console.log(`🤝 PairingEffectManager.processPairingEffect - processing pairing effects`);
        
        try {
            const { effects } = eventData;
            const pairingEffects = effects as PairingEffect[];
            
            if (!pairingEffects || pairingEffects.length === 0) {
                console.log(`⚠️ No pairing effects to process`);
                return { 
                    success: true, 
                    message: 'No pairing effects to process',
                    effectsProcessed: 0 
                };
            }
            
            console.log(`🔗 Processing ${pairingEffects.length} pairing effect(s) for player ${playerId}`);
            let effectsProcessed = 0;
            
            // Process each pairing effect (no tracking needed - re-pairing is impossible)
            for (const effect of pairingEffects) {
                const normalizedEffect = ensureEffectDefaults(effect);
                const { effectId } = normalizedEffect;
                
                console.log(`⚡ Executing pairing effect: ${effectId}`);
                const action = EffectExecutor.getEffectAction(normalizedEffect);

                if (action === 'draw') {
                    const drawResult = EffectExecutor.applyPlayerDrawEffect(gameEnv, playerId, normalizedEffect);
                    if (!drawResult.success) {
                        console.error(`❌ Failed to execute draw effect ${effectId}: ${drawResult.error}`);
                        continue;
                    }

                    console.log(`✅ Pairing effect ${effectId} executed successfully`);
                    effectsProcessed++;
                    continue;
                }

                const sourceCarduid = normalizedEffect.sourceCarduid || eventData.carduid;
                const choiceResult = TargetChoiceManager.processEffectWithTargetChoice(
                    gameEnv,
                    playerId,
                    sourceCarduid,
                    normalizedEffect
                );

                if (!choiceResult.success && !choiceResult.requiresSelection) {
                    console.error(`❌ Failed to execute pairing effect ${effectId}: ${choiceResult.error}`);
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
            console.error(`❌ Error in PairingEffectManager.processPairingEffect:`, error);
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
        if (!card) {
            return 0;
        }

        const totals = getCardTotals(card as any);
        return totals.totalAP;
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
     * Get notification manager (copied from GameEngine to remove dependency)
     */
    private static getNotificationManager(gameEnv: GameEnvironment): NotificationManager {
        // Import dynamically to avoid circular dependencies
        const { GameNotificationManager } = require('./GameNotificationManager');
        return new GameNotificationManager(gameEnv);
    }
}
