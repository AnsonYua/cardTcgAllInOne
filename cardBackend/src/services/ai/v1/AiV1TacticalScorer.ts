import type { AiActionCandidate, AiDecisionContext } from './AiV1Types';

const getActionType = (candidate: AiActionCandidate): string =>
    String(candidate.decision.payload?.actionType || candidate.telemetry?.actionType || '');

const getEffectAction = (candidate: AiActionCandidate): string =>
    String(candidate.telemetry?.action || '');

const estimateBurstRisk = (context: AiDecisionContext, attackerCarduid: string | undefined): number => {
    if (!attackerCarduid || context.opponent.shieldCount <= 0) {
        return 0;
    }
    const attacker = context.self.units.find((unit) => unit.carduid === attackerCarduid);
    if (!attacker) {
        return context.opponent.shieldCount * 3;
    }
    return context.opponent.shieldCount * 4 + (attacker.hp.remainingHp <= 2 ? 8 : 0);
};

const evaluateBoardState = (context: AiDecisionContext): number => {
    if (context.rawGameEnv?.gameEnded) {
        if (context.rawGameEnv.winnerId === context.aiPlayerId) {
            return 5000;
        }
        if (context.rawGameEnv.winnerId && context.rawGameEnv.winnerId !== context.aiPlayerId) {
            return -5000;
        }
    }

    return (
        context.self.totalBoardAp * 2.1
        + context.self.totalBoardHp * 1.9
        + context.self.readyAttackers * 8
        + context.self.shieldCount * 10
        + (context.self.hasBase ? 14 : 0)
        + context.self.blockers.length * 7
        - context.self.damagedUnits.length * 5
        - context.opponent.totalBoardAp * 1.9
        - context.opponent.totalBoardHp * 1.7
        - context.opponent.readyAttackers * 8
        - context.opponent.shieldCount * 9
        - (context.opponent.hasBase ? 10 : 0)
        - context.opponent.blockers.length * 5
        + context.opponent.damagedUnits.length * 4
    );
};

const scoreCandidate = (context: AiDecisionContext, candidate: AiActionCandidate, hasAlternativeActionStepPlay: boolean): number => {
    let score = candidate.estimatedScore;
    const actionType = getActionType(candidate);
    const effectAction = getEffectAction(candidate);

    if (context.windowKind === 'OWNED_PROMPT') {
        score += 1200;
    }
    if (context.windowKind === 'SETUP') {
        score += 300;
    }

    if (candidate.tags.includes('lethal_on_target')) {
        score += 120;
    }
    if (candidate.tags.includes('survives_trade')) {
        score += 35;
    }
    if (candidate.tags.includes('heals_key_unit')) {
        score += 40;
    }
    if (candidate.tags.includes('sets_up_kill_threshold')) {
        score += 18;
    }
    if (candidate.tags.includes('fails_to_kill')) {
        score -= 30;
    }
    if (candidate.tags.includes('dies_on_crackback')) {
        score -= 46;
    }

    if (actionType === 'attackShieldArea') {
        const attackerCarduid = String(candidate.decision.payload?.attackerCarduid || candidate.telemetry?.attackerCarduid || '');
        if (context.opponent.shieldCount === 0) {
            score += 2000;
        } else {
            score += 8;
            if (context.opponent.shieldCount <= 1) {
                score += 18;
            }
            score -= estimateBurstRisk(context, attackerCarduid);
        }
        if (context.self.readyAttackers > 1) {
            score += 10;
        }
    }

    if (actionType === 'attackUnit') {
        const targetCarduid = String(candidate.decision.payload?.targetUnitUid || candidate.telemetry?.targetCarduid || '');
        const target = context.opponent.units.find((unit) => unit.carduid === targetCarduid);
        if (target) {
            score += target.valueScore;
            if (target.keywords.includes('Blocker')) {
                score += 18;
            }
            if (target.canAttack) {
                score += 10;
            }
            if (context.self.readyAttackers > 1 && candidate.tags.includes('lethal_on_target')) {
                score += 12;
            }
        }
    }

    if (candidate.kind === 'playCard') {
        const playAs = String((candidate.decision.payload?.action as Record<string, unknown> | undefined)?.playAs || candidate.telemetry?.playAs || '');
        if (playAs === 'unit' && context.self.units.length < 3) {
            score += 12;
        }
        if (playAs === 'command' && context.self.readyAttackers === 0) {
            score -= 8;
        }
        if (playAs === 'pilot' && context.self.readyAttackers > 0) {
            score += 10;
        }
        if (playAs === 'pilot' && context.opponent.shieldCount === 0) {
            score += 12;
        }
        if (context.self.units.length >= 5 && context.opponent.readyAttackers > context.self.blockers.length + 1) {
            score -= 10;
        }
        if (playAs === 'unit' && context.self.readyAttackers > 0 && context.opponent.readyAttackers >= context.self.blockers.length + 1) {
            score -= 8;
        }
    }

    if (candidate.kind === 'activate') {
        if (context.windowKind === 'ACTION_STEP') {
            score += 20;
        }
        if (context.self.damagedUnits.length > 0 && candidate.tags.includes('heals_key_unit')) {
            score += 12;
        }
    }

    if (effectAction === 'damageShield') {
        score += context.opponent.shieldCount > 0 ? 24 : 6;
    }
    if (effectAction === 'modifyAP') {
        score += context.windowKind === 'ACTION_STEP' ? 24 : 14;
    }
    if (effectAction === 'modifyHP' || effectAction === 'heal' || effectAction === 'repair') {
        score += context.self.damagedUnits.length > 0 ? 18 : 6;
    }
    if (effectAction === 'grant_keyword') {
        score += 16;
    }
    if (effectAction === 'allow_attack_target') {
        score += 18;
    }
    if (effectAction === 'redirect_attack') {
        score += context.windowKind === 'ACTION_STEP' || context.windowKind === 'BLOCKER_STEP' ? 22 : 10;
    }
    if (effectAction === 'setActive') {
        score += context.self.readyAttackers > 0 ? 18 : 10;
    }
    if (effectAction === 'prevent_battle_damage') {
        score += context.windowKind === 'ACTION_STEP' ? 26 : 10;
    }
    if (effectAction === 'sequence' || effectAction === 'conditional') {
        score += 8;
    }

    if (candidate.kind === 'battleConfirm') {
        score += hasAlternativeActionStepPlay ? -35 : 18;
    }
    if (candidate.kind === 'battleResolve') {
        score += 20;
    }
    if (candidate.kind === 'endTurn') {
        score -= context.self.readyAttackers > 0 ? 18 : 0;
    }

    if (context.self.shieldCount === 0 && actionType === 'attackUnit' && candidate.tags.includes('lethal_on_target')) {
        score += 20;
    }

    return score;
};

export const scoreAiCandidates = (context: AiDecisionContext, candidates: AiActionCandidate[]): AiActionCandidate[] => {
    const hasAlternativeActionStepPlay = candidates.some((candidate) => candidate.kind === 'activate');
    return candidates
        .map((candidate) => {
            const tacticalScore = scoreCandidate(context, candidate, hasAlternativeActionStepPlay);
            return {
                ...candidate,
                tacticalScore,
                totalScore: tacticalScore
            };
        })
        .sort((left, right) => (right.totalScore || 0) - (left.totalScore || 0));
};

export { evaluateBoardState };
