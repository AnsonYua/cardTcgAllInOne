import type { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase } from '../../models/GameEnums';
import type { EffectDefinition, SourceLevelScope } from '../EventQueue/interfaces/GameEvent';
import { ConditionEvaluators } from './ConditionEvaluators';
import { evaluateCardsInPlayCondition } from './CardsInPlayCondition';
import { BattleConditionEvaluator } from './BattleConditionEvaluator';
import { SlotCardStateUtils } from './SlotCardStateUtils';
import { normalizeConditionTypeAlias } from '../effects/schema/EffectSchema';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { ConditionScopeUtils } from './ConditionScopeUtils';
import { ZoneCountConditionEvaluator } from './ZoneCountConditionEvaluator';
import { CardsInPlayWithFilterConditionEvaluator } from './CardsInPlayWithFilterConditionEvaluator';
import { EventConditionEvaluator } from './EventConditionEvaluator';
import { SourceAndSpecialConditionEvaluator } from './SourceAndSpecialConditionEvaluator';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';

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
            if (!EffectConditionEvaluator.checkSingleCondition(
                condition,
                gameEnv,
                cardOwnerPlayerId,
                sourceCard,
                storedEffect.sourceLevelScope
            )) {
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
        sourceCard?: any,
        sourceLevelScope?: SourceLevelScope
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
        const rawScope = typeof typedCondition.scope === 'string' ? typedCondition.scope : '';
        const scope = rawScope || (type.startsWith('source') ? 'source' : 'player');

        switch (type) {
            case 'turnPlayer': {
                const scopedPlayerId = ConditionScopeUtils.resolveScopedPlayerId(gameEnv, cardOwnerPlayerId, scope);
                return scopedPlayerId ? gameEnv.currentPlayer === scopedPlayerId : false;
            }

            case 'playerLevel':
                return cardOwnerPlayerId
                    ? ConditionEvaluators.playerLevel(gameEnv, cardOwnerPlayerId, scope, typedCondition.value)
                    : false;

            case 'handSize': {
                const scopedPlayerId = ConditionScopeUtils.resolveScopedPlayerId(gameEnv, cardOwnerPlayerId, scope);
                if (!scopedPlayerId) {
                    return false;
                }
                const player = gameEnv.getPlayer(scopedPlayerId);
                const handCount = player?.deck?.hand?.length ?? 0;
                if (typeof typedCondition.value === 'number') {
                    return handCount === typedCondition.value;
                }
                if (typeof typedCondition.value === 'string') {
                    return validateComparisonFilter(handCount, typedCondition.value);
                }
                return true;
            }

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

            case 'pairedPilotTraitAny': {
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                const traitsAny = Array.isArray((typedCondition as any).value)
                    ? ((typedCondition as any).value as unknown[]).filter((entry): entry is string => typeof entry === 'string')
                    : Array.isArray((typedCondition as any).traitsAny)
                        ? ((typedCondition as any).traitsAny as unknown[]).filter((entry): entry is string => typeof entry === 'string')
                        : [];
                return ConditionEvaluators.pairedPilotTraitAny(gameEnv, sourceCarduid, traitsAny);
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
                const excludeSourceCard = (typedCondition as any).excludeSourceCard === true;
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? ((sourceCard as any).carduid as string)
                    : undefined;

                return ConditionEvaluators.cardsInTrashWithFilter(
                    gameEnv,
                    playerId,
                    filters,
                    typedCondition.value,
                    {
                        excludeCarduid: excludeSourceCard ? sourceCarduid : undefined
                    }
                );
            }

            case 'cardsInZone': {
                const scopedPlayerId = ConditionScopeUtils.resolveScopedPlayerId(gameEnv, cardOwnerPlayerId, scope);
                if (!scopedPlayerId) {
                    return false;
                }
                const zone = typeof (typedCondition as any).zone === 'string' ? (typedCondition as any).zone : '';
                const count = ZoneCountConditionEvaluator.countCardsInZone(gameEnv, scopedPlayerId, zone);
                if (count === null) {
                    return false;
                }
                if (typeof typedCondition.value === 'number') {
                    return count === typedCondition.value;
                }
                if (typeof typedCondition.value === 'string') {
                    return validateComparisonFilter(count, typedCondition.value);
                }
                return true;
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

            case 'unitsInPlayWithStatus': {
                if (!cardOwnerPlayerId) {
                    return false;
                }
                const exclude = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : undefined;
                return ConditionEvaluators.evaluateUnitsInPlayWithStatusCondition(
                    gameEnv,
                    cardOwnerPlayerId,
                    typedCondition,
                    exclude
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

            case 'cardsInPlayWithFilter': {
                if (!cardOwnerPlayerId) {
                    return false;
                }
                return CardsInPlayWithFilterConditionEvaluator.evaluate(
                    gameEnv,
                    cardOwnerPlayerId,
                    typedCondition
                );
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
                const exclude = EffectConditionEvaluator.resolveAnotherUnitExcludeCarduid(gameEnv, sourceCard);
                return ConditionEvaluators.hasAnotherUnitWithTrait(gameEnv, cardOwnerPlayerId, traitsAny, exclude);
            }

            case 'hasAnotherUnitWithKeyword': {
                if (!cardOwnerPlayerId) {
                    return false;
                }
                const keyword = typeof (typedCondition as any).keyword === 'string'
                    ? (typedCondition as any).keyword
                    : typeof (typedCondition as any).value === 'string'
                        ? (typedCondition as any).value
                        : '';
                const exclude = EffectConditionEvaluator.resolveAnotherUnitExcludeCarduid(gameEnv, sourceCard);
                return ConditionEvaluators.hasAnotherUnitWithKeyword(gameEnv, cardOwnerPlayerId, keyword, exclude);
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

            case 'eventType':
                return EventConditionEvaluator.eventTypeMatches(gameEnv, typedCondition);

            case 'eventAttacker':
                return EventConditionEvaluator.eventAttackerMatches(gameEnv, sourceCard, typedCondition);

            case 'eventAttackerController':
                return EventConditionEvaluator.eventAttackerControllerMatches(gameEnv, cardOwnerPlayerId, typedCondition);

            case 'eventAttackerHasKeyword':
                return EventConditionEvaluator.eventAttackerHasKeyword(gameEnv, typedCondition);

            case 'eventAttackerIsNotSource':
                return EventConditionEvaluator.eventAttackerIsNotSource(gameEnv, sourceCard, typedCondition);

            case 'eventTarget':
                return EventConditionEvaluator.eventTargetMatches(gameEnv, sourceCard, typedCondition);

            case 'eventTargetController':
                return EventConditionEvaluator.eventTargetControllerMatches(gameEnv, cardOwnerPlayerId, typedCondition);

            case 'eventTargetPairedPilotTrait':
                return EventConditionEvaluator.eventTargetPairedPilotTrait(gameEnv, typedCondition);

            case 'eventTargetTraitsAny':
                return EventConditionEvaluator.eventTargetTraitsAny(gameEnv, typedCondition);

            case 'eventTargetWasRested':
                return EventConditionEvaluator.eventTargetWasRested(gameEnv, typedCondition);

            case 'eventTargetLinkStatus':
                return EventConditionEvaluator.eventTargetLinkStatus(gameEnv, typedCondition);

            default:
                const specialConditionResult = SourceAndSpecialConditionEvaluator.evaluate({
                    gameEnv,
                    cardOwnerPlayerId,
                    sourceCard,
                    type,
                    scope,
                    typedCondition,
                    sourceLevelScope
                });
                if (specialConditionResult !== null) {
                    return specialConditionResult;
                }
                console.log(`⚠️ Unknown structured condition: ${type}`);
                return false;
        }
    }

    private static resolveAnotherUnitExcludeCarduid(gameEnv: GameEnvironment, sourceCard?: any): string | undefined {
        const sourceCarduid = typeof sourceCard?.carduid === 'string' ? sourceCard.carduid : '';
        if (!sourceCarduid) {
            return undefined;
        }

        const sourceType = typeof sourceCard?.cardData?.cardType === 'string'
            ? String(sourceCard.cardData.cardType).toLowerCase()
            : '';
        if (sourceType === 'unit') {
            return sourceCarduid;
        }
        if (sourceType !== 'pilot') {
            return sourceCarduid;
        }

        for (const player of Object.values(gameEnv.players)) {
            if (!player?.zones) {
                continue;
            }
            const slotRef = SlotZoneUtils.findSlotByCarduid(player.zones, sourceCarduid);
            if (slotRef?.unit?.carduid) {
                return slotRef.unit.carduid;
            }
        }

        return sourceCarduid;
    }

}
