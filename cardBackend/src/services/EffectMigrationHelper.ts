/**
 * EffectMigrationHelper.ts - Utility for migrating from old effect system to new ActiveEffect system
 * 
 * Provides compatibility layer and migration tools for transitioning from the
 * CalculatedEffect -> FieldEffect approach to the direct JSON -> ActiveEffect approach.
 */

import { ActiveEffect, EffectRule } from '../models/ActiveEffect';
import { FieldEffect, EnhancedFieldEffect } from '../models/GameEnvironment';

/**
 * Migration helper for transitioning effect systems
 */
export class EffectMigrationHelper {
    
    /**
     * Convert legacy FieldEffect to ActiveEffect
     */
    static convertLegacyFieldEffectToActiveEffect(fieldEffect: FieldEffect): ActiveEffect | null {
        try {
            // Reconstruct EffectRule from legacy FieldEffect
            const rule: EffectRule = {
                id: fieldEffect.effectId.split('_').pop() || fieldEffect.type,
                type: 'continuous', // Default assumption
                trigger: {
                    event: 'always',
                    conditions: []
                },
                target: {
                    owner: fieldEffect.target.scope === 'OPPONENT' ? 'opponent' : 'self',
                    zones: Array.isArray(fieldEffect.target.zones) ? fieldEffect.target.zones.map(z => z.toString()) : [],
                    filters: this.reconstructFilters(fieldEffect.target.gameTypes, fieldEffect.target.traits)
                },
                effect: {
                    type: fieldEffect.type as 'powerBoost' | 'setPower' | 'drawCards' | 'searchCard' | 'neutralizeEffect' | 'preventSummon',
                    value: fieldEffect.value
                }
            };
            
            // Create ActiveEffect from reconstructed rule
            return ActiveEffect.fromCardRule(
                rule,
                fieldEffect.source,
                fieldEffect.sourcePlayerId || '',
                fieldEffect.target.playerId
            );
        } catch (error) {
            console.error(`Failed to convert legacy FieldEffect to ActiveEffect:`, error);
            return null;
        }
    }
    
    /**
     * Convert ActiveEffect to legacy FieldEffect for backward compatibility
     */
    static convertActiveEffectToLegacyFieldEffect(activeEffect: ActiveEffect): FieldEffect {
        return {
            effectId: activeEffect.effectId,
            source: activeEffect.sourceCardUid,
            sourcePlayerId: activeEffect.sourcePlayerId,
            type: activeEffect.effectType,
            target: {
                scope: (activeEffect.targetScope === 'opponent' ? 'OPPONENT' : activeEffect.targetScope === 'both' ? 'ALL' : 'SELF') as 'OPPONENT' | 'ALL' | 'SELF',
                zones: activeEffect.rule.target.zones as any,
                gameTypes: activeEffect.rule.target.filters?.filter(f => f.type === 'gameType').map(f => f.value || '').filter(Boolean),
                traits: activeEffect.rule.target.filters?.filter(f => f.type === 'trait').map(f => f.value || '').filter(Boolean)
            },
            value: activeEffect.effectValue,
            isEnabled: activeEffect.isActive,
            createdAt: activeEffect.createdAt
        };
    }
    
    /**
     * Convert enhanced FieldEffect to ActiveEffect
     */
    static convertEnhancedFieldEffectToActiveEffect(enhancedEffect: EnhancedFieldEffect): ActiveEffect {
        return new ActiveEffect(enhancedEffect.rule, {
            effectId: enhancedEffect.effectId,
            sourceCardUid: enhancedEffect.sourceCardUid,
            sourcePlayerId: enhancedEffect.sourcePlayerId,
            targetPlayerId: enhancedEffect.targetPlayerId,
            createdAt: enhancedEffect.createdAt,
            isActive: enhancedEffect.isActive
        });
    }
    
    /**
     * Convert ActiveEffect to enhanced FieldEffect
     */
    static convertActiveEffectToEnhancedFieldEffect(activeEffect: ActiveEffect): EnhancedFieldEffect {
        return {
            effectId: activeEffect.effectId,
            sourceCardUid: activeEffect.sourceCardUid,
            sourcePlayerId: activeEffect.sourcePlayerId,
            targetPlayerId: activeEffect.targetPlayerId,
            createdAt: activeEffect.createdAt,
            isActive: activeEffect.isActive,
            rule: activeEffect.rule
        };
    }
    
    /**
     * Reconstruct filters from legacy gameTypes and traits arrays
     */
    private static reconstructFilters(gameTypes?: string[], traits?: string[]): any[] {
        const filters: any[] = [];
        
        if (gameTypes && gameTypes.length > 0) {
            for (const gameType of gameTypes) {
                filters.push({
                    type: 'gameType',
                    value: gameType
                });
            }
        }
        
        if (traits && traits.length > 0) {
            for (const trait of traits) {
                filters.push({
                    type: 'trait',
                    value: trait
                });
            }
        }
        
        return filters;
    }
    
    /**
     * Migrate all legacy effects in a player's fieldEffects to enhanced format
     */
    static migratePlayerFieldEffects(fieldEffects: any): void {
        if (!fieldEffects.activeEffects) {
            return;
        }
        
        // Initialize enhanced effects array if not exists
        if (!fieldEffects.activeEffectsEnhanced) {
            fieldEffects.activeEffectsEnhanced = [];
        }
        
        // Convert each legacy effect to enhanced format
        for (const legacyEffect of fieldEffects.activeEffects) {
            const activeEffect = this.convertLegacyFieldEffectToActiveEffect(legacyEffect);
            if (activeEffect) {
                const enhancedEffect = this.convertActiveEffectToEnhancedFieldEffect(activeEffect);
                fieldEffects.activeEffectsEnhanced.push(enhancedEffect);
            }
        }
        
        console.log(`🔄 Migrated ${fieldEffects.activeEffects.length} legacy effects to enhanced format`);
    }
    
    /**
     * Validate effect compatibility between old and new systems
     */
    static validateEffectCompatibility(legacyEffect: FieldEffect, activeEffect: ActiveEffect): boolean {
        try {
            // Check if essential properties match using direct properties
            const legacyConverted = {
                effectId: activeEffect.effectId,
                source: activeEffect.sourceCardUid,
                sourcePlayerId: activeEffect.sourcePlayerId,
                type: activeEffect.effectType,
                target: {
                    scope: (activeEffect.targetScope === 'opponent' ? 'OPPONENT' : activeEffect.targetScope === 'both' ? 'ALL' : 'SELF') as 'OPPONENT' | 'ALL' | 'SELF',
                    zones: activeEffect.rule.target.zones as any,
                    gameTypes: activeEffect.rule.target.filters?.filter(f => f.type === 'gameType').map(f => f.value || '').filter(Boolean),
                    traits: activeEffect.rule.target.filters?.filter(f => f.type === 'trait').map(f => f.value || '').filter(Boolean)
                },
                value: activeEffect.effectValue,
                    isEnabled: activeEffect.isActive,
                createdAt: activeEffect.createdAt
            };
            
            return (
                legacyEffect.type === legacyConverted.type &&
                legacyEffect.value === legacyConverted.value &&
                legacyEffect.target.scope === legacyConverted.target.scope
            );
        } catch (error) {
            console.error('Effect compatibility validation failed:', error);
            return false;
        }
    }
    
    /**
     * Get migration statistics for a game environment
     */
    static getMigrationStatistics(gameEnv: any): any {
        const stats = {
            totalPlayers: Object.keys(gameEnv.players || {}).length,
            playersWithLegacyEffects: 0,
            playersWithEnhancedEffects: 0,
            totalLegacyEffects: 0,
            totalEnhancedEffects: 0,
            migrationNeeded: false
        };
        
        for (const [playerId, player] of Object.entries(gameEnv.players || {})) {
            const fieldEffects = (player as any).fieldEffects;
            if (!fieldEffects) continue;
            
            if (fieldEffects.activeEffects && fieldEffects.activeEffects.length > 0) {
                stats.playersWithLegacyEffects++;
                stats.totalLegacyEffects += fieldEffects.activeEffects.length;
            }
            
            if (fieldEffects.activeEffectsEnhanced && fieldEffects.activeEffectsEnhanced.length > 0) {
                stats.playersWithEnhancedEffects++;
                stats.totalEnhancedEffects += fieldEffects.activeEffectsEnhanced.length;
            }
        }
        
        stats.migrationNeeded = stats.totalLegacyEffects > 0 && stats.totalEnhancedEffects === 0;
        
        return stats;
    }
    
    /**
     * Perform automatic migration of entire game environment
     */
    static performFullMigration(gameEnv: any): void {
        console.log('🚀 Starting full effect system migration...');
        
        const initialStats = this.getMigrationStatistics(gameEnv);
        console.log('📊 Pre-migration stats:', initialStats);
        
        // Migrate each player's effects
        for (const [playerId, player] of Object.entries(gameEnv.players || {})) {
            const fieldEffects = (player as any).fieldEffects;
            if (fieldEffects) {
                this.migratePlayerFieldEffects(fieldEffects);
            }
        }
        
        const finalStats = this.getMigrationStatistics(gameEnv);
        console.log('📊 Post-migration stats:', finalStats);
        console.log('✅ Migration completed successfully');
    }
    
    /**
     * Create compatibility layer for old IncrementalEffectManager calls
     */
    static createCompatibilityLayer(): any {
        return {
            // Wrapper methods that delegate to new system
            processCardEffects: (gameEnv: any, play: any) => {
                console.log('🔄 Compatibility layer: delegating to EnhancedEffectManager');
                // Implementation would delegate to new system
            },
            
            calculateCardPower: (gameEnv: any, cardId: string, cardData: any, zone: string, playerId: string, basePower: number) => {
                console.log('🔄 Compatibility layer: delegating power calculation');
                // Implementation would delegate to new system
                return basePower; // Placeholder
            }
        };
    }
}

/**
 * Utility functions for effect system transition
 */
export class EffectSystemUtils {
    
    /**
     * Check if a game environment is using the new effect system
     */
    static isUsingEnhancedEffects(gameEnv: any): boolean {
        for (const player of Object.values(gameEnv.players || {})) {
            const fieldEffects = (player as any).fieldEffects;
            if (fieldEffects?.activeEffectsEnhanced && fieldEffects.activeEffectsEnhanced.length > 0) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Get recommended migration strategy
     */
    static getRecommendedMigrationStrategy(gameEnv: any): string {
        const stats = EffectMigrationHelper.getMigrationStatistics(gameEnv);
        
        if (stats.totalLegacyEffects === 0 && stats.totalEnhancedEffects === 0) {
            return 'CLEAN_START'; // No effects, can start with new system
        } else if (stats.totalLegacyEffects > 0 && stats.totalEnhancedEffects === 0) {
            return 'FULL_MIGRATION'; // Only legacy effects, migrate all
        } else if (stats.totalLegacyEffects === 0 && stats.totalEnhancedEffects > 0) {
            return 'ALREADY_MIGRATED'; // Only enhanced effects, already using new system
        } else {
            return 'HYBRID_STATE'; // Mixed state, need careful migration
        }
    }
    
    /**
     * Validate effect system consistency
     */
    static validateEffectSystemConsistency(gameEnv: any): any {
        const issues: string[] = [];
        const warnings: string[] = [];
        
        for (const [playerId, player] of Object.entries(gameEnv.players || {})) {
            const fieldEffects = (player as any).fieldEffects;
            if (!fieldEffects) continue;
            
            // Check for duplicate effects
            const legacyCount = fieldEffects.activeEffects?.length || 0;
            const enhancedCount = fieldEffects.activeEffectsEnhanced?.length || 0;
            
            if (legacyCount > 0 && enhancedCount > 0) {
                warnings.push(`Player ${playerId} has both legacy (${legacyCount}) and enhanced (${enhancedCount}) effects`);
            }
            
            // Validate enhanced effects structure
            if (fieldEffects.activeEffectsEnhanced) {
                for (const effect of fieldEffects.activeEffectsEnhanced) {
                    if (!effect.rule || !effect.effectId) {
                        issues.push(`Player ${playerId} has malformed enhanced effect: missing rule or effectId`);
                    }
                }
            }
        }
        
        return {
            isValid: issues.length === 0,
            issues,
            warnings,
            recommendation: issues.length > 0 ? 'FIX_ISSUES_BEFORE_MIGRATION' : 'SYSTEM_READY'
        };
    }
}