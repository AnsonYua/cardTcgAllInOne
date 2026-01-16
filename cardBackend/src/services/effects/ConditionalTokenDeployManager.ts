// src/services/effects/ConditionalTokenDeployManager.ts
// Handles conditional token deployment based on board state

import { GameEnvironment } from '../../models/GameEnvironment';
import { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { CardDatabaseManager, createZoneCard, UnitZoneCard } from '../../models/CardSystem';
import { PlayerCardManager } from '../PlayerCardManager';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { ExecutionResult } from '../ExecutionResult';

export interface ConditionalTokenPlan {
    tokenData: any;
    targetSlot: string;
}

export class ConditionalTokenDeployManager {
    static buildPlan(
        gameEnv: GameEnvironment,
        playerId: string,
        effect: EffectDefinition
    ): { success: true; plan: ConditionalTokenPlan } | { success: false; error: string } {
        const parameters = effect.parameters || {};
        const player = gameEnv.players[playerId];
        if (!player?.zones) {
            return { success: false, error: 'Player zones unavailable for token deploy' };
        }

        const targetSlot = PlayerCardManager.findFirstEmptySlot(player.zones);
        if (!targetSlot) {
            return { success: false, error: 'No empty unit slot available for token deploy' };
        }

        const unitsInPlay = SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, playerId).length;
        const conditionEntries = Object.entries(parameters)
            .filter(([key]) => key.startsWith('condition'))
            .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

        let selectedToken: any | null = null;
        for (const [, conditionValue] of conditionEntries) {
            if (!conditionValue || typeof conditionValue !== 'object') {
                continue;
            }
            const condition = conditionValue as Record<string, unknown>;
            const unitsRequirement = condition['unitsInPlay'];
            const token = condition['token'];
            if (!token || typeof token !== 'object') {
                continue;
            }

            if (typeof unitsRequirement === 'number' && unitsInPlay === unitsRequirement) {
                selectedToken = token;
                break;
            }

            if (typeof unitsRequirement === 'string' && validateComparisonFilter(unitsInPlay, unitsRequirement)) {
                selectedToken = token;
                break;
            }
        }

        if (!selectedToken) {
            return { success: false, error: 'No matching token condition found for board state' };
        }

        const tokenDataResult = this.resolveTokenData(selectedToken as Record<string, unknown>);
        if (!tokenDataResult.success) {
            return { success: false, error: tokenDataResult.error };
        }

        return { success: true, plan: { tokenData: tokenDataResult.tokenData, targetSlot } };
    }

    static executePlan(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        plan: ConditionalTokenPlan
    ): ExecutionResult {
        const carduid = PlayerCardManager.createUniqueCardId(plan.tokenData.id);
        const unitCard = createZoneCard(carduid, plan.tokenData.id, plan.tokenData, playerId, 'unit') as UnitZoneCard;

        const player = gameEnv.players[playerId];
        if (!player?.zones) {
            return { success: false, error: 'Player zones unavailable for token deploy' };
        }

        const slotResult = SlotZoneUtils.getSlotZone(player.zones, plan.targetSlot);
        if (!slotResult.isValid || !slotResult.slot) {
            return { success: false, error: `Invalid slot ${plan.targetSlot} for token deploy` };
        }

        slotResult.slot.unit = unitCard;
        console.log(`🪖 Deployed token ${plan.tokenData.name || plan.tokenData.id} to ${plan.targetSlot} (source ${sourceCarduid})`);
        return { success: true };
    }

    private static resolveTokenData(
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
