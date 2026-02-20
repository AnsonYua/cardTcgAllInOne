import type { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase } from '../../models/GameEnums';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { ConditionEvaluators } from './ConditionEvaluators';
import { evaluateCardsInPlayCondition } from './CardsInPlayCondition';
import { BattleConditionEvaluator } from './BattleConditionEvaluator';
import { SourceTraitConditionEvaluator } from './SourceTraitConditionEvaluator';
import { SlotCardStateUtils } from './SlotCardStateUtils';
import { SlotHealthService } from '../health/SlotHealthService';
import { SourceStatConditionEvaluator } from './SourceStatConditionEvaluator';
import { normalizeConditionTypeAlias } from '../effects/schema/EffectSchema';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';

type ZoneCardWithData = {
    carduid: string;
    [key: string]: unknown;
};

export class EffectConditionEvaluator {
    static validateEffectConditions(
        storedEffect: EffectDefinition,
        gameEnv: GameEnvironment,
        cardOwnerPlayerId: string | null,
        sourceCard?: ZoneCardWithData
    ): boolean {
        const actionTurn = storedEffect.timing?.actionTurn;
        if (actionTurn) {
            if (!EffectConditionEvaluator.checkTurnTiming(actionTurn, gameEnv, cardOwnerPlayerId)) {
                return false;
            }
        }

        const conditions = storedEffect.conditions || [];
        if (conditions.length === 0) {
            return true;
        }

        for (const condition of conditions) {
            if (!EffectConditionEvaluator.checkSingleCondition(condition, gameEnv, cardOwnerPlayerId, sourceCard)) {
                return false;
            }
        }

        return true;
    }

    private static checkTurnTiming(
        actionTurn: string,
        gameEnv: GameEnvironment,
        cardOwnerPlayerId: string | null
    ): boolean {
        switch (actionTurn) {
            case 'YOUR_TURN':
                return cardOwnerPlayerId ? gameEnv.currentPlayer === cardOwnerPlayerId : false;

            case 'OPPONENT_TURN':
                return cardOwnerPlayerId ? gameEnv.currentPlayer !== cardOwnerPlayerId : false;

            case 'ANY_TIME':
                return true;

            default:
                console.log(`⚠️ Unknown actionTurn: ${actionTurn}`);
                return false;
        }
    }

    private static checkSingleCondition(
        condition: unknown,
        gameEnv: GameEnvironment,
        cardOwnerPlayerId: string | null,
        sourceCard?: any
    ): boolean {
        if (typeof condition === 'string') {
            switch (condition) {
                case 'isPaired':
                    return SlotCardStateUtils.playerHasPairedUnits(gameEnv, cardOwnerPlayerId);

                case 'isLinked':
                    return SlotCardStateUtils.playerHasLinkedUnits(gameEnv, cardOwnerPlayerId);

                case 'MAIN_PHASE':
                    return gameEnv.phase === GamePhase.MAIN_PHASE;

                case 'ATTACK_PHASE':
                case 'BATTLE_PHASE':
                    return gameEnv.phase === GamePhase.ATTACK_PHASE || gameEnv.phase === GamePhase.DAMAGE_PHASE;

                case 'END_PHASE':
                    return gameEnv.phase === GamePhase.END_PHASE;

                case 'DRAW_PHASE':
                    return gameEnv.phase === GamePhase.DRAW_PHASE;

                default:
                    console.log(`⚠️ Unknown condition: ${condition}`);
                    return false;
            }
        }

        if (!condition || typeof condition !== 'object') {
            return false;
        }

        const typedCondition = condition as Record<string, unknown>;
        const rawType = typeof typedCondition.type === 'string' ? typedCondition.type : '';
        const type = normalizeConditionTypeAlias(rawType) || '';
        const scope = (typedCondition.scope as string) || 'player';

        switch (type) {
            case 'playerLevel':
                return cardOwnerPlayerId
                    ? ConditionEvaluators.playerLevel(gameEnv, cardOwnerPlayerId, scope, typedCondition.value)
                    : false;

            case 'pairedPilotColor': {
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                return ConditionEvaluators.pairedPilotColor(gameEnv, sourceCarduid, typedCondition.value);
            }

            case 'pairedPilotTrait': {
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                return ConditionEvaluators.pairedPilotTrait(gameEnv, sourceCarduid, typedCondition.value);
            }

            case 'pairedPilotLevel': {
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                return ConditionEvaluators.pairedPilotLevel(gameEnv, sourceCarduid, typedCondition.value);
            }

            case 'pairedUnitColor': {
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                return ConditionEvaluators.pairedUnitColor(gameEnv, sourceCarduid, typedCondition.value);
            }

            case 'pairedUnitTrait': {
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                return ConditionEvaluators.pairedUnitTrait(gameEnv, sourceCarduid, typedCondition.value);
            }

            case 'paired':
            case 'isPaired':
                if (scope === 'source') {
                    const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                        ? (sourceCard as any).carduid
                        : '';
                    return SlotCardStateUtils.isCardPaired(gameEnv, sourceCarduid);
                }
                return SlotCardStateUtils.playerHasPairedUnits(gameEnv, cardOwnerPlayerId);

            case 'linked':
            case 'isLinked':
                if (scope === 'source') {
                    const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                        ? (sourceCard as any).carduid
                        : '';
                    return SlotCardStateUtils.isCardLinked(gameEnv, sourceCarduid);
                }
                return SlotCardStateUtils.playerHasLinkedUnits(gameEnv, cardOwnerPlayerId);

            case 'turn':
                return typeof typedCondition.value === 'string'
                    ? EffectConditionEvaluator.checkTurnTiming(typedCondition.value, gameEnv, cardOwnerPlayerId)
                    : true;

            case 'phase':
                if (typeof typedCondition.value !== 'string') {
                    return true;
                }
                switch (typedCondition.value) {
                    case 'MAIN_PHASE':
                        return gameEnv.phase === GamePhase.MAIN_PHASE;
                    case 'ATTACK_PHASE':
                    case 'BATTLE_PHASE':
                        return gameEnv.phase === GamePhase.ATTACK_PHASE || gameEnv.phase === GamePhase.DAMAGE_PHASE;
                    case 'END_PHASE':
                        return gameEnv.phase === GamePhase.END_PHASE;
                    case 'DRAW_PHASE':
                        return gameEnv.phase === GamePhase.DRAW_PHASE;
                    default:
                        return false;
                }

            case 'opponentHandSize':
                return cardOwnerPlayerId
                    ? ConditionEvaluators.opponentHandSize(gameEnv, cardOwnerPlayerId, scope, typedCondition.value)
                    : false;

            case 'noUnitTokenWithTrait': {
                const traitValue = typedCondition.value;
                const traits = Array.isArray(traitValue)
                    ? traitValue.filter(item => typeof item === 'string')
                    : typeof traitValue === 'string'
                        ? [traitValue]
                        : [];
                return SlotCardStateUtils.noUnitTokenWithTraits(gameEnv, cardOwnerPlayerId, traits);
            }

            case 'cardsInTrash':
            case 'cardsInTrashWithTraitsAny': {
                const playerId = cardOwnerPlayerId;
                if (!playerId) {
                    return false;
                }
                const traitsAny = Array.isArray(typedCondition.traitsAny)
                    ? typedCondition.traitsAny.filter(item => typeof item === 'string')
                    : Array.isArray((typedCondition as any).traits)
                        ? (typedCondition as any).traits.filter((item: unknown) => typeof item === 'string')
                        : [];

                const filters: Record<string, unknown> = {
                    traitsAny
                };
                if (typeof (typedCondition as any).cardType === 'string') {
                    filters.cardType = (typedCondition as any).cardType;
                }

                return ConditionEvaluators.cardsInTrashWithFilter(
                    gameEnv,
                    playerId,
                    filters,
                    typedCondition.value
                );
            }

            case 'unitsInPlayWithTrait': {
                const playerId = cardOwnerPlayerId;
                if (!playerId) {
                    return false;
                }

                const traits = Array.isArray(typedCondition.traits)
                    ? typedCondition.traits.filter(item => typeof item === 'string')
                    : [];
                return ConditionEvaluators.unitsInPlayWithTrait(
                    gameEnv,
                    playerId,
                    traits,
                    typedCondition.value
                );
            }

            case 'unitsInPlayWithFilter': {
                if (!cardOwnerPlayerId) {
                    return false;
                }

                return ConditionEvaluators.evaluateUnitsInPlayWithFilterCondition(
                    gameEnv,
                    cardOwnerPlayerId,
                    typedCondition
                );
            }

            case 'unitsInPlay': {
                if (!cardOwnerPlayerId) {
                    return false;
                }
                return ConditionEvaluators.evaluateUnitsInPlayCondition(
                    gameEnv,
                    cardOwnerPlayerId,
                    typedCondition
                );
            }

            case 'cardsInPlay': {
                if (!cardOwnerPlayerId) {
                    return false;
                }

                return evaluateCardsInPlayCondition(
                    gameEnv,
                    cardOwnerPlayerId,
                    typedCondition
                );
            }

            case 'sourceTrait': {
                const value = typedCondition.value;
                const trait = typeof value === 'string' ? value : '';
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                if (!sourceCarduid || !trait) {
                    return false;
                }
                return SourceTraitConditionEvaluator.sourceHasTrait(gameEnv, sourceCarduid, trait);
            }

            case 'hasAnotherLinkedUnit': {
                if (!cardOwnerPlayerId) {
                    return false;
                }
                const exclude = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : undefined;
                return ConditionEvaluators.hasAnotherLinkedUnit(gameEnv, cardOwnerPlayerId, exclude);
            }

            case 'hasAnotherLinkedUnitWithTrait': {
                if (!cardOwnerPlayerId) {
                    return false;
                }
                const traitsAny = Array.isArray((typedCondition as any).traits)
                    ? (typedCondition as any).traits.filter((t: unknown) => typeof t === 'string')
                    : Array.isArray((typedCondition as any).traitsAny)
                        ? (typedCondition as any).traitsAny.filter((t: unknown) => typeof t === 'string')
                        : [];
                const exclude = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : undefined;
                return ConditionEvaluators.hasAnotherLinkedUnitWithTrait(gameEnv, cardOwnerPlayerId, traitsAny, exclude);
            }

            case 'hasAnotherUnitWithTrait': {
                if (!cardOwnerPlayerId) {
                    return false;
                }
                const traitsAny = Array.isArray((typedCondition as any).traits)
                    ? (typedCondition as any).traits.filter((t: unknown) => typeof t === 'string')
                    : Array.isArray((typedCondition as any).traitsAny)
                        ? (typedCondition as any).traitsAny.filter((t: unknown) => typeof t === 'string')
                        : typeof (typedCondition as any).value === 'string'
                            ? [(typedCondition as any).value]
                            : [];
                const exclude = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : undefined;
                return ConditionEvaluators.hasAnotherUnitWithTrait(gameEnv, cardOwnerPlayerId, traitsAny, exclude);
            }

            case 'noPairedPilot': {
                if (scope === 'source') {
                    const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                        ? (sourceCard as any).carduid
                        : '';
                    return !SlotCardStateUtils.isCardPaired(gameEnv, sourceCarduid);
                }
                return true;
            }

            case 'battleOpponentLevel': {
                if (!sourceCard || !cardOwnerPlayerId) {
                    return false;
                }
                return BattleConditionEvaluator.evaluateBattleOpponentLevel(
                    gameEnv,
                    (sourceCard as any).carduid,
                    typedCondition.value
                );
            }

            case 'sourceStatus': {
                if (scope !== 'source') {
                    return false;
                }
                if (!sourceCard) {
                    return false;
                }

                const statusRaw =
                    (typedCondition.status as string | undefined) ??
                    (typedCondition.value as string | undefined);
                const desired = typeof statusRaw === 'string' ? statusRaw.toLowerCase() : '';
                if (!desired) {
                    return true;
                }

                const isRested = (sourceCard as any)?.isRested === true;
                if (desired === 'rested') {
                    return isRested;
                }
                if (desired === 'active') {
                    return !isRested;
                }

                console.log(`⚠️ Unknown sourceStatus value: ${desired}`);
                return false;
            }

            case 'sourceDamaged': {
                if (scope !== 'source') {
                    return false;
                }
                if (!sourceCard) {
                    return false;
                }
                const expected = typeof typedCondition.value === 'boolean' ? typedCondition.value : true;
                const sourceCarduid = typeof (sourceCard as any).carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                const slotState = sourceCarduid
                    ? SlotHealthService.getSlotHealthState(gameEnv, sourceCarduid)
                    : null;
                const damaged = slotState
                    ? slotState.sharedDamage > 0
                    : (typeof (sourceCard as any).damageReceived === 'number'
                        ? (sourceCard as any).damageReceived > 0
                        : false);
                return damaged === expected;
            }

            case 'sourceLevel': {
                if (scope !== 'source') {
                    return false;
                }
                if (!sourceCard) {
                    return false;
                }
                const sourceLevel = typeof (sourceCard as any)?.cardData?.level === 'number'
                    ? (sourceCard as any).cardData.level
                    : (typeof (sourceCard as any)?.level === 'number' ? (sourceCard as any).level : 0);
                if (typeof typedCondition.value === 'number') {
                    return sourceLevel === typedCondition.value;
                }
                if (typeof typedCondition.value === 'string') {
                    return validateComparisonFilter(sourceLevel, typedCondition.value);
                }
                return true;
            }

            case 'sourceAp': {
                if (scope !== 'source') {
                    return false;
                }
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                if (!sourceCarduid) {
                    return false;
                }
                return SourceStatConditionEvaluator.sourceApMatches(gameEnv, sourceCarduid, typedCondition.value);
            }

            case 'sourceHp': {
                if (scope !== 'source') {
                    return false;
                }
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                if (!sourceCarduid) {
                    return false;
                }
                return SourceStatConditionEvaluator.sourceHpMatches(gameEnv, sourceCarduid, typedCondition.value);
            }

            default:
                console.log(`⚠️ Unknown structured condition: ${type}`);
                return false;
        }
    }
}
