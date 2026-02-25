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
import { ContinuousRegistryScopeResolver } from './effects/continuous/ContinuousRegistryScopeResolver';
import { EffectConditionEvaluator } from './conditions/EffectConditionEvaluator';
import { EffectSourceConditionEvaluator } from './conditions/EffectSourceConditionEvaluator';
import { EffectScalingResolver } from './effects/scaling/EffectScalingResolver';
import { EffectCompiler } from './effects/canonical/EffectCompiler';
import { EffectOperationRegistry } from './effects/canonical/EffectOperationRegistry';
import { DeployTargetManager } from './DeployTargetManager';

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
        return EffectConditionEvaluator.validateEffectConditions(storedEffect, gameEnv, cardOwnerPlayerId, sourceCard as any);
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
        return EffectSourceConditionEvaluator.sourceConditionsMet(effectRule, card as any, gameEnv, cardOwnerPlayerId);
    }
    
    // Note: card pairing/link checks and source condition evaluation live in src/services/conditions/* to keep
    // ContinuousEffectManager focused on continuous effect processing.

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

            // Scan base zone cards as potential continuous effect sources
            const baseCards = Array.isArray((player.zones as any)?.base) ? (player.zones as any).base : [];
            for (const baseCard of baseCards) {
                if (baseCard?.carduid) {
                    ContinuousEffectManager.updateRegistryFromCard(baseCard as ZoneCardWithData, playerId, gameEnv);
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
        const compiledEffect = EffectCompiler.compile(effectRule);
        
        return {
            effectId: effectRule.effectId,
            sourceCarduid: sourceCard.carduid,
            sourcePlayerId: sourcePlayerId,
            effectData: effectRule,
            compiledEffect,
            scope: effectRule.target?.scope || 'self_all_unit',
            action: effectAction,
            value: value,
            conditions: effectRule.conditions || [],
            eventReactiveContinuous: Boolean((effectRule as any).__eventReactiveContinuous),
            lastReactiveEventKey: undefined,
            active: true,
            timestamp: Date.now()
        };
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
                
                const sourceCard = ContinuousEffectManager.getSourceCardByUid(
                    gameEnv,
                    typedEntry.sourceCarduid,
                    typedEntry.sourcePlayerId
                );
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

                if (typedEntry.eventReactiveContinuous === true) {
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
                
                const baseValue = typeof typedEntry.value === 'number' ? typedEntry.value : 0;
                const scalingConfig = typedEntry.effectData?.parameters?.scaling;
                const numericValue = EffectScalingResolver.resolveScaledValue(
                    baseValue,
                    scalingConfig,
                    {
                        gameEnv,
                        sourcePlayerId: typedEntry.sourcePlayerId,
                        sourceCarduid: typedEntry.sourceCarduid,
                        effectId: typedEntry.effectId
                    }
                );
                const action = typedEntry.action;

                if (typeof action !== 'string') {
                    console.log('⚠️ Registry effect missing action, skipping');
                    continue;
                }

                const canonicalApplied = EffectOperationRegistry.applyContinuous(gameEnv, typedEntry, targets);
                if (typeof canonicalApplied === 'number') {
                    playerAppliedCount += canonicalApplied;
                    totalAppliedCount += canonicalApplied;
                    if (targets.length > 0) {
                        console.log(`  ⚡ Applied ${typedEntry.effectId} via canonical operations to ${targets.length} targets`);
                    }
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
        return ContinuousRegistryScopeResolver.resolve(
            effectEntry,
            gameEnv,
            ContinuousEffectManager.getAllPlayerUnitsInSlot
        );
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
            const sourceCard = ContinuousEffectManager.getSourceCardByUid(
                gameEnv,
                typedEntry.sourceCarduid,
                typedEntry.sourcePlayerId
            );

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
                if (typedEntry.eventReactiveContinuous === true) {
                    // Keep event-reactive continuous entries registered between events; they should
                    // be evaluated only when an event context exists, not during registry cleanup.
                    continue;
                }
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

    static processReactiveContinuousEffects(gameEnv: GameEnvironment): { success: boolean; error?: string; executed?: number } {
        const currentEvent = gameEnv.processingQueue[0] as any;
        const eventKey = currentEvent?.id && currentEvent?.type
            ? `${String(currentEvent.type)}:${String(currentEvent.id)}`
            : '';
        if (!eventKey) {
            return { success: true, executed: 0 };
        }

        let executed = 0;
        let pass = 0;
        let executedThisPass = false;

        do {
            executedThisPass = false;
            pass += 1;

            for (const [playerId, player] of Object.entries(gameEnv.players)) {
                if (!player.effectRegistry) {
                    continue;
                }

                for (const effectEntry of Object.values(player.effectRegistry)) {
                    const typedEntry = effectEntry as any;
                    if (!typedEntry?.active || typedEntry.eventReactiveContinuous !== true) {
                        continue;
                    }
                    if (typedEntry.lastReactiveEventKey === eventKey) {
                        continue;
                    }

                    const sourceCard = ContinuousEffectManager.getSourceCardByUid(
                        gameEnv,
                        typedEntry.sourceCarduid,
                        typedEntry.sourcePlayerId
                    );
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

                    if (!ContinuousEffectManager.validateEffectConditions(
                        typedEntry.effectData as EffectDefinition,
                        gameEnv,
                        typedEntry.sourcePlayerId,
                        sourceCard
                    )) {
                        continue;
                    }

                    const result = DeployTargetManager.processEffectWithTargetChoice(
                        gameEnv,
                        playerId,
                        typedEntry.sourceCarduid,
                        typedEntry.effectData as EffectDefinition
                    );
                    if (!result.success) {
                        return {
                            success: false,
                            error: result.error || `Failed to resolve reactive continuous effect ${typedEntry.effectId}`
                        };
                    }

                    typedEntry.lastReactiveEventKey = eventKey;
                    executed += 1;
                    executedThisPass = true;
                }
            }
        } while (executedThisPass && pass < 3);

        return { success: true, executed };
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

    private static getSourceCardByUid(
        gameEnv: GameEnvironment,
        carduid: string,
        sourcePlayerId?: string
    ): ZoneCardWithData | null {
        const slotCard = SlotZoneUtils.getCardByUid(gameEnv, carduid) as ZoneCardWithData | null;
        if (slotCard) {
            return slotCard;
        }

        const tryFindInBases = (playerId: string): ZoneCardWithData | null => {
            const player = gameEnv.players[playerId];
            const baseCards = Array.isArray(player?.zones?.base) ? player.zones.base : [];
            const found = baseCards.find((base: any) => base?.carduid === carduid);
            return (found as ZoneCardWithData) || null;
        };

        if (typeof sourcePlayerId === 'string' && sourcePlayerId.length > 0) {
            const ownedBase = tryFindInBases(sourcePlayerId);
            if (ownedBase) {
                return ownedBase;
            }
        }

        for (const playerId of Object.keys(gameEnv.players)) {
            const base = tryFindInBases(playerId);
            if (base) {
                return base;
            }
        }

        return null;
    }

}
