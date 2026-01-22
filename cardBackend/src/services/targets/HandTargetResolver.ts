// src/services/targets/HandTargetResolver.ts

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetFilters, TargetReference } from '../EventQueue/interfaces/GameEvent';
import type { ResolvedTargetConfig } from './TargetResolver';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';

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
        if (filters.level) {
            const cardLevel = cardData?.level || 0;
            if (!validateComparisonFilter(cardLevel, filters.level)) {
                return false;
            }
        }

        if (filters.traits && filters.traits.length > 0) {
            const cardTraits = cardData?.traits || [];
            const hasRequiredTrait = filters.traits.some((requiredTrait: string) =>
                cardTraits.some((cardTrait: string) => cardTrait === requiredTrait)
            );
            if (!hasRequiredTrait) {
                return false;
            }
        }

        return true;
    }
}

