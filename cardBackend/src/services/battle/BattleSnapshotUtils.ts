import { GameEnvironment } from '../../models/GameEnvironment';
import { BattleContext, ForcedTargetSummary } from '../../models/BattleContext';
import { UnitZoneCard, PilotZoneCard, BaseCard, FieldCardValue } from '../../models/CardSystem';
import { Player } from '../../models/Player';
import { GameNotificationManager } from '../GameNotificationManager';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { calculateSlotFieldValue, calculateBaseFieldValue } from '../../utils/FieldValueCalculator';

export interface BattleParticipantSnapshot {
    playerId: string;
    slot?: string;
    zoneType: 'slot' | 'base' | 'shield';
    unit?: UnitZoneCard | BaseCard | null;
    pilot?: PilotZoneCard | null;
    fieldCardValue?: FieldCardValue;
    shieldsRemaining?: number;
}

export function buildSlotSnapshot(player: Player | undefined, slotName?: string): BattleParticipantSnapshot | null {
    if (!player || !slotName) {
        return null;
    }

    const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotName);
    if (!slotResult.isValid || !slotResult.slot) {
        return null;
    }

    const slot = slotResult.slot;
    return {
        playerId: player.id,
        slot: slotName,
        zoneType: 'slot',
        unit: cloneCard(slot.unit),
        pilot: cloneCard(slot.pilot),
        fieldCardValue: calculateSlotFieldValue(slot)
    };
}

export function buildForcedTargetSnapshot(
    gameEnv: GameEnvironment,
    forcedTarget?: ForcedTargetSummary
): BattleParticipantSnapshot | null {
    if (!forcedTarget?.playerId || !forcedTarget.zone) {
        return null;
    }
    const player = gameEnv.getPlayer(forcedTarget.playerId);
    if (!player) {
        return null;
    }
    const snapshot = buildSlotSnapshot(player, forcedTarget.zone);
    if (snapshot) {
        snapshot.slot = forcedTarget.zone;
    }
    return snapshot;
}

export function buildBaseSnapshot(player: Player | undefined, baseCard?: BaseCard): BattleParticipantSnapshot | null {
    if (!player || !baseCard) {
        return null;
    }

    return {
        playerId: player.id,
        slot: 'base',
        zoneType: 'base',
        unit: cloneCard(baseCard),
        pilot: null,
        fieldCardValue: calculateBaseFieldValue(baseCard)
    };
}

export function buildShieldSnapshot(player: Player): BattleParticipantSnapshot {
    return {
        playerId: player.id,
        slot: 'shieldArea',
        zoneType: 'shield',
        unit: null,
        pilot: null,
        shieldsRemaining: player.getShieldCount()
    };
}

export function emitBattleResolutionNotification(
    gameEnv: GameEnvironment,
    context: BattleContext,
    data: {
        attacker?: BattleParticipantSnapshot | null;
        target?: BattleParticipantSnapshot | null;
        focusTarget?: BattleParticipantSnapshot | null;
        result: Record<string, any>;
    }
): void {
    const notificationManager = new GameNotificationManager(gameEnv);
    notificationManager.addNotificationEvent(
        'BATTLE_RESOLVED',
        {
            battleType: context.actionType,
            attackingPlayerId: context.attackingPlayerId,
            defendingPlayerId: context.defendingPlayerId,
            attackNotificationId: context.attackNotificationId,
            forcedTarget: context.forcedTarget,
            attacker: data.attacker || null,
            target: data.target || null,
            focusTarget: data.focusTarget || null,
            result: data.result
        },
        'normal'
    );
}

function cloneCard<T>(card: T | null | undefined): T | null {
    if (!card) {
        return null;
    }
    return JSON.parse(JSON.stringify(card)) as T;
}
