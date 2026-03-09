import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { GameEvent, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { getAvailableEnergyCount, getTotalEnergyCount } from '../AiEnergyUtils';
import { CHOICE_EVENT_TYPES, SLOT_NAMES } from '../AiTypes';
import {
    getSlotAttackPower,
    getSlotDamage,
    getSlotRemainingHp,
    getSlotTotalHp
} from '../AiSlotHealthUtils';
import { canAttackActiveTarget, isShieldAttackRestricted } from '../AiTargetUtils';
import type {
    AiCardData,
    AiGameEnvView,
    AiNotificationEvent,
    AiPlayerView,
    AiQueueEvent,
    AiSlotName,
    AiSlotView,
    AiUnitView
} from '../AiViewTypes';
import type {
    AiBattleSnapshot,
    AiContextAdapter,
    AiDecisionContext,
    AiOwnedPromptSnapshot,
    AiSideSummary,
    AiSlotCombatSnapshot,
    AiWindowKind
} from './AiV1Types';

const KEYWORD_TOKENS = ['High-Maneuver', 'First Strike', 'Suppression', 'Breach', 'Blocker', 'Repair'];

type ChoiceEventData = {
    availableTargets?: unknown[];
    availableChoices?: unknown[];
    availableOptions?: unknown[];
    defaultOptionIndex?: number;
    effect?: {
        action?: string;
        optional?: boolean;
    };
    context?: {
        kind?: string;
    };
    blockingPlayerId?: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const canAttack = (unit: AiUnitView | undefined): boolean => {
    if (!unit) {
        return false;
    }
    if (typeof unit.canAttackThisTurn === 'boolean') {
        return unit.canAttackThisTurn;
    }
    const isRested = Boolean(unit.isRested);
    const playedThisTurn = Boolean(unit.playedThisTurn);
    const canAttackOnPlayTurn = Boolean(unit.canAttackOnPlayTurn);
    return !isRested && (!playedThisTurn || canAttackOnPlayTurn);
};

const extractKeywords = (cardData: AiCardData | undefined): string[] => {
    if (!cardData) {
        return [];
    }
    const raw = JSON.stringify(cardData);
    return KEYWORD_TOKENS.filter((keyword) => raw.includes(keyword));
};

const getOpponentId = (gameEnvView: AiGameEnvView, aiPlayerId: string): string | null => {
    if (gameEnvView?.playerId_1 === aiPlayerId) {
        return gameEnvView?.playerId_2 || null;
    }
    if (gameEnvView?.playerId_2 === aiPlayerId) {
        return gameEnvView?.playerId_1 || null;
    }
    const ids = Object.keys(gameEnvView?.players || {});
    return ids.find((id) => id !== aiPlayerId) || null;
};

const buildCombatSlotSnapshot = (
    gameEnvView: AiGameEnvView,
    playerId: string,
    slotName: AiSlotName,
    slot: AiSlotView | undefined
): AiSlotCombatSnapshot | null => {
    const unit = slot?.unit;
    if (!unit?.carduid) {
        return null;
    }

    const ap = getSlotAttackPower(slot);
    const totalHp = getSlotTotalHp(slot);
    const damageReceived = getSlotDamage(slot);
    const remainingHp = getSlotRemainingHp(slot);
    const keywords = extractKeywords(unit.cardData);
    const attackableActiveTarget = Object.values(gameEnvView?.players || {}).some((player) =>
        SLOT_NAMES.some((candidateSlotName) => {
            const candidateSlot = player?.zones?.[candidateSlotName] as AiSlotView | undefined;
            const candidateUnit = candidateSlot?.unit;
            return Boolean(
                candidateUnit
                && candidateUnit.isRested !== true
                && candidateUnit.carduid !== unit.carduid
                && canAttackActiveTarget(gameEnvView, unit, candidateUnit)
            );
        })
    );

    const keywordValue = keywords.reduce((sum, keyword) => {
        switch (keyword) {
            case 'High-Maneuver':
                return sum + 10;
            case 'First Strike':
                return sum + 8;
            case 'Suppression':
                return sum + 8;
            case 'Breach':
                return sum + 10;
            case 'Blocker':
                return sum + 9;
            case 'Repair':
                return sum + 7;
            default:
                return sum;
        }
    }, 0);

    return {
        playerId,
        slotName,
        slot: slot as AiSlotView,
        carduid: unit.carduid,
        name: asString(unit.cardData?.name) || unit.carduid,
        ap,
        isRested: Boolean(unit.isRested),
        canAttack: canAttack(unit),
        canAttackPlayer: !isShieldAttackRestricted(unit),
        canAttackActiveUnit: attackableActiveTarget,
        hp: {
            totalHp,
            damageReceived,
            remainingHp,
            lethalDamageThreshold: remainingHp,
            isDestroyed: remainingHp <= 0
        },
        keywords,
        valueScore: ap * 2 + remainingHp * 2 + keywordValue
    };
};

const buildSideSummary = (
    gameEnvView: AiGameEnvView,
    playerId: string
): AiSideSummary => {
    const player = gameEnvView?.players?.[playerId] as AiPlayerView | undefined;
    const zones = player?.zones || {};
    const units = SLOT_NAMES
        .map((slotName) =>
            buildCombatSlotSnapshot(
                gameEnvView,
                playerId,
                slotName as AiSlotName,
                zones?.[slotName] as AiSlotView | undefined
            )
        )
        .filter((entry): entry is AiSlotCombatSnapshot => Boolean(entry));

    return {
        playerId,
        shieldCount: Number(zones?.shieldCount || 0),
        handCount: Number(player?.deck?.handCount ?? player?.deck?.hand?.length ?? 0),
        availableEnergy: getAvailableEnergyCount(player),
        totalEnergy: getTotalEnergyCount(player),
        trashCount: Array.isArray(zones?.trashArea) ? zones.trashArea.length : 0,
        hasBase: Array.isArray(zones?.base) && zones.base.length > 0,
        readyAttackers: units.filter((unit) => unit.canAttack).length,
        totalBoardAp: units.reduce((sum, unit) => sum + unit.ap, 0),
        totalBoardHp: units.reduce((sum, unit) => sum + unit.hp.remainingHp, 0),
        units,
        damagedUnits: units.filter((unit) => unit.hp.damageReceived > 0),
        blockers: units.filter((unit) => unit.keywords.includes('Blocker'))
    };
};

const getChoiceOwner = (eventLike: { playerId?: string; data?: unknown } | null | undefined): string | null => {
    if (!eventLike) {
        return null;
    }
    if (typeof eventLike.playerId === 'string' && eventLike.playerId.length > 0) {
        return eventLike.playerId;
    }
    const data = asRecord(eventLike.data);
    const blockingPlayerId = asString(data.blockingPlayerId);
    if (blockingPlayerId) {
        return blockingPlayerId;
    }
    const playerId = asString(data.playerId);
    return playerId || null;
};

const isUncompletedNotificationChoice = (notification: AiNotificationEvent): boolean => {
    const type = asString(notification?.type);
    if (!CHOICE_EVENT_TYPES.has(type)) {
        return false;
    }
    const payload = asRecord(notification?.payload);
    return payload.isCompleted !== true;
};

const queueEventToPrompt = (event: AiQueueEvent, notification: AiNotificationEvent | null): AiOwnedPromptSnapshot => {
    const data = asRecord(event.data) as ChoiceEventData;
    const effect = asRecord(data.effect);
    const availableTargets = asArray(data.availableTargets) as TargetReference[];
    const availableChoices = asArray(data.availableChoices).map(asRecord);
    const availableOptions = asArray(data.availableOptions).map(asRecord);
    const optionalTarget = effect.optional === true;

    return {
        eventId: asString(event.id),
        type: asString(event.type),
        ownerPlayerId: getChoiceOwner(event) || '',
        allowsDecline: asString(event.type) === 'BLOCKER_CHOICE'
            || asString(event.type) === 'BURST_EFFECT_CHOICE'
            || optionalTarget,
        isCompleted: false,
        effectAction: asString(effect.action),
        defaultOptionIndex: typeof data.defaultOptionIndex === 'number' ? data.defaultOptionIndex : undefined,
        availableTargets,
        availableChoices,
        availableOptions,
        contextKind: asString(asRecord(data.context).kind) || undefined,
        rawEvent: event,
        rawNotification: notification
    };
};

const notificationToPrompt = (notification: AiNotificationEvent): AiOwnedPromptSnapshot => {
    const payload = asRecord(notification.payload);
    const event = asRecord(payload.event) as AiQueueEvent;
    if (event?.id) {
        return queueEventToPrompt(event, notification);
    }

    return {
        eventId: asString(notification.id),
        type: asString(notification.type),
        ownerPlayerId: asString(payload.playerId),
        allowsDecline: asString(notification.type) === 'BURST_EFFECT_CHOICE',
        isCompleted: payload.isCompleted === true,
        defaultOptionIndex: undefined,
        availableTargets: [],
        availableChoices: [],
        availableOptions: [],
        rawEvent: null,
        rawNotification: notification
    };
};

const sortPrompts = (left: AiOwnedPromptSnapshot, right: AiOwnedPromptSnapshot): number => {
    const order = [
        'BURST_EFFECT_CHOICE',
        'BLOCKER_CHOICE',
        'TARGET_CHOICE',
        'TOKEN_CHOICE',
        'OPTION_CHOICE',
        'PROMPT_CHOICE'
    ];
    return order.indexOf(left.type) - order.indexOf(right.type);
};

const extractOwnedPrompts = (
    gameEnvView: AiGameEnvView,
    aiPlayerId: string,
    rawGameEnv?: GameEnvironment
): AiOwnedPromptSnapshot[] => {
    const byId = new Map<string, AiOwnedPromptSnapshot>();

    const queue = Array.isArray(rawGameEnv?.processingQueue) ? rawGameEnv.processingQueue : [];
    for (const event of queue) {
        if (event?.status !== 'DECLARED' || !CHOICE_EVENT_TYPES.has(asString(event.type))) {
            continue;
        }
        if (getChoiceOwner(event as unknown as GameEvent) !== aiPlayerId) {
            continue;
        }
        byId.set(event.id, queueEventToPrompt(event as unknown as AiQueueEvent, null));
    }

    const notifications = Array.isArray(gameEnvView?.notificationQueue) ? gameEnvView.notificationQueue : [];
    for (const notification of notifications) {
        if (!isUncompletedNotificationChoice(notification)) {
            continue;
        }
        const prompt = notificationToPrompt(notification);
        if (prompt.ownerPlayerId !== aiPlayerId) {
            continue;
        }
        const current = byId.get(prompt.eventId);
        byId.set(prompt.eventId, {
            ...(current || prompt),
            rawNotification: notification,
            rawEvent: current?.rawEvent || prompt.rawEvent,
            availableTargets: current?.availableTargets?.length ? current.availableTargets : prompt.availableTargets,
            availableChoices: current?.availableChoices?.length ? current.availableChoices : prompt.availableChoices,
            availableOptions: current?.availableOptions?.length ? current.availableOptions : prompt.availableOptions,
            effectAction: current?.effectAction || prompt.effectAction,
            defaultOptionIndex: current?.defaultOptionIndex ?? prompt.defaultOptionIndex,
            contextKind: current?.contextKind || prompt.contextKind
        });
    }

    return Array.from(byId.values()).sort(sortPrompts);
};

const buildBattleSnapshot = (
    gameEnvView: AiGameEnvView,
    aiPlayerId: string,
    self: AiSideSummary,
    opponent: AiSideSummary
): AiBattleSnapshot | null => {
    const battle = gameEnvView?.currentBattle;
    if (!battle) {
        return null;
    }

    const attackerCarduid = asString(battle.attackerCarduid);
    const targetCarduid = asString(battle.targetCarduid);
    const attacker = [...self.units, ...opponent.units].find((unit) => unit.carduid === attackerCarduid) || null;
    const defender = [...self.units, ...opponent.units].find((unit) => unit.carduid === targetCarduid) || null;
    const attackerId = asString(battle.attackingPlayerId) || null;
    const defenderId = asString(battle.defendingPlayerId) || null;
    const confirmations = asRecord(battle.confirmations);
    const actionTargets = asRecord(battle.actionTargets);
    const ownTargets = asArray(actionTargets[aiPlayerId]);

    return {
        status: asString(battle.status),
        actionType: asString((battle as Record<string, unknown>).actionType),
        attackingPlayerId: attackerId,
        defendingPlayerId: defenderId,
        attackerCarduid: attackerCarduid || null,
        targetCarduid: targetCarduid || null,
        aiParticipant: attackerId === aiPlayerId || defenderId === aiPlayerId,
        aiConfirmed: confirmations[aiPlayerId] === true,
        opponentConfirmed: defenderId && defenderId !== aiPlayerId
            ? confirmations[defenderId] === true
            : attackerId && attackerId !== aiPlayerId
                ? confirmations[attackerId] === true
                : false,
        bothConfirmed: Object.values(confirmations).length > 0 && Object.values(confirmations).every((value) => value === true),
        attacker,
        defender,
        actionTargetsCount: ownTargets.length
    };
};

const detectWindowKind = (
    gameEnvView: AiGameEnvView,
    aiPlayerId: string,
    activePrompt: AiOwnedPromptSnapshot | null,
    battle: AiBattleSnapshot | null
): AiWindowKind => {
    const phase = asString(gameEnvView?.phase);
    if (phase === 'DECIDE_FIRST_PLAYER_PHASE' || phase === 'REDRAW_PHASE') {
        return 'SETUP';
    }
    if (activePrompt) {
        return 'OWNED_PROMPT';
    }
    if (battle?.bothConfirmed) {
        return 'BATTLE_RESOLVE';
    }
    if (battle?.status === 'ACTION_STEP' && battle.aiParticipant) {
        return 'ACTION_STEP';
    }
    if (phase === 'BLOCKER_PHASE') {
        return 'BLOCKER_STEP';
    }
    if (phase === 'MAIN_PHASE' && gameEnvView?.currentPlayer === aiPlayerId) {
        return 'MAIN_PHASE';
    }
    return 'WAIT';
};

export class GameEnvAiContextAdapter implements AiContextAdapter {
    buildContext(gameEnvView: AiGameEnvView, aiPlayerId: string, rawGameEnv?: GameEnvironment): AiDecisionContext {
        const opponentId = getOpponentId(gameEnvView, aiPlayerId);
        const self = buildSideSummary(gameEnvView, aiPlayerId);
        const opponent = buildSideSummary(gameEnvView, opponentId || '');
        const activePrompts = extractOwnedPrompts(gameEnvView, aiPlayerId, rawGameEnv);
        const activePrompt = activePrompts[0] || null;
        const battle = buildBattleSnapshot(gameEnvView, aiPlayerId, self, opponent);
        const windowKind = detectWindowKind(gameEnvView, aiPlayerId, activePrompt, battle);

        return {
            aiPlayerId,
            opponentId,
            phase: asString(gameEnvView?.phase),
            currentTurn: Number(gameEnvView?.currentTurn || 0),
            currentPlayerId: asString(gameEnvView?.currentPlayer) || null,
            windowKind,
            gameEnvView,
            rawGameEnv,
            self,
            opponent,
            battle,
            activePrompts,
            activePrompt
        };
    }
}
