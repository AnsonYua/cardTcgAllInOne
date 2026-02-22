import type { GameEnvironment } from '../../models/GameEnvironment';
import type { UnitZoneCard } from '../../models/CardSystem';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { SlotHealthService } from '../health/SlotHealthService';
import { PlayerCardManager } from '../PlayerCardManager';
import type { DestructionRequest, PendingDestruction } from './DestructionTypes';

export class DestructionCoordinator {
    static requestSlotDestruction(
        gameEnv: GameEnvironment,
        request: DestructionRequest
    ): { success: boolean; queued?: boolean; skipped?: boolean; error?: string } {
        if (!request.unitCarduid) {
            return { success: false, error: 'Missing unitCarduid for destruction request' };
        }

        const slotHealth = SlotHealthService.getSlotHealthState(gameEnv, request.unitCarduid);
        if (!slotHealth || !slotHealth.unitCarduid) {
            return { success: true, skipped: true };
        }

        const isLethal = slotHealth.remainingHp <= 0;
        if (!isLethal && request.allowNonLethal !== true) {
            return { success: true, skipped: true };
        }

        const pending: PendingDestruction = {
            playerId: slotHealth.playerId,
            slotName: slotHealth.slotName,
            unitCarduid: slotHealth.unitCarduid,
            timing: request.timing,
            cause: request.cause,
            battleContextId: request.battleContextId,
            orderKey: typeof request.orderKey === 'number' ? request.orderKey : 100
        };

        if (request.timing === 'AFTER_BATTLE_RESOLVED') {
            const enqueued = gameEnv.enqueuePendingDestruction(pending);
            return { success: true, queued: enqueued, skipped: !enqueued };
        }

        return this.executePendingDestruction(gameEnv, pending);
    }

    static flushPostBattleDestructions(
        gameEnv: GameEnvironment,
        battleContextId: string
    ): { success: boolean; resolvedCount: number; error?: string } {
        const pending = gameEnv.drainPendingDestructionsByBattleContextId(battleContextId);
        pending.sort((a, b) => {
            if (a.orderKey !== b.orderKey) {
                return a.orderKey - b.orderKey;
            }
            if (a.playerId !== b.playerId) {
                return a.playerId.localeCompare(b.playerId);
            }
            return a.slotName.localeCompare(b.slotName);
        });

        let resolvedCount = 0;
        for (const entry of pending) {
            const result = this.executePendingDestruction(gameEnv, entry);
            if (!result.success) {
                return { success: false, resolvedCount, error: result.error };
            }
            if (!result.skipped) {
                resolvedCount += 1;
            }
        }

        return { success: true, resolvedCount };
    }

    static clearPostBattleDestructions(gameEnv: GameEnvironment, battleContextId: string): number {
        return gameEnv.clearPendingDestructionsByBattleContextId(battleContextId);
    }

    private static executePendingDestruction(
        gameEnv: GameEnvironment,
        entry: PendingDestruction
    ): { success: boolean; skipped?: boolean; error?: string } {
        const player = gameEnv.getPlayer(entry.playerId);
        if (!player?.zones) {
            return { success: true, skipped: true };
        }

        const slotResult = SlotZoneUtils.getSlotZone(player.zones, entry.slotName);
        if (!slotResult.isValid || !slotResult.slot?.unit) {
            return { success: true, skipped: true };
        }

        const unit = slotResult.slot.unit as UnitZoneCard;
        if (unit.carduid !== entry.unitCarduid) {
            return { success: true, skipped: true };
        }

        const destroyed = PlayerCardManager.destroyUnitInSlot(gameEnv, entry.playerId, entry.slotName, unit);
        if (!destroyed) {
            return {
                success: false,
                error: `Failed to destroy unit ${entry.unitCarduid} in ${entry.slotName}`
            };
        }

        return { success: true };
    }
}
