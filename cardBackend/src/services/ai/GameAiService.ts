type AiDecisionKind =
    | 'wait'
    | 'chooseFirstPlayer'
    | 'startReady'
    | 'playCard'
    | 'playerAction'
    | 'endTurn'
    | 'confirmBurstChoice'
    | 'confirmTargetChoice'
    | 'confirmBlockerChoice'
    | 'confirmTokenChoice'
    | 'confirmOptionChoice';

export interface AiDecision {
    kind: AiDecisionKind;
    reason: string;
    payload?: Record<string, unknown>;
}

const SLOT_NAMES = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];
const CHOICE_EVENT_TYPES = new Set([
    'BURST_EFFECT_CHOICE',
    'TARGET_CHOICE',
    'BLOCKER_CHOICE',
    'TOKEN_CHOICE',
    'OPTION_CHOICE',
    'PROMPT_CHOICE'
]);

export class GameAiService {
    static decide(gameEnvView: any, aiPlayerId: string): AiDecision {
        const scopeIssue = this.validateScopeMatrix(gameEnvView, aiPlayerId);
        if (scopeIssue) {
            return {
                kind: 'wait',
                reason: `scope_violation:${scopeIssue}`
            };
        }

        const players = gameEnvView?.players || {};
        const self = players[aiPlayerId];
        if (!self) {
            return { kind: 'wait', reason: 'self_not_found' };
        }

        const setupDecision = this.decideSetupPhase(gameEnvView, aiPlayerId);
        if (setupDecision) {
            return setupDecision;
        }

        const choiceDecision = this.decideChoiceIfPending(gameEnvView, aiPlayerId);
        if (choiceDecision) {
            return choiceDecision;
        }

        const battleDecision = this.decideActionStepConfirmation(gameEnvView, aiPlayerId);
        if (battleDecision) {
            return battleDecision;
        }

        if (gameEnvView?.currentPlayer !== aiPlayerId) {
            return { kind: 'wait', reason: 'not_my_turn' };
        }

        const opponentId = this.getOpponentId(gameEnvView, aiPlayerId);
        if (!opponentId || !players[opponentId]) {
            return { kind: 'wait', reason: 'opponent_not_found' };
        }

        const winAttack = this.findWinningShieldAttack(gameEnvView, aiPlayerId, opponentId);
        if (winAttack) {
            return winAttack;
        }

        const unitAttack = this.findBestUnitAttack(gameEnvView, aiPlayerId, opponentId);
        if (unitAttack) {
            return unitAttack;
        }

        const playCard = this.findBestPlayCard(gameEnvView, aiPlayerId);
        if (playCard) {
            return playCard;
        }

        const shieldAttack = this.findSafeShieldAttack(gameEnvView, aiPlayerId);
        if (shieldAttack) {
            return shieldAttack;
        }

        return {
            kind: 'endTurn',
            reason: 'no_better_action'
        };
    }

    private static validateScopeMatrix(gameEnvView: any, aiPlayerId: string): string | null {
        const players = gameEnvView?.players || {};
        for (const [playerId, playerData] of Object.entries(players)) {
            const player = playerData as any;
            const deck = player?.deck || {};
            const zones = player?.zones || {};

            if (playerId !== aiPlayerId) {
                if (Array.isArray(deck.hand) && deck.hand.length > 0) {
                    return 'opponent_hand_exposed';
                }
                if (Array.isArray(deck.handUids) && deck.handUids.length > 0) {
                    return 'opponent_handuids_exposed';
                }
            }

            if (Array.isArray(deck.mainDeck) && deck.mainDeck.length > 0) {
                return 'maindeck_identities_exposed';
            }

            const shieldArea = Array.isArray(zones.shieldArea) ? zones.shieldArea : [];
            for (const shield of shieldArea) {
                if ((shield as any)?.cardId || (shield as any)?.cardData) {
                    return 'shield_identity_exposed';
                }
            }
        }
        return null;
    }

    private static decideSetupPhase(gameEnvView: any, aiPlayerId: string): AiDecision | null {
        const phase = gameEnvView?.phase;
        if (phase === 'DECIDE_FIRST_PLAYER_PHASE') {
            if (gameEnvView?.firstPlayerChooser === aiPlayerId) {
                return {
                    kind: 'chooseFirstPlayer',
                    reason: 'ai_choose_first_player',
                    payload: {
                        chosenFirstPlayerId: aiPlayerId
                    }
                };
            }
            return null;
        }

        if (phase === 'REDRAW_PHASE') {
            const self = gameEnvView?.players?.[aiPlayerId];
            const alreadyReady = Boolean(self?.confirmIsRedraw);
            if (!alreadyReady) {
                return {
                    kind: 'startReady',
                    reason: 'ai_confirm_redraw_phase',
                    payload: {
                        isRedraw: false
                    }
                };
            }
            return null;
        }

        return null;
    }

    private static decideChoiceIfPending(gameEnvView: any, aiPlayerId: string): AiDecision | null {
        const queue = Array.isArray(gameEnvView?.processingQueue) ? gameEnvView.processingQueue : [];
        const head = queue[0];
        if (!head || head.status !== 'DECLARED' || !CHOICE_EVENT_TYPES.has(head.type)) {
            return null;
        }
        if (head.playerId !== aiPlayerId) {
            return null;
        }

        const data = head.data || {};
        const eventId = head.id;

        if (head.type === 'BURST_EFFECT_CHOICE') {
            return {
                kind: 'confirmBurstChoice',
                reason: 'resolve_burst_choice',
                payload: {
                    eventId,
                    confirmed: true
                }
            };
        }

        if (head.type === 'TARGET_CHOICE') {
            const availableTargets = Array.isArray(data.availableTargets) ? data.availableTargets : [];
            const count = this.extractTargetCount(data?.effect?.target?.count);
            return {
                kind: 'confirmTargetChoice',
                reason: 'resolve_target_choice',
                payload: {
                    eventId,
                    selectedTargets: availableTargets.slice(0, count)
                }
            };
        }

        if (head.type === 'BLOCKER_CHOICE') {
            const availableTargets = Array.isArray(data.availableTargets) ? data.availableTargets : [];
            const selected = availableTargets.length > 0 ? [availableTargets[0]] : [];
            return {
                kind: 'confirmBlockerChoice',
                reason: 'resolve_blocker_choice',
                payload: {
                    eventId,
                    selectedTargets: selected
                }
            };
        }

        if (head.type === 'TOKEN_CHOICE') {
            const availableChoices = Array.isArray(data.availableChoices) ? data.availableChoices : [];
            const selectedChoiceIndex = availableChoices[0]?.index ?? 0;
            return {
                kind: 'confirmTokenChoice',
                reason: 'resolve_token_choice',
                payload: {
                    eventId,
                    selectedChoiceIndex
                }
            };
        }

        if (head.type === 'OPTION_CHOICE' || head.type === 'PROMPT_CHOICE') {
            const availableOptions = Array.isArray(data.availableOptions) ? data.availableOptions : [];
            const selectedOptionIndex = typeof data.defaultOptionIndex === 'number'
                ? data.defaultOptionIndex
                : (availableOptions[0]?.index ?? 0);
            return {
                kind: 'confirmOptionChoice',
                reason: 'resolve_option_choice',
                payload: {
                    eventId,
                    selectedOptionIndex
                }
            };
        }

        return null;
    }

    private static decideActionStepConfirmation(gameEnvView: any, aiPlayerId: string): AiDecision | null {
        const battle = gameEnvView?.currentBattle;
        if (!battle || battle.status !== 'ACTION_STEP') {
            return null;
        }

        const isParticipant = battle.attackingPlayerId === aiPlayerId || battle.defendingPlayerId === aiPlayerId;
        if (!isParticipant) {
            return null;
        }

        const confirmations = battle.confirmations || {};
        if (confirmations[aiPlayerId] === true) {
            return null;
        }

        const queue = Array.isArray(gameEnvView?.processingQueue) ? gameEnvView.processingQueue : [];
        const hasPendingChoice = queue.some((event: any) => event?.status === 'DECLARED' && CHOICE_EVENT_TYPES.has(event?.type));
        if (hasPendingChoice) {
            return null;
        }

        return {
            kind: 'playerAction',
            reason: 'confirm_action_step',
            payload: {
                actionType: 'confirmBattle'
            }
        };
    }

    private static findWinningShieldAttack(gameEnvView: any, aiPlayerId: string, opponentId: string): AiDecision | null {
        const players = gameEnvView?.players || {};
        const opponent = players[opponentId];
        const opponentShieldCount = Number(opponent?.zones?.shieldCount || 0);
        if (opponentShieldCount > 0) {
            return null;
        }

        const attackers = this.getAttackers(gameEnvView, aiPlayerId);
        const best = attackers
            .filter((entry) => this.getUnitAttackPower(entry.slot) > 0)
            .sort((a, b) => this.getUnitAttackPower(b.slot) - this.getUnitAttackPower(a.slot))[0];
        if (!best) {
            return null;
        }

        return {
            kind: 'playerAction',
            reason: 'lethal_shield_attack',
            payload: {
                actionType: 'attackShieldArea',
                attackerCarduid: best.slot.unit.carduid
            }
        };
    }

    private static findBestUnitAttack(gameEnvView: any, aiPlayerId: string, opponentId: string): AiDecision | null {
        const attackers = this.getAttackers(gameEnvView, aiPlayerId);
        const defender = gameEnvView?.players?.[opponentId];
        const defenderTargets = this.getDefenderUnits(defender);

        if (attackers.length === 0 || defenderTargets.length === 0) {
            return null;
        }

        let bestScore = Number.NEGATIVE_INFINITY;
        let bestAction: AiDecision | null = null;

        for (const attacker of attackers) {
            const attackerAP = this.getUnitAttackPower(attacker.slot);
            const attackerHP = this.getUnitRemainingHp(attacker.slot);
            for (const target of defenderTargets) {
                const targetHP = this.getUnitRemainingHp(target.slot);
                const targetAP = this.getUnitAttackPower(target.slot);
                const killBonus = attackerAP >= targetHP ? 30 : 0;
                const tradeRisk = targetAP >= attackerHP ? 18 : 0;
                const score = killBonus + targetAP + targetHP - tradeRisk;
                if (score > bestScore) {
                    bestScore = score;
                    bestAction = {
                        kind: 'playerAction',
                        reason: 'best_unit_trade',
                        payload: {
                            actionType: 'attackUnit',
                            attackerCarduid: attacker.slot.unit.carduid,
                            targetPlayerId: opponentId,
                            targetUnitUid: target.slot.unit.carduid
                        }
                    };
                }
            }
        }

        return bestScore > 8 ? bestAction : null;
    }

    private static findSafeShieldAttack(gameEnvView: any, aiPlayerId: string): AiDecision | null {
        const attackers = this.getAttackers(gameEnvView, aiPlayerId);
        if (attackers.length === 0) {
            return null;
        }

        const best = attackers
            .sort((a, b) => this.getUnitAttackPower(b.slot) - this.getUnitAttackPower(a.slot))[0];
        if (!best) {
            return null;
        }

        return {
            kind: 'playerAction',
            reason: 'pressure_shields',
            payload: {
                actionType: 'attackShieldArea',
                attackerCarduid: best.slot.unit.carduid
            }
        };
    }

    private static findBestPlayCard(gameEnvView: any, aiPlayerId: string): AiDecision | null {
        const self = gameEnvView?.players?.[aiPlayerId];
        const hand = Array.isArray(self?.deck?.hand) ? self.deck.hand : [];
        if (hand.length === 0) {
            return null;
        }

        const zones = self?.zones || {};
        const availableEnergy = this.getAvailableEnergyCount(self);
        const hasBase = Array.isArray(zones.base) && zones.base.length > 0;
        const emptyUnitSlots = SLOT_NAMES.filter((slotName) => !zones?.[slotName]?.unit);
        const unitWithoutPilot = SLOT_NAMES
            .map((slotName) => zones?.[slotName])
            .find((slot) => slot?.unit && !slot?.pilot);

        const playable = hand
            .map((card: any) => {
                const cost = typeof card?.cardData?.cost === 'number' ? card.cardData.cost : 0;
                const cardType = card?.cardData?.cardType;
                return {
                    carduid: card?.carduid,
                    cardType,
                    cost
                };
            })
            .filter((card: any) => typeof card.carduid === 'string' && typeof card.cardType === 'string' && card.cost <= availableEnergy);

        const bestBase = playable.find((card: any) => card.cardType === 'base');
        if (bestBase && !hasBase) {
            return {
                kind: 'playCard',
                reason: 'establish_base',
                payload: {
                    action: {
                        type: 'PlayCard',
                        carduid: bestBase.carduid,
                        playAs: 'base'
                    }
                }
            };
        }

        const bestUnit = playable
            .filter((card: any) => card.cardType === 'unit' && emptyUnitSlots.length > 0)
            .sort((a: any, b: any) => b.cost - a.cost)[0];
        if (bestUnit) {
            return {
                kind: 'playCard',
                reason: 'develop_unit',
                payload: {
                    action: {
                        type: 'PlayCard',
                        carduid: bestUnit.carduid,
                        playAs: 'unit'
                    }
                }
            };
        }

        const bestPilot = playable
            .filter((card: any) => card.cardType === 'pilot' && unitWithoutPilot?.unit?.carduid)
            .sort((a: any, b: any) => b.cost - a.cost)[0];
        if (bestPilot && unitWithoutPilot?.unit?.carduid) {
            return {
                kind: 'playCard',
                reason: 'pair_pilot',
                payload: {
                    action: {
                        type: 'PlayCard',
                        carduid: bestPilot.carduid,
                        playAs: 'pilot',
                        targetUnit: unitWithoutPilot.unit.carduid
                    }
                }
            };
        }

        const bestCommand = playable
            .filter((card: any) => card.cardType === 'command')
            .sort((a: any, b: any) => b.cost - a.cost)[0];
        if (bestCommand) {
            return {
                kind: 'playCard',
                reason: 'spend_command',
                payload: {
                    action: {
                        type: 'PlayCard',
                        carduid: bestCommand.carduid,
                        playAs: 'command'
                    }
                }
            };
        }

        return null;
    }

    private static getOpponentId(gameEnvView: any, aiPlayerId: string): string | null {
        if (gameEnvView?.playerId_1 === aiPlayerId) return gameEnvView?.playerId_2 || null;
        if (gameEnvView?.playerId_2 === aiPlayerId) return gameEnvView?.playerId_1 || null;
        const playerIds = Object.keys(gameEnvView?.players || {});
        return playerIds.find((id) => id !== aiPlayerId) || null;
    }

    private static getAttackers(gameEnvView: any, aiPlayerId: string): Array<{ slotName: string; slot: any }> {
        const self = gameEnvView?.players?.[aiPlayerId];
        const zones = self?.zones || {};
        return SLOT_NAMES
            .map((slotName) => ({ slotName, slot: zones?.[slotName] }))
            .filter((entry) => entry?.slot?.unit && this.canAttack(entry.slot.unit));
    }

    private static getDefenderUnits(playerView: any): Array<{ slotName: string; slot: any }> {
        const zones = playerView?.zones || {};
        return SLOT_NAMES
            .map((slotName) => ({ slotName, slot: zones?.[slotName] }))
            .filter((entry) => entry?.slot?.unit);
    }

    private static canAttack(unit: any): boolean {
        if (!unit) return false;
        if (typeof unit.canAttackThisTurn === 'boolean') return unit.canAttackThisTurn;
        const isRested = Boolean(unit.isRested);
        const playedThisTurn = Boolean(unit.playedThisTurn);
        const canAttackOnPlayTurn = Boolean(unit.canAttackOnPlayTurn);
        return !isRested && (!playedThisTurn || canAttackOnPlayTurn);
    }

    private static getUnitAttackPower(slot: any): number {
        const fieldValue = slot?.fieldCardValue?.totalAP;
        if (typeof fieldValue === 'number') {
            return fieldValue;
        }
        const baseAp = Number(slot?.unit?.cardData?.ap || 0);
        const continuousAp = Number(slot?.unit?.continueModifyAP || 0);
        return Math.max(0, baseAp + continuousAp);
    }

    private static getUnitRemainingHp(slot: any): number {
        const totalHp = typeof slot?.fieldCardValue?.totalHP === 'number'
            ? slot.fieldCardValue.totalHP
            : Number(slot?.unit?.cardData?.hp || 0) + Number(slot?.unit?.continueModifyHP || 0);
        const damage = Number(slot?.unit?.damageReceived || 0);
        return Math.max(0, totalHp - damage);
    }

    private static getAvailableEnergyCount(playerView: any): number {
        const energyArea = Array.isArray(playerView?.zones?.energyArea) ? playerView.zones.energyArea : [];
        return energyArea.filter((energy: any) => !energy?.isRested).length;
    }

    private static extractTargetCount(rawCount: unknown): number {
        if (typeof rawCount === 'number' && rawCount > 0) {
            return rawCount;
        }
        if (rawCount && typeof rawCount === 'object') {
            const max = Number((rawCount as any).max || 1);
            return max > 0 ? max : 1;
        }
        return 1;
    }
}
