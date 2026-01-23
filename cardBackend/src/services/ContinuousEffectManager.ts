// src/services/ContinuousEffectManager.ts
// Universal card effect processor for all effect types

import { GameEnvironment } from '../models/GameEnvironment';
import { GamePhase } from '../models/GameEnums';
import { ZoneCard } from '../models/CardSystem';
import { EffectProcessingResult } from '../models/ContinuousEffectStore';
import { SLOT_ZONES } from '../config/gameConstants';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';
import { LinkUtils } from '../utils/LinkUtils';
import { ContinuousActionRegistry } from './effects/continuous/ContinuousActionRegistry';
import { EffectExecutor } from './effects/EffectExecutor';
import {
    ensureEffectDefaults,
    normalizeSourceConditions,
    NormalizedSourceCondition
} from '../utils/EffectNormalizationUtils';
import { EffectDefinition } from './EventQueue/interfaces/GameEvent';
import { ConditionEvaluators } from './conditions/ConditionEvaluators';
import { evaluateCardsInPlayCondition } from './conditions/CardsInPlayCondition';
import { BattleConditionEvaluator } from './conditions/BattleConditionEvaluator';
import { ContinuousConditionalEffectExpander } from './effects/continuous/ContinuousConditionalEffectExpander';
import { ContinuousStatChangeNotifier } from './effects/continuous/ContinuousStatChangeNotifier';
import { ContinuousSequenceEffectExpander } from './effects/continuous/ContinuousSequenceEffectExpander';
import { SourceTraitConditionEvaluator } from './conditions/SourceTraitConditionEvaluator';
import { ContinuousRegistryTargetResolver } from './effects/continuous/ContinuousRegistryTargetResolver';
import { ContinuousScopeUtils } from './effects/continuous/ContinuousScopeUtils';

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
     * Extract trigger type from effect rule.
     * Supports both legacy string triggers and structured { event: ... } forms.
     */
    static extractTrigger(rule: any): string {
        return typeof rule?.trigger === 'string' ? rule.trigger : rule?.trigger?.event || '';
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
    static getEffectValue(_action: string, parameters: any): number {
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
            case 'playerLevel':
                return cardOwnerPlayerId
                    ? ConditionEvaluators.playerLevel(gameEnv, cardOwnerPlayerId, scope, typedCondition.value)
                    : false;

            case 'pairedPilotColor': {
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                return ConditionEvaluators.pairedPilotColor(gameEnv, sourceCarduid, typedCondition.value);
            }

            case 'pairedUnitColor': {
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                return ConditionEvaluators.pairedUnitColor(gameEnv, sourceCarduid, typedCondition.value);
            }

            case 'pairedUnitTrait': {
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                return ConditionEvaluators.pairedUnitTrait(gameEnv, sourceCarduid, typedCondition.value);
            }

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

            case 'opponentHandSize':
                return cardOwnerPlayerId
                    ? ConditionEvaluators.opponentHandSize(gameEnv, cardOwnerPlayerId, scope, typedCondition.value)
                    : false;

            case 'noUnitTokenWithTrait': {
                const traitValue = typedCondition.value;
                const traits = Array.isArray(traitValue)
                    ? traitValue.filter(item => typeof item === 'string')
                    : typeof traitValue === 'string'
                        ? [traitValue]
                        : [];
                return ContinuousEffectManager.noUnitTokenWithTraits(gameEnv, cardOwnerPlayerId, traits);
            }

            case 'cardsInTrash':
            case 'cardsInTrashWithTraitsAny': {
                const playerId = cardOwnerPlayerId;
                if (!playerId) {
                    return false;
                }
                const traitsAny = Array.isArray(typedCondition.traitsAny)
                    ? typedCondition.traitsAny.filter(item => typeof item === 'string')
                    : Array.isArray((typedCondition as any).traits)
                        ? (typedCondition as any).traits.filter((item: unknown) => typeof item === 'string')
                        : [];

                const filters: Record<string, unknown> = {
                    traitsAny
                };
                if (typeof (typedCondition as any).cardType === 'string') {
                    filters.cardType = (typedCondition as any).cardType;
                }

                return ConditionEvaluators.cardsInTrashWithFilter(
                    gameEnv,
                    playerId,
                    filters,
                    typedCondition.value
                );
            }

            case 'unitsInPlayWithTrait': {
                const playerId = cardOwnerPlayerId;
                if (!playerId) {
                    return false;
                }

                const traits = Array.isArray(typedCondition.traits)
                    ? typedCondition.traits.filter(item => typeof item === 'string')
                    : [];
                return ConditionEvaluators.unitsInPlayWithTrait(
                    gameEnv,
                    playerId,
                    traits,
                    typedCondition.value
                );
            }

            case 'unitsInPlayWithFilter': {
                if (!cardOwnerPlayerId) {
                    return false;
                }

                return ConditionEvaluators.evaluateUnitsInPlayWithFilterCondition(
                    gameEnv,
                    cardOwnerPlayerId,
                    typedCondition
                );
            }

            case 'unitsInPlay': {
                if (!cardOwnerPlayerId) {
                    return false;
                }
                return ConditionEvaluators.evaluateUnitsInPlayCondition(
                    gameEnv,
                    cardOwnerPlayerId,
                    typedCondition
                );
            }

            case 'cardsInPlay': {
                if (!cardOwnerPlayerId) {
                    return false;
                }

                return evaluateCardsInPlayCondition(
                    gameEnv,
                    cardOwnerPlayerId,
                    typedCondition
                );
            }

            case 'sourceTrait': {
                const value = typedCondition.value;
                const trait = typeof value === 'string' ? value : '';
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                if (!sourceCarduid || !trait) {
                    return false;
                }
                return SourceTraitConditionEvaluator.sourceHasTrait(gameEnv, sourceCarduid, trait);
            }

            case 'hasAnotherLinkedUnit': {
                if (!cardOwnerPlayerId) {
                    return false;
                }
                const exclude = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : undefined;
                return ConditionEvaluators.hasAnotherLinkedUnit(gameEnv, cardOwnerPlayerId, exclude);
            }

            case 'hasAnotherLinkedUnitWithTrait': {
                if (!cardOwnerPlayerId) {
                    return false;
                }
                const traitsAny = Array.isArray((typedCondition as any).traits)
                    ? (typedCondition as any).traits.filter((t: unknown) => typeof t === 'string')
                    : Array.isArray((typedCondition as any).traitsAny)
                        ? (typedCondition as any).traitsAny.filter((t: unknown) => typeof t === 'string')
                        : [];
                const exclude = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : undefined;
                return ConditionEvaluators.hasAnotherLinkedUnitWithTrait(gameEnv, cardOwnerPlayerId, traitsAny, exclude);
            }

            case 'noPairedPilot': {
                if (scope === 'source') {
                    return sourceCard ? !ContinuousEffectManager.checkIsPaired(sourceCard, gameEnv) : false;
                }
                return true;
            }

            case 'battleOpponentLevel': {
                if (!sourceCard || !cardOwnerPlayerId) {
                    return false;
                }
                return BattleConditionEvaluator.evaluateBattleOpponentLevel(
                    gameEnv,
                    sourceCard.carduid,
                    typedCondition.value
                );
            }

            case 'sourceStatus': {
                if (scope !== 'source') {
                    return true;
                }
                if (!sourceCard) {
                    return false;
                }

                const statusRaw =
                    (typedCondition.status as string | undefined) ??
                    (typedCondition.value as string | undefined);
                const desired = typeof statusRaw === 'string' ? statusRaw.toLowerCase() : '';
                if (!desired) {
                    return true;
                }

                const isRested = (sourceCard as any)?.isRested === true;
                if (desired === 'rested') {
                    return isRested;
                }
                if (desired === 'active') {
                    return !isRested;
                }

                console.log(`⚠️ Unknown sourceStatus value: ${desired}`);
                return true;
            }

            case 'sourceDamaged': {
                if (scope !== 'source') {
                    return true;
                }
                if (!sourceCard) {
                    return false;
                }
                const expected = typeof typedCondition.value === 'boolean' ? typedCondition.value : true;
                const damaged = typeof (sourceCard as any).damageReceived === 'number'
                    ? (sourceCard as any).damageReceived > 0
                    : false;
                return damaged === expected;
            }

            default:
                console.log(`⚠️ Unknown structured condition: ${type}`);
                return true;
        }
    }

    private static noUnitTokenWithTraits(
        gameEnv: GameEnvironment,
        playerId: string | null,
        traits: string[]
    ): boolean {
        if (!playerId || traits.length === 0) {
            return true;
        }

        const units = SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, playerId);
        return !units.some(unitResult => {
            const cardData = unitResult?.unit?.cardData;
            if (!cardData) {
                return false;
            }
            const isToken = cardData.color === 'Token' || (typeof cardData.id === 'string' && cardData.id.startsWith('T-'));
            if (!isToken) {
                return false;
            }
            const unitTraits = Array.isArray(cardData.traits) ? cardData.traits : [];
            return traits.some(trait => unitTraits.includes(trait));
        });
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
                if (LinkUtils.isLinkedPair(slot.unit, slot.pilot)) {
                    return true; // Found at least one linked pair
                }
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

            const normalizedEffect = ensureEffectDefaults(effectRule);
            const effectAction = EffectExecutor.getEffectAction(normalizedEffect) || 'modifyAP';
            if (effectAction === 'conditional') {
                ContinuousConditionalEffectExpander.addToRegistry({
                    gameEnv,
                    player,
                    sourceCard: card,
                    sourcePlayerId: playerId,
                    effectRule: normalizedEffect,
                    validateEffectConditions: ContinuousEffectManager.validateEffectConditions,
                    createRegistryEntry: ContinuousEffectManager.createRegistryEntry
                });
                continue;
            }
            if (effectAction === 'sequence') {
                ContinuousSequenceEffectExpander.addToRegistry({
                    gameEnv,
                    player,
                    sourceCard: card,
                    sourcePlayerId: playerId,
                    effectRule: normalizedEffect,
                    validateEffectConditions: ContinuousEffectManager.validateEffectConditions,
                    createRegistryEntry: ContinuousEffectManager.createRegistryEntry
                });
                continue;
            }
            
            const effectKey = `${effectRule.effectId}_${card.carduid}`;
            
            // Add effect to player's registry if not already present
            if (!player.effectRegistry[effectKey]) {
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
        for (const player of Object.values(gameEnv.players)) {
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
                    return LinkUtils.isLinkedPair(slot.unit, slot.pilot);
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
            for (const effectEntry of Object.values(player.effectRegistry)) {
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
                const targets = ContinuousEffectManager.resolveRegistryTargets(typedEntry, gameEnv);
                
                const numericValue = typeof typedEntry.value === 'number' ? typedEntry.value : 0;
                const action = typedEntry.action;

                if (typeof action !== 'string') {
                    console.log('⚠️ Registry effect missing action, skipping');
                    continue;
                }

                const continuousApplied = ContinuousActionRegistry.apply(gameEnv, action, {
                    sourceCarduid: typedEntry.sourceCarduid,
                    sourcePlayerId: typedEntry.sourcePlayerId,
                    effectData: typedEntry.effectData as EffectDefinition
                }, targets);

                if (typeof continuousApplied === 'number') {
                    playerAppliedCount += continuousApplied;
                    totalAppliedCount += continuousApplied;
                } else {
                    for (const target of targets) {
                        const applied = EffectExecutor.applyContinueCardEffect(target, action, numericValue);
                        if (!applied) {
                            continue;
                        }

                        playerAppliedCount++;
                        totalAppliedCount++;
                    }
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
        const scope = ContinuousScopeUtils.normalizeScope(effectEntry.scope);
        const sourcePlayerId = effectEntry.sourcePlayerId;
        
        switch (scope) {
            case 'self_all_unit': {
                const units = ContinuousEffectManager.getAllPlayerUnitsInSlot(sourcePlayerId, gameEnv);
                return ContinuousEffectManager.applyTargetFilters(units, effectEntry.effectData?.target);
            }
            case 'self_all_shield': {
                const player = gameEnv.players[sourcePlayerId];
                const shields = Array.isArray(player?.zones?.shieldArea) ? player.zones.shieldArea : [];
                return shields.map((card: any) => ({
                    ...card,
                    zone: 'shield',
                    playerId: sourcePlayerId
                }));
            }
            case 'opponent_all':
                const opponentId = ContinuousEffectManager.getOpponentId(sourcePlayerId, gameEnv);
                return ContinuousEffectManager.applyTargetFilters(
                    ContinuousEffectManager.getAllPlayerUnitsInSlot(opponentId, gameEnv),
                    effectEntry.effectData?.target
                );
            case 'self':
                return ContinuousRegistryTargetResolver.resolveSelf(effectEntry, gameEnv);
            case 'battle_opponent': {
                const targets = ContinuousRegistryTargetResolver.resolveBattleOpponent(effectEntry, gameEnv);
                return ContinuousEffectManager.applyTargetFilters(targets, effectEntry.effectData?.target);
            }
            default:
                console.log(`⚠️ Unknown scope: ${scope}`);
                return [];
        }
    }

    private static applyTargetFilters(targets: any[], targetConfig: any): any[] {
        if (!Array.isArray(targets) || targets.length === 0) {
            return [];
        }

        const filters = targetConfig?.filters && typeof targetConfig.filters === 'object' ? targetConfig.filters : null;
        if (!filters) {
            return targets;
        }

        const traitsFilter = Array.isArray(filters.traits)
            ? filters.traits.filter((t: unknown) => typeof t === 'string')
            : [];

        if (traitsFilter.length === 0) {
            return targets;
        }

        return targets.filter(card => {
            const traits = Array.isArray(card?.cardData?.traits) ? card.cardData.traits : [];
            return traitsFilter.every((trait: string) => traits.includes(trait));
        });
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
                EffectExecutor.removeTemporaryEffectsFromSource(gameEnv, typedEntry.sourceCarduid);
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
                EffectExecutor.removeTemporaryEffectsFromSource(gameEnv, typedEntry.sourceCarduid);
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
                EffectExecutor.removeTemporaryEffectsFromSource(gameEnv, typedEntry.sourceCarduid);
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
            const snapshotBefore = ContinuousStatChangeNotifier.capture(gameEnv);

            // STEP 1: Reset all cards' modifications to 0
            ContinuousEffectManager.resetAllCardModifications(gameEnv);
            
            // STEP 2: Update effect registry from sources (replaces old Phase 1)
            ContinuousEffectManager.updateEffectRegistry(gameEnv);
            
            // STEP 3: Apply registry effects to all valid targets (replaces old Phase 2)
            ContinuousEffectManager.applyRegistryToTargets(gameEnv);

            ContinuousStatChangeNotifier.notify(gameEnv, snapshotBefore);
            
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
        
        for (const player of Object.values(gameEnv.players)) {
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
        return playerIds.find((id) => id !== playerId) || '';
    }
}
