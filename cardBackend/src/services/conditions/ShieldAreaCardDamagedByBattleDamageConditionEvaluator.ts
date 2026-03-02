import type { GameEnvironment } from '../../models/GameEnvironment';
import { ConditionScopeUtils } from './ConditionScopeUtils';

function readStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function readObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export class ShieldAreaCardDamagedByBattleDamageConditionEvaluator {
    static evaluate(
        gameEnv: GameEnvironment,
        cardOwnerPlayerId: string | null,
        condition: Record<string, unknown>,
        latestNotification: Record<string, unknown> | null
    ): boolean {
        if (!cardOwnerPlayerId || !latestNotification) {
            return false;
        }

        if (String((latestNotification as any)?.type || '').toUpperCase() !== 'SHIELD_AREA_CARD_DAMAGED') {
            return false;
        }

        const payload = readObject((latestNotification as any).payload);
        if (String(payload.damageSource || '').toLowerCase() !== 'battle') {
            return false;
        }

        const defendingPlayerId = typeof payload.defendingPlayerId === 'string' ? payload.defendingPlayerId : '';
        const defendingScope = typeof condition.scope === 'string' ? condition.scope : 'self';
        const expectedDefendingPlayerId = ConditionScopeUtils.resolveScopedPlayerId(gameEnv, cardOwnerPlayerId, defendingScope);
        if (!expectedDefendingPlayerId || defendingPlayerId !== expectedDefendingPlayerId) {
            return false;
        }

        const defenseAreas = readStringArray((condition as any).defenseAreas);
        const defenseArea = typeof payload.defenseArea === 'string' ? payload.defenseArea : '';
        if (defenseAreas.length > 0 && !defenseAreas.includes(defenseArea)) {
            return false;
        }

        const attackingPlayerId = typeof payload.attackingPlayerId === 'string' ? payload.attackingPlayerId : '';
        const sourceUnitScope = typeof (condition as any).sourceUnitScope === 'string'
            ? (condition as any).sourceUnitScope
            : 'self';
        const expectedAttackingPlayerId = ConditionScopeUtils.resolveScopedPlayerId(gameEnv, cardOwnerPlayerId, sourceUnitScope);
        if (!expectedAttackingPlayerId || attackingPlayerId !== expectedAttackingPlayerId) {
            return false;
        }

        const attackerSlot = typeof payload.attackerSlot === 'string' ? payload.attackerSlot : '';
        const attackerUnit = attackingPlayerId && attackerSlot
            ? (gameEnv.getPlayer(attackingPlayerId)?.zones as any)?.[attackerSlot]?.unit
            : null;
        if (!attackerUnit) {
            return false;
        }

        const filters = readObject((condition as any).sourceUnitFilters);
        const attackerTraits = readStringArray((attackerUnit as any)?.cardData?.traits);

        const traits = readStringArray(filters.traits);
        if (traits.length > 0 && !traits.every((trait) => attackerTraits.includes(trait))) {
            return false;
        }

        const traitsAny = readStringArray(filters.traitsAny);
        if (traitsAny.length > 0 && !traitsAny.some((trait) => attackerTraits.includes(trait))) {
            return false;
        }

        const expectedCardType = typeof filters.cardType === 'string' ? String(filters.cardType).toLowerCase() : '';
        const attackerCardType = typeof (attackerUnit as any)?.cardData?.cardType === 'string'
            ? String((attackerUnit as any).cardData.cardType).toLowerCase()
            : '';
        if (expectedCardType && attackerCardType !== expectedCardType) {
            return false;
        }

        return true;
    }
}
