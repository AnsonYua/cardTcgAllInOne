// src/services/effects/EffectExecutor.ts
// Centralized effect application helpers reused by effect managers

import { GameEnvironment } from '../../models/GameEnvironment';
import { UnitZoneCard, PilotZoneCard, TemporaryEffect } from '../../models/CardSystem';
import { EffectDefinition, EffectTiming, TargetReference, TargetScope } from '../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { SLOT_ZONES } from '../../config/gameConstants';

export class EffectExecutor {

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

        if (action === 'draw') {
            return this.applyPlayerDrawEffect(gameEnv, sourcePlayerId, effect);
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

            this.drawCardsIntoHand(player.deck, drawCount);
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
                    `  ❤️ Card ${card.carduid}: continueModifyHP ${previous} → ${(card as any).modifyHP} (${value > 0 ? '+' : ''}${value})`
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
        if (directAction && directAction.length > 0) {
            return directAction;
        }

        const nestedAction = effect.effect?.action;
        if (typeof nestedAction === 'string' && nestedAction.length > 0) {
            return nestedAction;
        }

        return undefined;
    }

    /**
     * Determine effect parameters
     */
    static getEffectParameters(effect: EffectDefinition): Record<string, unknown> | undefined {
        return effect.parameters ?? effect.effect?.parameters;
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
            const parameters = effect.parameters || effect.effect?.parameters || {};

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
        targetCard: UnitZoneCard | PilotZoneCard,
        action: string,
        parameters: Record<string, unknown> | undefined,
        target: TargetReference
    ): { success: boolean; error?: string } {
        switch (action) {
            case 'modifyAP':
            case 'modifyHP':
                return this.applyModifyStat(targetCard, action, parameters, target);

            case 'heal':
                return this.applyHealToCard(targetCard, parameters, target);

            case 'damage':
                return this.applyDamageToCard(targetCard, parameters, target);

            case 'rest':
                return this.applyRestState(targetCard, true, target);

            case 'setActive':
                return this.applyRestState(targetCard, false, target);

            default:
                console.log(`⚠️ Unsupported effect action: ${action}`);
                return {
                    success: false,
                    error: `Unsupported effect action: ${action}`
                };
        }
    }

    private static applyModifyStat(
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

        const maxHP = targetCard.cardData?.hp ?? targetCard.originalHP ?? targetCard.currentHP ?? 0;
        if (maxHP === 0) {
            return {
                success: false,
                error: `Card ${target.carduid} has no HP information`
            };
        }

        const currentHP = typeof targetCard.currentHP === 'number' ? targetCard.currentHP : maxHP;
        const newHP = Math.min(maxHP, currentHP + value);
        targetCard.currentHP = newHP;

        if (typeof (targetCard as any).damageReceived === 'number') {
            const previousDamage = (targetCard as any).damageReceived;
            (targetCard as any).damageReceived = Math.max(0, previousDamage - value);
        }

        console.log(`  🩹 ${target.carduid}: HP ${currentHP} → ${newHP}`);
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

        const maxHP = targetCard.cardData?.hp ?? targetCard.originalHP ?? targetCard.currentHP ?? 0;
        if (maxHP === 0) {
            return {
                success: false,
                error: `Card ${target.carduid} has no HP information`
            };
        }

        const currentHP = typeof targetCard.currentHP === 'number' ? targetCard.currentHP : maxHP;
        const newHP = Math.max(0, currentHP - value);
        targetCard.currentHP = newHP;

        const previousDamage = typeof (targetCard as any).damageReceived === 'number'
            ? (targetCard as any).damageReceived
            : 0;
        (targetCard as any).damageReceived = previousDamage + value;

        console.log(`  💥 ${target.carduid}: HP ${currentHP} → ${newHP} (damage ${value})`);
        return { success: true };
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

    private static drawCardsIntoHand(deck: any, count: number): void {
        if (!deck || !Array.isArray(deck.mainDeck)) {
            throw new Error('Deck structure invalid for draw effect');
        }

        if (!Array.isArray(deck._handUids)) {
            deck._handUids = Array.isArray(deck.handUids) ? [...deck.handUids] : [];
        }

        if (!Array.isArray(deck.handUids)) {
            deck.handUids = Array.isArray(deck._handUids) ? [...deck._handUids] : [];
        }

        for (let i = 0; i < count && deck.mainDeck.length > 0; i++) {
            const drawnCard = deck.mainDeck.shift();
            if (!drawnCard) continue;

            if (!deck._handUids.includes(drawnCard)) {
                deck._handUids.push(drawnCard);
            }

            if (Array.isArray(deck.handUids) && !deck.handUids.includes(drawnCard)) {
                deck.handUids.push(drawnCard);
            }
        }

        const handSize = Array.isArray(deck.handUids) ? deck.handUids.length : deck._handUids.length;
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
            const shouldExpire = tempEffect.duration === 'UNTIL_END_OF_TURN' &&
                                 tempEffect.appliedTurn === currentTurn &&
                                 tempEffect.appliedBy === endingPlayerId;

            if (shouldExpire) {
                console.log(`⏰ Expiring temporary effect from ${tempEffect.sourceCarduid} on card ${card.carduid}`);
                this.revertTemporaryEffectFromUnit(card, tempEffect);
            }

            return !shouldExpire;
        });

        return initialCount - card.temporaryEffects.length;
    }

    private static revertTemporaryEffectFromUnit(card: UnitZoneCard | PilotZoneCard, tempEffect: TemporaryEffect): void {
        if (tempEffect.modifyAP !== undefined) {
            const currentAP = card.modifyAP || 0;
            card.modifyAP = currentAP - tempEffect.modifyAP;
            console.log(`🔄 Reverted AP modification on ${card.carduid}: ${currentAP} → ${card.modifyAP}`);
        }

        if (tempEffect.modifyHP !== undefined) {
            const currentHP = card.modifyHP || 0;
            card.modifyHP = currentHP - tempEffect.modifyHP;
            console.log(`🔄 Reverted HP modification on ${card.carduid}: ${currentHP} → ${card.modifyHP}`);
        }
    }
}
