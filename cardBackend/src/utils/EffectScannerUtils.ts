/**
 * EffectScannerUtils - Simplified Version
 * 
 * Centralized utility for scanning cards for effects with minimal object creation.
 * Only stores essential data - everything else derived via findSlotByCarduid when needed.
 */

import { GameEnvironment } from '../models/GameEnvironment';
import { CardDatabaseManager } from '../models/CardSystem';
import { SLOT_ZONES } from '../config/gameConstants';
import { SlotZoneUtils } from './SlotZoneUtils';
import { getCardIdFromUid } from './CardUtils';
import { EffectDefinition } from '../services/EventQueue/interfaces/GameEvent';

export interface EffectScanResult {
    carduid: string;
}

export interface BlockerUnit {
    carduid: string;
    effect: EffectDefinition;
}

export type EffectFilter = (effect: EffectDefinition) => boolean;

export class EffectScannerUtils {
    
    /**
     * Simplified effect scanning - returns only carduids
     * All other data derived via findSlotByCarduid when needed
     */
    static scanPlayerForEffects(
        gameEnv: GameEnvironment, 
        playerId: string, 
        effectFilter: EffectFilter
    ): EffectScanResult[] {
        const results: EffectScanResult[] = [];
        const player = gameEnv.getPlayer(playerId);
        
        if (!player || !player.zones) {
            return results;
        }

        // Scan all slot zones
        for (const slotName of SLOT_ZONES) {
            const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotName);
            if (!slotResult.isValid || !slotResult.slot?.unit) {
                continue;
            }

            const unit = slotResult.slot.unit;
            if (!unit?.carduid) continue;

            // Check if unit has matching effects
            const cardId = getCardIdFromUid(unit.carduid);
            const cardData = CardDatabaseManager.getCardDetails(cardId);
            
            if (!cardData?.effects?.rules) continue;

            for (const effect of cardData.effects.rules) {
                if (effectFilter(effect)) {
                    results.push({ carduid: unit.carduid });
                    break; // Only need to know the card has a matching effect
                }
            }
        }
        
        return results;
    }
    
    /**
     * Simplified blocker scanner - returns carduid + effect only
     * Everything else (zone, playerId, etc.) derived via findSlotByCarduid when needed
     */
    static scanForBlockerUnits(gameEnv: GameEnvironment, playerId: string): BlockerUnit[] {
        const results: BlockerUnit[] = [];
        const player = gameEnv.getPlayer(playerId);
        
        if (!player || !player.zones) {
            return results;
        }

        for (const slotName of SLOT_ZONES) {
            const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotName);
            if (!slotResult.isValid || !slotResult.slot?.unit) {
                continue;
            }

            const unit = slotResult.slot.unit;
            
            // Skip rested units and invalid cards
            if (!unit.carduid || unit.isRested) {
                continue;
            }

            // Use cardData from unit directly instead of CardDatabaseManager
            const cardData = unit.cardData;
            
            if (!cardData?.effects?.rules) {
                continue;
            }

            // Find blocker effects
            for (const effect of cardData.effects.rules) {
                if (effect.trigger === 'ATTACK_REDIRECT') {
                    results.push({
                        carduid: unit.carduid,
                        effect: effect
                    });
                    break;
                }
            }
        }
        
        return results;
    }
    
    /**
     * Specialized scanner for repair effects
     */
    static scanForRepairAbilities(gameEnv: GameEnvironment, playerId: string): EffectScanResult[] {
        const repairFilter: EffectFilter = (effect) => 
            effect.trigger === 'END_OF_TURN' && 
            effect.action === 'heal';
            
        return this.scanPlayerForEffects(gameEnv, playerId, repairFilter);
    }
    
    /**
     * Specialized scanner for continuous effects
     */
    static scanForContinuousEffects(gameEnv: GameEnvironment, playerId: string): EffectScanResult[] {
        const continuousFilter: EffectFilter = (effect) => 
            effect.trigger === 'continuous' || 
            effect.type === 'static';
            
        return this.scanPlayerForEffects(gameEnv, playerId, continuousFilter);
    }
    
    /**
     * Generic scanner for any effect type/trigger combination
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