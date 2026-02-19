import { GameEnvironment } from '../../models/GameEnvironment';
import { ExecutionResult } from '../ExecutionResult';
import { GameNotificationManager } from '../GameNotificationManager';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import {
    buildSlotSnapshot,
    buildInvalidActionStepTargetSnapshot,
    emitBattleResolutionNotification
} from './BattleSnapshotUtils';

type ClearBattleFn = (reason: string) => void;

export class ActionStepBattleConsistencyService {
    static ensure(
        gameEnv: GameEnvironment,
        reason: string,
        clearBattle: ClearBattleFn
    ): ExecutionResult | null {
        const validation = this.validateCurrentBattle(gameEnv);
        if (validation.valid) {
            return null;
        }

        const invalidReason = validation.reason || `INVALID_ACTION_STEP_BATTLE_${reason}`;
        return this.endInvalidBattle(gameEnv, invalidReason, clearBattle);
    }

    private static validateCurrentBattle(gameEnv: GameEnvironment): { valid: boolean; reason?: string } {
        const battle = gameEnv.currentBattle;
        if (!battle) {
            return { valid: true };
        }

        const status = (battle.status || '').toString().toUpperCase();
        if (status !== 'ACTION_STEP') {
            return { valid: true };
        }

        const attackerCarduid = (battle.attackerCarduid || '').toString();
        if (!attackerCarduid) {
            return { valid: false, reason: 'ATTACKER_UID_MISSING' };
        }

        const attackerLookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, attackerCarduid) as any;
        if (!this.isUnitLookupMatch(attackerLookup, attackerCarduid)) {
            return { valid: false, reason: 'ATTACKER_NOT_ON_BOARD' };
        }

        if (battle.attackingPlayerId && attackerLookup.playerId !== battle.attackingPlayerId) {
            return { valid: false, reason: 'ATTACKER_OWNER_MISMATCH' };
        }

        if (battle.actionType === 'attackUnit') {
            const targetCarduid = (battle.targetCarduid || '').toString();
            if (!targetCarduid) {
                return { valid: false, reason: 'TARGET_UID_MISSING' };
            }

            const targetLookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, targetCarduid) as any;
            if (!this.isUnitLookupMatch(targetLookup, targetCarduid)) {
                return { valid: false, reason: 'TARGET_NOT_ON_BOARD' };
            }

            if (battle.targetPlayerId && targetLookup.playerId !== battle.targetPlayerId) {
                return { valid: false, reason: 'TARGET_OWNER_MISMATCH' };
            }
        }

        return { valid: true };
    }

    private static endInvalidBattle(
        gameEnv: GameEnvironment,
        reason: string,
        clearBattle: ClearBattleFn
    ): ExecutionResult {
        const battle = gameEnv.currentBattle;
        if (!battle) {
            return { success: true };
        }

        const status = (battle.status || '').toString().toUpperCase();
        if (status !== 'ACTION_STEP') {
            return { success: true };
        }

        const attackNotificationId = battle.attackNotificationId;
        if (attackNotificationId) {
            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.updateNotificationEvent(attackNotificationId, {
                battleEnd: true
            });
            console.log(`📣 Attack notification ${attackNotificationId} marked as battleEnd (invalid battle)`);
        }

        const attackerLookup = battle.attackerCarduid
            ? SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, battle.attackerCarduid) as any
            : null;
        const attackerPlayer = attackerLookup?.playerId ? gameEnv.getPlayer(attackerLookup.playerId) : null;
        const attackerSnapshot = attackerPlayer
            ? buildSlotSnapshot(attackerPlayer, attackerLookup?.slotName)
            : null;
        const attackerMissing = !this.isUnitLookupMatch(attackerLookup, battle.attackerCarduid);

        const targetLookup = battle.targetCarduid
            ? SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, battle.targetCarduid) as any
            : null;
        const targetMissing = battle.actionType === 'attackUnit'
            ? !this.isUnitLookupMatch(targetLookup, battle.targetCarduid)
            : false;
        const targetSnapshot = buildInvalidActionStepTargetSnapshot(gameEnv, battle, targetLookup);

        emitBattleResolutionNotification(gameEnv, battle, {
            attacker: attackerSnapshot,
            target: targetSnapshot,
            focusTarget: targetSnapshot,
            result: {
                targetType: battle.actionType === 'attackUnit' ? 'unit' : 'shield',
                aborted: true,
                abortReason: reason,
                battleEndedEarly: true,
                attackerMissing,
                targetMissing
            }
        });

        console.warn(`⚠️ Action-step battle ended early: ${reason}`);
        clearBattle(`invalid_action_step_${reason}`);
        return { success: true };
    }

    private static isUnitLookupMatch(lookup: any, carduid?: string): boolean {
        if (!lookup?.found || !lookup?.slotName || !lookup?.playerId || !carduid) {
            return false;
        }
        const foundUnitUid = lookup?.unit?.carduid ?? lookup?.unit?.cardUid;
        return foundUnitUid === carduid;
    }
}
