/**
 * EffectScannerUtils - Simplified Version
 * 
 * Centralized utility for scanning cards for effects with minimal object creation.
 * Only stores essential data - everything else derived via findSlotByCarduid when needed.
 */

import { GameEnvironment } from '../models/GameEnvironment';
import { Player } from '../models/Player';
import { CardDatabaseManager } from '../models/CardSystem';
import { SLOT_ZONES } from '../config/gameConstants';
import { SlotZoneUtils } from './SlotZoneUtils';
import { getCardIdFromUid } from './CardUtils';
import { EffectDefinition } from '../services/EventQueue/interfaces/GameEvent';
import { resolveEffectActionFromRule } from './EffectNormalizationUtils';
import { ActionStepTargetSummary } from '../models/BattleContext';
import { extractActionStepEffectIds } from './ActionStepTargetPolicy';
import {
    getEffectEventTrigger,
    isContinuousEffectTiming
} from '../services/effects/timing/EffectTimingAccess';

export interface EffectScanResult {
    carduid: string;
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
     * Specialized scanner for repair effects
     */
    static scanForRepairAbilities(gameEnv: GameEnvironment, playerId: string): EffectScanResult[] {
        const repairFilter: EffectFilter = (effect) => 
            getEffectEventTrigger(effect) === 'END_OF_TURN' &&
            resolveEffectActionFromRule(effect) === 'heal';
            
        return this.scanPlayerForEffects(gameEnv, playerId, repairFilter);
    }
    
    /**
     * Specialized scanner for continuous effects
     */
    static scanForContinuousEffects(gameEnv: GameEnvironment, playerId: string): EffectScanResult[] {
        const continuousFilter: EffectFilter = (effect) => 
            isContinuousEffectTiming(effect) || 
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
            if (trigger) {
                const normalizedTrigger = trigger.toUpperCase();
                if (normalizedTrigger === 'CONTINUOUS') {
                    if (!isContinuousEffectTiming(effect)) return false;
                } else if (getEffectEventTrigger(effect) !== normalizedTrigger) {
                    return false;
                }
            }
            if (action && resolveEffectActionFromRule(effect) !== action) return false;
            if (effectId && effect.effectId !== effectId) return false;
            return true;
        };
        
        return this.scanPlayerForEffects(gameEnv, playerId, genericFilter);
    }

    /**
     * Collect actionable cards for ACTION_STEP timing windows (hand/base/unit/pilot)
     */
    static collectActionStepTargets(gameEnv: GameEnvironment, playerId: string): ActionStepTargetSummary[] {
        const player = gameEnv.getPlayer(playerId);
        if (!player) {
            return [];
        }

        const availableEnergy = (player.zones?.energyArea || []).filter(card => !card.isRested).length;
        const targets: ActionStepTargetSummary[] = [];

        this.scanHandForActionStepTargets(player, targets, availableEnergy, gameEnv.currentTurn, gameEnv, playerId);
        this.scanSlotForActionStepTargets(player, targets, availableEnergy, gameEnv.currentTurn, gameEnv, playerId);
        this.scanBaseForActionStepTargets(player, targets, availableEnergy, gameEnv.currentTurn, gameEnv, playerId);

        return targets;
    }

    private static scanHandForActionStepTargets(
        player: Player,
        targets: ActionStepTargetSummary[],
        availableEnergy: number,
        currentTurn: number,
        gameEnv: GameEnvironment,
        sourcePlayerId: string
    ): void {
        const handCards = player.deck?.hand || [];
        for (const card of handCards) {
            this.tryAddActionStepTarget(
                targets,
                card.carduid,
                card.cardData,
                'hand',
                'hand',
                availableEnergy,
                currentTurn,
                gameEnv,
                sourcePlayerId,
                card
            );
        }
    }

    private static scanSlotForActionStepTargets(
        player: Player,
        targets: ActionStepTargetSummary[],
        availableEnergy: number,
        currentTurn: number,
        gameEnv: GameEnvironment,
        sourcePlayerId: string
    ): void {
        if (!player.zones) {
            return;
        }

        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            if (!slot) {
                continue;
            }

            if (slot.unit) {
                this.tryAddActionStepTarget(
                    targets,
                    slot.unit.carduid,
                    slot.unit.cardData,
                    slotName,
                    'unit',
                    availableEnergy,
                    currentTurn,
                    gameEnv,
                    sourcePlayerId,
                    slot.unit
                );
            }

            if (slot.pilot) {
                this.tryAddActionStepTarget(
                    targets,
                    slot.pilot.carduid,
                    slot.pilot.cardData,
                    slotName,
                    'pilot',
                    availableEnergy,
                    currentTurn,
                    gameEnv,
                    sourcePlayerId,
                    slot.pilot
                );
            }
        }
    }

    private static scanBaseForActionStepTargets(
        player: Player,
        targets: ActionStepTargetSummary[],
        availableEnergy: number,
        currentTurn: number,
        gameEnv: GameEnvironment,
        sourcePlayerId: string
    ): void {
        const baseCards = player.zones?.base || [];
        for (const baseCard of baseCards) {
            this.tryAddActionStepTarget(
                targets,
                baseCard.carduid,
                baseCard.cardData,
                'base',
                'base',
                availableEnergy,
                currentTurn,
                gameEnv,
                sourcePlayerId,
                baseCard
            );
        }
    }

    private static tryAddActionStepTarget(
        targets: ActionStepTargetSummary[],
        carduid?: string,
        cardData?: any,
        location: string = 'unknown',
        zoneType: 'hand' | 'unit' | 'pilot' | 'base' = 'unit',
        availableEnergy: number = 0,
        currentTurn: number = 0,
        gameEnv?: GameEnvironment,
        sourcePlayerId?: string,
        sourceCardState?: any
    ): void {
        if (!carduid || !cardData?.effects?.rules) {
            return;
        }

        // Hand commands require energy to be playable. If you can't pay, don't block ACTION_STEP confirmations.
        if (zoneType === 'hand') {
            const energyCost = typeof cardData.cost === 'number' ? cardData.cost : Number(cardData.cost || 0);
            if (energyCost > 0 && availableEnergy < energyCost) {
                return;
            }
        }

        const effectIds = extractActionStepEffectIds(cardData.effects.rules, zoneType, {
            availableEnergy,
            currentTurn,
            gameEnv,
            sourcePlayerId,
            sourceCard: sourceCardState?.carduid ? sourceCardState : undefined,
            sourceCardState: sourceCardState
                ? {
                      isRested: Boolean(sourceCardState.isRested),
                      effectUsage: sourceCardState.effectUsage || {}
                  }
                : undefined
        });
        if (!effectIds.length) {
            return;
        }

        targets.push({
            carduid,
            cardId: cardData.id || getCardIdFromUid(carduid),
            cardName: cardData.name,
            cardType: cardData.cardType,
            location,
            zoneType,
            effectIds
        });
    }
}
