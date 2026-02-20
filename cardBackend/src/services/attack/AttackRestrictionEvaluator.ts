import { UnitZoneCard } from '../../models/CardSystem';
import { GameEnvironment } from '../../models/GameEnvironment';

const SLOT_NAMES = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;

export class AttackRestrictionEvaluator {
    static hasRestriction(unit: UnitZoneCard | null, restriction: string): boolean {
        if (!unit) {
            return false;
        }

        const matchesRestriction = (value: any): boolean => {
            if (!value) {
                return false;
            }

            if (typeof value === 'string') {
                return value === restriction;
            }

            if (Array.isArray(value)) {
                return value.some(item => matchesRestriction(item));
            }

            if (typeof value === 'object') {
                if (value.restriction || value.restrictions) {
                    return matchesRestriction(value.restriction || value.restrictions);
                }

                if (value.type) {
                    return matchesRestriction(value.type);
                }

                return Object.values(value).some(item => matchesRestriction(item));
            }

            return false;
        };

        if (matchesRestriction((unit as any).attackRestrictions)) {
            return true;
        }

        if (matchesRestriction((unit as any).activeRestrictions)) {
            return true;
        }

        const cardRules = unit.cardData?.effects?.rules || [];
        return cardRules.some(rule => {
            if (rule?.action !== 'restrict_attack') {
                return false;
            }

            const parameters = rule.parameters || {};
            return matchesRestriction(parameters.restriction || parameters.restrictions);
        });
    }

    static getDynamicAttackRequirementError(
        gameEnv: GameEnvironment,
        playerId: string,
        attackingUnit: UnitZoneCard
    ): string | null {
        const cardRules = Array.isArray(attackingUnit?.cardData?.effects?.rules)
            ? attackingUnit.cardData.effects.rules
            : [];

        for (const rule of cardRules) {
            if (rule?.action !== 'restrict_attack') {
                continue;
            }

            const requires = (rule.parameters as any)?.requires;
            if (!requires || typeof requires !== 'object') {
                continue;
            }

            const requirementType = typeof requires.type === 'string' ? requires.type : '';
            if (requirementType !== 'friendly_unit_deployed_this_turn') {
                continue;
            }

            const requiredTraits = Array.isArray(requires.traitsAny)
                ? requires.traitsAny.filter((trait: unknown): trait is string => typeof trait === 'string')
                : [];
            const player = gameEnv.getPlayer(playerId);
            if (!player?.zones) {
                return 'Attack requirement check failed: player zones not found';
            }

            let matched = false;
            for (const slotName of SLOT_NAMES) {
                const unit = (player.zones as any)?.[slotName]?.unit as UnitZoneCard | undefined;
                if (!unit || unit.playedThisTurn !== true) {
                    continue;
                }

                if (requiredTraits.length === 0) {
                    matched = true;
                    break;
                }

                const unitTraits = Array.isArray(unit.cardData?.traits) ? unit.cardData.traits : [];
                if (requiredTraits.some((trait: string) => unitTraits.includes(trait))) {
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                const cardName = attackingUnit.cardData?.name || attackingUnit.cardId || 'This unit';
                return `${cardName} can only attack during a turn when one of your required units was deployed`;
            }
        }

        return null;
    }
}
