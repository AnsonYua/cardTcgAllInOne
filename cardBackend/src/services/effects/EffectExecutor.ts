// src/services/effects/EffectExecutor.ts
// Centralized effect application helpers reused by effect managers

import { GameEnvironment } from '../../models/GameEnvironment';
import { CardData, UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import { EffectDefinition, EffectTiming, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { ShieldCardManager } from '../ShieldCardManager';
import { EffectStatApplier } from './EffectStatApplier';
import { EffectTemporaryManager } from './EffectTemporaryManager';
import { GameNotificationManager } from '../GameNotificationManager';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { applyAddExtraEnergyEffect } from './actions/EffectEnergyActions';
import { applyScryTopDeckEffect } from './actions/EffectScryActions';
import { applyGrantBreachEffect } from './actions/EffectBreachActions';
import { applyPreventShieldDamageEffect, applyDamageShieldEffect } from './actions/EffectShieldActions';
import { applyConditionalTokenDeployEffect } from './actions/EffectTokenActions';
import { applySetActiveEffect } from './actions/EffectSetActiveActions';
import { applyDeployFromHandEffect } from './actions/EffectDeployFromHandActions';
import { applySequenceEffect } from './actions/EffectSequenceActions';
import { applyDiscardFromHandEffect } from './actions/EffectDiscardActions';
import { applyGrantKeywordEffect } from './actions/EffectKeywordActions';
import { extractNumericValue, resolvePlayerIdsForScope } from './actions/EffectActionUtils';

interface EffectActionContext {
    gameEnv: GameEnvironment;
    effect: EffectDefinition;
    selectedTargets: TargetReference[];
    sourcePlayerId: string;
    sourceCarduid?: string;
}

interface AddToHandOptions {
    eventType?: string;
    sourceZone?: string;
    reason?: string;
    notify?: boolean;
    drawContext?: string;
}

export class EffectExecutor {

    private static readonly ACTION_HANDLERS: Record<string, (context: EffectActionContext) => { success: boolean; error?: string }> = {
        draw: ({ gameEnv, effect, sourcePlayerId }) => this.applyPlayerDrawEffect(gameEnv, sourcePlayerId, effect),
        addToHand: ({ gameEnv, effect, selectedTargets, sourcePlayerId }) =>
            this.applyAddToHandEffect(gameEnv, sourcePlayerId, effect, selectedTargets),
        addExtraEnergy: ({ gameEnv, effect, sourcePlayerId }) => applyAddExtraEnergyEffect(gameEnv, sourcePlayerId, effect),
        scry_top_deck: ({ gameEnv, effect, sourcePlayerId }) => applyScryTopDeckEffect(gameEnv, sourcePlayerId, effect),
        grant_breach: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyGrantBreachEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        prevent_shield_damage: ({ gameEnv, effect, sourcePlayerId, sourceCarduid }) =>
            applyPreventShieldDamageEffect(gameEnv, sourcePlayerId, sourceCarduid, effect),
        conditionalTokenDeploy: ({ gameEnv, effect, sourcePlayerId, sourceCarduid }) =>
            applyConditionalTokenDeployEffect(gameEnv, sourcePlayerId, sourceCarduid, effect),
        deploy_from_hand: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyDeployFromHandEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        discardFromHand: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyDiscardFromHandEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        grant_keyword: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyGrantKeywordEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        sequence: ({ gameEnv, effect, sourcePlayerId, sourceCarduid }) =>
            applySequenceEffect(gameEnv, sourcePlayerId, sourceCarduid, effect),
        damageShield: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyDamageShieldEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        setActive: ({ gameEnv, effect, selectedTargets, sourcePlayerId }) =>
            applySetActiveEffect(gameEnv, sourcePlayerId, effect, selectedTargets)
    };

    /**
     * Apply effect to selected targets using unified application logic
     */
    static applyEffectToTargets(
        gameEnv: GameEnvironment,
        effect: EffectDefinition,
        selectedTargets: TargetReference[],
        sourcePlayerId: string,
        sourceCarduid?: string
    ): { success: boolean; error?: string } {

        const action = this.getEffectAction(effect);
        if (!action) {
            return {
                success: false,
                error: 'Effect action is undefined'
            };
        }

        const handler = this.ACTION_HANDLERS[action];
        if (handler) {
            return handler({
                gameEnv,
                effect,
                selectedTargets,
                sourcePlayerId,
                sourceCarduid
            });
        }

        const parameters = this.getEffectParameters(effect);
        const timing = this.getEffectTiming(effect);

        console.log(`⚡ Applying effect ${action} to ${selectedTargets.length} target(s)`);

        try {
            const successfullyApplied: TargetReference[] = [];

            for (const target of selectedTargets) {
                const resolvedTarget = SlotZoneUtils.resolveTargetReference(gameEnv, target);
                if (!resolvedTarget) {
                    return {
                        success: false,
                        error: `Target card ${target.carduid} not found in zone ${target.zone}`
                    };
                }

            const applyResult = EffectStatApplier.applyEffectToResolvedCard(
                gameEnv,
                resolvedTarget.card as UnitZoneCard | PilotZoneCard,
                action,
                parameters,
                target
            );

                if (!applyResult.success) {
                    return applyResult;
                }

                successfullyApplied.push(target);
            }

            if (timing?.duration === 'UNTIL_END_OF_TURN' && sourceCarduid && successfullyApplied.length > 0) {
                EffectTemporaryManager.createTemporaryEffect(gameEnv, effect, successfullyApplied, sourcePlayerId, sourceCarduid);
            }

            console.log(`✅ Successfully applied ${action} to ${successfullyApplied.length} target(s)`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error applying effect to targets:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Effect application failed'
            };
        }
    }

    /**
     * Wrapper for activated abilities to reuse unified target handling
     */
    static executeActivatedEffect(
        gameEnv: GameEnvironment,
        effect: EffectDefinition,
        targets: TargetReference[],
        sourcePlayerId: string,
        sourceCarduid: string
    ): { success: boolean; error?: string } {
        return this.applyEffectToTargets(gameEnv, effect, targets, sourcePlayerId, sourceCarduid);
    }

     static applyAddToHandEffect(gameEnv: GameEnvironment, 
                                 sourcePlayerId: string, 
                                 effect: EffectDefinition,
                                 selectedTargets: TargetReference[]): { success: boolean; error?: string } {
        console.log(`➕ Applying addToHand effect to ${selectedTargets.length} target(s)`);
        
        try {
            // Process each selected target using centralized GameEngine method
            for (const target of selectedTargets) {
                console.log(`➕ Processing addToHand for target: ${target.carduid} in zone ${target.zone}`);
                
                // Check if we need to remove card from shield first (based on effect parameters)
                const parameters = this.getEffectParameters(effect);
                if (parameters?.from === 'shield') {
                    console.log(`🛡️ Effect specifies removal from shield - removing ${target.carduid} from shield first`);
                    
                    // Remove card from shield first using centralized helper
                    const removeResult = this.removeCardFromShield(gameEnv, sourcePlayerId, target.carduid);
                    if (!removeResult.success) {
                        return {
                            success: false,
                            error: removeResult.error || `Failed to remove card ${target.carduid} from shield`
                        };
                    }
                }
                
                // Use centralized helper to add card to hand
                const executionResult = this.addCardToPlayerHand(
                    gameEnv,
                    sourcePlayerId,
                    target.carduid,
                    target.cardData,
                    {
                        sourceZone: target.zone || (parameters?.from as string | undefined)
                    }
                );
                
                if (!executionResult.success) {
                    return {
                        success: false,
                        error: executionResult.error || `Failed to add card ${target.carduid} to hand`
                    };
                }
                
                console.log(`✅ Card ${target.carduid} added to ${sourcePlayerId}'s hand from ${target.zone} zone`);
            }
            return { success: true };
            
        } catch (error) {
            console.error(`❌ Error applying addToHand effect:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'AddToHand effect application failed'
            };
        }
     }

    static applyPlayerDrawEffect(gameEnv: GameEnvironment, sourcePlayerId: string, effect: EffectDefinition): { success: boolean; error?: string } {
        const parameters = this.getEffectParameters(effect);
        const drawCount = extractNumericValue(parameters) ?? 1;

        if (drawCount <= 0) {
            return {
                success: false,
                error: 'Draw effect requires a positive value'
            };
        }

        const targetPlayerIds = resolvePlayerIdsForScope(gameEnv, sourcePlayerId, effect.target?.scope);
        if (targetPlayerIds.length === 0) {
            return {
                success: false,
                error: 'No eligible player targets for draw effect'
            };
        }

        for (const targetPlayerId of targetPlayerIds) {
            const player = gameEnv.getPlayer(targetPlayerId);
            if (!player?.deck) {
                console.error(`❌ Player ${targetPlayerId} deck not found for draw effect`);
                return {
                    success: false,
                    error: `Player ${targetPlayerId} deck not found`
                };
            }

            this.drawCardsIntoHand(gameEnv, targetPlayerId, player.deck, drawCount);
        }

        console.log(`🃏 Applied draw effect (${drawCount}) to players: ${targetPlayerIds.join(', ')}`);
        return { success: true };
    }


    static actionSupportsNoTargets(action?: string): boolean {
        if (!action) {
            return false;
        }

        return [
            'draw',
            'addExtraEnergy',
            'scry_top_deck',
            'prevent_shield_damage',
            'conditionalTokenDeploy',
            'sequence'
        ].includes(action);
    }

    /**
     * Clean up expired temporary effects at end of turn
     */
    static cleanupExpiredTemporaryEffects(gameEnv: GameEnvironment, endingPlayerId: string): void {
        EffectTemporaryManager.cleanupExpiredTemporaryEffects(gameEnv, endingPlayerId);
    }

    /**
     * Apply a direct stat modification to a single card without building a full target reference.
     */
    static applyContinueCardEffect(card: UnitZoneCard | PilotZoneCard, action: string, value: number): boolean {
        return EffectTemporaryManager.applyContinueCardEffect(card, action, value);
    }

    /**
     * Determine effect action
     */
    static getEffectAction(effect: EffectDefinition): string | undefined {
        const directAction = typeof effect.action === 'string' ? effect.action : undefined;
        return directAction && directAction.length > 0 ? directAction : undefined;
    }

    /**
     * Determine effect parameters
     */
    static getEffectParameters(effect: EffectDefinition): Record<string, unknown> | undefined {
        return effect.parameters;
    }

    /**
     * Determine effect timing
     */
    static getEffectTiming(effect: EffectDefinition): EffectTiming | undefined {
        return effect.timing;
    }

    static removeTemporaryEffectsFromSource(gameEnv: GameEnvironment, sourceCarduid: string): number {
        return EffectTemporaryManager.removeTemporaryEffectsFromSource(gameEnv, sourceCarduid);
    }

    static removeCardFromShield(
        gameEnv: GameEnvironment,
        playerId: string,
        carduid: string
    ): { success: boolean; error?: string } {
        const removed = ShieldCardManager.removeShieldCard(gameEnv, playerId, carduid);
        if (!removed) {
            console.log(`⚠️ Warning: Could not remove card ${carduid} from ${playerId}'s shield`);
            return {
                success: false,
                error: `Card ${carduid} not found in ${playerId}'s shield`
            };
        }

        console.log(`🛡️ Card ${carduid} successfully removed from ${playerId}'s shield`);
        return { success: true };
    }

    static addCardToPlayerHand(
        gameEnv: GameEnvironment,
        playerId: string,
        carduid: string,
        cardData?: CardData | Record<string, unknown>,
        options: AddToHandOptions = {}
    ): { success: boolean; error?: string } {
        const player = gameEnv.getPlayer(playerId);
        if (!player || !player.deck) {
            return {
                success: false,
                error: `Player ${playerId} not found`
            };
        }

        if (!Array.isArray(player.deck._handUids)) {
            player.deck._handUids = [];
        }

        let added = false;
        if (!player.deck._handUids.includes(carduid)) {
            player.deck._handUids.push(carduid);
            added = true;
        }

        if (Array.isArray(player.deck.handUids) && !player.deck.handUids.includes(carduid)) {
            player.deck.handUids.push(carduid);
            added = true;
        }

        const cardName = typeof cardData?.name === 'string' ? cardData.name : 'Unknown';
        console.log(`✅ Card ${carduid} (${cardName}) added to ${playerId}'s hand`);

        if (added && options.notify !== false) {
            const notificationManager = new GameNotificationManager(gameEnv);
            const cardId = (cardData as { id?: string } | undefined)?.id;

            const eventType = options.eventType || 'CARD_ADDED_TO_HAND';
            const payload: Record<string, unknown> = {
                playerId,
                carduid,
                cardId,
                sourceZone: options.sourceZone,
                reason: options.reason,
                timestamp: Date.now()
            };
            if (eventType !== 'CARD_DRAWN') {
                payload.cardName = cardName;
            } else if (options.drawContext) {
                payload.drawContext = options.drawContext;
            }

            notificationManager.addNotificationEvent(
                eventType,
                payload,
                'normal'
            );
        }

        return { success: true };
    }


    static drawCardsIntoHand(
        gameEnv: GameEnvironment,
        playerId: string,
        deck: any,
        count: number,
        options: { notify?: boolean; drawContext?: string } = {}
    ): void {
        if (!deck || !Array.isArray(deck.mainDeck)) {
            throw new Error('Deck structure invalid for draw effect');
        }

        const shouldNotify = options.notify !== false;
        const notifyPerCard = shouldNotify && count === 1;
        const drawnUids: string[] = [];
        const drawContext = options.drawContext;

        for (let i = 0; i < count && deck.mainDeck.length > 0; i++) {
            const drawnCard = deck.mainDeck.shift();
            if (!drawnCard) continue;
            drawnUids.push(drawnCard);

            const addResult = this.addCardToPlayerHand(gameEnv, playerId, drawnCard, undefined, {
                eventType: 'CARD_DRAWN',
                sourceZone: 'deck',
                reason: 'draw',
                notify: notifyPerCard,
                drawContext
            });
            if (!addResult.success) {
                throw new Error(addResult.error || `Failed to add ${drawnCard} to hand`);
            }
        }

        if (shouldNotify && !notifyPerCard && drawnUids.length > 0) {
            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.addNotificationEvent('CARD_DRAWN', {
                playerId,
                count: drawnUids.length,
                carduids: drawnUids,
                sourceZone: 'deck',
                reason: 'draw',
                drawContext,
                timestamp: Date.now()
            });
        }

        const handSize = Array.isArray(deck.handUids) ? deck.handUids.length : deck._handUids?.length || 0;
        console.log(`🃏 Deck draw complete. Hand size: ${handSize}`);
    }

}
