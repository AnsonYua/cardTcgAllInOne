// src/services/effects/ConditionalTokenDeployManager.ts
// Handles conditional token deployment based on board state

import { GameEnvironment } from '../../models/GameEnvironment';
import { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { CardDatabaseManager } from '../../models/CardSystem';
import { PlayerCardManager } from '../PlayerCardManager';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { ExecutionResult } from '../ExecutionResult';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { UnitDeployService } from '../deploy/UnitDeployService';

export interface ConditionalTokenPlan {
    tokenData: any;
    targetSlots: string[];
    rested?: boolean;
}

export class ConditionalTokenDeployManager {
    static resolveMatchingConditionConfig(
        gameEnv: GameEnvironment,
        playerId: string,
        effect: EffectDefinition,
        sourceCarduid?: string
    ): { success: true; config: { tokenData: any; count: number; rested: boolean } } | { success: false; error: string } {
        if (!this.conditionsSatisfied(effect, gameEnv, playerId, sourceCarduid)) {
            return { success: false, error: 'Conditions not met for token deploy' };
        }

        const parameters = effect.parameters || {};
        const unitsInPlay = SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, playerId).length;
        const conditionEntries = Object.entries(parameters)
            .filter(([key]) => key.startsWith('condition'))
            .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

        let selectedCondition: Record<string, unknown> | null = null;
        let fallbackCondition: Record<string, unknown> | null = null;
        for (const [, conditionValue] of conditionEntries) {
            if (!conditionValue || typeof conditionValue !== 'object') {
                continue;
            }
            const condition = conditionValue as Record<string, unknown>;
            const token = condition['token'];
            if (!token || typeof token !== 'object') {
                continue;
            }

            if (!this.conditionMatches(gameEnv, playerId, condition, unitsInPlay)) {
                continue;
            }

            if (typeof condition['cardInTrash'] === 'string') {
                selectedCondition = condition;
                break;
            }

            if (!fallbackCondition) {
                fallbackCondition = condition;
            }
        }

        if (!selectedCondition && fallbackCondition) {
            selectedCondition = fallbackCondition;
        }

        if (!selectedCondition) {
            return { success: false, error: 'No matching token condition found for board state' };
        }

        const tokenDataResult = this.resolveTokenData(selectedCondition['token'] as Record<string, unknown>);
        if (!tokenDataResult.success) {
            return { success: false, error: tokenDataResult.error };
        }

        const count = typeof selectedCondition['count'] === 'number' ? (selectedCondition['count'] as number) : 1;
        const rested = selectedCondition['rested'] === true;
        return {
            success: true,
            config: {
                tokenData: tokenDataResult.tokenData,
                count,
                rested
            }
        };
    }

    static conditionsSatisfied(
        effect: EffectDefinition,
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid?: string
    ): boolean {
        const sourceCard = sourceCarduid ? SlotZoneUtils.getCardByUid(gameEnv, sourceCarduid) : undefined;
        return ContinuousEffectManager.validateEffectConditions(effect, gameEnv, playerId, sourceCard || undefined);
    }

    static buildPlanForTokenChoice(
        gameEnv: GameEnvironment,
        playerId: string,
        token: Record<string, unknown>,
        count: number
    ): { success: true; plan: ConditionalTokenPlan } | { success: false; error: string } {
        const player = gameEnv.players[playerId];
        if (!player?.zones) {
            return { success: false, error: 'Player zones unavailable for token deploy' };
        }

        const tokenDataResult = this.resolveTokenData(token);
        if (!tokenDataResult.success) {
            return { success: false, error: tokenDataResult.error };
        }

        const targetSlots = this.findEmptySlots(player.zones, count);
        if (targetSlots.length < count) {
            return { success: false, error: 'Not enough empty unit slots available for token deploy' };
        }

        return { success: true, plan: { tokenData: tokenDataResult.tokenData, targetSlots } };
    }

    static getEmptyUnitSlots(gameEnv: GameEnvironment, playerId: string): string[] {
        const player = gameEnv.players[playerId];
        if (!player?.zones) {
            return [];
        }
        return SlotZoneUtils.getEmptySlotNames(player.zones);
    }

    static buildPlan(
        gameEnv: GameEnvironment,
        playerId: string,
        effect: EffectDefinition,
        sourceCarduid?: string
    ): { success: true; plan: ConditionalTokenPlan } | { success: false; error: string } {
        const player = gameEnv.players[playerId];
        if (!player?.zones) {
            return { success: false, error: 'Player zones unavailable for token deploy' };
        }
        const configResult = this.resolveMatchingConditionConfig(gameEnv, playerId, effect, sourceCarduid);
        if (!configResult.success) {
            return { success: false, error: configResult.error };
        }

        const count = configResult.config.count;
        const rested = configResult.config.rested;
        const targetSlots = this.findEmptySlots(player.zones, count);
        if (targetSlots.length < count) {
            return { success: false, error: 'Not enough empty unit slots available for token deploy' };
        }

        return {
            success: true,
            plan: {
                tokenData: configResult.config.tokenData,
                targetSlots,
                ...(rested ? { rested: true } : {})
            }
        };
    }

    static executePlan(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        plan: ConditionalTokenPlan
    ): ExecutionResult {
        const player = gameEnv.players[playerId];
        if (!player?.zones) {
            return { success: false, error: 'Player zones unavailable for token deploy' };
        }

        for (const targetSlot of plan.targetSlots) {
            const carduid = PlayerCardManager.createUniqueCardId(plan.tokenData.id);
            console.log(`🪖 Deployed token ${plan.tokenData.name || plan.tokenData.id} to ${targetSlot} (source ${sourceCarduid})`);

            const deployResult = UnitDeployService.deployUnitCardToSlot(gameEnv, {
                playerId,
                destinationSlot: targetSlot,
                carduid,
                cardId: plan.tokenData.id,
                cardData: plan.tokenData,
                sourceCarduid,
                fromZone: 'token',
                notificationType: 'TOKEN_DEPLOYED',
                ...(plan.rested ? { isRested: true } : {})
            });
            if (!deployResult.success) {
                return { success: false, error: deployResult.error || 'Failed to deploy token' };
            }
        }

        return { success: true };
    }

    private static conditionMatches(
        gameEnv: GameEnvironment,
        playerId: string,
        condition: Record<string, unknown>,
        unitsInPlay: number
    ): boolean {
        const unitsRequirement = condition['unitsInPlay'];
        if (typeof unitsRequirement === 'number' && unitsInPlay !== unitsRequirement) {
            return false;
        }

        if (typeof unitsRequirement === 'string' && !validateComparisonFilter(unitsInPlay, unitsRequirement)) {
            return false;
        }

        if (condition['selfTurn'] === true && gameEnv.currentPlayer !== playerId) {
            return false;
        }

        const hasAnotherUnitWithTrait = condition['hasAnotherUnitWithTrait'];
        if (typeof hasAnotherUnitWithTrait === 'string' && hasAnotherUnitWithTrait.length > 0) {
            const hasMatch = SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, playerId)
                .some((entry: any) => {
                    const unit = entry?.unit;
                    if (!unit) {
                        return false;
                    }
                    const traits = Array.isArray(unit.cardData?.traits) ? unit.cardData.traits : [];
                    return traits.includes(hasAnotherUnitWithTrait);
                });
            if (!hasMatch) {
                return false;
            }
        }

        if (typeof condition['cardInTrash'] === 'string') {
            const player = gameEnv.players[playerId];
            const targetCardId = condition['cardInTrash'] as string;
            const inTrash = player?.zones?.trashArea?.some(card => card.cardId === targetCardId);
            if (!inTrash) {
                return false;
            }
        }

        const enemyId = gameEnv.getOpponentId(playerId);
        const enemy = enemyId ? gameEnv.players[enemyId] : null;

        const enemyShields = condition['enemyShields'];
        if (typeof enemyShields === 'number' || typeof enemyShields === 'string') {
            const shieldCount = enemy && typeof enemy.getShieldCount === 'function'
                ? enemy.getShieldCount()
                : 0;
            if (typeof enemyShields === 'number') {
                if (shieldCount !== enemyShields) {
                    return false;
                }
            } else if (!validateComparisonFilter(shieldCount, enemyShields)) {
                return false;
            }
        }

        const enemyUnitsInPlay = condition['enemyUnitsInPlay'];
        if (typeof enemyUnitsInPlay === 'number' || typeof enemyUnitsInPlay === 'string') {
            const enemyUnitCount = enemyId ? SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, enemyId).length : 0;
            if (typeof enemyUnitsInPlay === 'number') {
                if (enemyUnitCount !== enemyUnitsInPlay) {
                    return false;
                }
            } else if (!validateComparisonFilter(enemyUnitCount, enemyUnitsInPlay)) {
                return false;
            }
        }

        const enemyUnitsInPlayMax = condition['enemyUnitsInPlayMax'];
        if (typeof enemyUnitsInPlayMax === 'number') {
            const enemyUnitCount = enemyId ? SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, enemyId).length : 0;
            if (enemyUnitCount > enemyUnitsInPlayMax) {
                return false;
            }
        }

        return true;
    }

    private static findEmptySlots(playerZones: any, count: number): string[] {
        const slots = SlotZoneUtils.getEmptySlotNames(playerZones);
        return slots.slice(0, Math.max(0, count));
    }

    static resolveTokenData(
        token: Record<string, unknown>
    ): { success: true; tokenData: any } | { success: false; error: string } {
        const tokenCardId = typeof token['cardId'] === 'string'
            ? (token['cardId'] as string)
            : typeof token['id'] === 'string'
                ? (token['id'] as string)
                : undefined;

        let baseTokenData = tokenCardId ? CardDatabaseManager.getCardDetails(tokenCardId) : null;

        if (!baseTokenData) {
            const tokenName = typeof token['name'] === 'string' ? (token['name'] as string) : undefined;
            const normalizedName = tokenName
                ? tokenName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
                : '';
            const tokenAp = typeof token['ap'] === 'number' ? (token['ap'] as number) : undefined;
            const tokenHp = typeof token['hp'] === 'number' ? (token['hp'] as number) : undefined;

            const tokenCards = Object.values(CardDatabaseManager.getAllCards()).filter((card: any) =>
                card?.cardType === 'unit' && card?.color === 'Token'
            );

            if (normalizedName) {
                baseTokenData = tokenCards.find((card: any) => {
                    const candidate = (card?.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    return candidate === normalizedName;
                });
            }

            if (!baseTokenData && (tokenAp !== undefined || tokenHp !== undefined)) {
                baseTokenData = tokenCards.find((card: any) => {
                    if (tokenAp !== undefined && card?.ap !== tokenAp) {
                        return false;
                    }
                    if (tokenHp !== undefined && card?.hp !== tokenHp) {
                        return false;
                    }
                    return true;
                });
            }
        }

        if (!baseTokenData) {
            return { success: false, error: 'Token card data not found for conditional deploy' };
        }

        const overrideTraits = Array.isArray(token['traits']) ? (token['traits'] as string[]) : undefined;
        const overrideAp = typeof token['ap'] === 'number' ? (token['ap'] as number) : undefined;
        const overrideHp = typeof token['hp'] === 'number' ? (token['hp'] as number) : undefined;
        const overrideName = typeof token['name'] === 'string' ? (token['name'] as string) : undefined;

        return {
            success: true,
            tokenData: {
                ...baseTokenData,
                name: overrideName || baseTokenData.name,
                traits: overrideTraits || baseTokenData.traits,
                ap: overrideAp ?? baseTokenData.ap,
                hp: overrideHp ?? baseTokenData.hp
            }
        };
    }

}
