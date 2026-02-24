import type { TemporaryEffect, UnitZoneCard } from '../../models/CardSystem';

type AllowAttackTargetPermission = NonNullable<TemporaryEffect['allowAttackTarget']>;

export function normalizeAllowAttackTargetPermission(parameters: unknown): AllowAttackTargetPermission {
    const typed = parameters && typeof parameters === 'object'
        ? (parameters as Record<string, unknown>)
        : {};

    const permission: AllowAttackTargetPermission = {};

    if (typeof typed.status === 'string') {
        permission.status = typed.status;
    }

    if (typeof typed.level === 'string') {
        permission.level = typed.level;
    }

    if (typeof typed.ap === 'string' || typeof typed.ap === 'number') {
        permission.ap = typed.ap;
    }

    if (typeof typed.damaged === 'boolean') {
        permission.damaged = typed.damaged;
    }

    if (typeof typed.pairedPilot === 'string') {
        permission.pairedPilot = typed.pairedPilot;
    }

    if (typeof typed.pairedPilotTrait === 'string') {
        permission.pairedPilotTrait = typed.pairedPilotTrait;
    }

    if (typeof typed.allowAttackOnDeployTurn === 'boolean') {
        permission.allowAttackOnDeployTurn = typed.allowAttackOnDeployTurn;
    }

    return permission;
}

export function applyAllowAttackTargetUnitOverrides(
    unit: UnitZoneCard,
    permission: AllowAttackTargetPermission
): void {
    if (permission.allowAttackOnDeployTurn === true) {
        unit.canAttackOnPlayTurn = true;
    }
}
