// src/services/conditions/PairingConditionEvaluator.ts
// Centralizes evaluation of pairing-only condition types (PAIRING_COMPLETE trigger).

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { PilotZoneCard, UnitZoneCard } from '../../models/CardSystem';
import { SLOT_ZONES } from '../../config/gameConstants';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { ConditionEvaluators } from './ConditionEvaluators';
import { LinkUtils } from '../../utils/LinkUtils';

export class PairingConditionEvaluator {
    static evaluate(
        gameEnv: GameEnvironment,
        playerId: string,
        condition: Record<string, unknown>,
        unit: UnitZoneCard,
        pilot: PilotZoneCard
    ): boolean | null {
        const type = typeof condition.type === 'string' ? condition.type : '';

        switch (type) {
            case 'pairedPilotLevel': {
                const pilotLevel = typeof pilot?.cardData?.level === 'number' ? pilot.cardData.level : 0;
                const rawValue = condition.value;
                if (typeof rawValue === 'number') {
                    return pilotLevel === rawValue;
                }
                if (typeof rawValue === 'string') {
                    return validateComparisonFilter(pilotLevel, rawValue);
                }
                return false;
            }

            case 'pairedPilotTrait': {
                const required = typeof condition.value === 'string' ? condition.value : null;
                if (!required) {
                    return false;
                }
                const pilotTraits = Array.isArray(pilot.cardData?.traits) ? pilot.cardData.traits : [];
                return pilotTraits.includes(required);
            }

            case 'pairedPilotTraitAny': {
                const values = Array.isArray(condition.value)
                    ? condition.value.filter((v: unknown) => typeof v === 'string')
                    : Array.isArray((condition as any).traitsAny)
                        ? (condition as any).traitsAny.filter((v: unknown) => typeof v === 'string')
                        : [];
                if (values.length === 0) {
                    return false;
                }
                const pilotTraits = Array.isArray(pilot.cardData?.traits) ? pilot.cardData.traits : [];
                return values.some((trait: string) => pilotTraits.includes(trait));
            }

            case 'pairedPilotColor': {
                const expected = typeof condition.value === 'string' ? condition.value : null;
                if (!expected) {
                    return false;
                }
                const pilotColor = typeof pilot.cardData?.color === 'string' ? pilot.cardData.color : '';
                return pilotColor === expected;
            }

            case 'pairedUnitTrait': {
                const required = typeof condition.value === 'string' ? condition.value : null;
                if (!required) {
                    return false;
                }
                const unitTraits = Array.isArray(unit.cardData?.traits) ? unit.cardData.traits : [];
                return unitTraits.includes(required);
            }

            case 'unitsInPlayWithTrait': {
                const traits = Array.isArray((condition as any).traits)
                    ? (condition as any).traits.filter((t: unknown) => typeof t === 'string')
                    : [];
                return ConditionEvaluators.unitsInPlayWithTrait(gameEnv, playerId, traits, condition.value);
            }

            case 'cardsInTrashWithTraitsAny': {
                const traitsAny = Array.isArray((condition as any).traits)
                    ? (condition as any).traits.filter((t: unknown) => typeof t === 'string')
                    : [];
                return ConditionEvaluators.cardsInTrashWithTraitsAny(gameEnv, playerId, traitsAny, condition.value);
            }

            case 'cardsInTrash': {
                const traitsAny = Array.isArray((condition as any).traitsAny)
                    ? (condition as any).traitsAny.filter((t: unknown) => typeof t === 'string')
                    : [];
                return ConditionEvaluators.cardsInTrashWithTraitsAny(gameEnv, playerId, traitsAny, condition.value);
            }

            case 'hasAnotherLinkedUnit': {
                const player = gameEnv.getPlayer(playerId);
                if (!player?.zones) {
                    return false;
                }

                for (const slotName of SLOT_ZONES) {
                    const slot = (player.zones as any)[slotName];
                    if (!slot?.unit || !slot?.pilot) {
                        continue;
                    }

                    if (slot.unit.carduid === unit.carduid) {
                        continue;
                    }

                    if (LinkUtils.isLinkedPair(slot.unit, slot.pilot)) {
                        return true;
                    }
                }

                return false;
            }

            default:
                return null;
        }
    }
}

