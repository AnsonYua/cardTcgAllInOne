import { GamePhase } from '../../models/GameEnums';
import { EffectTimingWindowUtils } from '../../utils/EffectTimingWindowUtils';
import { effectRequiresLinkedSource } from '../../utils/ImplicitEffectConditionUtils';
import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { TargetResolver } from '../targets/TargetResolver';
import { EffectExecutor } from '../effects/EffectExecutor';
import { SlotCardStateUtils } from '../conditions/SlotCardStateUtils';
import { buildViewAdapter, scoreTargetForAction } from './AiTargetUtils';
import { getAvailableEnergyCount } from './AiEnergyUtils';
import { SLOT_NAMES, type AiDecision } from './AiTypes';
import {
    adjustDecisionThreshold,
    getActionPlaystyleMultiplier,
    getAiPlaystyle,
    type AiPlaystyle
} from './AiPlaystyleConfig';
import type { AiGameEnvView, AiSlotView, AiUnitView } from './AiViewTypes';

const MIN_FIELD_ABILITY_SCORE = 24;
const TARGET_WEIGHT = 0.22;

const ACTION_BASE_SCORE: Record<string, number> = {
    destroy: 36,
    returnToHand: 34,
    damage: 32,
    rest: 26,
    conditionalTokenDeploy: 24,
    draw: 22,
    setActive: 20,
    modifyAP: 18,
    modifyHP: 16,
    heal: 15,
    repair: 15,
    addExtraEnergy: 14,
    addBasicEnergy: 12,
    allow_attack_target: 11,
    grant_breach: 10,
    grant_keyword: 9,
    sequence: 7
};

type ZoneSourceType = 'base' | 'unit' | 'pilot';

type SourceCardCandidate = {
    sourceType: ZoneSourceType;
    carduid: string;
    cardData: Record<string, unknown>;
    isRested: boolean;
    effectUsage: Record<string, { lastUsedTurn?: number; [key: string]: unknown }>;
};

type TargetEvaluation = {
    score: number;
    selectedTargets: TargetReference[];
};

type BoardContext = {
    selfReadyAttackers: number;
    selfDamagedTotal: number;
    selfRestedUnits: number;
    selfUnitCount: number;
    opponentReadyAttackers: number;
    opponentUnitCount: number;
    openSelfSlots: number;
};

type Candidate = {
    decision: AiDecision;
    score: number;
};

const GAME_PHASE_SET = new Set<string>(Object.values(GamePhase));

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

const asActivatedRules = (cardData: Record<string, unknown>): EffectDefinition[] => {
    const effects = cardData?.effects as { rules?: unknown } | undefined;
    const rules = Array.isArray(effects?.rules) ? effects.rules : [];
    return rules.filter(
        (rule): rule is EffectDefinition =>
            Boolean(
                rule
                && typeof rule === 'object'
                && typeof (rule as EffectDefinition).effectId === 'string'
                && (rule as EffectDefinition).type === 'activated'
            )
    );
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

const collectSources = (gameEnvView: AiGameEnvView, aiPlayerId: string): SourceCardCandidate[] => {
    const sources: SourceCardCandidate[] = [];
    const self = gameEnvView?.players?.[aiPlayerId];
    const zones = self?.zones || {};

    const bases = Array.isArray(zones.base) ? zones.base : [];
    for (const base of bases) {
        if (!base?.carduid || !base.cardData) {
            continue;
        }
        sources.push({
            sourceType: 'base',
            carduid: base.carduid,
            cardData: base.cardData as Record<string, unknown>,
            isRested: Boolean(base.isRested),
            effectUsage: (base.effectUsage || {}) as Record<string, { lastUsedTurn?: number; [key: string]: unknown }>
        });
    }

    for (const slotName of SLOT_NAMES) {
        const slot = zones?.[slotName] as AiSlotView | undefined;
        if (slot?.unit?.carduid && slot.unit.cardData) {
            sources.push({
                sourceType: 'unit',
                carduid: slot.unit.carduid,
                cardData: slot.unit.cardData as Record<string, unknown>,
                isRested: Boolean(slot.unit.isRested),
                effectUsage: (slot.unit.effectUsage || {}) as Record<string, { lastUsedTurn?: number; [key: string]: unknown }>
            });
        }
        if (slot?.pilot?.carduid && slot.pilot.cardData) {
            sources.push({
                sourceType: 'pilot',
                carduid: slot.pilot.carduid,
                cardData: slot.pilot.cardData as Record<string, unknown>,
                isRested: Boolean(slot.pilot.isRested),
                effectUsage: (slot.pilot.effectUsage || {}) as Record<string, { lastUsedTurn?: number; [key: string]: unknown }>
            });
        }
    }

    return sources;
};

const buildBoardContext = (gameEnvView: AiGameEnvView, aiPlayerId: string): BoardContext => {
    const self = gameEnvView?.players?.[aiPlayerId];
    const opponentId = gameEnvView?.playerId_1 === aiPlayerId ? gameEnvView.playerId_2 : gameEnvView?.playerId_1;
    const opponent = opponentId ? gameEnvView?.players?.[opponentId] : undefined;
    const selfZones = self?.zones || {};
    const opponentZones = opponent?.zones || {};

    let selfReadyAttackers = 0;
    let selfDamagedTotal = 0;
    let selfRestedUnits = 0;
    let selfUnitCount = 0;
    let opponentReadyAttackers = 0;
    let opponentUnitCount = 0;
    let openSelfSlots = 0;

    for (const slotName of SLOT_NAMES) {
        const selfSlot = selfZones?.[slotName] as AiSlotView | undefined;
        const opponentSlot = opponentZones?.[slotName] as AiSlotView | undefined;
        if (selfSlot?.unit) {
            selfUnitCount += 1;
            if (canAttack(selfSlot.unit)) {
                selfReadyAttackers += 1;
            }
            if (selfSlot.unit.isRested) {
                selfRestedUnits += 1;
            }
            const totalHp = typeof selfSlot?.fieldCardValue?.totalHP === 'number'
                ? selfSlot.fieldCardValue.totalHP
                : toNumber(selfSlot.unit.cardData?.hp, 0);
            const damage = toNumber(selfSlot.unit.damageReceived, 0);
            selfDamagedTotal += Math.max(0, Math.min(totalHp, damage));
        } else {
            openSelfSlots += 1;
        }

        if (opponentSlot?.unit) {
            opponentUnitCount += 1;
            if (canAttack(opponentSlot.unit)) {
                opponentReadyAttackers += 1;
            }
        }
    }

    return {
        selfReadyAttackers,
        selfDamagedTotal,
        selfRestedUnits,
        selfUnitCount,
        opponentReadyAttackers,
        opponentUnitCount,
        openSelfSlots
    };
};

const evaluateTargets = (
    gameEnvView: AiGameEnvView,
    aiPlayerId: string,
    sourceCarduid: string,
    effect: EffectDefinition
): TargetEvaluation | null => {
    const adapter = buildViewAdapter(gameEnvView);
    const targetConfig = TargetResolver.resolveTargetConfig(effect);
    const availableTargets = TargetResolver.generateAvailableTargets(
        adapter as unknown as GameEnvironment,
        aiPlayerId,
        targetConfig,
        sourceCarduid
    );
    if (!Array.isArray(availableTargets) || availableTargets.length === 0) {
        return null;
    }

    const selectCount = Math.max(1, Math.min(targetConfig.count || 1, availableTargets.length));
    const ranked = availableTargets
        .map((target) => ({
            target,
            score: scoreTargetForAction(gameEnvView, target, effect, targetConfig.scope)
        }))
        .sort((left, right) => right.score - left.score);

    if (ranked.length === 0 || ranked[0].score <= -20) {
        return null;
    }

    const selected = ranked.slice(0, selectCount);
    return {
        selectedTargets: selected.map((entry) => entry.target),
        score: selected.reduce((sum, entry) => sum + entry.score, 0)
    };
};

const scoreEffect = (
    boardContext: BoardContext,
    effect: EffectDefinition,
    sourceType: ZoneSourceType,
    targetEvaluation: TargetEvaluation | null,
    playstyle: AiPlaystyle
): number => {
    const action = typeof effect.action === 'string' ? effect.action : '';
    const scope = effect?.target?.scope;
    const actionMultiplier = getActionPlaystyleMultiplier(playstyle, action, scope);
    let score = ACTION_BASE_SCORE[action] ?? 10;
    score += targetEvaluation ? targetEvaluation.score * TARGET_WEIGHT : 0;

    switch (action) {
        case 'conditionalTokenDeploy':
            score += boardContext.openSelfSlots > 0 ? 14 + boardContext.openSelfSlots * 2 : -26;
            break;
        case 'setActive':
            score += boardContext.selfRestedUnits > 0 ? 14 : -22;
            break;
        case 'heal':
        case 'repair':
        case 'modifyHP':
            score += boardContext.selfDamagedTotal > 0 ? Math.min(22, boardContext.selfDamagedTotal * 4) : -35;
            break;
        case 'modifyAP':
            score += boardContext.selfReadyAttackers > 0 ? 10 : 2;
            break;
        case 'rest':
            score += boardContext.opponentReadyAttackers > 0 ? 12 : 4;
            break;
        case 'damage':
        case 'destroy':
        case 'returnToHand':
            score += boardContext.opponentUnitCount > 0 ? 14 : -24;
            break;
        case 'draw':
            score += 8;
            break;
        case 'allow_attack_target':
        case 'grant_breach':
        case 'grant_keyword':
            score += boardContext.selfReadyAttackers > 0 ? 10 : -8;
            break;
        default:
            break;
    }

    if (sourceType === 'base') {
        score += 2;
    }
    return score * actionMultiplier;
};

export function findBestFieldAbilityAction(gameEnvView: AiGameEnvView, aiPlayerId: string): AiDecision | null {
    const phase = resolvePhase(gameEnvView?.phase);
    if (!phase) {
        return null;
    }
    const playstyle = getAiPlaystyle();

    const self = gameEnvView?.players?.[aiPlayerId];
    const availableEnergy = getAvailableEnergyCount(self);
    const currentTurn = toNumber(gameEnvView?.currentTurn, 0);
    const boardContext = buildBoardContext(gameEnvView, aiPlayerId);
    const candidates: Candidate[] = [];
    const sources = collectSources(gameEnvView, aiPlayerId);

    for (const source of sources) {
        const rules = asActivatedRules(source.cardData);
        for (const rule of rules) {
            if (!rule.effectId) {
                continue;
            }
            if (!EffectTimingWindowUtils.allowsPhase(rule, phase, { defaultToMainPhaseWhenMissing: true })) {
                continue;
            }

            const cost = (rule.cost || {}) as Record<string, unknown>;
            if (cost.oncePerTurn === true) {
                const lastUsedTurn = source.effectUsage?.[rule.effectId]?.lastUsedTurn;
                if (typeof lastUsedTurn === 'number' && lastUsedTurn >= currentTurn) {
                    continue;
                }
            }

            const requiresRest = cost.restSelf === true || cost.rest === 'self' || cost.tap === 'self';
            if (requiresRest && source.isRested) {
                continue;
            }

            const energyCost = toNumber(cost.resource, 0);
            if (energyCost > availableEnergy) {
                continue;
            }

            if (
                effectRequiresLinkedSource(rule, source.cardData)
                && !SlotCardStateUtils.isCardLinked(gameEnvView as unknown as GameEnvironment, source.carduid)
            ) {
                continue;
            }

            let targetEvaluation: TargetEvaluation | null = null;
            const action = EffectExecutor.getEffectAction(rule);
            if (!EffectExecutor.actionSupportsNoTargets(action)) {
                targetEvaluation = evaluateTargets(gameEnvView, aiPlayerId, source.carduid, rule);
                if (!targetEvaluation) {
                    continue;
                }
            }

            const score = scoreEffect(boardContext, rule, source.sourceType, targetEvaluation, playstyle) - energyCost * 2.2;
            candidates.push({
                score,
                decision: {
                    kind: 'playerAction',
                    reason: `activate_${action || 'ability'}:${Math.round(score)}`,
                    payload: {
                        actionType: 'activateCardAbility',
                        carduid: source.carduid,
                        effectId: rule.effectId
                    }
                }
            });
        }
    }

    if (candidates.length === 0) {
        return null;
    }

    const best = candidates.sort((left, right) => right.score - left.score)[0];
    const minScore = adjustDecisionThreshold(MIN_FIELD_ABILITY_SCORE, playstyle);
    if (!best || best.score < minScore) {
        return null;
    }

    return best.decision;
}
