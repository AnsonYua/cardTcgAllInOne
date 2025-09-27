/**
 * Unified Target Choice Manager
 * 
 * Handles all target selection scenarios including:
 * - Deploy effects requiring player choice
 * - Pairing effects with multiple eligible targets  
 * - Future effect types requiring target selection
 * 
 * Replaces DEPLOY_TARGET_CHOICE with unified TARGET_CHOICE system.
 */

import { GameEnvironment } from '../models/GameEnvironment';
import {
    EventFactory,
    EventStatus,
    EffectDefinition,
    TargetChoiceEvent,
    TargetChoiceSelection,
    TargetFilters,
    TargetReference,
    TargetScope,
    TargetType
} from './EventQueue/interfaces/GameEvent';
import { SLOT_ZONES } from '../config/gameConstants';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';
import { UnitZoneCard, PilotZoneCard } from '../models/CardSystem';
import { EffectExecutor } from './effects/EffectExecutor';
import { ensureEffectDefaults, normalizeTargetConfig, validateComparisonFilter } from '../utils/EffectNormalizationUtils';
import { PlayerCardManager } from './PlayerCardManager';

interface ResolvedTargetConfig {
    type: TargetType;
    scope: TargetScope;
    count: number;
    filters: TargetFilters;
}

export interface TargetChoiceResult {
    success: boolean;
    error?: string;
    requiresSelection?: boolean;    // true if TARGET_CHOICE event created
    autoApplied?: boolean;         // true if effect auto-applied (single target)
    affectedTargets?: TargetReference[];
}


export class TargetChoiceManager {

    private static readonly DEFAULT_TARGET_TYPE: TargetType = 'unit';
    private static readonly DEFAULT_TARGET_SCOPE: TargetScope = 'opponent';
    private static readonly DEFAULT_TARGET_COUNT = 1;

    /**
     * Main entry point: Process effect that may require target selection
     * 
     * Logic:
     * - If multiple targets available and count=1 → Create TARGET_CHOICE event
     * - If single target available → Auto-apply effect
     * - If no targets available → Effect succeeds but does nothing
     */
    static processEffectWithTargetChoice(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition
    ): TargetChoiceResult {
        const normalizedEffect = ensureEffectDefaults(effect);
        const effectAction = EffectExecutor.getEffectAction(normalizedEffect);
        const effectLabel = normalizedEffect.effectId || effectAction || 'unknown';
        console.log(`🎯 Processing effect ${effectLabel} requiring target selection`);

        try {
            const targetConfig = this.resolveTargetConfig(normalizedEffect);
            const sourceCardId = this.deriveSourceCardId(sourceCarduid);
            // Generate available targets based on config
            const availableTargets = this.generateAvailableTargets(gameEnv, playerId, targetConfig);
            
            if (availableTargets.length === 0) {
                console.log(`⚠️ No eligible targets found for ${effect.effectId}`);
                return { 
                    success: true, 
                    autoApplied: true,
                    affectedTargets: [] 
                };
            }
            
            // Decision logic: Choice vs Auto-application
            if (this.requiresPlayerChoice(targetConfig, availableTargets)) {
                // Create TARGET_CHOICE event for player selection - pass objects directly
                const choiceEvent = EventFactory.createTargetChoiceEvent({
                    playerId,
                    sourceCarduid,
                    effect: normalizedEffect,
                    availableTargets
                });
                
                // Add to processing queue for game event processing
                gameEnv.processingQueue.push(choiceEvent);
                
                console.log(`🎮 Created TARGET_CHOICE event ${choiceEvent.id} with ${availableTargets.length} targets`);
                return { 
                    success: true, 
                    requiresSelection: true 
                };
                
            } else {
                // Auto-apply to single target or all targets (based on count)
                const targetsToApply = availableTargets.slice(0, targetConfig.count);
                const result = EffectExecutor.applyEffectToTargets(gameEnv, normalizedEffect, targetsToApply, playerId, sourceCarduid);
                
                console.log(`🤖 Auto-applied ${effect.effectId} to ${targetsToApply.length} target(s)`);
                return {
                    success: result.success,
                    error: result.error,
                    autoApplied: true,
                    affectedTargets: result.success ? targetsToApply : []
                };
            }
            
        } catch (error) {
            console.error(`❌ Error in processEffectWithTargetChoice:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Target choice processing failed'
            };
        }
    }

    /**
     * Execute TARGET_CHOICE event when player makes selection
     */
    static executeTargetChoice(event: TargetChoiceEvent, gameEnv: GameEnvironment): { success: boolean; error?: string } {
        console.log(`🎯 Executing TARGET_CHOICE event: ${event.id} (${event.status})`);
        try {
            if (event.status !== EventStatus.RESOLVING) {
                console.log(`⚠️ Unexpected event status: ${event.status} (expected RESOLVING)`);
                return { success: true }; // Skip - should not happen in correct flow
            }

            // Get event data object directly without destructuring to minimize conversions
            const eventData = event.data;
            
            // Use selectedTargets directly from eventData, normalizing to array if needed
            const selectedTargets: TargetChoiceSelection[] | undefined =
                eventData.selectedTargets ??
                (eventData.selectedTarget ? [eventData.selectedTarget] : undefined);

            if (!selectedTargets) {
                return {
                    success: false,
                    error: 'No targets selected for effect'
                };
            }

            if (selectedTargets.length === 0) {
                return {
                    success: false,
                    error: 'No targets selected for effect'
                };
            }

            const normalizedTargets: TargetReference[] = selectedTargets.map((selection) => ({
                carduid: selection.carduid,
                zone: selection.zone,
                playerId: selection.playerId
            }));

            // Apply effect to selected targets - pass eventData object directly to minimize conversions
            const normalizedEffect = ensureEffectDefaults(eventData.effect);
            const result = EffectExecutor.applyEffectToTargets(
                gameEnv,
                normalizedEffect,
                normalizedTargets,
                event.playerId,
                eventData.sourceCarduid
            );

            if (!result.success) {
                console.log(`❌ Failed to apply effect to selected targets: ${result.error}`);
                return result;
            }

            console.log(`✅ Successfully applied ${normalizedEffect.effectId} to ${selectedTargets.length} selected target(s)`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error in executeTargetChoice:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Target choice execution failed'
            };
        }
    }

    /**
     * Generate available targets based on target configuration
     */
    static generateAvailableTargets(
        gameEnv: GameEnvironment, 
        playerId: string, 
        targetConfig: ResolvedTargetConfig
    ): TargetReference[] {
        
        const targets: TargetReference[] = [];
        
        console.log(`🔍 Generating targets for config:`, JSON.stringify(targetConfig, null, 2));
        
        // Determine target player based on scope
        const targetPlayerIds = this.getTargetPlayerIds(gameEnv, playerId, targetConfig.scope);
        
        for (const targetPlayerId of targetPlayerIds) {
            const player = gameEnv.getPlayer(targetPlayerId);
            if (!player) {
                console.error(`❌ Target player ${targetPlayerId} not found`);
                continue;
            }
            
            console.log(`🎯 Searching player ${targetPlayerId} for valid targets`);
            
            // Search specified zones (or all slot zones by default)
            const zonesToSearch = targetConfig.filters.zone || SLOT_ZONES;
            
            for (const slotName of zonesToSearch) {
                // Use type-safe slot validation
                const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotName);
                if (!slotResult.isValid || !slotResult.slot) {
                    console.log(`⚠️ Skipping invalid slot ${slotName}: ${slotResult.error}`);
                    continue;
                }
                
                const slotZone = slotResult.slot;
                
                // Check unit targets
                if (targetConfig.type === 'unit' && SlotZoneUtils.hasUnit(slotZone)) {
                    const unit = SlotZoneUtils.getUnit(slotZone);
                    if (unit && this.validateTargetFilters(gameEnv , unit, targetConfig.filters || {})) {
                        targets.push({
                            carduid: unit.carduid,
                            zone: slotName,
                            playerId: targetPlayerId,
                            cardData: unit.cardData
                        });
                        console.log(`✅ Added unit target: ${unit.carduid} in ${slotName}`);
                    }
                }
                
                // Check pilot targets
                /*
                if (targetConfig.type === 'pilot' && SlotZoneUtils.hasPilot(slotZone)) {
                    const pilot = SlotZoneUtils.getPilot(slotZone);
                    if (pilot && this.validateTargetFilters(pilot, targetConfig.filters || {})) {
                        targets.push({
                            carduid: pilot.carduid,
                            zone: slotName,
                            playerId: targetPlayerId,
                            cardData: pilot.cardData
                        });
                        console.log(`✅ Added pilot target: ${pilot.carduid} in ${slotName}`);
                    }
                }*/
            }
        }
        
        console.log(`🎯 Generated ${targets.length} valid targets`);
        return targets;
    }

    /**
     * Derive complete target configuration using effect defaults when necessary
     */
    private static resolveTargetConfig(effect: EffectDefinition): ResolvedTargetConfig {
        const normalizedTarget = normalizeTargetConfig(effect.target, {
            scope: this.DEFAULT_TARGET_SCOPE,
            type: this.DEFAULT_TARGET_TYPE,
            count: this.DEFAULT_TARGET_COUNT
        });

        const type = (normalizedTarget?.type as TargetType) || this.DEFAULT_TARGET_TYPE;
        const scope = (normalizedTarget?.scope as TargetScope) || this.DEFAULT_TARGET_SCOPE;
        const countValue = normalizedTarget?.count;
        const count = typeof countValue === 'number' && countValue > 0
            ? countValue
            : this.DEFAULT_TARGET_COUNT;
        const filters: TargetFilters = normalizedTarget?.filters ? { ...normalizedTarget.filters } : {};
        if (normalizedTarget?.zone) {
            filters.zone = normalizedTarget.zone;
        }

        return {
            type,
            scope,
            count,
            filters
        };
    }

    /**
     * Extract source cardId from composite carduid identifier
     */
    private static deriveSourceCardId(sourceCarduid?: string): string | undefined {
        if (!sourceCarduid) {
            return undefined;
        }

        const parts = sourceCarduid.split('_').filter(Boolean);
        if (parts.length === 0) {
            return undefined;
        }

        return parts[parts.length - 1];
    }

    /**
     * Determine if player choice is required
     * 
     * Logic:
     * - If count=1 and multiple targets available → Requires choice
     * - If count>1 → Always requires choice (select multiple)
     * - If only one target or auto-select scenarios → No choice needed
     */
    private static requiresPlayerChoice(targetConfig: ResolvedTargetConfig, availableTargets: TargetReference[]): boolean {
        // Multiple target selection always requires choice
        if (targetConfig.count > 1) {
            return availableTargets.length > 0;
        }
        
        // Single target selection requires choice only if multiple options
        if (targetConfig.count === 1) {
            return availableTargets.length > 1;
        }
        
        // Zero or negative count - no choice needed
        return false;
    }
    
    /**
     * Clean up expired temporary effects at end of turn
     * Now works with unit-stored effects instead of player-level effects
     */
    static cleanupExpiredTemporaryEffects(gameEnv: GameEnvironment, endingPlayerId: string): void {
        EffectExecutor.cleanupExpiredTemporaryEffects(gameEnv, endingPlayerId);
    }

    /**
     * Get target player IDs based on scope
     */
   private static getTargetPlayerIds(gameEnv: GameEnvironment, playerId: string, scope: TargetScope): string[] {
        switch (scope) {
            case 'self':
            case 'self_all_unit':
            case 'self_all':
            case 'self_unit':
            case 'self_shield':
                return [playerId];
            case 'opponent':
            case 'opponent_unit':
            case 'opponent_all_unit':
                const opponentId = gameEnv.getOpponentId(playerId);
                return opponentId ? [opponentId] : [];
            case 'any':
                return Object.keys(gameEnv.players);
            default:
                if (typeof scope === 'string') {
                    if (scope.startsWith('self')) {
                        return [playerId];
                    }
                    if (scope.startsWith('opponent')) {
                        const opponent = gameEnv.getOpponentId(playerId);
                        return opponent ? [opponent] : [];
                    }
                }
                console.log(`⚠️ Unknown target scope: ${scope}`);
                return [];
        }
    }

    /**
     * Unified target validation with all filter types
     */
    private static validateTargetFilters(gameEnv: GameEnvironment,card: UnitZoneCard | PilotZoneCard, filters: TargetFilters = {}): boolean {
        // Level filter (from pairing effects)
        if (filters.level) {
            const cardLevel = card.cardData?.level || 0;
            if (!validateComparisonFilter(cardLevel, filters.level)) {
                console.log(`❌ Card ${card.carduid} failed level filter: ${filters.level}`);
                return false;
            }
        }
        
        // HP filter (from deploy effects)
        if (filters.hp) {
            const currentHp = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv,card.carduid).totalHP;
            if (!validateComparisonFilter(currentHp, filters.hp)) {
                console.log(`❌ Card ${card.carduid} failed HP filter: ${filters.hp}`);
                return false;
            }
        }
        
        // Status filter
        if (filters.status) {
            const cardStatus = card.isRested ? 'rested' : 'active';
            if (cardStatus !== filters.status) {
                console.log(`❌ Card ${card.carduid} failed status filter: expected ${filters.status}, got ${cardStatus}`);
                return false;
            }
        }
        
        // Trait filter
        if (filters.traits && filters.traits.length > 0) {
            const cardTraits = card.cardData?.traits || [];
            const hasRequiredTrait = filters.traits.some((requiredTrait: string) =>
                cardTraits.some((cardTrait: string) => cardTrait === requiredTrait)
            );
            if (!hasRequiredTrait) {
                console.log(`❌ Card ${card.carduid} failed trait filter: required ${filters.traits}, has ${cardTraits}`);
                return false;
            }
        }
        
        return true;
    }

}
