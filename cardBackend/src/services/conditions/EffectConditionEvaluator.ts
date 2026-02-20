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
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { SLOT_ZONES } from '../../config/gameConstants';
import { LinkUtils } from '../../utils/LinkUtils';
import { KeywordUtils } from '../../utils/KeywordUtils';

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
            case 'turnPlayer': {
                const scopedPlayerId = EffectConditionEvaluator.resolveScopedPlayerId(gameEnv, cardOwnerPlayerId, scope);
                return scopedPlayerId ? gameEnv.currentPlayer === scopedPlayerId : false;
            }

            case 'playerLevel':
                return cardOwnerPlayerId
                    ? ConditionEvaluators.playerLevel(gameEnv, cardOwnerPlayerId, scope, typedCondition.value)
                    : false;

            case 'handSize': {
                const scopedPlayerId = EffectConditionEvaluator.resolveScopedPlayerId(gameEnv, cardOwnerPlayerId, scope);
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

            case 'cardsInZone': {
                const scopedPlayerId = EffectConditionEvaluator.resolveScopedPlayerId(gameEnv, cardOwnerPlayerId, scope);
                if (!scopedPlayerId) {
                    return false;
                }
                const zone = typeof (typedCondition as any).zone === 'string' ? (typedCondition as any).zone : '';
                const count = EffectConditionEvaluator.countCardsInZone(gameEnv, scopedPlayerId, zone);
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
                return EffectConditionEvaluator.evaluateCardsInPlayWithFilterCondition(
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

            case 'sourceColor': {
                if (scope !== 'source') {
                    return false;
                }
                const expected = typeof typedCondition.value === 'string' ? typedCondition.value.toLowerCase() : '';
                const actual = typeof (sourceCard as any)?.cardData?.color === 'string'
                    ? String((sourceCard as any).cardData.color).toLowerCase()
                    : '';
                if (!expected || !actual) {
                    return false;
                }
                return actual === expected;
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

            case 'cardsInTrashWithNameIncludes': {
                const scopedPlayerId = EffectConditionEvaluator.resolveScopedPlayerId(gameEnv, cardOwnerPlayerId, scope);
                if (!scopedPlayerId) {
                    return false;
                }
                const player = gameEnv.getPlayer(scopedPlayerId);
                const trash = Array.isArray((player?.zones as any)?.trashArea)
                    ? ((player?.zones as any).trashArea as any[])
                    : Array.isArray((player?.zones as any)?.trash)
                        ? ((player?.zones as any).trash as any[])
                        : [];
                const needle = typeof (typedCondition as any).name === 'string'
                    ? String((typedCondition as any).name).toLowerCase()
                    : '';
                if (!needle) {
                    return false;
                }
                const matches = trash.filter((card: any) => {
                    const name = typeof card?.cardData?.name === 'string'
                        ? card.cardData.name
                        : typeof card?.name === 'string'
                            ? card.name
                            : '';
                    return name.toLowerCase().includes(needle);
                }).length;
                if (typeof typedCondition.value === 'number') {
                    return matches === typedCondition.value;
                }
                if (typeof typedCondition.value === 'string') {
                    return validateComparisonFilter(matches, typedCondition.value);
                }
                return true;
            }

            case 'sourcePairedWithPilot': {
                if (scope !== 'source') {
                    return false;
                }
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                const slot = sourceCarduid
                    ? EffectConditionEvaluator.findSlotByCarduid(gameEnv, sourceCarduid)
                    : null;
                const expected = typeof typedCondition.value === 'boolean' ? typedCondition.value : true;
                const paired = Boolean(slot?.pilot);
                return paired === expected;
            }

            case 'sourceIsBattling': {
                if (scope !== 'source') {
                    return false;
                }
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                const expected = typeof typedCondition.value === 'boolean' ? typedCondition.value : true;
                const battle = gameEnv.currentBattle;
                const battling = Boolean(
                    battle &&
                    (battle.attackerCarduid === sourceCarduid || battle.targetCarduid === sourceCarduid)
                );
                return battling === expected;
            }

            case 'battleTargetHasTrigger': {
                if (scope !== 'source') {
                    return false;
                }
                const expectedTrigger = typeof typedCondition.value === 'string'
                    ? typedCondition.value.toUpperCase()
                    : '';
                if (!expectedTrigger) {
                    return false;
                }
                const sourceCarduid = typeof (sourceCard as any)?.carduid === 'string'
                    ? (sourceCard as any).carduid
                    : '';
                const battle = gameEnv.currentBattle;
                if (!battle || battle.actionType !== 'attackUnit') {
                    return false;
                }
                const targetCarduid = battle.attackerCarduid === sourceCarduid
                    ? battle.targetCarduid
                    : battle.targetCarduid === sourceCarduid
                        ? battle.attackerCarduid
                        : undefined;
                const targetCard = targetCarduid ? SlotZoneUtils.getCardByUid(gameEnv, targetCarduid) : null;
                const rules = Array.isArray((targetCard as any)?.cardData?.effects?.rules)
                    ? ((targetCard as any).cardData.effects.rules as any[])
                    : [];
                return rules.some((rule: any) => String(rule?.trigger || '').toUpperCase() === expectedTrigger);
            }

            case 'sourceDeployedFrom': {
                if (scope !== 'source') {
                    return false;
                }
                const expected = typeof typedCondition.value === 'string'
                    ? typedCondition.value.toLowerCase()
                    : '';
                const actual = typeof (sourceCard as any)?.deployedFrom === 'string'
                    ? String((sourceCard as any).deployedFrom).toLowerCase()
                    : '';
                if (!expected || !actual) {
                    return false;
                }
                return actual === expected;
            }

            case 'eventType':
                return EffectConditionEvaluator.eventTypeMatches(gameEnv, typedCondition);

            case 'eventAttacker':
                return EffectConditionEvaluator.eventAttackerMatches(gameEnv, sourceCard, typedCondition);

            case 'eventAttackerController':
                return EffectConditionEvaluator.eventAttackerControllerMatches(gameEnv, cardOwnerPlayerId, typedCondition);

            case 'eventAttackerHasKeyword':
                return EffectConditionEvaluator.eventAttackerHasKeyword(gameEnv, typedCondition);

            case 'eventAttackerIsNotSource':
                return EffectConditionEvaluator.eventAttackerIsNotSource(gameEnv, sourceCard, typedCondition);

            case 'eventTarget':
                return EffectConditionEvaluator.eventTargetMatches(gameEnv, sourceCard, typedCondition);

            case 'eventTargetController':
                return EffectConditionEvaluator.eventTargetControllerMatches(gameEnv, cardOwnerPlayerId, typedCondition);

            case 'eventTargetTraitsAny':
                return EffectConditionEvaluator.eventTargetTraitsAny(gameEnv, typedCondition);

            case 'eventTargetWasRested':
                return EffectConditionEvaluator.eventTargetWasRested(gameEnv, typedCondition);

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

    private static resolveScopedPlayerId(
        gameEnv: GameEnvironment,
        cardOwnerPlayerId: string | null,
        scope: unknown
    ): string | null {
        if (!cardOwnerPlayerId) {
            return null;
        }
        const normalizedScope = typeof scope === 'string' ? scope.toLowerCase() : 'self';
        if (normalizedScope === 'opponent') {
            return gameEnv.getOpponentId(cardOwnerPlayerId);
        }
        return cardOwnerPlayerId;
    }

    private static countCardsInZone(
        gameEnv: GameEnvironment,
        playerId: string,
        zoneRaw: unknown
    ): number | null {
        const player = gameEnv.getPlayer(playerId);
        if (!player) {
            return null;
        }

        const zone = typeof zoneRaw === 'string' ? zoneRaw.toLowerCase() : '';
        if (!zone) {
            return null;
        }

        if (zone === 'shield' || zone === 'shieldarea') {
            return Array.isArray(player.zones?.shieldArea) ? player.zones.shieldArea.length : 0;
        }
        if (zone === 'trash' || zone === 'trasharea') {
            return Array.isArray(player.zones?.trashArea) ? player.zones.trashArea.length : 0;
        }
        if (zone === 'energy' || zone === 'energyarea') {
            return Array.isArray(player.zones?.energyArea) ? player.zones.energyArea.length : 0;
        }
        if (zone === 'base') {
            return Array.isArray(player.zones?.base) ? player.zones.base.length : 0;
        }
        if (zone === 'hand') {
            if (typeof player.deck?.getHandSize === 'function') {
                return player.deck.getHandSize();
            }
            const handUids = (player.deck as any)?.handUids;
            return Array.isArray(handUids) ? handUids.length : 0;
        }
        if (zone === 'deck' || zone === 'maindeck') {
            if (typeof player.deck?.getDeckSize === 'function') {
                return player.deck.getDeckSize();
            }
            const deckCards = (player.deck as any)?.mainDeck;
            return Array.isArray(deckCards) ? deckCards.length : 0;
        }

        const slotName = SLOT_ZONES.find((slot) => slot.toLowerCase() === zone);
        if (slotName) {
            const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotName);
            if (!slotResult.isValid || !slotResult.slot) {
                return 0;
            }
            let count = 0;
            if (slotResult.slot.unit) {
                count += 1;
            }
            if (slotResult.slot.pilot) {
                count += 1;
            }
            return count;
        }

        return null;
    }

    private static evaluateCardsInPlayWithFilterCondition(
        gameEnv: GameEnvironment,
        rootPlayerId: string,
        condition: Record<string, unknown>
    ): boolean {
        const scopedPlayerId = this.resolveScopedPlayerId(gameEnv, rootPlayerId, condition.scope);
        if (!scopedPlayerId) {
            return false;
        }
        const player = gameEnv.getPlayer(scopedPlayerId);
        if (!player?.zones) {
            return false;
        }
        const filters = condition.filters && typeof condition.filters === 'object'
            ? (condition.filters as Record<string, unknown>)
            : {};
        const cardTypeFilter = typeof filters.cardType === 'string'
            ? filters.cardType.toLowerCase()
            : '';

        let count = 0;
        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            if (!slot) {
                continue;
            }

            if ((cardTypeFilter === '' || cardTypeFilter === 'unit') && slot.unit) {
                if (this.matchesSlotCardFilter(gameEnv, slot.unit, slot, filters)) {
                    count += 1;
                }
            }

            if ((cardTypeFilter === '' || cardTypeFilter === 'pilot') && slot.pilot) {
                if (this.matchesSlotCardFilter(gameEnv, slot.pilot, slot, filters)) {
                    count += 1;
                }
            }
        }

        if (typeof condition.value === 'number') {
            return count === condition.value;
        }
        if (typeof condition.value === 'string') {
            return validateComparisonFilter(count, condition.value);
        }
        return true;
    }

    private static matchesSlotCardFilter(
        gameEnv: GameEnvironment,
        card: any,
        slot: any,
        filters: Record<string, unknown>
    ): boolean {
        const levelFilter = filters.level;
        if (typeof levelFilter === 'string') {
            const level = typeof card?.cardData?.level === 'number'
                ? card.cardData.level
                : 0;
            if (!validateComparisonFilter(level, levelFilter)) {
                return false;
            }
        }

        if (Array.isArray(filters.traits) && filters.traits.length > 0) {
            const traits = Array.isArray(card?.cardData?.traits) ? card.cardData.traits : [];
            const hasAny = (filters.traits as unknown[]).some((trait) => typeof trait === 'string' && traits.includes(trait));
            if (!hasAny) {
                return false;
            }
        }

        if (Array.isArray(filters.traitsAny) && filters.traitsAny.length > 0) {
            const traits = Array.isArray(card?.cardData?.traits) ? card.cardData.traits : [];
            const hasAny = (filters.traitsAny as unknown[]).some((trait) => typeof trait === 'string' && traits.includes(trait));
            if (!hasAny) {
                return false;
            }
        }

        if (typeof filters.status === 'string') {
            const desired = String(filters.status).toLowerCase();
            const status = card?.isRested ? 'rested' : 'active';
            if (status !== desired) {
                return false;
            }
        }

        if (typeof filters.color === 'string') {
            const color = typeof card?.cardData?.color === 'string' ? card.cardData.color.toLowerCase() : '';
            if (color !== String(filters.color).toLowerCase()) {
                return false;
            }
        }

        if (typeof filters.pairedPilot === 'string' && card?.cardData?.cardType === 'unit') {
            const requirement = String(filters.pairedPilot).toLowerCase();
            const hasPilot = Boolean(slot?.pilot);
            if (requirement === 'any' && !hasPilot) {
                return false;
            }
            if (requirement === 'none' && hasPilot) {
                return false;
            }
        }

        if (typeof filters.isLinkUnit === 'boolean' && card?.cardData?.cardType === 'unit') {
            const linked = LinkUtils.isLinkedPair(slot?.unit, slot?.pilot);
            if (linked !== filters.isLinkUnit) {
                return false;
            }
        }

        if (typeof filters.isBattling === 'boolean' && card?.carduid) {
            const battle = gameEnv.currentBattle;
            const battling = Boolean(
                battle && (battle.attackerCarduid === card.carduid || battle.targetCarduid === card.carduid)
            );
            if (battling !== filters.isBattling) {
                return false;
            }
        }

        return true;
    }

    private static findSlotByCarduid(gameEnv: GameEnvironment, carduid: string): { playerId: string; slotName: string; slot: any } | null {
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

    private static getLatestNotification(gameEnv: GameEnvironment): Record<string, unknown> | null {
        const queue = Array.isArray(gameEnv.notificationQueue) ? gameEnv.notificationQueue : [];
        if (queue.length === 0) {
            return null;
        }
        return queue[queue.length - 1] as Record<string, unknown>;
    }

    private static eventTypeMatches(gameEnv: GameEnvironment, condition: Record<string, unknown>): boolean {
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
        const battle = gameEnv.currentBattle;
        if (battle?.targetCarduid) {
            return battle.targetCarduid;
        }
        return null;
    }

    private static eventAttackerMatches(gameEnv: GameEnvironment, sourceCard: any, condition: Record<string, unknown>): boolean {
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

    private static eventAttackerControllerMatches(
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

    private static eventAttackerHasKeyword(gameEnv: GameEnvironment, condition: Record<string, unknown>): boolean {
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
            return rules.some((rule: any) => String(rule?.trigger || '').toUpperCase() === 'END_OF_TURN' && String(rule?.action || '').toLowerCase() === 'heal');
        }
        return false;
    }

    private static eventAttackerIsNotSource(gameEnv: GameEnvironment, sourceCard: any, condition: Record<string, unknown>): boolean {
        const expected = typeof condition.value === 'boolean' ? condition.value : true;
        const attackerCarduid = this.getEventAttackerCarduid(gameEnv);
        const sourceCarduid = typeof sourceCard?.carduid === 'string' ? sourceCard.carduid : '';
        if (!attackerCarduid || !sourceCarduid) {
            return false;
        }
        const isNotSource = attackerCarduid !== sourceCarduid;
        return isNotSource === expected;
    }

    private static eventTargetMatches(gameEnv: GameEnvironment, sourceCard: any, condition: Record<string, unknown>): boolean {
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

    private static eventTargetControllerMatches(
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

    private static eventTargetTraitsAny(gameEnv: GameEnvironment, condition: Record<string, unknown>): boolean {
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

    private static eventTargetWasRested(gameEnv: GameEnvironment, condition: Record<string, unknown>): boolean {
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
}
