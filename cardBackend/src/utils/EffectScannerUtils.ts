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
import { isBlockerRedirectRule } from './BlockerRuleUtils';
import { isPlayOrActivatedEffect } from './EffectTypeRouter';

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
                if (isBlockerRedirectRule(effect)) {
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
            resolveEffectActionFromRule(effect) === 'heal';
            
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

        const targets: ActionStepTargetSummary[] = [];

        this.scanHandForActionStepTargets(player, targets);
        this.scanSlotForActionStepTargets(player, targets);
        this.scanBaseForActionStepTargets(player, targets);

        return targets;
    }

    private static scanHandForActionStepTargets(player: Player, targets: ActionStepTargetSummary[]): void {
        const handCards = player.deck?.hand || [];
        for (const card of handCards) {
            this.tryAddActionStepTarget(
                targets,
                card.carduid,
                card.cardData,
                'hand',
                'hand'
            );
        }
    }

    private static scanSlotForActionStepTargets(player: Player, targets: ActionStepTargetSummary[]): void {
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
                    'unit'
                );
            }

            if (slot.pilot) {
                this.tryAddActionStepTarget(
                    targets,
                    slot.pilot.carduid,
                    slot.pilot.cardData,
                    `${slotName}_pilot`,
                    'pilot'
                );
            }
        }
    }

    private static scanBaseForActionStepTargets(player: Player, targets: ActionStepTargetSummary[]): void {
        const baseCards = player.zones?.base || [];
        for (const baseCard of baseCards) {
            this.tryAddActionStepTarget(
                targets,
                baseCard.carduid,
                baseCard.cardData,
                'base',
                'base'
            );
        }
    }

    private static tryAddActionStepTarget(
        targets: ActionStepTargetSummary[],
        carduid?: string,
        cardData?: any,
        location: string = 'unknown',
        zoneType: 'hand' | 'unit' | 'pilot' | 'base' = 'unit'
    ): void {
        if (!carduid || !cardData?.effects?.rules) {
            return;
        }

        const effectIds = this.extractActionStepEffectIds(cardData.effects.rules, zoneType);
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

    private static extractActionStepEffectIds(
        effects: EffectDefinition[],
        zoneType: 'hand' | 'unit' | 'pilot' | 'base'
    ): string[] {
        const actionEffectIds: string[] = [];

        for (const effect of effects) {
            if (this.effectSupportsActionStep(effect, zoneType)) {
                actionEffectIds.push(effect.effectId || effect.action || 'action_step_effect');
            }
        }

        return actionEffectIds;
    }

    private static effectSupportsActionStep(effect: EffectDefinition, zoneType: 'hand' | 'unit' | 'pilot' | 'base'): boolean {
        // Action step targets are meant to represent *player-triggered* decisions (play/activate).
        // Exclude triggered/static rules so we don't block battle flow waiting for confirmations.
        if (!isPlayOrActivatedEffect(effect)) {
            return false;
        }

        // "Play" effects represent playing a card (typically from hand). Cards sitting in slots/base
        // should not advertise their "play" rules as action step options.
        if (effect.type === 'play' && zoneType !== 'hand') {
            return false;
        }

        const windows = Array.isArray(effect.timing?.windows)
            ? effect.timing!.windows!.map(window => typeof window === 'string' ? window.toUpperCase() : window)
            : [];

        if (windows.includes('ACTION_STEP')) {
            return true;
        }

        const actionTurn = typeof effect.timing?.actionTurn === 'string'
            ? effect.timing.actionTurn.toUpperCase()
            : undefined;

        return actionTurn === 'ACTION_STEP';
    }
}
