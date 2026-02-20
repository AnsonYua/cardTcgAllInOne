import type { GameEnvironment } from '../../models/GameEnvironment';
import { SLOT_ZONES } from '../../config/gameConstants';
import { LinkUtils } from '../../utils/LinkUtils';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { ConditionScopeUtils } from './ConditionScopeUtils';

export class CardsInPlayWithFilterConditionEvaluator {
    static evaluate(
        gameEnv: GameEnvironment,
        rootPlayerId: string,
        condition: Record<string, unknown>
    ): boolean {
        const scopedPlayerId = ConditionScopeUtils.resolveScopedPlayerId(gameEnv, rootPlayerId, condition.scope);
        if (!scopedPlayerId) {
            return false;
        }

        const player = gameEnv.getPlayer(scopedPlayerId);
        if (!player?.zones) {
            return false;
        }

        const filters = condition.filters && typeof condition.filters === 'object'
            ? (condition.filters as Record<string, unknown>)
            : {};
        const cardTypeFilter = typeof filters.cardType === 'string'
            ? filters.cardType.toLowerCase()
            : '';

        let count = 0;
        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            if (!slot) {
                continue;
            }

            if ((cardTypeFilter === '' || cardTypeFilter === 'unit') && slot.unit) {
                if (this.matchesSlotCardFilter(gameEnv, slot.unit, slot, filters)) {
                    count += 1;
                }
            }

            if ((cardTypeFilter === '' || cardTypeFilter === 'pilot') && slot.pilot) {
                if (this.matchesSlotCardFilter(gameEnv, slot.pilot, slot, filters)) {
                    count += 1;
                }
            }
        }

        if (typeof condition.value === 'number') {
            return count === condition.value;
        }
        if (typeof condition.value === 'string') {
            return validateComparisonFilter(count, condition.value);
        }
        return true;
    }

    private static matchesSlotCardFilter(
        gameEnv: GameEnvironment,
        card: any,
        slot: any,
        filters: Record<string, unknown>
    ): boolean {
        const levelFilter = filters.level;
        if (typeof levelFilter === 'string') {
            const level = typeof card?.cardData?.level === 'number'
                ? card.cardData.level
                : 0;
            if (!validateComparisonFilter(level, levelFilter)) {
                return false;
            }
        }

        if (Array.isArray(filters.traits) && filters.traits.length > 0) {
            const traits = Array.isArray(card?.cardData?.traits) ? card.cardData.traits : [];
            const hasAny = (filters.traits as unknown[]).some((trait) => typeof trait === 'string' && traits.includes(trait));
            if (!hasAny) {
                return false;
            }
        }

        if (Array.isArray(filters.traitsAny) && filters.traitsAny.length > 0) {
            const traits = Array.isArray(card?.cardData?.traits) ? card.cardData.traits : [];
            const hasAny = (filters.traitsAny as unknown[]).some((trait) => typeof trait === 'string' && traits.includes(trait));
            if (!hasAny) {
                return false;
            }
        }

        if (typeof filters.status === 'string') {
            const desired = String(filters.status).toLowerCase();
            const status = card?.isRested ? 'rested' : 'active';
            if (status !== desired) {
                return false;
            }
        }

        if (typeof filters.color === 'string') {
            const color = typeof card?.cardData?.color === 'string' ? card.cardData.color.toLowerCase() : '';
            if (color !== String(filters.color).toLowerCase()) {
                return false;
            }
        }

        if (typeof filters.pairedPilot === 'string' && card?.cardData?.cardType === 'unit') {
            const requirement = String(filters.pairedPilot).toLowerCase();
            const hasPilot = Boolean(slot?.pilot);
            if (requirement === 'any' && !hasPilot) {
                return false;
            }
            if (requirement === 'none' && hasPilot) {
                return false;
            }
        }

        if (typeof filters.isLinkUnit === 'boolean' && card?.cardData?.cardType === 'unit') {
            const linked = LinkUtils.isLinkedPair(slot?.unit, slot?.pilot);
            if (linked !== filters.isLinkUnit) {
                return false;
            }
        }

        if (typeof filters.isBattling === 'boolean' && card?.carduid) {
            const battle = gameEnv.currentBattle;
            const battling = Boolean(
                battle && (battle.attackerCarduid === card.carduid || battle.targetCarduid === card.carduid)
            );
            if (battling !== filters.isBattling) {
                return false;
            }
        }

        return true;
    }
}
