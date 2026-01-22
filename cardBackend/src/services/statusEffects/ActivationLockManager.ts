// src/services/statusEffects/ActivationLockManager.ts
// Centralized helpers for activation-lock style status effects (e.g. "cannot be set active next turn").

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { ActivationLockEffect, UnitZoneCard } from '../../models/CardSystem';
import { SLOT_ZONES } from '../../config/gameConstants';

export interface PreventSetActiveConsumption {
    preventedUnits: { carduid: string; sourceCarduid?: string; appliedBy?: string }[];
    preventedUnitUids: Set<string>;
}

export class ActivationLockManager {
    static addPreventSetActiveNextTurnLock(
        gameEnv: GameEnvironment,
        sourcePlayerId: string,
        sourceCarduid: string | undefined,
        targetUnit: UnitZoneCard,
        remainingStartPhases: number
    ): void {
        if (!Array.isArray(targetUnit.activationLocks)) {
            targetUnit.activationLocks = [];
        }

        const lock: ActivationLockEffect = {
            kind: 'prevent_set_active_next_turn',
            sourceCarduid: sourceCarduid || 'unknown',
            appliedBy: sourcePlayerId,
            appliedTurn: gameEnv.currentTurn || 0,
            remainingStartPhases: Math.max(1, remainingStartPhases)
        };

        targetUnit.activationLocks.push(lock);
    }

    static consumePreventSetActiveNextTurnLocks(
        gameEnv: GameEnvironment,
        playerId: string
    ): PreventSetActiveConsumption {
        const player = gameEnv.players[playerId];
        if (!player?.zones) {
            return { preventedUnits: [], preventedUnitUids: new Set() };
        }

        const preventedUnits: { carduid: string; sourceCarduid?: string; appliedBy?: string }[] = [];
        const preventedUnitUids = new Set<string>();

        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            const unit = slot?.unit as UnitZoneCard | undefined;
            if (!unit) {
                continue;
            }

            const locks: ActivationLockEffect[] = Array.isArray(unit.activationLocks) ? unit.activationLocks : [];
            const activeLocks = locks.filter(lock =>
                lock.kind === 'prevent_set_active_next_turn' && lock.remainingStartPhases > 0
            );

            if (activeLocks.length === 0) {
                continue;
            }

            unit.activationLocks = locks.map(lock => {
                if (lock.kind !== 'prevent_set_active_next_turn' || lock.remainingStartPhases <= 0) {
                    return lock;
                }
                return {
                    ...lock,
                    remainingStartPhases: Math.max(0, lock.remainingStartPhases - 1)
                };
            }).filter(lock => lock.remainingStartPhases > 0);

            preventedUnits.push({
                carduid: unit.carduid,
                sourceCarduid: activeLocks[0]?.sourceCarduid,
                appliedBy: activeLocks[0]?.appliedBy
            });
            preventedUnitUids.add(unit.carduid);
        }

        return { preventedUnits, preventedUnitUids };
    }
}

