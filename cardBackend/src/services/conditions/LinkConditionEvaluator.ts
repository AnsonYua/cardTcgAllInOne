// src/services/conditions/LinkConditionEvaluator.ts
// Centralized helpers for link-related condition checks across triggers (PAIRING_COMPLETE, DESTROYED, etc.).

import type { GameEnvironment } from '../../models/GameEnvironment';
import { SLOT_ZONES } from '../../config/gameConstants';
import { LinkUtils } from '../../utils/LinkUtils';

export class LinkConditionEvaluator {
    static hasAnotherLinkedUnit(
        gameEnv: GameEnvironment,
        playerId: string,
        excludeCarduid?: string
    ): boolean {
        const player = gameEnv.getPlayer(playerId) || gameEnv.players[playerId];
        if (!player?.zones) {
            return false;
        }

        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            if (!slot?.unit || !slot?.pilot) {
                continue;
            }

            if (!LinkUtils.isLinkedPair(slot.unit, slot.pilot)) {
                continue;
            }

            if (excludeCarduid) {
                if (slot.unit?.carduid === excludeCarduid || slot.pilot?.carduid === excludeCarduid) {
                    continue;
                }
            }

            return true;
        }

        return false;
    }

    static hasAnotherLinkedUnitWithTrait(
        gameEnv: GameEnvironment,
        playerId: string,
        traitsAny: string[],
        excludeCarduid?: string
    ): boolean {
        const normalizedTraits = Array.isArray(traitsAny)
            ? traitsAny.filter(trait => typeof trait === 'string' && trait.length > 0)
            : [];

        const player = gameEnv.getPlayer(playerId) || gameEnv.players[playerId];
        if (!player?.zones) {
            return false;
        }

        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            if (!slot?.unit || !slot?.pilot) {
                continue;
            }

            if (!LinkUtils.isLinkedPair(slot.unit, slot.pilot)) {
                continue;
            }

            if (excludeCarduid) {
                if (slot.unit?.carduid === excludeCarduid || slot.pilot?.carduid === excludeCarduid) {
                    continue;
                }
            }

            const unitTraits = Array.isArray(slot.unit?.cardData?.traits) ? slot.unit.cardData.traits : [];
            if (normalizedTraits.length === 0) {
                return true;
            }

            if (normalizedTraits.some(trait => unitTraits.includes(trait))) {
                return true;
            }
        }

        return false;
    }
}
