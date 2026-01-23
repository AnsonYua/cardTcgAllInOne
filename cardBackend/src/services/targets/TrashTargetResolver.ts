// src/services/targets/TrashTargetResolver.ts

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetFilters, TargetReference } from '../EventQueue/interfaces/GameEvent';
import type { ResolvedTargetConfig } from './TargetResolver';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { TargetFilterUtils } from './TargetFilterUtils';

export class TrashTargetResolver {
    static generateTrashTargets(
        gameEnv: GameEnvironment,
        targetPlayerIds: string[],
        targetConfig: ResolvedTargetConfig
    ): TargetReference[] {
        const targets: TargetReference[] = [];

        for (const targetPlayerId of targetPlayerIds) {
            const player = gameEnv.getPlayer(targetPlayerId);
            if (!player?.zones || !Array.isArray(player.zones.trashArea)) {
                continue;
            }

            for (const trashCard of player.zones.trashArea) {
                if (!trashCard?.carduid) {
                    continue;
                }

                const cardData = (trashCard as any).cardData;
                if (!cardData) {
                    continue;
                }

                if (!this.validateTrashCardFilters(cardData, targetConfig.filters || {})) {
                    continue;
                }

                targets.push({
                    carduid: trashCard.carduid,
                    zone: 'trash',
                    playerId: targetPlayerId,
                    cardData
                });
            }
        }

        return targets;
    }

    private static validateTrashCardFilters(cardData: any, filters: TargetFilters = {}): boolean {
        const filterCardType = typeof (filters as any).cardType === 'string' ? (filters as any).cardType : undefined;
        if (filterCardType && cardData?.cardType !== filterCardType) {
            return false;
        }

        const colorResult = TargetFilterUtils.validateColorFilter(cardData?.color, filters);
        if (!colorResult.ok) {
            return false;
        }

        if (filters.level) {
            const level = typeof cardData?.level === 'number' ? cardData.level : 0;
            if (!validateComparisonFilter(level, filters.level)) {
                return false;
            }
        }

        const traitsAny = Array.isArray((filters as any).traitsAny)
            ? ((filters as any).traitsAny as unknown[]).filter((t: unknown) => typeof t === 'string')
            : [];
        if (traitsAny.length > 0) {
            const traits = Array.isArray(cardData?.traits) ? cardData.traits : [];
            const matches = traitsAny.some((trait: string) => traits.includes(trait));
            if (!matches) {
                return false;
            }
        }

        if (filters.traits && filters.traits.length > 0) {
            const traits = Array.isArray(cardData?.traits) ? cardData.traits : [];
            const hasRequired = filters.traits.some((requiredTrait: string) => traits.includes(requiredTrait));
            if (!hasRequired) {
                return false;
            }
        }

        return true;
    }
}
