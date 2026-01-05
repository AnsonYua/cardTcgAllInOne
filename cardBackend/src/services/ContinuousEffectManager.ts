// src/services/ContinuousEffectManager.ts
// Universal card effect processor for all effect types

import { GameEnvironment } from '../models/GameEnvironment';
import { GamePhase } from '../models/GameEnums';
import { ZoneCard, CardDatabaseManager } from '../models/CardSystem';
import { EffectProcessingResult } from '../models/ContinuousEffectStore';
import { SLOT_ZONES } from '../config/gameConstants';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';
import { EffectExecutor } from './effects/EffectExecutor';
import {
    ensureEffectDefaults,
    normalizeSourceConditions,
    NormalizedSourceCondition
} from '../utils/EffectNormalizationUtils';
import { EffectDefinition } from './EventQueue/interfaces/GameEvent';

export interface EffectResult {
    success: boolean;
    message?: string;
    error?: string;
    affectedCards?: any[];
    // REMOVED: requiresSelection and selection - all effects now process automatically
}

/**
 * Universal ContinuousEffectManager class that handles any card effect based on JSON structure
 * Works with any target, action, and parameters combination
 */
type ZoneCardWithData = ZoneCard & {
    carduid: string;
    cardData?: {
        effects?: {
            rules?: EffectDefinition[];
        };
        [key: string]: unknown;
    };
    [key: string]: unknown;
};

export class ContinuousEffectManager {
    
    /**
     * Static method to execute repair effects from StateBasedActionEngine
     */
    static executeRepairEffect(gameEnv: GameEnvironment, repairData: any): EffectResult {
        // Handle both data structures: direct fields or nested in data
        const eventData = repairData.data || repairData;
        const cardId = eventData.cardId || (repairData.affectedCards && repairData.affectedCards[0]);
        const carduid = eventData.carduid;
        const playerId = eventData.playerId || (repairData.affectedPlayers && repairData.affectedPlayers[0]);
        const healAmount = eventData.healAmount || 2; // Default to 2 for repair_2
        
        console.log(`🩹 Static repair execution: ${healAmount} HP for ${cardId} (${carduid || 'unknown UID'})`);
        
        // Find the target unit
        const player = gameEnv.players[playerId];
        if (!player || !player.zones) {
            return {
                success: false,
                error: 'Player not found'
            };
        }
        
        // Find unit in slot zones
        let targetUnit = null;
        
        for (const slot of SLOT_ZONES) {
            const slotZone = (player.zones as any)[slot];
            if (slotZone?.unit) {
                // First try to match by carduid if available
                if (carduid && slotZone.unit.carduid === carduid) {
                    targetUnit = slotZone.unit;
                    break;
                }
                // Fallback to matching by cardId
                else if (cardId && slotZone.unit.cardId === cardId) {
                    targetUnit = slotZone.unit;
                    break;
                }
            }
        }
        
        if (!targetUnit) {
            console.log(`❌ Could not find target unit with cardId: ${cardId}, carduid: ${carduid} for player: ${playerId}`);
            return {
                success: false,
                error: `Target unit not found (cardId: ${cardId}, carduid: ${carduid})`
            };
        }
        
        // Get card data to check max HP
        const cardData = ContinuousEffectManager.getStaticCardData(cardId);
        if (!cardData) {
            return {
                success: false,
                error: 'Card data not found'
            };
        }
        
        const maxHP = cardData.hp || targetUnit.originalHP || 0;
        const currentDamage = targetUnit.damageReceived || 0;
        const currentHP = Math.max(0, maxHP - currentDamage);

        const healAmountClamped = Math.max(0, healAmount);
        const actualHealing = Math.min(healAmountClamped, currentDamage);
        const newDamage = currentDamage - actualHealing;
        const newHP = Math.max(0, maxHP - newDamage);

        if (actualHealing > 0) {
            targetUnit.damageReceived = newDamage;

            console.log(`✅ Repaired ${cardId} for ${actualHealing} HP (${currentHP} → ${newHP}/${maxHP})`);

            return {
                success: true,
                message: `Repaired ${cardId} for ${actualHealing} HP`,
                affectedCards: [targetUnit]
            };
        } else {
            console.log(`ℹ️ ${cardId} already at max HP (${currentHP}/${maxHP}) - no repair needed`);
            
            return {
                success: true,
                message: `${cardId} already at max HP - no repair needed`,
                affectedCards: []
            };
        }
    }
    
    /**
     * Static helper to get card data
     */
    private static getStaticCardData(cardId: string): any {
        try {
            return CardDatabaseManager.getCardDetails(cardId);
        } catch (error) {
            console.error(`❌ Error loading card data for ${cardId}:`, error);
            return null;
        }
    }

    // ============================================================================
    // CONTINUOUS EFFECT PROCESSING METHODS
    // ============================================================================


    
    

    /**
     * Extract all unit cards in slot zones for a player
     * Note: Only returns units from slot1-slot6, excludes base/shield/energy/trash areas
     */
    static getAllPlayerUnitsInSlot(playerId: string, gameEnv: GameEnvironment): ZoneCard[] {
        const player = gameEnv.players[playerId];
        if (!player?.zones) return [];
        
        const units: ZoneCard[] = [];
        
        for (const slotName of SLOT_ZONES) {
            const unit = (player.zones as any)[slotName]?.unit;
            if (unit) units.push(unit);
        }
        
        return units;
    }

    
    


    
    /**
     * Get effect value from unified parameters structure
     * All numeric effects now use 'value' parameter for simplicity
     */
    static getEffectValue(action: string, parameters: any): number {
        // Unified structure: all numeric effects use 'value' parameter
        return parameters.value || 0;
    }

    /**
     * Validate effect conditions and turn timing (separated architecture)
     */
    static validateEffectConditions(
        storedEffect: EffectDefinition,
        gameEnv: GameEnvironment,
        cardOwnerPlayerId: string | null,
        sourceCard?: ZoneCardWithData
    ): boolean {
        // Step 1: Check turn timing first (fast exit)
        const actionTurn = storedEffect.timing?.actionTurn;
        if (actionTurn) {
            if (!ContinuousEffectManager.checkTurnTiming(actionTurn, gameEnv, cardOwnerPlayerId)) {
                return false;
            }
        }
        
        // Step 2: Check game state conditions
        const conditions = storedEffect.conditions || [];
        
        // If no conditions specified, effect is active (assuming turn timing passed)
        if (conditions.length === 0) {
            return true;
        }
        
        // All conditions must be met for effect to be active
        for (const condition of conditions) {
            if (!ContinuousEffectManager.checkSingleCondition(condition, gameEnv, cardOwnerPlayerId, sourceCard)) {
                return false;
            }
        }
        
        // All conditions passed
        return true;
    }

    /**
     * Check turn timing (separated from game state conditions)
     */
    private static checkTurnTiming(actionTurn: string, gameEnv: GameEnvironment, cardOwnerPlayerId: string | null): boolean {
        switch (actionTurn) {
            case 'YOUR_TURN':
                return cardOwnerPlayerId ? gameEnv.currentPlayer === cardOwnerPlayerId : false;
                
            case 'OPPONENT_TURN':
                return cardOwnerPlayerId ? gameEnv.currentPlayer !== cardOwnerPlayerId : false;
                
            case 'ANY_TIME':
                return true;
                
            default:
                console.log(`⚠️ Unknown actionTurn: ${actionTurn}`);
                // Default to allow effect if timing is unknown (fail-safe)
                return true;
        }
    }

    /**
     * Check a single game state condition (no turn timing)
     */
    private static checkSingleCondition(
        condition: unknown,
        gameEnv: GameEnvironment,
        cardOwnerPlayerId: string | null,
        sourceCard?: any
    ): boolean {
        if (typeof condition === 'string') {
            switch (condition) {
                case 'isPaired':
                    return ContinuousEffectManager.checkPlayerHasPairedUnits(cardOwnerPlayerId, gameEnv);

                case 'isLinked':
                    return ContinuousEffectManager.checkIsLinked(cardOwnerPlayerId, gameEnv);

                case 'MAIN_PHASE':
                    return gameEnv.phase === GamePhase.MAIN_PHASE;

                case 'ATTACK_PHASE':
                case 'BATTLE_PHASE':
                    return gameEnv.phase === GamePhase.ATTACK_PHASE || gameEnv.phase === GamePhase.DAMAGE_PHASE;

                case 'END_PHASE':
                    return gameEnv.phase === GamePhase.END_PHASE;

                case 'DRAW_PHASE':
                    return gameEnv.phase === GamePhase.DRAW_PHASE;

                default:
                    console.log(`⚠️ Unknown condition: ${condition}`);
                    return true;
            }
        }

        if (!condition || typeof condition !== 'object') {
            return true;
        }

        const typedCondition = condition as Record<string, unknown>;
        const type = (typedCondition.type as string) || '';
        const scope = (typedCondition.scope as string) || 'player';

        switch (type) {
            case 'paired':
            case 'isPaired':
                if (scope === 'source') {
                    return sourceCard ? ContinuousEffectManager.checkIsPaired(sourceCard, gameEnv) : false;
                }
                return ContinuousEffectManager.checkPlayerHasPairedUnits(cardOwnerPlayerId, gameEnv);

            case 'linked':
            case 'isLinked':
                if (scope === 'source') {
                    return sourceCard ? ContinuousEffectManager.checkCardIsLinked(sourceCard, gameEnv) : false;
                }
                return ContinuousEffectManager.checkIsLinked(cardOwnerPlayerId, gameEnv);

            case 'turn':
                return typeof typedCondition.value === 'string'
                    ? ContinuousEffectManager.checkTurnTiming(typedCondition.value, gameEnv, cardOwnerPlayerId)
                    : true;

            case 'phase':
                if (typeof typedCondition.value !== 'string') {
                    return true;
                }
                switch (typedCondition.value) {
                    case 'MAIN_PHASE':
                        return gameEnv.phase === GamePhase.MAIN_PHASE;
                    case 'ATTACK_PHASE':
                    case 'BATTLE_PHASE':
                        return gameEnv.phase === GamePhase.ATTACK_PHASE || gameEnv.phase === GamePhase.DAMAGE_PHASE;
                    case 'END_PHASE':
                        return gameEnv.phase === GamePhase.END_PHASE;
                    case 'DRAW_PHASE':
                        return gameEnv.phase === GamePhase.DRAW_PHASE;
                    default:
                        return true;
                }

            default:
                console.log(`⚠️ Unknown structured condition: ${type}`);
                return true;
        }
    }

    /**
     * Check if card owner has paired units (placeholder - implement based on game logic)
     */
    private static checkPlayerHasPairedUnits(cardOwnerPlayerId: string | null, gameEnv: GameEnvironment): boolean {
        if (!cardOwnerPlayerId) return false;
        
        const player = gameEnv.players[cardOwnerPlayerId];
        if (!player?.zones) return false;
        
        // Check all slot zones for paired units (unit + pilot)
        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            if (slot?.unit && slot?.pilot) {
                return true; // Found at least one paired slot
            }
        }
        
        return false;
    }

    /**
     * Check if specific source conditions are satisfied for a card
     */
    static sourceConditionsMet(
        effectRule: EffectDefinition,
        card: ZoneCardWithData,
        gameEnv: GameEnvironment,
        cardOwnerPlayerId: string | null
    ): boolean {
        if (!card?.cardData?.effects?.rules?.length) {
            return false;
        }

        const normalizedConditions = normalizeSourceConditions(effectRule.sourceConditions);
        if (normalizedConditions.length === 0) {
            return true;
        }

        for (const condition of normalizedConditions) {
            if (!ContinuousEffectManager.evaluateSourceCondition(condition, card, gameEnv, cardOwnerPlayerId)) {
                return false;
            }
        }

        return true;
    }

    private static evaluateSourceCondition(
        condition: NormalizedSourceCondition,
        card: ZoneCardWithData,
        gameEnv: GameEnvironment,
        cardOwnerPlayerId: string | null
    ): boolean {
        const type = condition.type || '';

        switch (type) {
            case 'paired':
            case 'isPaired':
                return ContinuousEffectManager.checkIsPaired(card, gameEnv);

            case 'linked':
            case 'isLinked':
                return ContinuousEffectManager.checkCardIsLinked(card, gameEnv);

            case 'controller': {
                const desired = typeof condition.value === 'string' ? (condition.value as string) : undefined;
                if (!desired) {
                    return true;
                }
                const ownerId = ContinuousEffectManager.findCardOwner(card.carduid, gameEnv);
                if (!ownerId) {
                    return false;
                }
                if (desired === 'self') {
                    return ownerId === cardOwnerPlayerId;
                }
                if (desired === 'opponent') {
                    return cardOwnerPlayerId ? ownerId !== cardOwnerPlayerId : false;
                }
                return ownerId === desired;
            }

            default:
                console.log(`⚠️ Unknown source condition type: ${type}`);
                return true;
        }
    }

    /**
     * Check if card owner has linked units (placeholder - implement based on game logic)
     */
    private static checkIsLinked(cardOwnerPlayerId: string | null, gameEnv: GameEnvironment): boolean {
        if (!cardOwnerPlayerId) return false;
        
        const player = gameEnv.players[cardOwnerPlayerId];
        if (!player?.zones) return false;
        
        // Check all slot zones for linked units (unit.link matches pilot traits/name)
        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            if (slot?.unit && slot?.pilot) {
                if (ContinuousEffectManager.detectLink(slot.unit, slot.pilot)) {
                    return true; // Found at least one linked pair
                }
            }
        }
        
        return false;
    }

    /**
     * Detect if unit and pilot form a link (unit.link matches pilot.name or traits)
     */
    private static detectLink(unit: any, pilot: any): boolean {
        if (!unit?.cardData?.link || !pilot?.cardData) return false;
        
        const unitLink = unit.cardData.link;
        const pilotName = pilot.cardData.name;
        const pilotTraits = pilot.cardData.traits || [];
        
        // Check if unit's link matches pilot's name
        if (pilotName && unitLink.includes(pilotName)) {
            return true;
        }
        
        // Check if unit's link matches any of pilot's traits
        for (const linkValue of unitLink) {
            if (pilotTraits.includes(linkValue)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Find which player owns a specific card by carduid
     */
    static findCardOwner(carduid: string, gameEnv: GameEnvironment): string | null {
        for (const [playerId, player] of Object.entries(gameEnv.players)) {
            if (!player.zones) continue;
            
            // Check all slot zones for the card
            for (const slotName of SLOT_ZONES) {
                const slot = (player.zones as any)[slotName];
                if (slot?.unit?.carduid === carduid || slot?.pilot?.carduid === carduid) {
                    return playerId;
                }
            }
            
            // Check other zones (base, shield, energy, trash) 
            const otherZones = ['base', 'shieldArea', 'energyArea', 'trashArea'];
            for (const zoneName of otherZones) {
                const zone = (player.zones as any)[zoneName];
                if (Array.isArray(zone)) {
                    for (const card of zone) {
                        if (card?.carduid === carduid) {
                            return playerId;
                        }
                    }
                } else if (zone?.carduid === carduid) {
                    return playerId;
                }
            }
        }
        
        return null;
    }

    // ============================================================================
    // EFFECT REGISTRY MANAGEMENT (NEW - January 2025)
    // ============================================================================

    /**
     * Update effect registry from effect sources (source-based architecture)
     */
    static updateEffectRegistry(gameEnv: GameEnvironment): void {
        console.log(`📋 Updating effect registry from sources`);
        
        // Process each player to find effect sources
        for (const [playerId, player] of Object.entries(gameEnv.players)) {
            if (!player.zones) continue;
            
            // Ensure player has effectRegistry
            if (!player.effectRegistry) {
                player.effectRegistry = {};
            }
            
            console.log(`🔍 Scanning player ${playerId} for effect sources`);
            
            // Scan each slot for cards that can be effect sources
            for (const slotName of SLOT_ZONES) {
                const slot = (player.zones as any)[slotName];
                
                // Process unit cards as potential effect sources
                if (slot?.unit) {
                    ContinuousEffectManager.updateRegistryFromCard(slot.unit as ZoneCardWithData, playerId, gameEnv);
                }
                
                // Process pilot cards as potential effect sources  
                if (slot?.pilot) {
                    ContinuousEffectManager.updateRegistryFromCard(slot.pilot as ZoneCardWithData, playerId, gameEnv);
                }
            }
            
            // Cleanup invalid effects for this player
            ContinuousEffectManager.cleanupPlayerRegistryEffects(player, playerId, gameEnv);
            
            const activeEffects = Object.keys(player.effectRegistry).length;
            console.log(`✅ Player ${playerId} effect registry: ${activeEffects} active effects`);
        }
    }

    /**
     * Update registry from a single card (if it's a valid effect source)
     */
    static updateRegistryFromCard(card: ZoneCardWithData, playerId: string, gameEnv: GameEnvironment): void {
        const player = gameEnv.players[playerId];
        if (!player) return;
        
        const effects = (card.cardData?.effects?.rules as EffectDefinition[] | undefined) || [];
        if (effects.length === 0) {
            return;
        }
        
        for (const effectRule of effects) {
            const trigger = ContinuousEffectManager.extractTrigger(effectRule);
            if (trigger !== 'continuous') continue;
            
            if (!ContinuousEffectManager.sourceConditionsMet(effectRule, card, gameEnv, playerId)) {
                continue;
            }

            // Check if effect conditions are met
            if (!ContinuousEffectManager.validateEffectConditions(effectRule, gameEnv, playerId, card)) {
                continue;
            }
            
            const effectKey = `${effectRule.effectId}_${card.carduid}`;
            
            // Add effect to player's registry if not already present
            if (!player.effectRegistry[effectKey]) {
                const normalizedEffect = ensureEffectDefaults(effectRule);
                const registryEntry = ContinuousEffectManager.createRegistryEntry(normalizedEffect, card, playerId);
                player.effectRegistry[effectKey] = registryEntry;
                console.log(`  ➕ Added effect ${effectRule.effectId} from ${card.cardId} to player ${playerId} registry`);
            }
        }
    }

    /**
     * Create registry entry for an effect
     */
    static createRegistryEntry(effectRule: EffectDefinition, sourceCard: ZoneCardWithData, sourcePlayerId: string): any {
        const effectAction = EffectExecutor.getEffectAction(effectRule) || 'modifyAP';
        const parameters = effectRule.parameters || {};
        const value = ContinuousEffectManager.getEffectValue(effectAction, parameters);
        
        return {
            effectId: effectRule.effectId,
            sourceCarduid: sourceCard.carduid,
            sourcePlayerId: sourcePlayerId,
            effectData: effectRule,
            scope: effectRule.target?.scope || 'self_all_unit',
            action: effectAction,
            value: value,
            conditions: effectRule.conditions || [],
            active: true,
            timestamp: Date.now()
        };
    }

    /**
     * Check if a card is paired (for pair-triggered effects)
     */
    static checkIsPaired(card: ZoneCardWithData, gameEnv: GameEnvironment): boolean {
        // Find the card's slot
        for (const [playerId, player] of Object.entries(gameEnv.players)) {
            if (!player.zones) continue;
            
            for (const slotName of SLOT_ZONES) {
                const slot = (player.zones as any)[slotName];
                
                if (slot?.unit?.carduid === card.carduid) {
                    // Card found in unit position, check if slot has pilot
                    return slot.pilot != null;
                }
                
                if (slot?.pilot?.carduid === card.carduid) {
                    // Card found in pilot position, check if slot has unit
                    return slot.unit != null;
                }
            }
        }
        
        return false;
    }

    private static checkCardIsLinked(card: ZoneCardWithData, gameEnv: GameEnvironment): boolean {
        for (const player of Object.values(gameEnv.players)) {
            if (!player?.zones) continue;

            for (const slotName of SLOT_ZONES) {
                const slot = (player.zones as any)[slotName];
                if (!slot?.unit && !slot?.pilot) {
                    continue;
                }

                const isUnit = slot?.unit?.carduid === card.carduid;
                const isPilot = slot?.pilot?.carduid === card.carduid;

                if (!isUnit && !isPilot) {
                    continue;
                }

                if (slot.unit && slot.pilot) {
                    return ContinuousEffectManager.detectLink(slot.unit, slot.pilot);
                }

                return false;
            }
        }

        return false;
    }

    /**
     * Apply registry effects to all valid targets
     */
    static applyRegistryToTargets(gameEnv: GameEnvironment): void {
        console.log(`⚡ Applying registry effects to targets`);
        
        let totalAppliedCount = 0;
        
        // Apply effects from each player's registry
        for (const [playerId, player] of Object.entries(gameEnv.players)) {
            if (!player.effectRegistry) continue;
            
            let playerAppliedCount = 0;
            
            // Apply each active effect from player's registry to its targets
            for (const [effectKey, effectEntry] of Object.entries(player.effectRegistry)) {
                const typedEntry = effectEntry as any; // Type assertion for effectRegistry entries
                if (!typedEntry.active) continue;
                
                const sourceCard = SlotZoneUtils.getCardByUid(gameEnv, typedEntry.sourceCarduid) as ZoneCardWithData | null;
                if (!sourceCard) {
                    continue;
                }

                if (!ContinuousEffectManager.sourceConditionsMet(
                    typedEntry.effectData as EffectDefinition,
                    sourceCard,
                    gameEnv,
                    typedEntry.sourcePlayerId
                )) {
                    continue;
                }

                // Re-validate conditions (YOUR_TURN/OPPONENT_TURN may have changed)
                if (!ContinuousEffectManager.validateEffectConditions(
                    typedEntry.effectData as EffectDefinition,
                    gameEnv,
                    typedEntry.sourcePlayerId,
                    sourceCard
                )) {
                    continue;
                }
                console.log("adsdsadsfsd " ,JSON.stringify(typedEntry))
                const targets = ContinuousEffectManager.resolveRegistryTargets(typedEntry, gameEnv);
                
                const numericValue = typeof typedEntry.value === 'number' ? typedEntry.value : 0;
                const action = typedEntry.action;

                for (const target of targets) {
                    if (typeof action !== 'string') {
                        console.log('⚠️ Registry effect missing action, skipping');
                        continue;
                    }

                    const applied = EffectExecutor.applyContinueCardEffect(target, action, numericValue);
                    if (!applied) {
                        continue;
                    }

                    playerAppliedCount++;
                    totalAppliedCount++;
                }
                
                if (targets.length > 0) {
                    console.log(`  ⚡ Applied ${typedEntry.effectId} from player ${playerId} to ${targets.length} targets`);
                }
            }
            
            if (playerAppliedCount > 0) {
                console.log(`  Player ${playerId}: Applied ${playerAppliedCount} effects`);
            }
        }
        
        console.log(`✅ Applied ${totalAppliedCount} total registry effects to targets`);
    }

    /**
     * Resolve targets for a registry effect
     */
    static resolveRegistryTargets(effectEntry: any, gameEnv: GameEnvironment): any[] {
        const scope = effectEntry.scope;
        const sourcePlayerId = effectEntry.sourcePlayerId;
        
        switch (scope) {
            case 'self_all_unit':
                return ContinuousEffectManager.getAllPlayerUnitsInSlot(sourcePlayerId, gameEnv);
            case 'opponent_all':
                const opponentId = ContinuousEffectManager.getOpponentId(sourcePlayerId, gameEnv);
                return ContinuousEffectManager.getAllPlayerUnitsInSlot(opponentId, gameEnv);
            case 'self':
                // Get the source card itself
                const sourceCard = SlotZoneUtils.getCardByUid(gameEnv, effectEntry.sourceCarduid) as ZoneCardWithData | null;
                return sourceCard ? [sourceCard] : [];
            default:
                console.log(`⚠️ Unknown scope: ${scope}`);
                return [];
        }
    }

    /**
     * Clean up invalid effects from player's registry
     */
    static cleanupPlayerRegistryEffects(player: any, playerId: string, gameEnv: GameEnvironment): void {
        const effectsToRemove: string[] = [];
        
        // Check each effect in player's registry
        for (const [effectKey, effectEntry] of Object.entries(player.effectRegistry)) {
            const typedEntry = effectEntry as any; // Type assertion for effectRegistry entries
            // Check if source card still exists
            const sourceCard = SlotZoneUtils.getCardByUid(gameEnv, typedEntry.sourceCarduid) as ZoneCardWithData | null;

            if (!sourceCard) {
                effectsToRemove.push(effectKey);
                console.log(`  🗑️ Removing effect ${typedEntry.effectId} from player ${playerId} - source card no longer in field`);
                continue;
            }

            if (!ContinuousEffectManager.sourceConditionsMet(
                typedEntry.effectData as EffectDefinition,
                sourceCard,
                gameEnv,
                typedEntry.sourcePlayerId
            )) {
                effectsToRemove.push(effectKey);
                console.log(`  🗑️ Removing effect ${typedEntry.effectId} from player ${playerId} - source no longer valid`);
                continue;
            }

            if (!ContinuousEffectManager.validateEffectConditions(
                typedEntry.effectData as EffectDefinition,
                gameEnv,
                typedEntry.sourcePlayerId,
                sourceCard
            )) {
                effectsToRemove.push(effectKey);
                console.log(`  🗑️ Removing effect ${typedEntry.effectId} from player ${playerId} - conditions no longer met`);
                continue;
            }
        }
        
        // Remove invalid effects
        for (const effectKey of effectsToRemove) {
            delete player.effectRegistry[effectKey];
        }
        
        if (effectsToRemove.length > 0) {
            console.log(`🧹 Cleaned up ${effectsToRemove.length} invalid effects from player ${playerId} registry`);
        }
    }

    // ============================================================================
    // CONTINUOUS EFFECTS ORCHESTRATION
    // ============================================================================

    /**
     * Main entry point - Source-based effect registry processing (NEW - January 2025)
     */
    static processAllContinuousEffects(gameEnv: GameEnvironment): EffectProcessingResult {
        console.log(`🔄 Processing continuous effects (SOURCE-BASED REGISTRY)`);
        
        try {
            // STEP 1: Reset all cards' modifications to 0
            ContinuousEffectManager.resetAllCardModifications(gameEnv);
            
            // STEP 2: Update effect registry from sources (replaces old Phase 1)
            ContinuousEffectManager.updateEffectRegistry(gameEnv);
            
            // STEP 3: Apply registry effects to all valid targets (replaces old Phase 2)
            ContinuousEffectManager.applyRegistryToTargets(gameEnv);
            
            // Count total effects across all players
            let totalEffects = 0;
            for (const player of Object.values(gameEnv.players)) {
                if (player.effectRegistry) {
                    totalEffects += Object.keys(player.effectRegistry).length;
                }
            }
            
            console.log(`✅ Registry processing complete: ${totalEffects} effects across all player registries`);
            return { success: true, effectsProcessed: totalEffects, effectsActivated: totalEffects, effectsDeactivated: 0 };
            
        } catch (error) {
            console.error(`❌ Error processing continuous effects:`, error);
            return { success: false, effectsProcessed: 0, effectsActivated: 0, effectsDeactivated: 0, error: String(error) };
        }
    }


    /**
     * Reset all cards' modifyAP and modifyHP to 0 before recalculating effects
     */
    static resetAllCardModifications(gameEnv: GameEnvironment): void {
        console.log(`🔄 Resetting all card modifications to 0`);
        
        for (const [playerId, player] of Object.entries(gameEnv.players)) {
            if (!player.zones) continue;
            
            // Reset modifications for all slot zone cards
            for (const slotName of SLOT_ZONES) {
                const slot = (player.zones as any)[slotName];
                
                // Reset unit modifications
                if (slot?.unit) {
                    slot.unit.continueModifyAP = 0;
                    slot.unit.continueModifyHP = 0;
                }
                
                // Reset pilot modifications
                if (slot?.pilot) {
                    slot.pilot.continueModifyAP = 0;
                    slot.pilot.continueModifyHP = 0;
                }
            }
        }
        
        console.log(`✅ All card modifications reset to 0`);
    }














    /**
     * Get opponent player ID
     */
    private static getOpponentId(playerId: string, gameEnv: GameEnvironment): string {
        const playerIds = Object.keys(gameEnv.players);
        return playerIds.find(id => id !== playerId) || '';
    }



    // ============================================================================
    // STATIC UTILITY METHODS
    // ============================================================================

    /**
     * Extract trigger type from effect rule
     */
    static extractTrigger(rule: any): string {
        return typeof rule.trigger === 'string' ? rule.trigger : rule.trigger?.event || '';
    }

    /**
     * Extract conditions array from effect rule
     */
    static extractConditions(rule: any): string[] {
        return rule.conditions || rule.trigger?.conditions || [];
    }

    /**
     * Extract target scope from effect rule
     */
    static extractTargetScope(rule: any): string {
        return rule.target?.scope || rule.target?.owner || 'self';
    }

    /**
     * Extract effect ID from effect rule
     */
    static extractEffectId(rule: any): string {
        return rule.effectId || rule.id || 'unknown_effect';
    }

    // ============================================================================
    // INSTANCE METHODS AND PROPERTIES
    // ============================================================================

    private gameEnv: GameEnvironment;
    private playerId: string;
    private target: any;
    private effect: any;
    
    constructor(gameEnv: GameEnvironment, playerId: string, target: any, effect: any) {
        this.gameEnv = gameEnv;
        this.playerId = playerId;
        this.target = target;
        this.effect = effect;
    }
    
    /**
     * Main execution method - handles any effect action
     */
    execute(): EffectResult {
        const { action } = this.effect;
        
        console.log(`🎯 ContinuousEffectManager executing: ${action} for player ${this.playerId}`);
        
        try {
            switch (action) {
                case 'addToHand':
                    return this.executeAddToHand();
                case 'heal':
                    return this.executeHeal();
                default:
                    console.log(`⚠️ Unknown effect action: ${action} - returning success for placeholder`);
                    return {
                        success: true,
                        message: `Effect action ${action} not yet implemented`
                    };
            }
        } catch (error) {
            console.error(`❌ ContinuousEffectManager execution failed:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Effect execution failed'
            };
        }
    }
    
    /**
     * Handle addToHand effects - universal for any "from" source
     */
    private executeAddToHand(): EffectResult {
        const { parameters } = this.effect;
        const { value = 1, from } = parameters;
        
        console.log(`🃏 Adding ${value} cards to hand from ${from}`);
        
        // Resolve target cards based on target specification  
        const targetCards = this.resolveTargetCards();
        
        // Execute based on "from" parameter
        switch (from) {
            case 'shield':
                return this.addFromShieldToHand(targetCards, value);
            default:
                console.log(`⚠️ Unknown addToHand source: ${from} - returning success for placeholder`);
                return {
                    success: true,
                    message: `AddToHand source ${from} not yet implemented`
                };
        }
    }
    
    /**
     * Handle heal effects - repair abilities
     */
    private executeHeal(): EffectResult {
        const { parameters } = this.effect;
        const { value = 2 } = parameters;
        
        console.log(`🩹 Executing heal for ${value} HP on player ${this.playerId}`);
        
        // For repair_2, target is self - find the unit that needs healing
        const targetUnit = this.findTargetUnit();
        if (!targetUnit) {
            return {
                success: false,
                error: 'Target unit not found for healing'
            };
        }
        
        // Get card data to check max HP
        const cardData = this.getCardData(targetUnit.cardId);
        if (!cardData) {
            return {
                success: false,
                error: 'Card data not found for healing'
            };
        }
        
        const maxHP = cardData.hp || targetUnit.originalHP || 0;
        const currentDamage = targetUnit.damageReceived || 0;
        const currentHP = Math.max(0, maxHP - currentDamage);

        const healAmountClamped = Math.max(0, value);
        const actualHealing = Math.min(healAmountClamped, currentDamage);
        const newDamage = currentDamage - actualHealing;
        const newHP = Math.max(0, maxHP - newDamage);
        
        if (actualHealing > 0) {
            targetUnit.damageReceived = newDamage;

            console.log(`✅ Healed ${targetUnit.cardId} for ${actualHealing} HP (${currentHP} → ${newHP}/${maxHP})`);
            
            return {
                success: true,
                message: `Healed ${targetUnit.cardId} for ${actualHealing} HP`,
                affectedCards: [targetUnit]
            };
        } else {
            console.log(`ℹ️ ${targetUnit.cardId} already at max HP (${currentHP}/${maxHP}) - no healing applied`);
            
            return {
                success: true,
                message: `${targetUnit.cardId} already at max HP - no healing applied`,
                affectedCards: []
            };
        }
    }
    
    /**
     * Find the target unit for healing (self-targeting repair abilities)
     */
    private findTargetUnit(): any {
        // This method will be called with specific card UID context from StateBasedActionEngine
        // For now, return null - will be enhanced when integrated
        return null;
    }
    
    /**
     * Get card data helper
     */
    private getCardData(cardId: string): any {
        try {
            return CardDatabaseManager.getCardDetails(cardId);
        } catch (error) {
            console.error(`❌ Error loading card data for ${cardId}:`, error);
            return null;
        }
    }
    
    // ============ TARGET RESOLUTION METHODS ============
    
    /**
     * Universal target resolution based on target specification
     */
    private resolveTargetCards(): any[] {
        if (!this.target) {
            return [];
        }
        
        const { type, scope, filters } = this.target;
        
        console.log(`🎯 Resolving targets: type=${type}, scope=${scope}`);
        
        switch (scope) {
            case 'self_shield':
                return this.getPlayerShieldCards();
            default:
                console.log(`⚠️ Unknown target scope: ${scope}`);
                return [];
        }
    }
    
    /**
     * Get player's shield area cards
     */
    private getPlayerShieldCards(): any[] {
        const player = this.gameEnv.players[this.playerId];
        if (!player || !player.zones) {
            return [];
        }
        
        const shieldCards = player.zones.shieldArea || [];
        console.log(`🛡️ Found ${shieldCards.length} shield cards`);
        return shieldCards;
    }
    
    /**
     * Add cards from shield area to hand
     */
    private addFromShieldToHand(targetCards: any[], count: number): EffectResult {
        const player = this.gameEnv.players[this.playerId];
        const shieldCards = player.zones.shieldArea || [];
        
        const cardsToMove = shieldCards.slice(0, count);
        const movedCards = [];
        
        for (const card of cardsToMove) {
            // Move from shield to hand
            const index = shieldCards.indexOf(card);
            if (index > -1) {
                // Remove from shield area
                shieldCards.splice(index, 1);
                
                const addResult = EffectExecutor.addCardToPlayerHand(
                    this.gameEnv,
                    this.playerId,
                    card.carduid,
                    card.cardData,
                    {
                        sourceZone: 'shield'
                    }
                );
                if (!addResult.success) {
                    return {
                        success: false,
                        error: addResult.error || `Failed to add card ${card.carduid} to hand`
                    };
                }
                movedCards.push(card);
            }
        }
        
        console.log(`🛡️➡️🃏 Moved ${movedCards.length} cards from shield to hand`);
        
        return {
            success: true,
            message: `Moved ${movedCards.length} cards from shield to hand`,
            affectedCards: movedCards
        };
    }
}
