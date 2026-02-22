import type { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase } from '../../models/GameEnums';
import { SLOT_ZONES } from '../../config/gameConstants';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { KeywordUtils } from '../../utils/KeywordUtils';
import { SlotCardStateUtils } from './SlotCardStateUtils';

export class EventConditionEvaluator {
    static eventTypeMatches(gameEnv: GameEnvironment, condition: Record<string, unknown>): boolean {
        const expected = typeof condition.value === 'string' ? condition.value.toUpperCase() : '';
        if (!expected) {
            return false;
        }

        const currentEvent = gameEnv.processingQueue[0] as any;
        const actionType = String(currentEvent?.data?.actionType || '').toLowerCase();
        const latestNotification = this.getLatestNotification(gameEnv);
        const latestType = String((latestNotification as any)?.type || '').toUpperCase();

        if (expected === 'UNIT_ATTACK_DECLARED') {
            return latestType === 'UNIT_ATTACK_DECLARED' || actionType === 'attackunit' || actionType === 'attackshieldarea';
        }
        if (expected === 'UNIT_HEALED') {
            return latestType === 'CARD_HEALED';
        }
        if (expected === 'EFFECT_DAMAGE_RECEIVED') {
            return latestType === 'CARD_DAMAGED' || String(currentEvent?.type || '').toUpperCase() === 'TRIGGER_EFFECT_DAMAGE_RECEIVED';
        }
        if (expected === 'SET_ACTIVE_BY_EFFECT') {
            return latestType === 'CARD_SET_ACTIVE';
        }
        if (expected === 'END_OF_TURN') {
            return gameEnv.phase === GamePhase.END_PHASE || String(currentEvent?.type || '').toUpperCase() === 'TRIGGER_END_OF_TURN_EFFECT';
        }
        if (expected === 'BATTLE_DESTROY') {
            return latestType === 'BATTLE_RESOLVED';
        }

        return latestType === expected || String(currentEvent?.type || '').toUpperCase() === expected;
    }

    static eventAttackerMatches(
        gameEnv: GameEnvironment,
        sourceCard: any,
        condition: Record<string, unknown>
    ): boolean {
        const expected = typeof condition.value === 'string' ? condition.value.toLowerCase() : '';
        if (!expected) {
            return false;
        }

        const attackerCarduid = this.getEventAttackerCarduid(gameEnv);
        if (!attackerCarduid) {
            return false;
        }

        if (expected === 'self') {
            return typeof sourceCard?.carduid === 'string' && sourceCard.carduid === attackerCarduid;
        }

        return false;
    }

    static eventAttackerControllerMatches(
        gameEnv: GameEnvironment,
        cardOwnerPlayerId: string | null,
        condition: Record<string, unknown>
    ): boolean {
        const expected = typeof condition.value === 'string' ? condition.value.toLowerCase() : '';
        if (!expected || !cardOwnerPlayerId) {
            return false;
        }

        const attackerCarduid = this.getEventAttackerCarduid(gameEnv);
        if (!attackerCarduid) {
            return false;
        }

        const slot = this.findSlotByCarduid(gameEnv, attackerCarduid);
        if (!slot) {
            return false;
        }

        if (expected === 'self') {
            return slot.playerId === cardOwnerPlayerId;
        }
        if (expected === 'opponent') {
            return slot.playerId !== cardOwnerPlayerId;
        }

        return false;
    }

    static eventAttackerHasKeyword(gameEnv: GameEnvironment, condition: Record<string, unknown>): boolean {
        const keyword = typeof condition.value === 'string' ? condition.value : '';
        if (!keyword) {
            return false;
        }

        const attackerCarduid = this.getEventAttackerCarduid(gameEnv);
        if (!attackerCarduid) {
            return false;
        }

        const attackerCard = SlotZoneUtils.getCardByUid(gameEnv, attackerCarduid) as any;
        if (!attackerCard?.cardData) {
            return false;
        }

        const normalizedKeyword = keyword.toLowerCase();
        const keywords = Array.isArray(attackerCard.cardData?.keywords) ? attackerCard.cardData.keywords : [];
        if (keywords.some((entry: unknown) => typeof entry === 'string' && entry.toLowerCase() === normalizedKeyword)) {
            return true;
        }
        if (normalizedKeyword === 'blocker') {
            return KeywordUtils.hasBlocker(attackerCard);
        }
        if (normalizedKeyword === 'repair') {
            const rules = Array.isArray(attackerCard.cardData?.effects?.rules) ? attackerCard.cardData.effects.rules : [];
            return rules.some((rule: any) =>
                String(rule?.trigger || '').toUpperCase() === 'END_OF_TURN' &&
                String(rule?.action || '').toLowerCase() === 'heal'
            );
        }

        return false;
    }

    static eventAttackerIsNotSource(
        gameEnv: GameEnvironment,
        sourceCard: any,
        condition: Record<string, unknown>
    ): boolean {
        const expected = typeof condition.value === 'boolean' ? condition.value : true;
        const attackerCarduid = this.getEventAttackerCarduid(gameEnv);
        const sourceCarduid = typeof sourceCard?.carduid === 'string' ? sourceCard.carduid : '';
        if (!attackerCarduid || !sourceCarduid) {
            return false;
        }

        const isNotSource = attackerCarduid !== sourceCarduid;
        return isNotSource === expected;
    }

    static eventTargetMatches(
        gameEnv: GameEnvironment,
        sourceCard: any,
        condition: Record<string, unknown>
    ): boolean {
        const expected = typeof condition.value === 'string' ? condition.value.toLowerCase() : '';
        if (!expected) {
            return false;
        }

        const targetCarduid = this.getEventTargetCarduid(gameEnv);
        if (!targetCarduid) {
            return false;
        }

        if (expected === 'self') {
            return typeof sourceCard?.carduid === 'string' && sourceCard.carduid === targetCarduid;
        }

        return false;
    }

    static eventTargetControllerMatches(
        gameEnv: GameEnvironment,
        cardOwnerPlayerId: string | null,
        condition: Record<string, unknown>
    ): boolean {
        const expected = typeof condition.value === 'string' ? condition.value.toLowerCase() : '';
        if (!expected || !cardOwnerPlayerId) {
            return false;
        }

        const targetCarduid = this.getEventTargetCarduid(gameEnv);
        if (!targetCarduid) {
            return false;
        }

        const slot = this.findSlotByCarduid(gameEnv, targetCarduid);
        if (!slot) {
            return false;
        }

        if (expected === 'self') {
            return slot.playerId === cardOwnerPlayerId;
        }
        if (expected === 'opponent') {
            return slot.playerId !== cardOwnerPlayerId;
        }

        return false;
    }

    static eventTargetTraitsAny(gameEnv: GameEnvironment, condition: Record<string, unknown>): boolean {
        const values = Array.isArray(condition.value)
            ? condition.value.filter((entry): entry is string => typeof entry === 'string')
            : [];
        if (values.length === 0) {
            return false;
        }

        const targetCarduid = this.getEventTargetCarduid(gameEnv);
        if (!targetCarduid) {
            return false;
        }

        const targetCard = SlotZoneUtils.getCardByUid(gameEnv, targetCarduid) as any;
        const traits = Array.isArray(targetCard?.cardData?.traits) ? targetCard.cardData.traits : [];
        return values.some((trait) => traits.includes(trait));
    }

    static eventTargetPairedPilotTrait(gameEnv: GameEnvironment, condition: Record<string, unknown>): boolean {
        const expected = typeof condition.value === 'string' ? condition.value : '';
        if (!expected) {
            return false;
        }

        const targetCarduid = this.getEventTargetCarduid(gameEnv);
        if (!targetCarduid) {
            return false;
        }

        const slotRef = this.findSlotByCarduid(gameEnv, targetCarduid);
        const pairedPilot = slotRef?.slot?.pilot;
        const traits = Array.isArray(pairedPilot?.cardData?.traits) ? pairedPilot.cardData.traits : [];
        return traits.includes(expected);
    }

    static eventTargetWasRested(gameEnv: GameEnvironment, condition: Record<string, unknown>): boolean {
        const expected = typeof condition.value === 'boolean' ? condition.value : true;
        const latestNotification = this.getLatestNotification(gameEnv) as any;
        const targetCarduid = this.getEventTargetCarduid(gameEnv);
        const carduid = typeof latestNotification?.payload?.carduid === 'string'
            ? latestNotification.payload.carduid
            : targetCarduid;
        if (!carduid) {
            return false;
        }

        const card = SlotZoneUtils.getCardByUid(gameEnv, carduid) as any;
        const wasRested = Boolean(card?.isRested);
        return wasRested === expected;
    }

    static eventTargetLinkStatus(gameEnv: GameEnvironment, condition: Record<string, unknown>): boolean {
        const expected = typeof condition.value === 'string' ? condition.value.toLowerCase() : '';
        if (!expected) {
            return false;
        }

        const targetCarduid = this.getEventTargetCarduid(gameEnv);
        if (!targetCarduid) {
            return false;
        }

        const linked = SlotCardStateUtils.isCardLinked(gameEnv, targetCarduid);
        if (expected === 'linked') {
            return linked;
        }
        if (expected === 'unlinked') {
            return !linked;
        }
        return false;
    }

    private static getLatestNotification(gameEnv: GameEnvironment): Record<string, unknown> | null {
        const overrideNotification = (gameEnv as any)?.eventConditionNotificationOverride;
        if (overrideNotification && typeof overrideNotification === 'object') {
            return overrideNotification as Record<string, unknown>;
        }

        const queue = Array.isArray(gameEnv.notificationQueue) ? gameEnv.notificationQueue : [];
        if (queue.length === 0) {
            return null;
        }
        return queue[queue.length - 1] as Record<string, unknown>;
    }

    private static getEventAttackerCarduid(gameEnv: GameEnvironment): string | null {
        const latestNotification = this.getLatestNotification(gameEnv) as any;
        if (typeof latestNotification?.payload?.attackerCarduid === 'string') {
            return latestNotification.payload.attackerCarduid;
        }
        const battle = gameEnv.currentBattle;
        if (battle?.attackerCarduid) {
            return battle.attackerCarduid;
        }
        return null;
    }

    private static getEventTargetCarduid(gameEnv: GameEnvironment): string | null {
        const latestNotification = this.getLatestNotification(gameEnv) as any;
        if (typeof latestNotification?.payload?.targetCarduid === 'string') {
            return latestNotification.payload.targetCarduid;
        }
        if (typeof latestNotification?.payload?.carduid === 'string') {
            return latestNotification.payload.carduid;
        }
        const battle = gameEnv.currentBattle;
        if (battle?.targetCarduid) {
            return battle.targetCarduid;
        }
        return null;
    }

    private static findSlotByCarduid(
        gameEnv: GameEnvironment,
        carduid: string
    ): { playerId: string; slotName: string; slot: any } | null {
        for (const [playerId, player] of Object.entries(gameEnv.players)) {
            if (!player?.zones) {
                continue;
            }

            for (const slotName of SLOT_ZONES) {
                const slot = (player.zones as any)[slotName];
                if (!slot) {
                    continue;
                }
                if (slot.unit?.carduid === carduid || slot.pilot?.carduid === carduid) {
                    return { playerId, slotName, slot };
                }
            }
        }

        return null;
    }
}
