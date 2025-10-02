/**
 * EffectScannerUtils
 * 
 * Centralized utility for scanning cards for specific effects across the game.
 * Eliminates code duplication from RepairEffectManager, ContinuousEffectManager, etc.
 * Provides reusable patterns for effect detection and filtering.
 */

import { GameEnvironment } from '../models/GameEnvironment';
import { CardDatabaseManager } from '../models/CardSystem';
import { SLOT_ZONES } from '../config/gameConstants';
import { SlotZoneUtils } from './SlotZoneUtils';
import { getCardIdFromUid } from './CardUtils';
import { EffectDefinition } from '../services/EventQueue/interfaces/GameEvent';

export interface EffectScanResult {
    carduid: string;
    cardId: string;
    zone: string;
    playerId: string;
    effect: EffectDefinition;
    cardData: any;
}

export interface BlockerUnit {
    carduid: string;
    zone: string;
    playerId: string;
    effect: EffectDefinition;
}

export type EffectFilter = (effect: EffectDefinition) => boolean;

export class EffectScannerUtils {
    
    /**
     * Centralized effect scanning across all player slot zones
     * Reusable pattern for any effect detection needs
     */
    static scanPlayerForEffects(
        gameEnv: GameEnvironment, 
        playerId: string, 
        effectFilter: EffectFilter
    ): EffectScanResult[] {
        const results: EffectScanResult[] = [];
        const player = gameEnv.getPlayer(playerId);
        
        if (!player || !player.zones) {
            console.log(`⚠️ Player ${playerId} not found or has no zones`);
            return results;
        }

        // Scan all slot zones using centralized SLOT_ZONES pattern
        for (const slotName of SLOT_ZONES) {
            const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotName);
            if (!slotResult.isValid || !slotResult.slot) {
                continue;
            }

            const slot = slotResult.slot;
            
            // Check unit in slot
            if (slot.unit) {
                const unitResults = this.scanCardForEffects(
                    slot.unit, slotName, playerId, effectFilter
                );
                results.push(...unitResults);
            }
            
            // Check pilot in slot
            if (slot.pilot) {
                const pilotResults = this.scanCardForEffects(
                    slot.pilot, slotName, playerId, effectFilter
                );
                results.push(...pilotResults);
            }
        }
        
        return results;
    }
    
    /**
     * Scan individual card for effects matching filter
     */
    private static scanCardForEffects(
        card: any,
        zone: string,
        playerId: string,
        effectFilter: EffectFilter
    ): EffectScanResult[] {
        const results: EffectScanResult[] = [];
        
        if (!card?.carduid) {
            return results;
        }

        const cardId = getCardIdFromUid(card.carduid);
        const cardData = CardDatabaseManager.getCardDetails(cardId);
        
        if (!cardData?.effects?.rules) {
            return results;
        }

        // Apply filter to each effect rule
        for (const effect of cardData.effects.rules) {
            if (effectFilter(effect)) {
                results.push({
                    carduid: card.carduid,
                    cardId,
                    zone,
                    playerId,
                    effect,
                    cardData
                });
            }
        }
        
        return results;
    }
    
    /**
     * Specialized scanner for blocker effects
     * Used by BlockerEffectManager
     */
    static scanForBlockerUnits(gameEnv: GameEnvironment, playerId: string): BlockerUnit[] {
        const blockerFilter: EffectFilter = (effect) => 
            effect.effectId === 'blocker' && 
            effect.trigger === 'ATTACK_REDIRECT';
            
        return this.scanPlayerForEffects(gameEnv, playerId, blockerFilter)
            .map(result => ({
                carduid: result.carduid,
                zone: result.zone,
                playerId: result.playerId,
                effect: result.effect
            }))
            .filter(blocker => {
                // Only unrested units can block
                const player = gameEnv.getPlayer(playerId);
                if (!player) return false;
                
                const slotResult = SlotZoneUtils.getSlotZone(player.zones, blocker.zone);
                if (!slotResult.isValid || !slotResult.slot) return false;
                
                const unit = slotResult.slot.unit;
                return unit && unit.carduid === blocker.carduid && !unit.isRested;
            });
    }
    
    /**
     * Specialized scanner for repair effects (can replace RepairEffectManager logic)
     * Demonstrates reusability of the pattern
     */
    static scanForRepairAbilities(gameEnv: GameEnvironment, playerId: string): EffectScanResult[] {
        const repairFilter: EffectFilter = (effect) => 
            effect.trigger === 'END_OF_TURN' && 
            effect.action === 'heal';
            
        return this.scanPlayerForEffects(gameEnv, playerId, repairFilter);
    }
    
    /**
     * Specialized scanner for continuous effects
     * Can be used by ContinuousEffectManager
     */
    static scanForContinuousEffects(gameEnv: GameEnvironment, playerId: string): EffectScanResult[] {
        const continuousFilter: EffectFilter = (effect) => 
            effect.trigger === 'continuous' || 
            effect.type === 'static';
            
        return this.scanPlayerForEffects(gameEnv, playerId, continuousFilter);
    }
    
    /**
     * Generic scanner for any effect type/trigger combination
     * Maximum flexibility for future effect types
     */
    static scanForEffectsByType(
        gameEnv: GameEnvironment, 
        playerId: string, 
        trigger?: string, 
        action?: string, 
        effectId?: string
    ): EffectScanResult[] {
        const genericFilter: EffectFilter = (effect) => {
            if (trigger && effect.trigger !== trigger) return false;
            if (action && effect.action !== action) return false;
            if (effectId && effect.effectId !== effectId) return false;
            return true;
        };
        
        return this.scanPlayerForEffects(gameEnv, playerId, genericFilter);
    }
}