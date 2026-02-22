import type { BattleContext } from '../../models/BattleContext';
import type { GameEnvironment } from '../../models/GameEnvironment';
import type { UnitZoneCard } from '../../models/CardSystem';
import { DestructionCoordinator } from './DestructionCoordinator';

export class BattleDestructionOrchestrator {
    static createBattleContextId(context: BattleContext): string {
        return `${context.attackingPlayerId}:${context.defendingPlayerId}:${context.attackerCarduid || 'unknown'}:${context.openedAt || 0}`;
    }

    static queueBattleDamageDestructions(
        gameEnv: GameEnvironment,
        params: {
            context: BattleContext;
            attackerDestroyed: boolean;
            defenderDestroyed: boolean;
            attackingUnit: UnitZoneCard;
            targetUnit: UnitZoneCard;
        }
    ): { success: boolean; battleContextId: string; error?: string } {
        const { context, attackerDestroyed, defenderDestroyed, attackingUnit, targetUnit } = params;
        const battleContextId = this.createBattleContextId(context);

        if (defenderDestroyed) {
            const enqueueResult = DestructionCoordinator.requestSlotDestruction(gameEnv, {
                unitCarduid: targetUnit.carduid,
                timing: 'AFTER_BATTLE_RESOLVED',
                cause: 'BATTLE_DAMAGE',
                battleContextId,
                orderKey: 0
            });
            if (!enqueueResult.success) {
                return { success: false, battleContextId, error: enqueueResult.error || 'Failed to queue defender destruction' };
            }
        }

        if (attackerDestroyed) {
            const enqueueResult = DestructionCoordinator.requestSlotDestruction(gameEnv, {
                unitCarduid: attackingUnit.carduid,
                timing: 'AFTER_BATTLE_RESOLVED',
                cause: 'BATTLE_DAMAGE',
                battleContextId,
                orderKey: 1
            });
            if (!enqueueResult.success) {
                DestructionCoordinator.clearPostBattleDestructions(gameEnv, battleContextId);
                return { success: false, battleContextId, error: enqueueResult.error || 'Failed to queue attacker destruction' };
            }
        }

        return { success: true, battleContextId };
    }

    static flushQueuedBattleDestructions(
        gameEnv: GameEnvironment,
        battleContextId: string
    ): { success: boolean; error?: string } {
        const flushResult = DestructionCoordinator.flushPostBattleDestructions(gameEnv, battleContextId);
        if (!flushResult.success) {
            return { success: false, error: flushResult.error || 'Failed to resolve post-battle destruction' };
        }
        return { success: true };
    }

    static clearQueuedBattleDestructions(gameEnv: GameEnvironment, battleContextId: string): void {
        DestructionCoordinator.clearPostBattleDestructions(gameEnv, battleContextId);
    }
}
