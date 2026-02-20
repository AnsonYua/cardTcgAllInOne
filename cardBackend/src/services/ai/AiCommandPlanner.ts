import { GamePhase } from '../../models/GameEnums';
import { isPlayOrActivatedEffect } from '../../utils/EffectTypeRouter';
import { EffectTimingWindowUtils } from '../../utils/EffectTimingWindowUtils';
import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import type { ResolvedTargetConfig } from '../targets/TargetResolver';
import { TargetResolver } from '../targets/TargetResolver';
import { EffectExecutor } from '../effects/EffectExecutor';
import { getAvailableEnergyCount, getTotalEnergyCount } from './AiEnergyUtils';
import { buildViewAdapter, scoreTargetForAction } from './AiTargetUtils';
import { SLOT_NAMES, type AiDecision } from './AiTypes';
import {
    adjustDecisionThreshold,
    getActionPlaystyleMultiplier,
    getAiPlaystyle,
    type AiPlaystyle
} from './AiPlaystyleConfig';
import type {
    AiCardData,
    AiGameEnvView,
    AiHandCard,
    AiSlotView,
    AiUnitView
} from './AiViewTypes';

const MIN_COMMAND_SCORE = 26;
const ACTION_WEIGHT_SCALE = 0.24;

const ACTION_BASE_SCORE: Record<string, number> = {
    destroy: 40,
    returnToHand: 36,
    damage: 34,
    damageShield: 30,
    rest: 26,
    draw: 24,
    conditionalTokenDeploy: 22,
    addExtraEnergy: 20,
    addBasicEnergy: 18,
    setActive: 18,
    modifyAP: 16,
    modifyHP: 15,
    heal: 14,
    repair: 14,
    allow_attack_target: 12,
    grant_breach: 11,
    grant_keyword: 10,
    scry_top_deck: 9,
    sequence: 8
};

type CommandCardCandidate = {
    carduid: string;
    cardData: AiCardData;
    cost: number;
    level: number;
};

type UnitSnapshot = {
    ap: number;
    hp: number;
    remainingHp: number;
    damage: number;
    isRested: boolean;
};

type TargetEvaluation = {
    selectedTargets: TargetReference[];
    score: number;
};

type BoardContext = {
    selfUnitCount: number;
    selfReadyAttackers: number;
    selfDamagedTotal: number;
    opponentUnitCount: number;
    opponentReadyAttackers: number;
    opponentShieldCount: number;
    openSelfUnitSlots: number;
    handSize: number;
};

type DecisionCandidate = {
    decision: AiDecision;
    score: number;
};

type DecisionContext = {
    gameEnvView: AiGameEnvView;
    aiPlayerId: string;
    boardContext: BoardContext;
    adapter: ReturnType<typeof buildViewAdapter>;
};

const GAME_PHASE_SET = new Set<string>(Object.values(GamePhase));

const asEffectRules = (cardData: AiCardData): EffectDefinition[] => {
    const rules = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
    return rules.filter(
        (rule): rule is EffectDefinition =>
            Boolean(
                rule
                && typeof (rule as EffectDefinition).effectId === 'string'
                && (rule as EffectDefinition).effectId.length > 0
            )
    );
};

const toNumber = (value: unknown, fallback = 0): number => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const resolvePhase = (phase: string | undefined): GamePhase | null => {
    if (!phase || !GAME_PHASE_SET.has(phase)) {
        return null;
    }
    return phase as GamePhase;
};

const isCommandCard = (card: AiHandCard): card is AiHandCard & { carduid: string; cardData: AiCardData } => {
    return Boolean(card?.carduid && card?.cardData?.cardType === 'command');
};

const isOpponentScope = (scope: unknown): boolean => {
    const scopeText = typeof scope === 'string' ? scope.toLowerCase() : '';
    return scopeText.includes('opponent') || scopeText.includes('enemy');
};

const isSelfScope = (scope: unknown): boolean => {
    const scopeText = typeof scope === 'string' ? scope.toLowerCase() : '';
    return scopeText.startsWith('self');
};

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

const buildBoardContext = (gameEnvView: AiGameEnvView, aiPlayerId: string): BoardContext => {
    const self = gameEnvView?.players?.[aiPlayerId];
    const opponentId = gameEnvView?.playerId_1 === aiPlayerId ? gameEnvView.playerId_2 : gameEnvView?.playerId_1;
    const opponent = opponentId ? gameEnvView?.players?.[opponentId] : undefined;
    const selfZones = self?.zones || {};
    const opponentZones = opponent?.zones || {};

    let selfUnitCount = 0;
    let selfReadyAttackers = 0;
    let selfDamagedTotal = 0;
    let opponentUnitCount = 0;
    let opponentReadyAttackers = 0;
    let openSelfUnitSlots = 0;

    for (const slotName of SLOT_NAMES) {
        const selfSlot = selfZones?.[slotName] as AiSlotView | undefined;
        const opponentSlot = opponentZones?.[slotName] as AiSlotView | undefined;

        if (selfSlot?.unit) {
            selfUnitCount += 1;
            if (canAttack(selfSlot.unit)) {
                selfReadyAttackers += 1;
            }
            const totalHp = typeof selfSlot?.fieldCardValue?.totalHP === 'number'
                ? selfSlot.fieldCardValue.totalHP
                : toNumber(selfSlot.unit.cardData?.hp, 0);
            const damage = typeof selfSlot?.fieldCardValue?.totalDamageReceived === 'number'
                ? toNumber(selfSlot.fieldCardValue.totalDamageReceived, 0)
                : toNumber(selfSlot.unit.damageReceived, 0);
            selfDamagedTotal += Math.max(0, Math.min(totalHp, damage));
        } else {
            openSelfUnitSlots += 1;
        }

        if (opponentSlot?.unit) {
            opponentUnitCount += 1;
            if (canAttack(opponentSlot.unit)) {
                opponentReadyAttackers += 1;
            }
        }
    }

    return {
        selfUnitCount,
        selfReadyAttackers,
        selfDamagedTotal,
        opponentUnitCount,
        opponentReadyAttackers,
        opponentShieldCount: toNumber(opponent?.zones?.shieldCount, 0),
        openSelfUnitSlots,
        handSize: Array.isArray(self?.deck?.hand) ? self.deck.hand.length : 0
    };
};

const getUnitSnapshot = (gameEnvView: AiGameEnvView, carduid: string): UnitSnapshot | null => {
    const players = gameEnvView?.players || {};
    for (const [playerId, player] of Object.entries(players)) {
        const zones = player?.zones || {};
        for (const slotName of SLOT_NAMES) {
            const slot = zones?.[slotName] as AiSlotView | undefined;
            const unit = slot?.unit;
            if (!unit || unit.carduid !== carduid) {
                continue;
            }
            const totalAP = typeof slot?.fieldCardValue?.totalAP === 'number'
                ? slot.fieldCardValue.totalAP
                : toNumber(unit?.cardData?.ap, 0);
            const totalHP = typeof slot?.fieldCardValue?.totalHP === 'number'
                ? slot.fieldCardValue.totalHP
                : toNumber(unit?.cardData?.hp, 0);
            const remainingHp = typeof slot?.fieldCardValue?.totalHP === 'number'
                ? Math.max(0, slot.fieldCardValue.totalHP)
                : Math.max(0, totalHP - toNumber(unit?.damageReceived, 0));
            const damage = typeof slot?.fieldCardValue?.totalDamageReceived === 'number'
                ? toNumber(slot.fieldCardValue.totalDamageReceived, 0)
                : toNumber(unit?.damageReceived, 0);
            return {
                ap: totalAP,
                hp: totalHP,
                remainingHp,
                damage,
                isRested: Boolean(unit?.isRested)
            };
        }
    }

    return null;
};

const evaluateTargets = (
    context: DecisionContext,
    command: CommandCardCandidate,
    effect: EffectDefinition,
    targetConfig: ResolvedTargetConfig
): TargetEvaluation | null => {
    const availableTargets = TargetResolver.generateAvailableTargets(
        context.adapter as unknown as GameEnvironment,
        context.aiPlayerId,
        targetConfig,
        command.carduid
    );
    if (!Array.isArray(availableTargets) || availableTargets.length === 0) {
        return null;
    }

    const targetCount = Math.max(1, Math.min(targetConfig.count || 1, availableTargets.length));
    const rankedTargets = availableTargets
        .map((target) => ({
            target,
            score: scoreCommandTarget(context, effect, target, targetConfig.scope)
        }))
        .sort((left, right) => right.score - left.score);

    if (rankedTargets.length === 0 || rankedTargets[0].score <= -25) {
        return null;
    }

    const selected = rankedTargets.slice(0, targetCount);
    return {
        selectedTargets: selected.map((entry) => entry.target),
        score: selected.reduce((total, entry) => total + entry.score, 0)
    };
};

const scoreCommandTarget = (
    context: DecisionContext,
    effect: EffectDefinition,
    target: TargetReference,
    scope: unknown
): number => {
    const baseScore = scoreTargetForAction(context.gameEnvView, target, effect, scope);
    const action = typeof effect.action === 'string' ? effect.action : '';
    const snapshot = getUnitSnapshot(context.gameEnvView, target.carduid);
    if (!snapshot) {
        return baseScore;
    }

    const targetingSelf = target.playerId === context.aiPlayerId;
    let bonus = 0;

    if (action === 'heal' || action === 'repair' || action === 'modifyHP') {
        bonus += targetingSelf ? snapshot.damage * 7 : -50;
        if (snapshot.damage <= 0 && targetingSelf) {
            bonus -= 45;
        }
    }

    if (action === 'damage' || action === 'destroy' || action === 'returnToHand') {
        bonus += targetingSelf ? -45 : snapshot.ap * 3 + snapshot.remainingHp * 2;
        const effectDamage = toNumber(effect.parameters?.value, 0);
        if (action === 'damage' && effectDamage > 0 && effectDamage >= snapshot.remainingHp && !targetingSelf) {
            bonus += 16;
        }
    }

    if (action === 'rest') {
        if (targetingSelf) {
            bonus -= 40;
        } else if (!snapshot.isRested) {
            bonus += 20;
        }
    }

    if (action === 'modifyAP') {
        const delta = toNumber(effect.parameters?.value, 0);
        if (!targetingSelf && delta < 0) {
            bonus += snapshot.ap * 3;
        }
        if (targetingSelf && delta > 0) {
            bonus += context.boardContext.selfReadyAttackers > 0 ? snapshot.ap * 2 + 10 : -15;
        }
    }

    if (action === 'setActive') {
        bonus += targetingSelf && snapshot.isRested ? 24 : -20;
    }

    return baseScore + bonus;
};

const scoreCommandAction = (
    context: DecisionContext,
    command: CommandCardCandidate,
    effect: EffectDefinition,
    targetEvaluation: TargetEvaluation | null,
    scope: unknown,
    playstyle: AiPlaystyle
): number => {
    const action = typeof effect.action === 'string' ? effect.action : '';
    const base = ACTION_BASE_SCORE[action] ?? 9;
    const costScore = Math.max(0, 5 - command.cost) * 2.2;
    const levelScore = Math.max(0, 5 - command.level) * 1.4;
    const targetScore = targetEvaluation ? targetEvaluation.score * ACTION_WEIGHT_SCALE : 0;
    const actionMultiplier = getActionPlaystyleMultiplier(playstyle, action, scope);

    let score = base + costScore + levelScore + targetScore;
    const board = context.boardContext;

    switch (action) {
        case 'draw':
            score += board.handSize <= 4 ? 12 : 4;
            if (board.handSize >= 8) {
                score -= 16;
            }
            break;
        case 'addExtraEnergy':
        case 'addBasicEnergy':
            score += board.selfUnitCount <= 1 ? 10 : 4;
            break;
        case 'conditionalTokenDeploy':
        case 'deploy_from_hand':
            score += board.openSelfUnitSlots > 0 ? 10 + board.openSelfUnitSlots * 3 : -24;
            break;
        case 'damageShield':
            score += board.opponentShieldCount === 0 ? 12 : 7;
            break;
        case 'heal':
        case 'repair':
        case 'modifyHP':
            score += board.selfDamagedTotal > 0 ? Math.min(22, board.selfDamagedTotal * 5) : -38;
            break;
        case 'modifyAP':
            if (isOpponentScope(scope)) {
                score += board.opponentReadyAttackers > 0 ? 12 : 2;
            } else if (isSelfScope(scope)) {
                score += board.selfReadyAttackers > 0 ? 14 : -18;
            }
            break;
        case 'setActive':
            score += board.selfReadyAttackers > 0 ? 8 : 3;
            break;
        case 'rest':
            score += board.opponentReadyAttackers > 0 ? 18 : 6;
            break;
        case 'damage':
        case 'destroy':
        case 'returnToHand':
            score += board.opponentUnitCount > 0 ? 14 : -20;
            break;
        case 'allow_attack_target':
        case 'grant_breach':
        case 'grant_keyword':
            score += board.selfReadyAttackers > 0 ? 10 : -8;
            break;
        case 'prevent_shield_damage':
        case 'prevent_battle_damage':
            score += context.gameEnvView.currentBattle ? 12 : -22;
            break;
        case 'scry_top_deck':
            score += board.handSize <= 3 ? 6 : 2;
            break;
        default:
            break;
    }

    return score * actionMultiplier;
};

const buildPayloadTargets = (targets: TargetReference[]): {
    targetCarduid?: string;
    targets?: Array<{ carduid: string; zone: string; playerId: string }>;
} => {
    if (targets.length === 1) {
        return { targetCarduid: targets[0].carduid };
    }

    return {
        targets: targets.map((target) => ({
            carduid: target.carduid,
            zone: target.zone,
            playerId: target.playerId
        }))
    };
};

const toCommandCard = (card: AiHandCard): CommandCardCandidate | null => {
    if (!isCommandCard(card)) {
        return null;
    }

    const effectiveCost = toNumber(card.cardData.effectiveCost ?? card.cardData.cost, 0);
    const effectiveLevel = toNumber(card.cardData.effectiveLevel ?? card.cardData.level, 0);
    return {
        carduid: card.carduid,
        cardData: card.cardData,
        cost: effectiveCost,
        level: effectiveLevel
    };
};

const buildDecisionForCommandEffect = (
    context: DecisionContext,
    command: CommandCardCandidate,
    effect: EffectDefinition,
    playstyle: AiPlaystyle
): DecisionCandidate | null => {
    if (!effect.effectId || !effect.action) {
        return null;
    }

    const requiresTargets = !EffectExecutor.actionSupportsNoTargets(effect.action);
    let targetEvaluation: TargetEvaluation | null = null;
    let targetScope: unknown = effect.target?.scope;

    if (requiresTargets) {
        const targetConfig = TargetResolver.resolveTargetConfig(effect);
        targetScope = targetConfig.scope;
        targetEvaluation = evaluateTargets(context, command, effect, targetConfig);
        if (!targetEvaluation || targetEvaluation.selectedTargets.length === 0) {
            return null;
        }
    }

    const score = scoreCommandAction(context, command, effect, targetEvaluation, targetScope, playstyle);
    const payloadTargets = targetEvaluation
        ? buildPayloadTargets(targetEvaluation.selectedTargets)
        : {};

    return {
        score,
        decision: {
            kind: 'playerAction',
            reason: `use_command_${effect.action}`,
            payload: {
                actionType: 'useCommandCard',
                carduid: command.carduid,
                effectId: effect.effectId,
                ...payloadTargets
            }
        }
    };
};

export function findBestCommandAction(gameEnvView: AiGameEnvView, aiPlayerId: string): AiDecision | null {
    const self = gameEnvView?.players?.[aiPlayerId];
    const hand = Array.isArray(self?.deck?.hand) ? self.deck.hand : [];
    if (hand.length === 0) {
        return null;
    }

    const phase = resolvePhase(gameEnvView?.phase);
    if (!phase) {
        return null;
    }
    const playstyle = getAiPlaystyle();

    const availableEnergy = getAvailableEnergyCount(self);
    const totalEnergy = getTotalEnergyCount(self);
    const context: DecisionContext = {
        gameEnvView,
        aiPlayerId,
        boardContext: buildBoardContext(gameEnvView, aiPlayerId),
        adapter: buildViewAdapter(gameEnvView)
    };

    const decisions: DecisionCandidate[] = [];

    for (const handCard of hand) {
        const command = toCommandCard(handCard);
        if (!command) {
            continue;
        }
        if (command.cost > availableEnergy || command.level > totalEnergy) {
            continue;
        }

        const rules = asEffectRules(command.cardData);
        for (const rule of rules) {
            if (!isPlayOrActivatedEffect(rule)) {
                continue;
            }
            if (!EffectTimingWindowUtils.allowsPhase(rule, phase, { defaultToMainPhaseWhenMissing: true })) {
                continue;
            }
            const candidate = buildDecisionForCommandEffect(context, command, rule, playstyle);
            if (!candidate) {
                continue;
            }
            decisions.push(candidate);
        }
    }

    if (decisions.length === 0) {
        return null;
    }

    const best = decisions.sort((left, right) => right.score - left.score)[0];
    const minScore = adjustDecisionThreshold(MIN_COMMAND_SCORE, playstyle);
    if (!best || best.score < minScore) {
        return null;
    }

    return {
        ...best.decision,
        reason: `${best.decision.reason}:${Math.round(best.score)}`
    };
}
