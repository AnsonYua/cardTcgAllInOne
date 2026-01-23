// src/services/statusEffects/AttackRestrictionManager.ts

import { GameEnvironment } from '../../models/GameEnvironment';
import { UnitZoneCard } from '../../models/CardSystem';
import { SLOT_ZONES } from '../../config/gameConstants';

export type AttackRestrictionDuration = 'UNTIL_END_OF_TURN' | string;

export interface AttackRestrictionEntry {
    restriction: string;
    duration: AttackRestrictionDuration;
    appliedBy?: string;
    appliedTurn?: number;
    sourceCarduid?: string;
}

export class AttackRestrictionManager {
    static applyRestriction(
        gameEnv: GameEnvironment,
        unit: UnitZoneCard,
        entry: AttackRestrictionEntry
    ): void {
        if (!(unit as any).activeRestrictions) {
            (unit as any).activeRestrictions = [];
        }
        if (!Array.isArray((unit as any).activeRestrictions)) {
            (unit as any).activeRestrictions = [(unit as any).activeRestrictions];
        }

        (unit as any).activeRestrictions.push({
            ...entry,
            appliedTurn: typeof entry.appliedTurn === 'number' ? entry.appliedTurn : gameEnv.currentTurn
        });
    }

    static cleanupEndOfTurn(gameEnv: GameEnvironment, endingPlayerId: string): number {
        let removedCount = 0;

        for (const player of Object.values(gameEnv.players || {})) {
            if (!player?.zones) {
                continue;
            }

            for (const slotName of SLOT_ZONES) {
                const unit = (player.zones as any)[slotName]?.unit as UnitZoneCard | undefined;
                if (!unit || !Array.isArray((unit as any).activeRestrictions)) {
                    continue;
                }

                const before = (unit as any).activeRestrictions.length;
                (unit as any).activeRestrictions = (unit as any).activeRestrictions.filter((restriction: any) => {
                    if (!restriction || typeof restriction !== 'object') {
                        return true;
                    }

                    const duration = typeof restriction.duration === 'string' ? restriction.duration : '';
                    if (duration !== 'UNTIL_END_OF_TURN') {
                        return true;
                    }

                    const appliedBy = typeof restriction.appliedBy === 'string' ? restriction.appliedBy : undefined;
                    if (appliedBy !== endingPlayerId) {
                        return true;
                    }

                    const appliedTurn = typeof restriction.appliedTurn === 'number'
                        ? restriction.appliedTurn
                        : gameEnv.currentTurn;

                    return !(appliedTurn <= gameEnv.currentTurn);
                });

                removedCount += Math.max(0, before - (unit as any).activeRestrictions.length);
            }
        }

        return removedCount;
    }
}
