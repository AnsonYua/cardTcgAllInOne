import { getEffectPlayMode } from '../../effects/EffectActionAccess';
import { enumerateCommandActionCandidates } from '../AiCommandPlanner';
import { getAvailableEnergyCount, getTotalEnergyCount } from '../AiEnergyUtils';
import { enumerateFieldAbilityCandidates } from '../AiFieldAbilityPlanner';
import { SLOT_NAMES, type AiDecision } from '../AiTypes';
import { extractTargetCount, scoreTargetForAction } from '../AiTargetUtils';
import type {
    AiActionCandidate,
    AiActionCandidateTag,
    AiActionAdapter,
    AiDecisionContext
} from './AiV1Types';

type PlayableCard = {
    carduid: string;
    cardType: string;
    cost: number;
    level: number;
    cardData: Record<string, unknown>;
};

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const sortRecordKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map((entry) => sortRecordKeys(entry));
    }
    if (value && typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>)
            .sort()
            .reduce<Record<string, unknown>>((accumulator, key) => {
                accumulator[key] = sortRecordKeys((value as Record<string, unknown>)[key]);
                return accumulator;
            }, {});
    }
    return value;
};

const buildCandidateId = (
    kind: AiActionCandidate['kind'],
    decision: AiDecision,
    telemetry: Record<string, unknown>,
    tags: AiActionCandidateTag[]
): string => JSON.stringify(sortRecordKeys({
    kind,
    decisionKind: decision.kind,
    reason: decision.reason,
    payload: decision.payload || {},
    telemetry,
    tags
}));

const buildTargetCombinations = <T>(
    entries: T[],
    selectionSize: number,
    limit: number
): T[][] => {
    if (selectionSize <= 0 || entries.length < selectionSize) {
        return [];
    }

    const combinations: T[][] = [];
    const stack: T[] = [];

    const walk = (startIndex: number): void => {
        if (combinations.length >= limit) {
            return;
        }
        if (stack.length === selectionSize) {
            combinations.push([...stack]);
            return;
        }
        for (let index = startIndex; index < entries.length; index += 1) {
            stack.push(entries[index]);
            walk(index + 1);
            stack.pop();
            if (combinations.length >= limit) {
                return;
            }
        }
    };

    walk(0);
    return combinations;
};

const createCandidate = (
    kind: AiActionCandidate['kind'],
    windowKind: AiActionCandidate['windowKind'],
    decision: AiDecision,
    estimatedScore: number,
    tags: AiActionCandidateTag[] = [],
    telemetry: Record<string, unknown> = {}
): AiActionCandidate => ({
    candidateId: buildCandidateId(kind, decision, telemetry, tags),
    kind,
    decision,
    windowKind,
    estimatedScore,
    tags,
    telemetry,
    requiresSimulation: kind === 'prompt'
        || kind === 'attack'
        || kind === 'playCard'
        || kind === 'activate'
        || kind === 'battleConfirm'
        || kind === 'battleResolve'
        || kind === 'endTurn'
});

const canAttack = (unit: { canAttackThisTurn?: boolean; isRested?: boolean; playedThisTurn?: boolean; canAttackOnPlayTurn?: boolean } | undefined): boolean => {
    if (!unit) {
        return false;
    }
    if (typeof unit.canAttackThisTurn === 'boolean') {
        return unit.canAttackThisTurn;
    }
    return !Boolean(unit.isRested) && (!Boolean(unit.playedThisTurn) || Boolean(unit.canAttackOnPlayTurn));
};

const listEffectActions = (cardData: Record<string, unknown>): string[] => {
    const effects = asRecord(cardData.effects);
    const rules = Array.isArray(effects.rules) ? effects.rules : [];
    return rules
        .map((rule) => asRecord(rule))
        .map((rule) => asString(rule.action) || asString(rule.operation))
        .filter((entry) => entry.length > 0);
};

const tagsForAttack = (
    context: AiDecisionContext,
    attackerCarduid: string,
    targetCarduid: string | null
): AiActionCandidateTag[] => {
    const attacker = context.self.units.find((unit) => unit.carduid === attackerCarduid);
    if (!attacker || !targetCarduid) {
        return [];
    }
    const target = context.opponent.units.find((unit) => unit.carduid === targetCarduid);
    if (!target) {
        return [];
    }

    const tags: AiActionCandidateTag[] = [];
    if (attacker.ap >= target.hp.remainingHp) {
        tags.push('lethal_on_target');
    } else {
        tags.push('fails_to_kill');
        if (attacker.ap > 0 && attacker.ap < target.hp.remainingHp) {
            tags.push('sets_up_kill_threshold');
        }
    }
    if (target.ap < attacker.hp.remainingHp || attacker.keywords.includes('First Strike')) {
        tags.push('survives_trade');
    } else {
        tags.push('dies_on_crackback');
    }
    return tags;
};

const tagsForCardEffects = (
    context: AiDecisionContext,
    effectActions: string[]
): AiActionCandidateTag[] => {
    const tags = new Set<AiActionCandidateTag>();
    if (effectActions.some((action) => action === 'heal' || action === 'repair' || action === 'modifyHP') && context.self.damagedUnits.length > 0) {
        tags.add('heals_key_unit');
    }
    return Array.from(tags);
};

const buildAbilityCandidates = (context: AiDecisionContext): AiActionCandidate[] => {
    const commandCandidates = enumerateCommandActionCandidates(context.gameEnvView, context.aiPlayerId, { maxTargetVariants: 3 })
        .map((candidate) =>
            ({
                ...createCandidate(
                    'activate',
                    context.windowKind,
                    candidate.decision,
                    candidate.score,
                    tagsForCardEffects(context, candidate.action ? [candidate.action] : []),
                    {
                        source: 'command_planner',
                        action: candidate.action,
                        carduid: candidate.carduid,
                        effectId: candidate.effectId,
                        selectedTargets: candidate.selectedTargets?.map((target) => ({
                            carduid: target.carduid,
                            zone: target.zone,
                            playerId: target.playerId
                        }))
                    }
                ),
                targetCarduid: typeof candidate.decision.payload?.targetCarduid === 'string'
                    ? (candidate.decision.payload?.targetCarduid as string)
                    : undefined
            })
        );

    const fieldAbilityCandidates = enumerateFieldAbilityCandidates(context.gameEnvView, context.aiPlayerId, { maxTargetVariants: 3 })
        .map((candidate) =>
            ({
                ...createCandidate(
                    'activate',
                    context.windowKind,
                    candidate.decision,
                    candidate.score,
                    tagsForCardEffects(context, candidate.action ? [candidate.action] : []),
                    {
                        source: 'field_ability_planner',
                        action: candidate.action,
                        carduid: candidate.carduid,
                        effectId: candidate.effectId,
                        sourceType: candidate.sourceType,
                        selectedTargets: candidate.selectedTargets?.map((target) => ({
                            carduid: target.carduid,
                            zone: target.zone,
                            playerId: target.playerId
                        }))
                    }
                ),
                targetCarduid: candidate.selectedTargets?.length === 1
                    ? candidate.selectedTargets[0].carduid
                    : undefined
            })
        );

    return [...commandCandidates, ...fieldAbilityCandidates];
};

const buildSetupCandidates = (context: AiDecisionContext): AiActionCandidate[] => {
    if (context.phase === 'DECIDE_FIRST_PLAYER_PHASE' && context.gameEnvView.firstPlayerChooser === context.aiPlayerId) {
        return [
            createCandidate(
                'setup',
                context.windowKind,
                {
                    kind: 'chooseFirstPlayer',
                    reason: 'v1_choose_first_player',
                    payload: {
                        chosenFirstPlayerId: context.aiPlayerId
                    }
                },
                80
            )
        ];
    }

    const self = context.gameEnvView.players?.[context.aiPlayerId];
    if (context.phase === 'REDRAW_PHASE' && !self?.confirmIsRedraw) {
        return [
            createCandidate(
                'setup',
                context.windowKind,
                {
                    kind: 'startReady',
                    reason: 'v1_confirm_redraw',
                    payload: {
                        isRedraw: false
                    }
                },
                60
            )
        ];
    }

    return [];
};

const buildPromptCandidates = (context: AiDecisionContext): AiActionCandidate[] => {
    const prompt = context.activePrompt;
    if (!prompt) {
        return [];
    }

    if (prompt.type === 'BURST_EFFECT_CHOICE') {
        return [
            createCandidate(
                'prompt',
                context.windowKind,
                {
                    kind: 'confirmBurstChoice',
                    reason: 'v1_burst_activate',
                    payload: {
                        eventId: prompt.eventId,
                        confirmed: true
                    }
                },
                18,
                [],
                { promptType: prompt.type, confirmed: true }
            ),
            createCandidate(
                'prompt',
                context.windowKind,
                {
                    kind: 'confirmBurstChoice',
                    reason: 'v1_burst_decline',
                    payload: {
                        eventId: prompt.eventId,
                        confirmed: false
                    }
                },
                6,
                [],
                { promptType: prompt.type, confirmed: false }
            )
        ];
    }

    if (prompt.type === 'TARGET_CHOICE') {
        const effect = asRecord(prompt.rawEvent?.data).effect as Record<string, unknown> | undefined;
        const targetCount = extractTargetCount(asRecord(effect?.target).count);
        const rankedTargets = prompt.availableTargets
            .map((target) => ({
                target,
                score: scoreTargetForAction(
                    context.gameEnvView,
                    target,
                    effect || {},
                    asRecord(effect?.target).scope
                )
            }))
            .sort((left, right) => right.score - left.score);
        const bestScore = rankedTargets[0]?.score ?? 0;
        const targetPoolSize = Math.min(
            rankedTargets.length,
            Math.max(targetCount, 6)
        );
        const targetSelections = buildTargetCombinations(
            rankedTargets.slice(0, targetPoolSize),
            targetCount,
            3
        );
        const candidates = targetSelections.map((selectedEntries, selectionIndex) => {
            const selectedTargets = selectedEntries.map((entry) => entry.target);
            const selectionScore = selectedEntries.reduce((sum, entry) => sum + entry.score, 0);
            return createCandidate(
                'prompt',
                context.windowKind,
                {
                    kind: 'confirmTargetChoice',
                    reason: `v1_target_choice:${selectionIndex}`,
                    payload: {
                        eventId: prompt.eventId,
                        selectedTargets
                    }
                },
                20 + selectionScore,
                [],
                {
                    promptType: prompt.type,
                    selectedTargetCount: selectedTargets.length,
                    selectedTargets: selectedTargets.map((target) => ({
                        carduid: target.carduid,
                        zone: target.zone,
                        playerId: target.playerId
                    })),
                    effectAction: prompt.effectAction
                }
            );
        });

        if (prompt.allowsDecline) {
            candidates.push(createCandidate(
                'prompt',
                context.windowKind,
                {
                    kind: 'confirmTargetChoice',
                    reason: 'v1_target_decline',
                    payload: {
                        eventId: prompt.eventId,
                        selectedTargets: []
                    }
                },
                bestScore < 0 ? 22 : -5,
                [],
                { promptType: prompt.type, declined: true }
            ));
        }

        return candidates;
    }

    if (prompt.type === 'BLOCKER_CHOICE') {
        const declineCandidate = createCandidate(
            'prompt',
            context.windowKind,
            {
                kind: 'confirmBlockerChoice',
                reason: 'v1_blocker_decline',
                payload: {
                    eventId: prompt.eventId,
                    selectedTargets: []
                }
            },
            4,
            [],
            { promptType: prompt.type, declined: true }
        );

        const blockCandidates = prompt.availableTargets.map((target) => {
            const targetUnit = context.self.units.find((unit) => unit.carduid === target.carduid);
            const score = (targetUnit?.hp.remainingHp || 0) + (targetUnit?.ap || 0) + (targetUnit?.keywords.includes('Blocker') ? 10 : 0);
            return createCandidate(
                'prompt',
                context.windowKind,
                {
                    kind: 'confirmBlockerChoice',
                    reason: 'v1_blocker_choice',
                    payload: {
                        eventId: prompt.eventId,
                        selectedTargets: [target]
                    }
                },
                28 + score,
                targetUnit?.hp.remainingHp && targetUnit.hp.remainingHp > 1 ? ['survives_trade'] : [],
                { promptType: prompt.type, blockerCarduid: target.carduid }
            );
        });

        return [...blockCandidates, declineCandidate];
    }

    if (prompt.type === 'TOKEN_CHOICE') {
        return prompt.availableChoices.map((choice, index) =>
            createCandidate(
                'prompt',
                context.windowKind,
                {
                    kind: 'confirmTokenChoice',
                    reason: 'v1_token_choice',
                    payload: {
                        eventId: prompt.eventId,
                        selectedChoiceIndex: Number(choice.index ?? index)
                    }
                },
                18 + Number(choice.count || 0) * 4,
                [],
                { promptType: prompt.type, selectedChoiceIndex: Number(choice.index ?? index) }
            )
        );
    }

    if (prompt.type === 'OPTION_CHOICE' || prompt.type === 'PROMPT_CHOICE') {
        return prompt.availableOptions.map((option, index) => {
            const label = asString(option.label).toLowerCase();
            const baseScore = label.includes('decline') || label.includes('cancel') || label.includes('skip')
                ? 3
                : 18;
            const defaultBonus = Number(option.index ?? index) === prompt.defaultOptionIndex ? 4 : 0;

            return createCandidate(
                'prompt',
                context.windowKind,
                {
                    kind: 'confirmOptionChoice',
                    reason: 'v1_option_choice',
                    payload: {
                        eventId: prompt.eventId,
                        selectedOptionIndex: Number(option.index ?? index)
                    }
                },
                baseScore + defaultBonus,
                [],
                {
                    promptType: prompt.type,
                    selectedOptionIndex: Number(option.index ?? index),
                    optionLabel: asString(option.label)
                }
            );
        });
    }

    return [];
};

const buildAttackCandidates = (context: AiDecisionContext): AiActionCandidate[] => {
    if (context.currentPlayerId !== context.aiPlayerId) {
        return [];
    }

    const candidates: AiActionCandidate[] = [];
    for (const attacker of context.self.units) {
        if (!attacker.canAttack) {
            continue;
        }

        if (attacker.canAttackPlayer) {
            const shieldScore = context.opponent.shieldCount === 0
                ? 180
                : 8 + attacker.ap + (attacker.keywords.includes('Breach') ? 16 : 0);
            candidates.push(createCandidate(
                'attack',
                context.windowKind,
                {
                    kind: 'playerAction',
                    reason: context.opponent.shieldCount === 0 ? 'v1_lethal_shield_attack' : 'v1_shield_attack',
                    payload: {
                        actionType: 'attackShieldArea',
                        attackerCarduid: attacker.carduid
                    }
                },
                shieldScore,
                [],
                {
                    actionType: 'attackShieldArea',
                    attackerCarduid: attacker.carduid
                }
            ));
        }

        for (const target of context.opponent.units) {
            if (!target.isRested && !attacker.canAttackActiveUnit) {
                continue;
            }
            const killBonus = attacker.ap >= target.hp.remainingHp ? 42 : 0;
            const score = 14 + killBonus + target.valueScore - (target.ap >= attacker.hp.remainingHp ? 18 : 0);
            candidates.push({
                ...createCandidate(
                    'attack',
                    context.windowKind,
                    {
                        kind: 'playerAction',
                        reason: 'v1_unit_attack',
                        payload: {
                            actionType: 'attackUnit',
                            attackerCarduid: attacker.carduid,
                            targetPlayerId: context.opponentId,
                            targetUnitUid: target.carduid
                        }
                    },
                    score,
                    tagsForAttack(context, attacker.carduid, target.carduid),
                    {
                        actionType: 'attackUnit',
                        attackerCarduid: attacker.carduid,
                        targetCarduid: target.carduid
                    }
                ),
                sourceCarduid: attacker.carduid,
                targetCarduid: target.carduid
            });
        }
    }

    return candidates;
};

const buildBlockerStepCandidates = (context: AiDecisionContext): AiActionCandidate[] => [
    ...buildPromptCandidates(context),
    ...buildBattleCandidates(context)
];

const buildPlayCandidates = (context: AiDecisionContext): AiActionCandidate[] => {
    if (context.windowKind !== 'MAIN_PHASE') {
        return [];
    }

    const self = context.gameEnvView.players?.[context.aiPlayerId];
    const hand = Array.isArray(self?.deck?.hand) ? self.deck.hand : [];
    const availableEnergy = getAvailableEnergyCount(self);
    const totalEnergy = getTotalEnergyCount(self);
    const unitsWithoutPilot = context.self.units.filter((unit) => !unit.slot?.pilot);
    const emptySlotNames = SLOT_NAMES.filter((slotName) => !(self?.zones?.[slotName] as { unit?: unknown } | undefined)?.unit);
    const replacementSlots = emptySlotNames.length === 0
        ? [...context.self.units]
            .sort((left, right) => (left.valueScore + left.hp.remainingHp) - (right.valueScore + right.hp.remainingHp))
            .map((unit) => unit.slotName)
        : [];

    const playableCards = hand
        .map((handCard) => {
            const cardData = asRecord(handCard.cardData);
            const cost = Number(cardData.effectiveCost ?? cardData.cost ?? 0);
            const level = Number(cardData.effectiveLevel ?? cardData.level ?? 0);
            const cardType = asString(cardData.cardType);
            const carduid = asString(handCard.carduid);
            if (!carduid || !cardType || cost > availableEnergy || level > totalEnergy) {
                return null;
            }
            return {
                carduid,
                cardType,
                cost,
                level,
                cardData
            } as PlayableCard;
        })
        .filter((entry): entry is PlayableCard => Boolean(entry));

    const candidates: AiActionCandidate[] = [];
    for (const card of playableCards) {
        const effectActions = listEffectActions(card.cardData);
        const effectTags = tagsForCardEffects(context, effectActions);
        const name = asString(card.cardData.name) || card.carduid;

        if (card.cardType === 'base' && !context.self.hasBase) {
            candidates.push(createCandidate(
                'playCard',
                context.windowKind,
                {
                    kind: 'playCard',
                    reason: 'v1_establish_base',
                    payload: {
                        action: {
                            type: 'PlayCard',
                            carduid: card.carduid,
                            playAs: 'base'
                        }
                    }
                },
                44 + card.cost * 5,
                effectTags,
                { cardName: name, playAs: 'base', effectActions }
            ));
            continue;
        }

        if (card.cardType === 'unit') {
            const destinations = emptySlotNames.length > 0 ? emptySlotNames : replacementSlots;
            for (const destination of destinations) {
                const isReplacement = emptySlotNames.length === 0;
                candidates.push(createCandidate(
                    'playCard',
                    context.windowKind,
                    {
                        kind: 'playCard',
                        reason: isReplacement ? 'v1_replace_unit' : 'v1_play_unit',
                        payload: {
                            action: {
                                type: 'PlayCard',
                                carduid: card.carduid,
                                playAs: 'unit',
                                ...(isReplacement ? { replaceSlot: destination } : { slotName: destination })
                            }
                        }
                    },
                    26 + card.cost * 7 + (isReplacement ? 8 : 0),
                    effectTags,
                    {
                        cardName: name,
                        playAs: 'unit',
                        effectActions,
                        destinationSlot: destination,
                        isReplacement
                    }
                ));
            }
            continue;
        }

        if ((card.cardType === 'pilot' || card.cardType === 'command') && unitsWithoutPilot.length > 0) {
            const playMode = effectActions.length > 0
                ? effectActions[0]
                : '';
            const rules = Array.isArray(asRecord(card.cardData.effects).rules)
                ? asRecord(card.cardData.effects).rules as Record<string, unknown>[]
                : [];
            const canDesignatePilot = rules.some((rule) => getEffectPlayMode(rule as never) === 'designate_pilot');
            if (card.cardType === 'pilot' || canDesignatePilot) {
                for (const unitWithoutPilot of unitsWithoutPilot) {
                    candidates.push(createCandidate(
                        'playCard',
                        context.windowKind,
                        {
                            kind: 'playCard',
                            reason: card.cardType === 'pilot' ? 'v1_pair_pilot' : 'v1_pair_command_pilot',
                            payload: {
                                action: {
                                    type: 'PlayCard',
                                    carduid: card.carduid,
                                    playAs: 'pilot',
                                    targetUnit: unitWithoutPilot.carduid
                                }
                            }
                        },
                        24 + unitWithoutPilot.valueScore + card.cost * 4,
                        effectTags,
                        {
                            cardName: name,
                            playAs: 'pilot',
                            targetUnit: unitWithoutPilot.carduid,
                            effectActions,
                            playMode
                        }
                    ));
                }
                continue;
            }
        }

        if (card.cardType === 'command') {
            candidates.push(createCandidate(
                'playCard',
                context.windowKind,
                {
                    kind: 'playCard',
                    reason: 'v1_play_command',
                    payload: {
                        action: {
                            type: 'PlayCard',
                            carduid: card.carduid,
                            playAs: 'command'
                        }
                    }
                },
                16 + card.cost * 3 + effectActions.length * 4,
                effectTags,
                { cardName: name, playAs: 'command', effectActions }
            ));
        }
    }

    return candidates;
};

const buildBattleCandidates = (context: AiDecisionContext): AiActionCandidate[] => {
    if (!context.battle || !context.battle.aiParticipant) {
        return [];
    }

    if (context.battle.bothConfirmed) {
        return [
            createCandidate(
                'battleResolve',
                context.windowKind,
                {
                    kind: 'playerAction',
                    reason: 'v1_resolve_battle',
                    payload: {
                        actionType: 'resolveBattle'
                    }
                },
                40,
                [],
                { actionType: 'resolveBattle' }
            )
        ];
    }

    if (!context.battle.aiConfirmed) {
        return [
            createCandidate(
                'battleConfirm',
                context.windowKind,
                {
                    kind: 'playerAction',
                    reason: 'v1_confirm_battle',
                    payload: {
                        actionType: 'confirmBattle'
                    }
                },
                8,
                [],
                { actionType: 'confirmBattle' }
            )
        ];
    }

    return [];
};

const buildEndTurnCandidate = (context: AiDecisionContext): AiActionCandidate[] => {
    if (context.windowKind !== 'MAIN_PHASE') {
        return [];
    }
    return [
        createCandidate(
            'endTurn',
            context.windowKind,
            {
                kind: 'endTurn',
                reason: 'v1_end_turn'
            },
            -6
        )
    ];
};

export class GameEnvAiActionAdapter implements AiActionAdapter {
    enumerateCandidates(context: AiDecisionContext): AiActionCandidate[] {
        const candidates = (() => {
            switch (context.windowKind) {
            case 'SETUP':
                return buildSetupCandidates(context);
            case 'OWNED_PROMPT':
                return buildPromptCandidates(context);
            case 'BLOCKER_STEP':
                return buildBlockerStepCandidates(context);
            case 'ACTION_STEP':
                return [
                    ...buildAbilityCandidates(context),
                    ...buildBattleCandidates(context)
                ];
            case 'BATTLE_RESOLVE':
                return buildBattleCandidates(context);
            case 'MAIN_PHASE':
                return [
                    ...buildAbilityCandidates(context),
                    ...buildPlayCandidates(context),
                    ...buildAttackCandidates(context),
                    ...buildEndTurnCandidate(context)
                ];
            default:
                return [];
            }
        })();

        return candidates.sort((left, right) => left.candidateId.localeCompare(right.candidateId));
    }
}
