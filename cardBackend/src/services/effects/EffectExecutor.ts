// src/services/effects/EffectExecutor.ts
// Centralized effect application helpers reused by effect managers

import { GameEnvironment } from '../../models/GameEnvironment';
import { CardData, UnitZoneCard, PilotZoneCard, TemporaryEffect } from '../../models/CardSystem';
import { EffectDefinition, EffectTiming, TargetReference, TargetScope } from '../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { SLOT_ZONES } from '../../config/gameConstants';
import { ShieldCardManager } from '../ShieldCardManager';
import { GameNotificationManager } from '../GameNotificationManager';

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
    requiresAcknowledgment?: boolean;
    notify?: boolean;
}

export class EffectExecutor {

    private static readonly ACTION_HANDLERS: Record<string, (context: EffectActionContext) => { success: boolean; error?: string }> = {
        draw: ({ gameEnv, effect, sourcePlayerId }) => this.applyPlayerDrawEffect(gameEnv, sourcePlayerId, effect),
        addToHand: ({ gameEnv, effect, selectedTargets, sourcePlayerId }) =>
            this.applyAddToHandEffect(gameEnv, sourcePlayerId, effect, selectedTargets)
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

            const applyResult = this.applyEffectToResolvedCard(
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
                this.createTemporaryEffect(gameEnv, effect, successfullyApplied, sourcePlayerId, sourceCarduid);
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
        const drawCount = this.extractNumericValue(parameters) ?? 1;

        if (drawCount <= 0) {
            return {
                success: false,
                error: 'Draw effect requires a positive value'
            };
        }

        const targetPlayerIds = this.resolvePlayerIdsForScope(gameEnv, sourcePlayerId, effect.target?.scope);
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

    /**
     * Clean up expired temporary effects at end of turn
     */
    static cleanupExpiredTemporaryEffects(gameEnv: GameEnvironment, endingPlayerId: string): void {
        console.log(`🧹 Cleaning up temporary effects for player ${endingPlayerId} (turn ${gameEnv.currentTurn})`);

        let totalExpiredCount = 0;

        for (const playerId of Object.keys(gameEnv.players)) {
            const player = gameEnv.getPlayer(playerId);
            if (!player) continue;

            for (const slotName of SLOT_ZONES) {
                const slot = player.zones[slotName];

                if (slot?.unit?.temporaryEffects) {
                    totalExpiredCount += this.removeExpiredEffectsFromCard(slot.unit, endingPlayerId, gameEnv.currentTurn);
                }

                if (slot?.pilot?.temporaryEffects) {
                    totalExpiredCount += this.removeExpiredEffectsFromCard(slot.pilot, endingPlayerId, gameEnv.currentTurn);
                }
            }
        }

        console.log(`✅ Cleaned up ${totalExpiredCount} expired temporary effects applied by player ${endingPlayerId}`);
    }

    /**
     * Apply a direct stat modification to a single card without building a full target reference.
     */
    static applyContinueCardEffect(card: UnitZoneCard | PilotZoneCard, action: string, value: number): boolean {
        switch (action) {
            case 'modifyAP': {
                const previous = (card as any).continueModifyAP || 0;
                (card as any).continueModifyAP = previous + value;
                console.log(
                    `  ⚡ Card ${card.carduid}: continueModifyAP ${previous} → ${(card as any).continueModifyAP} (${value > 0 ? '+' : ''}${value})`
                );
                return true;
            }
            case 'modifyHP': {
                const previous = (card as any).continueModifyHP || 0;
                (card as any).continueModifyHP = previous + value;
                console.log(
                    `  ❤️ Card ${card.carduid}: continueModifyHP ${previous} → ${(card as any).continueModifyHP} (${value > 0 ? '+' : ''}${value})`
                );
                return true;
            }
            default:
                console.log(`⚠️ Unsupported direct card effect action: ${action}`);
                return false;
        }
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

    private static createTemporaryEffect(
        gameEnv: GameEnvironment,
        effect: EffectDefinition,
        selectedTargets: TargetReference[],
        sourcePlayerId: string,
        sourceCarduid: string
    ): void {

        console.log(`⏰ Creating temporary effect: ${effect.effectId} until end of turn`);

        for (const target of selectedTargets) {
            const resolvedTarget = SlotZoneUtils.resolveTargetReference(gameEnv, target);
            if (!resolvedTarget) {
                continue;
            }

            const targetCard = resolvedTarget.card as UnitZoneCard | PilotZoneCard;
            const parameters = effect.parameters || {};

            const parameterValue = parameters['value'];

            const tempEffect: TemporaryEffect = {
                sourceCarduid,
                modifyAP: effect.action === 'modifyAP' && typeof parameterValue === 'number' ? parameterValue : undefined,
                modifyHP: effect.action === 'modifyHP' && typeof parameterValue === 'number' ? parameterValue : undefined,
                duration: effect.timing?.duration || 'UNTIL_END_OF_TURN',
                appliedTurn: gameEnv.currentTurn,
                appliedBy: sourcePlayerId
            };

            if (!targetCard.temporaryEffects) {
                targetCard.temporaryEffects = [];
            }

            targetCard.temporaryEffects.push(tempEffect);
            console.log(`✅ Added temporary effect from ${sourceCarduid} to unit ${target.carduid}`);
        }
    }

    private static applyEffectToResolvedCard(
        gameEnv: GameEnvironment,
        targetCard: UnitZoneCard | PilotZoneCard,
        action: string,
        parameters: Record<string, unknown> | undefined,
        target: TargetReference
    ): { success: boolean; error?: string } {
        switch (action) {
            case 'modifyAP':
            case 'modifyHP':
                return this.applyModifyStat(gameEnv, targetCard, action, parameters, target);

            case 'heal':
                return this.applyHealToCard(targetCard, parameters, target);

            case 'damage':
                return this.applyDamageToCard(targetCard, parameters, target);

            case 'rest':
                return this.applyRestState(targetCard, true, target);

            case 'setActive':
                return this.applySetActiveEffect(gameEnv, targetCard, target);

            default:
                console.log(`⚠️ Unsupported effect action: ${action}`);
                return {
                    success: false,
                    error: `Unsupported effect action: ${action}`
                };
        }
    }

    private static applyModifyStat(
        gameEnv: GameEnvironment,
        targetCard: UnitZoneCard | PilotZoneCard,
        action: 'modifyAP' | 'modifyHP',
        parameters: Record<string, unknown> | undefined,
        target: TargetReference
    ): { success: boolean; error?: string } {
        const value = this.extractNumericValue(parameters);
        if (value === undefined) {
            return {
                success: false,
                error: `${action} effect requires numeric value`
            };
        }

        const property = action === 'modifyAP' ? 'modifyAP' : 'modifyHP';
        const previousValue = (targetCard as any)[property] || 0;
        (targetCard as any)[property] = previousValue + value;

        console.log(`  ⚙️ ${target.carduid}: ${property} ${previousValue} → ${(targetCard as any)[property]} (${value > 0 ? '+' : ''}${value})`);
        this.notifyCardStatChange(
            gameEnv,
            targetCard,
            target,
            action,
            value,
            (targetCard as any)[property]
        );
        return { success: true };
    }

    private static applyHealToCard(
        targetCard: UnitZoneCard | PilotZoneCard,
        parameters: Record<string, unknown> | undefined,
        target: TargetReference
    ): { success: boolean; error?: string } {
        const value = this.extractNumericValue(parameters);
        if (value === undefined) {
            return {
                success: false,
                error: 'Heal effect requires numeric value'
            };
        }

        const maxHP = targetCard.originalHP ?? targetCard.cardData?.hp ?? 0;
        if (maxHP === 0) {
            return {
                success: false,
                error: `Card ${target.carduid} has no HP information`
            };
        }

        const previousDamage = typeof (targetCard as any).damageReceived === 'number'
            ? (targetCard as any).damageReceived
            : 0;

        const healAmount = Math.max(0, value);
        const newDamage = Math.max(0, previousDamage - healAmount);
        (targetCard as any).damageReceived = newDamage;

        const resultingHP = Math.max(0, maxHP - newDamage);

        console.log(`  🩹 ${target.carduid}: damage ${previousDamage} → ${newDamage} (HP ${resultingHP}/${maxHP})`);
        return { success: true };
    }

    private static applyDamageToCard(
        targetCard: UnitZoneCard | PilotZoneCard,
        parameters: Record<string, unknown> | undefined,
        target: TargetReference
    ): { success: boolean; error?: string } {
        const value = this.extractNumericValue(parameters);
        if (value === undefined) {
            return {
                success: false,
                error: 'Damage effect requires numeric value'
            };
        }

        const maxHP = targetCard.originalHP ?? targetCard.cardData?.hp ?? 0;
        if (maxHP === 0) {
            return {
                success: false,
                error: `Card ${target.carduid} has no HP information`
            };
        }

        const previousDamage = typeof (targetCard as any).damageReceived === 'number'
            ? (targetCard as any).damageReceived
            : 0;
        const newDamage = previousDamage + value;
        (targetCard as any).damageReceived = newDamage;

        const resultingHP = Math.max(0, maxHP - newDamage);

        console.log(`  💥 ${target.carduid}: damage ${previousDamage} → ${newDamage} (HP ${resultingHP}/${maxHP})`);
        return { success: true };
    }

    private static notifyCardStatChange(
        gameEnv: GameEnvironment,
        targetCard: UnitZoneCard | PilotZoneCard,
        target: TargetReference,
        action: 'modifyAP' | 'modifyHP',
        delta: number,
        modifierValue: number
    ): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        const cardId = targetCard.cardId ?? target.cardData?.cardId;
        const cardName = target.cardData?.name || targetCard.cardData?.name || 'Unknown Card';

        notificationManager.addNotificationEvent(
            'CARD_STAT_MODIFIED',
            {
                playerId: target.playerId,
                carduid: target.carduid,
                cardId,
                cardName,
                zone: target.zone,
                stat: action,
                delta,
                modifierValue,
                timestamp: Date.now()
            },
            false,
            'normal'
        );
    }

    private static applyRestState(
        targetCard: UnitZoneCard | PilotZoneCard,
        shouldRest: boolean,
        target: TargetReference
    ): { success: boolean; error?: string } {
        targetCard.isRested = shouldRest;
        console.log(`  😌 ${target.carduid}: ${shouldRest ? 'rested' : 'activated'}`);
        return { success: true };
    }

    private static applySetActiveEffect(
        gameEnv: GameEnvironment,
        targetCard: UnitZoneCard | PilotZoneCard,
        target: TargetReference
    ): { success: boolean; error?: string } {
        const playerId = target.playerId;
        if (!playerId) {
            console.warn('⚠️ setActive effect missing playerId in target reference');
            return { success: true };
        }

        const player = gameEnv.players[playerId];
        const energyArea = player?.zones?.energyArea;
        if (!energyArea || energyArea.length === 0) {
            console.log('⚠️ No energy cards available to ready');
            return { success: true };
        }

        const restedEnergy = [...energyArea].reverse().find(card => card.isRested);
        if (!restedEnergy) {
            console.log('⚠️ No rested energy available to set active');
            return { success: true };
        }

        restedEnergy.isRested = false;
        console.log(`  ⚡ Ready energy ${restedEnergy.carduid}`);
        return { success: true };
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

            notificationManager.addNotificationEvent(
                options.eventType || 'CARD_ADDED_TO_HAND',
                {
                    playerId,
                    carduid,
                    cardId,
                    cardName,
                    sourceZone: options.sourceZone,
                    reason: options.reason,
                    timestamp: Date.now()
                },
                options.requiresAcknowledgment ?? false,
                'normal'
            );
        }

        return { success: true };
    }

    private static extractNumericValue(parameters?: Record<string, unknown>): number | undefined {
        if (!parameters) {
            return undefined;
        }

        const rawValue =
            parameters['value'] ??
            parameters['amount'] ??
            parameters['modifier'];
        if (typeof rawValue === 'number') {
            return rawValue;
        }

        if (typeof rawValue === 'string') {
            const parsed = Number(rawValue);
            return Number.isNaN(parsed) ? undefined : parsed;
        }

        return undefined;
    }

    private static resolvePlayerIdsForScope(
        gameEnv: GameEnvironment,
        sourcePlayerId: string,
        scope: TargetScope | string | undefined
    ): string[] {
        if (!scope || scope === 'self' || scope === 'SELF') {
            return [sourcePlayerId];
        }

        if (scope === 'opponent' || scope === 'OPPONENT') {
            const opponentId = gameEnv.getOpponentId(sourcePlayerId);
            return opponentId ? [opponentId] : [];
        }

        if (scope === 'any' || scope === 'both') {
            const opponentId = gameEnv.getOpponentId(sourcePlayerId);
            return opponentId ? [sourcePlayerId, opponentId] : [sourcePlayerId];
        }

        // Fallback: treat custom scopes (e.g., self_all_unit) as self to avoid silent failures
        return [sourcePlayerId];
    }

    static drawCardsIntoHand(
        gameEnv: GameEnvironment,
        playerId: string,
        deck: any,
        count: number
    ): void {
        if (!deck || !Array.isArray(deck.mainDeck)) {
            throw new Error('Deck structure invalid for draw effect');
        }

        for (let i = 0; i < count && deck.mainDeck.length > 0; i++) {
            const drawnCard = deck.mainDeck.shift();
            if (!drawnCard) continue;

            const addResult = this.addCardToPlayerHand(gameEnv, playerId, drawnCard, undefined, {
                eventType: 'CARD_DRAWN',
                sourceZone: 'deck',
                reason: 'draw',
                requiresAcknowledgment: true
            });
            if (!addResult.success) {
                throw new Error(addResult.error || `Failed to add ${drawnCard} to hand`);
            }
        }

        const handSize = Array.isArray(deck.handUids) ? deck.handUids.length : deck._handUids?.length || 0;
        console.log(`🃏 Deck draw complete. Hand size: ${handSize}`);
    }

    private static removeExpiredEffectsFromCard(
        card: UnitZoneCard | PilotZoneCard,
        endingPlayerId: string,
        currentTurn: number
    ): number {
        if (!card.temporaryEffects) {
            return 0;
        }

        const initialCount = card.temporaryEffects.length;
        card.temporaryEffects = card.temporaryEffects.filter(tempEffect => {
            const effectTurn = tempEffect.appliedTurn ?? currentTurn;
            const shouldExpire = tempEffect.duration === 'UNTIL_END_OF_TURN' && effectTurn <= currentTurn;

            if (shouldExpire) {
                const appliedBy = tempEffect.appliedBy ?? 'unknown';
                console.log(
                    `⏰ Expiring temporary effect from ${tempEffect.sourceCarduid} applied by ${appliedBy} on card ${card.carduid} (ending player ${endingPlayerId}, effect turn ${effectTurn})`
                );
                this.revertTemporaryEffectFromUnit(card, tempEffect);
            }

            return !shouldExpire;
        });

        return initialCount - card.temporaryEffects.length;
    }

    private static revertTemporaryEffectFromUnit(card: UnitZoneCard | PilotZoneCard, tempEffect: TemporaryEffect): void {
        if (tempEffect.modifyAP !== undefined) {
            const currentAP = (card as any).modifyAP || 0;
            const nextAP = currentAP - tempEffect.modifyAP;
            (card as any).modifyAP = nextAP;
            console.log(`🔄 Reverted AP modification on ${card.carduid}: ${currentAP} → ${nextAP}`);
        }

        if (tempEffect.modifyHP !== undefined) {
            const currentHP = (card as any).modifyHP || 0;
            const nextHP = currentHP - tempEffect.modifyHP;
            (card as any).modifyHP = nextHP;
            console.log(`🔄 Reverted HP modification on ${card.carduid}: ${currentHP} → ${nextHP}`);
        }
    }
}
