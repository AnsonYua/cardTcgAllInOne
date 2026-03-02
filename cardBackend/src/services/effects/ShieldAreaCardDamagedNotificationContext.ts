import type { GameEnvironment } from '../../models/GameEnvironment';

function readNotificationQueue(gameEnv: GameEnvironment): any[] {
    return Array.isArray((gameEnv as any)?.notificationQueue) ? (gameEnv as any).notificationQueue : [];
}

export function findShieldAreaCardDamagedNotification(
    gameEnv: GameEnvironment,
    eventId: string
): Record<string, unknown> | null {
    if (!eventId) {
        return null;
    }

    const queue = readNotificationQueue(gameEnv);
    for (let i = queue.length - 1; i >= 0; i--) {
        const notification = queue[i] as any;
        if (!notification || notification.type !== 'SHIELD_AREA_CARD_DAMAGED') {
            continue;
        }
        if (String(notification.id || '') !== eventId) {
            continue;
        }
        return notification as Record<string, unknown>;
    }

    return null;
}

function readStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export function shieldAreaCardDamagedRuleMatchesEvent(
    rawRule: Record<string, unknown>,
    context: {
        attackingPlayerId: string;
        defendingPlayerId: string;
        defenseArea: string;
        attackerTraits: string[];
    }
): boolean {
    const conditions = Array.isArray((rawRule as any).conditions) ? ((rawRule as any).conditions as any[]) : [];
    const eventConditions = conditions.filter(
        (condition) => condition && typeof condition === 'object' && (condition as any).type === 'shieldAreaCardDamagedByBattleDamage'
    );

    if (eventConditions.length === 0) {
        return true;
    }

    return eventConditions.every((condition) => {
        const scope = typeof (condition as any).scope === 'string' ? ((condition as any).scope as string).toLowerCase() : '';
        if (scope === 'opponent' && context.defendingPlayerId === context.attackingPlayerId) {
            return false;
        }

        const defenseAreas = readStringArray((condition as any).defenseAreas);
        if (defenseAreas.length > 0 && !defenseAreas.includes(context.defenseArea)) {
            return false;
        }

        const filters = (condition as any).sourceUnitFilters && typeof (condition as any).sourceUnitFilters === 'object'
            ? (condition as any).sourceUnitFilters
            : {};
        const traits = readStringArray((filters as any).traits);
        if (traits.length > 0 && !traits.every((trait) => context.attackerTraits.includes(trait))) {
            return false;
        }

        return true;
    });
}
