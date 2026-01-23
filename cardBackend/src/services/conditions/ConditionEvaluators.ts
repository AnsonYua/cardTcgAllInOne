// src/services/conditions/ConditionEvaluators.ts

import { CardDatabaseManager } from '../../models/CardSystem';
import type { GameEnvironment } from '../../models/GameEnvironment';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { LinkUtils } from '../../utils/LinkUtils';
import { LinkConditionEvaluator } from './LinkConditionEvaluator';
import { PairedSlotConditionEvaluator } from './PairedSlotConditionEvaluator';

export class ConditionEvaluators {
    private static resolveScopedPlayerId(
        gameEnv: GameEnvironment,
        rootPlayerId: string,
        scopeRaw: unknown
    ): string | null {
        const scope = typeof scopeRaw === 'string' ? scopeRaw.toLowerCase() : 'self';
        if (scope === 'opponent') {
            return gameEnv.getOpponentId(rootPlayerId);
        }
        return rootPlayerId;
    }

    static evaluateHandContinuousCondition(
        gameEnv: GameEnvironment,
        rootPlayerId: string,
        condition: Record<string, unknown>
    ): boolean {
        const type = typeof condition.type === 'string' ? condition.type : '';
        const scopedPlayerId = this.resolveScopedPlayerId(gameEnv, rootPlayerId, condition.scope);
        if (!scopedPlayerId) {
            return false;
        }

        switch (type) {
            case 'unitsInPlayWithFilter':
                return ConditionEvaluators.evaluateUnitsInPlayWithFilterCondition(gameEnv, rootPlayerId, condition);

            case 'unitsInPlayWithTrait': {
                const traits = Array.isArray(condition.traits)
                    ? condition.traits.filter((t: unknown) => typeof t === 'string')
                    : [];
                return ConditionEvaluators.unitsInPlayWithTrait(gameEnv, scopedPlayerId, traits, condition.value);
            }

            case 'unitsInPlay': {
                return ConditionEvaluators.evaluateUnitsInPlayCondition(gameEnv, rootPlayerId, condition);
            }

            case 'cardsInTrash':
            case 'cardsInTrashWithTraitsAny': {
                const traitsAny = Array.isArray((condition as any).traitsAny)
                    ? ((condition as any).traitsAny as unknown[]).filter((t): t is string => typeof t === 'string')
                    : Array.isArray((condition as any).traits)
                        ? ((condition as any).traits as unknown[]).filter((t): t is string => typeof t === 'string')
                        : [];

                const filters: Record<string, unknown> = { traitsAny };
                if (typeof (condition as any).cardType === 'string') {
                    filters.cardType = (condition as any).cardType;
                }

                return ConditionEvaluators.cardsInTrashWithFilter(gameEnv, scopedPlayerId, filters, condition.value);
            }

            default:
                return false;
        }
    }

    static evaluateUnitsInPlayCondition(
        gameEnv: GameEnvironment,
        rootPlayerId: string,
        condition: Record<string, unknown>
    ): boolean {
        const scopedPlayerId = this.resolveScopedPlayerId(gameEnv, rootPlayerId, condition.scope);
        if (!scopedPlayerId) {
            return false;
        }

        const units = SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, scopedPlayerId);
        const count = Array.isArray(units) ? units.length : 0;
        if (typeof condition.value === 'number') {
            return count === condition.value;
        }
        if (typeof condition.value === 'string') {
            return validateComparisonFilter(count, condition.value);
        }
        return true;
    }

    static cardsInTrashWithTraitsAny(
        gameEnv: GameEnvironment,
        playerId: string,
        traitsAny: string[],
        value: unknown
    ): boolean {
        return ConditionEvaluators.cardsInTrashWithFilter(gameEnv, playerId, { traitsAny }, value);
    }

    static cardsInTrashWithFilter(
        gameEnv: GameEnvironment,
        playerId: string,
        filters: Record<string, unknown>,
        value: unknown
    ): boolean {
        const player = gameEnv.getPlayer(playerId) || gameEnv.players[playerId];
        const trash = player?.zones?.trashArea;
        if (!Array.isArray(trash)) {
            return false;
        }

        const cardTypeFilter = typeof filters['cardType'] === 'string' ? (filters['cardType'] as string) : undefined;
        const traitsAny = Array.isArray(filters['traitsAny'])
            ? (filters['traitsAny'] as unknown[]).filter((t): t is string => typeof t === 'string')
            : [];

        const matchingCount = trash.reduce((total: number, card: any) => {
            const cardData = card?.cardData
                || (typeof card?.cardId === 'string' ? CardDatabaseManager.getCardDetails(card.cardId) : null);
            if (!cardData) {
                return total;
            }

            if (cardTypeFilter) {
                const type = typeof cardData.cardType === 'string' ? cardData.cardType : '';
                if (type !== cardTypeFilter) {
                    return total;
                }
            }

            if (traitsAny.length > 0) {
                const traits = Array.isArray(cardData.traits) ? cardData.traits : [];
                const matches = traitsAny.some((trait: string) => traits.includes(trait));
                if (!matches) {
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

    static playerLevel(
        gameEnv: GameEnvironment,
        rootPlayerId: string,
        scopeRaw: unknown,
        value: unknown
    ): boolean {
        const scopedPlayerId = this.resolveScopedPlayerId(gameEnv, rootPlayerId, scopeRaw);
        if (!scopedPlayerId) {
            return false;
        }

        const player = gameEnv.getPlayer(scopedPlayerId) || gameEnv.players[scopedPlayerId];
        const level = typeof (player as any)?.playerPoint === 'number' ? (player as any).playerPoint : 0;

        if (typeof value === 'number') {
            return level === value;
        }
        if (typeof value === 'string') {
            return validateComparisonFilter(level, value);
        }
        return true;
    }

    static opponentHandSize(
        gameEnv: GameEnvironment,
        rootPlayerId: string,
        scopeRaw: unknown,
        value: unknown
    ): boolean {
        const scope = typeof scopeRaw === 'string' ? scopeRaw.toLowerCase() : 'opponent';
        const targetPlayerId = scope === 'self'
            ? rootPlayerId
            : gameEnv.getOpponentId(rootPlayerId);
        if (!targetPlayerId) {
            return false;
        }

        const player = gameEnv.getPlayer(targetPlayerId) || gameEnv.players[targetPlayerId];
        const handSize = typeof player?.deck?.getHandSize === 'function'
            ? player.deck.getHandSize()
            : Array.isArray((player as any)?.deck?.handUids)
                ? (player as any).deck.handUids.length
                : 0;

        if (typeof value === 'number') {
            return handSize === value;
        }
        if (typeof value === 'string') {
            return validateComparisonFilter(handSize, value);
        }
        return true;
    }

    static pairedPilotColor(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        value: unknown
    ): boolean {
        const expected = typeof value === 'string' ? value : '';
        if (!expected || !sourceCarduid) {
            return false;
        }

        return PairedSlotConditionEvaluator.pairedPilotColor(gameEnv, sourceCarduid, expected);
    }

    static pairedUnitColor(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        value: unknown
    ): boolean {
        const expected = typeof value === 'string' ? value : '';
        if (!expected || !sourceCarduid) {
            return false;
        }

        return PairedSlotConditionEvaluator.pairedUnitColor(gameEnv, sourceCarduid, expected);
    }

    static pairedUnitTrait(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        value: unknown
    ): boolean {
        const expected = typeof value === 'string' ? value : '';
        if (!expected || !sourceCarduid) {
            return false;
        }

        return PairedSlotConditionEvaluator.pairedUnitTrait(gameEnv, sourceCarduid, expected);
    }

    static hasAnotherLinkedUnit(
        gameEnv: GameEnvironment,
        playerId: string,
        excludeCarduid?: string
    ): boolean {
        return LinkConditionEvaluator.hasAnotherLinkedUnit(gameEnv, playerId, excludeCarduid);
    }

    static hasAnotherLinkedUnitWithTrait(
        gameEnv: GameEnvironment,
        playerId: string,
        traitsAny: string[],
        excludeCarduid?: string
    ): boolean {
        return LinkConditionEvaluator.hasAnotherLinkedUnitWithTrait(gameEnv, playerId, traitsAny, excludeCarduid);
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
        const scopedPlayerId = this.resolveScopedPlayerId(gameEnv, rootPlayerId, condition.scope);

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

    static unitsInPlayWithStatus(
        gameEnv: GameEnvironment,
        playerId: string,
        status: unknown,
        value: unknown,
        excludeCarduid?: string
    ): boolean {
        const desired = typeof status === 'string' ? status.toLowerCase() : '';
        if (!desired) {
            return true;
        }

        const units = SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, playerId);
        const matchingCount = units.reduce((total: number, unitResult: any) => {
            const unit = unitResult?.unit;
            if (!unit) {
                return total;
            }

            if (excludeCarduid && unit.carduid === excludeCarduid) {
                return total;
            }

            const cardStatus = unit.isRested ? 'rested' : 'active';
            if (cardStatus !== desired) {
                return total;
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

    static evaluateUnitsInPlayWithStatusCondition(
        gameEnv: GameEnvironment,
        rootPlayerId: string,
        condition: Record<string, unknown>,
        excludeCarduid?: string
    ): boolean {
        const scopedPlayerId = this.resolveScopedPlayerId(gameEnv, rootPlayerId, condition.scope);
        if (!scopedPlayerId) {
            return false;
        }

        return ConditionEvaluators.unitsInPlayWithStatus(
            gameEnv,
            scopedPlayerId,
            condition.status,
            condition.value,
            excludeCarduid
        );
    }
}
