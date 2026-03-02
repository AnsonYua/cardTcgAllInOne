// src/services/conditions/PairingConditionEvaluator.ts
// Centralizes evaluation of pairing-only condition types (PAIRING_COMPLETE trigger).

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { PilotZoneCard, UnitZoneCard } from '../../models/CardSystem';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { ConditionEvaluators } from './ConditionEvaluators';
import { CardTraitUtils } from '../../utils/CardTraitUtils';

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
                return CardTraitUtils.hasTrait(pilot.cardData, required);
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
                return CardTraitUtils.hasAnyTrait(pilot.cardData, values);
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
                return CardTraitUtils.hasTrait(unit.cardData, required);
            }

            case 'pairedUnitColor': {
                const expected = typeof condition.value === 'string' ? condition.value : null;
                if (!expected) {
                    return false;
                }
                const unitColor = typeof unit.cardData?.color === 'string' ? unit.cardData.color : '';
                return unitColor === expected;
            }

            case 'unitsInPlayWithTrait': {
                const traits = Array.isArray((condition as any).traits)
                    ? (condition as any).traits.filter((t: unknown) => typeof t === 'string')
                    : [];
                return ConditionEvaluators.unitsInPlayWithTrait(gameEnv, playerId, traits, condition.value);
            }

            case 'unitsInPlay': {
                const units = SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, playerId);
                const count = Array.isArray(units) ? units.length : 0;
                if (typeof condition.value === 'number') {
                    return count === condition.value;
                }
                if (typeof condition.value === 'string') {
                    return validateComparisonFilter(count, condition.value);
                }
                return true;
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
                return ConditionEvaluators.hasAnotherLinkedUnit(gameEnv, playerId, unit.carduid);
            }

            default:
                return null;
        }
    }
}
