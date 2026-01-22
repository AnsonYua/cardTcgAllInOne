// src/services/effects/EffectScalingUtils.ts

import type { GameEnvironment } from '../../models/GameEnvironment';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';

export class EffectScalingUtils {
    static resolveScalingFactor(
        gameEnv: GameEnvironment,
        playerId: string,
        scaling: unknown
    ): number {
        if (!scaling || typeof scaling !== 'object') {
            return 1;
        }

        const typedScaling = scaling as Record<string, unknown>;
        const scalingType = typeof typedScaling.type === 'string' ? typedScaling.type : '';
        if (scalingType !== 'COUNT_UNITS_IN_PLAY') {
            return 1;
        }

        const scope = typeof typedScaling.scope === 'string' ? typedScaling.scope : '';
        const normalizedScope = scope.toLowerCase();

        if (normalizedScope.startsWith('opponent')) {
            const opponentId = gameEnv.getOpponentId(playerId);
            if (!opponentId) {
                return 0;
            }
            return SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, opponentId).length;
        }

        if (normalizedScope.startsWith('self')) {
            return SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, playerId).length;
        }

        if (normalizedScope === 'any') {
            return Object.keys(gameEnv.players).reduce(
                (total, id) => total + SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, id).length,
                0
            );
        }

        return 1;
    }
}

