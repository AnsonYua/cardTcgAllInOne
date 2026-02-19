// src/services/effects/EffectExecutor.ts
// Centralized effect application helpers reused by effect managers

import { GameEnvironment } from '../../models/GameEnvironment';
import { CardData, UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import { EffectDefinition, EffectTiming, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { ShieldCardManager } from '../ShieldCardManager';
import { EffectStatApplier } from './EffectStatApplier';
import { EffectTemporaryManager } from './EffectTemporaryManager';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { applyAddBasicEnergyEffect, applyAddExtraEnergyEffect } from './actions/EffectEnergyActions';
import { applyScryTopDeckEffect } from './actions/EffectScryActions';
import { applyGrantBreachEffect } from './actions/EffectBreachActions';
import { applyPreventShieldDamageEffect, applyDamageShieldEffect } from './actions/EffectShieldActions';
import { applyConditionalTokenDeployEffect } from './actions/EffectTokenActions';
import { applySetActiveEffect } from './actions/EffectSetActiveActions';
import { applySetActiveThenRestrictAttackEffect } from './actions/EffectSetActiveThenRestrictAttackActions';
import { applyRestrictAttackEffect } from './actions/EffectRestrictAttackActions';
import { applyDeployFromHandEffect } from './actions/EffectDeployFromHandActions';
import { applySequenceEffect } from './actions/EffectSequenceActions';
import { applyDiscardFromHandEffect } from './actions/EffectDiscardActions';
import { applyMoveFromHandToDeckBottom, applyMoveFromTrashToDeck } from './actions/EffectDeckActions';
import { applyExileFromTrashEffect } from './actions/EffectExileActions';
import { applyDestroyEffect } from './actions/EffectDestroyActions';
import { applyGrantKeywordEffect } from './actions/EffectKeywordActions';
import { applyPreventBattleDamageEffect } from './actions/EffectBattleDamagePreventionActions';
import { applyPreventSetActiveNextTurnEffect } from './actions/EffectActivationLockActions';
import { applyReturnToHandEffect } from './actions/EffectReturnToHandActions';
import { applyPairFromTrashEffect } from './actions/EffectPairActions';
import { applyRestEffect } from './actions/EffectRestActions';
import { applyDamageEffect } from './actions/EffectDamageActions';
import { applyAllowAttackTargetEffect } from './actions/EffectAllowAttackTargetActions';
import { extractNumericValue, resolvePlayerIdsForScope } from './actions/EffectActionUtils';
import { HandZoneManager } from '../zones/HandZoneManager';
import type { AddToHandOptions } from '../zones/HandZoneManager';
import { EffectDrawTriggerDispatcher } from './EffectDrawTriggerDispatcher';
import { DrawNotificationPublisher } from './DrawNotificationPublisher';

interface EffectActionContext {
    gameEnv: GameEnvironment;
    effect: EffectDefinition;
    selectedTargets: TargetReference[];
    sourcePlayerId: string;
    sourceCarduid?: string;
}

export class EffectExecutor {

    private static readonly ACTION_HANDLERS: Record<string, (context: EffectActionContext) => { success: boolean; error?: string }> = {
        draw: ({ gameEnv, effect, sourcePlayerId, sourceCarduid }) => this.applyPlayerDrawEffect(gameEnv, sourcePlayerId, effect, sourceCarduid),
        addToHand: ({ gameEnv, effect, selectedTargets, sourcePlayerId }) =>
            this.applyAddToHandEffect(gameEnv, sourcePlayerId, effect, selectedTargets),
        addExtraEnergy: ({ gameEnv, effect, sourcePlayerId, sourceCarduid }) =>
            applyAddExtraEnergyEffect(gameEnv, sourcePlayerId, sourceCarduid, effect),
        addBasicEnergy: ({ gameEnv, effect, sourcePlayerId, sourceCarduid }) =>
            applyAddBasicEnergyEffect(gameEnv, sourcePlayerId, sourceCarduid, effect),
        scry_top_deck: ({ gameEnv, effect, sourcePlayerId }) => applyScryTopDeckEffect(gameEnv, sourcePlayerId, effect),
        grant_breach: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyGrantBreachEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        prevent_shield_damage: ({ gameEnv, effect, sourcePlayerId, sourceCarduid }) =>
            applyPreventShieldDamageEffect(gameEnv, sourcePlayerId, sourceCarduid, effect),
        conditionalTokenDeploy: ({ gameEnv, effect, sourcePlayerId, sourceCarduid }) =>
            applyConditionalTokenDeployEffect(gameEnv, sourcePlayerId, sourceCarduid, effect),
        deploy_from_hand: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyDeployFromHandEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        restrict_attack: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyRestrictAttackEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        discardFromHand: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyDiscardFromHandEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        moveFromHandToDeckBottom: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyMoveFromHandToDeckBottom(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        moveFromTrashToDeck: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyMoveFromTrashToDeck(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        exileFromTrash: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyExileFromTrashEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        destroy: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyDestroyEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        grant_keyword: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyGrantKeywordEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        sequence: ({ gameEnv, effect, sourcePlayerId, sourceCarduid }) =>
            applySequenceEffect(gameEnv, sourcePlayerId, sourceCarduid, effect),
        damageShield: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyDamageShieldEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        setActive: ({ gameEnv, effect, selectedTargets, sourcePlayerId }) =>
            applySetActiveEffect(gameEnv, sourcePlayerId, effect, selectedTargets),
        setActive_then_restrict_attack: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applySetActiveThenRestrictAttackEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        prevent_battle_damage: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyPreventBattleDamageEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        prevent_set_active_next_turn: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyPreventSetActiveNextTurnEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        returnToHand: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyReturnToHandEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        pair_from_trash: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyPairFromTrashEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        rest: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyRestEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        damage: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyDamageEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets),
        allow_attack_target: ({ gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid }) =>
            applyAllowAttackTargetEffect(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets)
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

    static applyPlayerDrawEffect(
        gameEnv: GameEnvironment,
        sourcePlayerId: string,
        effect: EffectDefinition,
        sourceCarduid?: string
    ): { success: boolean; error?: string } {
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

            const drawContext = sourceCarduid
                ? `effect_draw:${sourceCarduid}`
                : `effect_draw:${effect.effectId}`;

            this.drawCardsIntoHand(gameEnv, targetPlayerId, player.deck, drawCount, {
                drawContext,
                sourceCarduid
            });
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

    static cleanupEndOfBattleTemporaryEffects(gameEnv: GameEnvironment, carduids: string[]): number {
        return EffectTemporaryManager.cleanupEndOfBattleTemporaryEffects(gameEnv, carduids);
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
        return HandZoneManager.addCardToHand(gameEnv, playerId, carduid, cardData, {
            eventType: options.eventType,
            sourceZone: options.sourceZone,
            reason: options.reason,
            notify: options.notify,
            drawContext: options.drawContext,
            extraPayload: options.extraPayload
        });
    }


    static drawCardsIntoHand(
        gameEnv: GameEnvironment,
        playerId: string,
        deck: any,
        count: number,
        options: { notify?: boolean; drawContext?: string; sourceCarduid?: string } = {}
    ): void {
        if (!deck || !Array.isArray(deck.mainDeck)) {
            throw new Error('Deck structure invalid for draw effect');
        }

        const shouldNotify = options.notify !== false;
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
                notify: false,
                drawContext
            });
            if (!addResult.success) {
                throw new Error(addResult.error || `Failed to add ${drawnCard} to hand`);
            }
        }

        if (shouldNotify && drawnUids.length > 0) {
            DrawNotificationPublisher.publishDrawNotifications(gameEnv, {
                playerId,
                drawnCarduids: drawnUids,
                drawContext,
                sourceZone: 'deck',
                reason: 'draw'
            });
        }

        EffectDrawTriggerDispatcher.dispatchEffectDrawIfNeeded({
            gameEnv,
            playerId,
            drawnCarduids: drawnUids,
            drawContext,
            sourceCarduid: options.sourceCarduid
        });

        const handSize = Array.isArray(deck.handUids) ? deck.handUids.length : deck._handUids?.length || 0;
        console.log(`🃏 Deck draw complete. Hand size: ${handSize}`);
    }

}
