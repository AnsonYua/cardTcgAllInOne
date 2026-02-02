// src/services/targets/HandTargetResolver.ts

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetFilters, TargetReference } from '../EventQueue/interfaces/GameEvent';
import type { ResolvedTargetConfig } from './TargetResolver';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { TargetFilterUtils } from './TargetFilterUtils';

export class HandTargetResolver {
    static generateHandTargets(
        gameEnv: GameEnvironment,
        targetPlayerIds: string[],
        targetConfig: ResolvedTargetConfig
    ): TargetReference[] {
        const targets: TargetReference[] = [];

        for (const targetPlayerId of targetPlayerIds) {
            const player = gameEnv.getPlayer(targetPlayerId);
            if (!player?.deck) {
                continue;
            }

            const handCards = player.deck.hand || [];
            for (const handCard of handCards) {
                if (!handCard?.carduid) {
                    continue;
                }

                const cardData = handCard.cardData;
                if (!cardData) {
                    continue;
                }

                if (targetConfig.type === 'unit' && cardData.cardType !== 'unit') {
                    continue;
                }

                if (!this.validateHandCardFilters(cardData, targetConfig.filters || {})) {
                    continue;
                }

                targets.push({
                    carduid: handCard.carduid,
                    zone: 'hand',
                    playerId: targetPlayerId,
                    cardData
                });
            }
        }

        return targets;
    }

    private static validateHandCardFilters(
        cardData: any,
        filters: TargetFilters = {}
    ): boolean {
        const desiredCardType = typeof (filters as any).cardType === 'string'
            ? ((filters as any).cardType as string)
            : undefined;
        if (desiredCardType && cardData?.cardType !== desiredCardType) {
            return false;
        }

        if (filters.level) {
            const cardLevel = cardData?.level || 0;
            if (!validateComparisonFilter(cardLevel, filters.level)) {
                return false;
            }
        }

        const cardColor = typeof cardData?.color === 'string' ? (cardData.color as string) : undefined;
        const colorResult = TargetFilterUtils.validateColorFilter(cardColor, filters);
        if (!colorResult.ok) {
            return false;
        }

        const hasTraitFilters =
            (Array.isArray(filters.traits) && filters.traits.length > 0) ||
            (Array.isArray(filters.traitsAny) && filters.traitsAny.length > 0) ||
            (Array.isArray(filters.traitsAll) && filters.traitsAll.length > 0);
        if (hasTraitFilters) {
            const cardTraits = Array.isArray(cardData?.traits) ? (cardData.traits as string[]) : [];
            const traitResult = TargetFilterUtils.validateTraitFilters(cardTraits, filters);
            if (!traitResult.ok) {
                return false;
            }
        }

        return true;
    }
}
