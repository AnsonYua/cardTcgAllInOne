// src/services/conditions/CardsInPlayCondition.ts

import type { GameEnvironment } from '../../models/GameEnvironment';
import { CardDatabaseManager } from '../../models/CardSystem';
import { SLOT_ZONES } from '../../config/gameConstants';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';

export function evaluateCardsInPlayCondition(
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

    const player = gameEnv.getPlayer(scopedPlayerId) || gameEnv.players[scopedPlayerId];
    if (!player?.zones) {
        return false;
    }

    const cardType = typeof (condition as any).cardType === 'string'
        ? String((condition as any).cardType).toLowerCase()
        : undefined;

    const traitsAny = Array.isArray((condition as any).traitsAny)
        ? (condition as any).traitsAny.filter((t: unknown) => typeof t === 'string')
        : [];

    const matchesTraits = (cardData: any): boolean => {
        if (traitsAny.length === 0) {
            return true;
        }
        const traits = Array.isArray(cardData?.traits) ? cardData.traits : [];
        return traitsAny.some((trait: string) => traits.includes(trait));
    };

    let matchingCount = 0;

    if (!cardType || cardType === 'unit' || cardType === 'pilot') {
        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            if (!slot) {
                continue;
            }

            if ((!cardType || cardType === 'unit') && slot.unit?.cardData && matchesTraits(slot.unit.cardData)) {
                matchingCount += 1;
            }

            if (!cardType || cardType === 'pilot') {
                const pilot = slot.pilot;
                if (!pilot) {
                    continue;
                }

                const pilotCardData = pilot.cardData
                    || (typeof pilot.cardId === 'string' ? CardDatabaseManager.getCardDetails(pilot.cardId) : null);

                const isPilotInPlay = pilot.playedAs === 'pilot' || pilotCardData?.cardType === 'pilot';
                if (isPilotInPlay && pilotCardData && matchesTraits(pilotCardData)) {
                    matchingCount += 1;
                }
            }
        }
    }

    if (!cardType || cardType === 'base') {
        const bases = Array.isArray(player.zones.base) ? player.zones.base : [];
        for (const base of bases) {
            const baseCardData = base?.cardData
                || (typeof base?.cardId === 'string' ? CardDatabaseManager.getCardDetails(base.cardId) : null);
            if (!baseCardData) {
                continue;
            }

            if (cardType && cardType !== 'base') {
                continue;
            }

            if (matchesTraits(baseCardData)) {
                matchingCount += 1;
            }
        }
    }

    const value = condition.value;
    if (typeof value === 'number') {
        return matchingCount === value;
    }
    if (typeof value === 'string') {
        return validateComparisonFilter(matchingCount, value);
    }
    return true;
}

