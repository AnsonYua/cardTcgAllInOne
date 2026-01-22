// src/services/conditions/ConditionEvaluators.ts

import { CardDatabaseManager } from '../../models/CardSystem';
import type { GameEnvironment } from '../../models/GameEnvironment';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { LinkUtils } from '../../utils/LinkUtils';

export class ConditionEvaluators {
    static cardsInTrashWithTraitsAny(
        gameEnv: GameEnvironment,
        playerId: string,
        traitsAny: string[],
        value: unknown
    ): boolean {
        const player = gameEnv.getPlayer(playerId) || gameEnv.players[playerId];
        const trash = player?.zones?.trashArea;
        if (!Array.isArray(trash)) {
            return false;
        }

        const matchingCount = trash.reduce((total: number, card: any) => {
            const cardData = card?.cardData
                || (typeof card?.cardId === 'string' ? CardDatabaseManager.getCardDetails(card.cardId) : null);
            const traits = Array.isArray(cardData?.traits) ? cardData.traits : [];
            if (traitsAny.length === 0) {
                return total + 1;
            }
            const matches = traitsAny.some((trait: string) => traits.includes(trait));
            return matches ? total + 1 : total;
        }, 0);

        if (typeof value === 'number') {
            return matchingCount === value;
        }
        if (typeof value === 'string') {
            return validateComparisonFilter(matchingCount, value);
        }
        return true;
    }

    static unitsInPlayWithTrait(
        gameEnv: GameEnvironment,
        playerId: string,
        traits: string[],
        value: unknown
    ): boolean {
        if (traits.length === 0) {
            return true;
        }

        const units = SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, playerId);
        const matchingCount = units.reduce((total: number, unitResult: any) => {
            const cardTraits = Array.isArray(unitResult?.unit?.cardData?.traits) ? unitResult.unit.cardData.traits : [];
            const matches = traits.some((trait: string) => cardTraits.includes(trait));
            return matches ? total + 1 : total;
        }, 0);

        if (typeof value === 'number') {
            return matchingCount === value;
        }
        if (typeof value === 'string') {
            return validateComparisonFilter(matchingCount, value);
        }
        return true;
    }

    static unitsInPlayWithFilter(
        gameEnv: GameEnvironment,
        playerId: string,
        filters: Record<string, unknown>,
        value: unknown
    ): boolean {
        const units = SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, playerId);
        const matchingCount = units.reduce((total: number, unitResult: any) => {
            const unit = unitResult?.unit;
            if (!unit) {
                return total;
            }

            const cardData = unit.cardData;
            if (!cardData) {
                return total;
            }

            const cardTypeFilter = filters['cardType'];
            if (typeof cardTypeFilter === 'string') {
                const cardType = typeof cardData.cardType === 'string' ? cardData.cardType : '';
                if (cardType !== cardTypeFilter) {
                    return total;
                }
            }

            const levelFilter = filters['level'];
            if (typeof levelFilter === 'string') {
                const cardLevel = typeof cardData.level === 'number' ? cardData.level : 0;
                if (!validateComparisonFilter(cardLevel, levelFilter)) {
                    return total;
                }
            }

            const statusFilter = filters['status'];
            if (typeof statusFilter === 'string') {
                const cardStatus = unit.isRested ? 'rested' : 'active';
                if (cardStatus !== statusFilter) {
                    return total;
                }
            }

            const traitsFilter = filters['traits'];
            if (Array.isArray(traitsFilter) && traitsFilter.length > 0) {
                const cardTraits = Array.isArray(cardData.traits) ? cardData.traits : [];
                const hasTrait = traitsFilter.some((trait: unknown) =>
                    typeof trait === 'string' && cardTraits.includes(trait)
                );
                if (!hasTrait) {
                    return total;
                }
            }

            const colorNotFilter = filters['colorNot'];
            if (typeof colorNotFilter === 'string') {
                const color = typeof cardData.color === 'string' ? cardData.color : '';
                if (color === colorNotFilter) {
                    return total;
                }
            }

            const isLinkUnitFilter = filters['isLinkUnit'];
            if (typeof isLinkUnitFilter === 'boolean') {
                const pilot = unitResult?.pilot;
                const linked = LinkUtils.isLinkedPair(unit, pilot);
                if (isLinkUnitFilter !== linked) {
                    return total;
                }
            }

            return total + 1;
        }, 0);

        if (typeof value === 'number') {
            return matchingCount === value;
        }
        if (typeof value === 'string') {
            return validateComparisonFilter(matchingCount, value);
        }
        return true;
    }

    static evaluateUnitsInPlayWithFilterCondition(
        gameEnv: GameEnvironment,
        rootPlayerId: string,
        condition: Record<string, unknown>
    ): boolean {
        const scope = typeof condition.scope === 'string' ? condition.scope.toLowerCase() : 'self';
        let scopedPlayerId: string | null = rootPlayerId;

        if (scope === 'opponent') {
            scopedPlayerId = gameEnv.getOpponentId(rootPlayerId);
        }

        if (!scopedPlayerId) {
            return false;
        }

        const filters = condition.filters && typeof condition.filters === 'object'
            ? (condition.filters as Record<string, unknown>)
            : {};

        return ConditionEvaluators.unitsInPlayWithFilter(
            gameEnv,
            scopedPlayerId,
            filters,
            condition.value
        );
    }
}
