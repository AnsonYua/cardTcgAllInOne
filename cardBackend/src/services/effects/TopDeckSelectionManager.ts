import type { GameEnvironment } from '../../models/GameEnvironment';
import { CardDatabaseManager } from '../../models/CardSystem';
import type { EffectDefinition, OptionChoiceEvent, PromptChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { getCardIdFromUid } from '../../utils/CardUtils';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { DeckZoneManager } from '../zones/DeckZoneManager';
import { ChoiceDisplayBuilder } from '../choices/ChoiceDisplayBuilder';
import { ChoiceEventScheduler } from '../choices/ChoiceEventScheduler';
import type { ExecutionResult } from '../ExecutionResult';
import { buildTopDeckSelectionOptions } from './topDeckSelection/TopDeckSelectionOptionUtils';
import {
    buildTopDeckSelectionReviewConfirmContext,
    parseTopDeckSelectionRestOrder,
    parseTopDeckSelectionReviewConfirmContext,
    parseTopDeckSelectionRuntimeContext,
} from './topDeckSelection/TopDeckSelectionContextUtils';
import {
    emitTopDeckSelectionCardsMovedToBottom,
    emitTopDeckSelectionResolved,
    emitTopDeckSelectionViewed
} from './topDeckSelection/TopDeckSelectionNotificationUtils';
import { matchesTopDeckSelectionFilter, type TopDeckSelectionFilter } from './topDeckSelection/TopDeckSelectionFilterUtils';
import { resolveTopDeckSelection } from './topDeckSelection/TopDeckSelectionResolution';
import { TOP_DECK_SELECTION_REVIEW_CHOICE_ID } from './topDeckSelection/TopDeckSelectionFlowUtils';

type TopDeckSelectionSelectConfig = {
    count?: number;
    optional?: boolean;
    toZone?: string;
    reveal?: boolean;
    filters?: TopDeckSelectionFilter;
    filtersAny?: TopDeckSelectionFilter[];
};

type TopDeckSelectionRestConfig = {
    toZone?: string;
    order?: 'random' | 'preserve';
};

type NormalizedTopDeckSelectionConfig = {
    effect: EffectDefinition;
    lookCount: number;
    selectCount: number;
    optional: boolean;
    toZone: 'hand' | 'play';
    reveal: boolean;
    filters: TopDeckSelectionFilter;
    filtersAny: TopDeckSelectionFilter[];
    restOrder: 'random' | 'preserve';
};

export class TopDeckSelectionManager {
    static processEffect(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        cardPlayNotificationId?: string
    ): { success: boolean; error?: string; requiresSelection?: boolean; autoApplied?: boolean } {
        const normalized = this.normalizeEffect(effect);
        if (!normalized.success) {
            return normalized;
        }

        const player = gameEnv.getPlayer(playerId);
        if (!player?.deck || !Array.isArray(player.deck.mainDeck)) {
            return { success: false, error: 'Player deck not found for select_from_top_deck' };
        }

        const deck = player.deck.mainDeck as string[];
        const lookedCarduids = DeckZoneManager.peekTop(deck, normalized.lookCount);
        if (lookedCarduids.length === 0) {
            return { success: true, autoApplied: true };
        }

        const emptySlots = player.zones ? SlotZoneUtils.getEmptySlotNames(player.zones) : [];
        const hasEmptySlot = emptySlots.length > 0;
        const lookedCards = lookedCarduids.map((carduid) => {
            const cardId = getCardIdFromUid(carduid);
            const cardData = CardDatabaseManager.getCardDetails(cardId);
            const traits = Array.isArray(cardData?.traits) ? cardData.traits : [];
            const hasDirectFilters = Object.keys(normalized.filters).length > 0;
            const matchesDirectFilters = hasDirectFilters
                ? matchesTopDeckSelectionFilter(cardData, normalized.filters)
                : false;
            const matchesAnyFilter = normalized.filtersAny.length === 0
                ? false
                : normalized.filtersAny.some((entry) => matchesTopDeckSelectionFilter(cardData, entry));
            return {
                carduid,
                cardId,
                name: cardData?.name,
                traits,
                matchesFilters: hasDirectFilters || normalized.filtersAny.length > 0
                    ? (matchesDirectFilters || matchesAnyFilter)
                    : true
            };
        });

        emitTopDeckSelectionViewed({
            gameEnv,
            playerId,
            sourceCarduid,
            effectId: normalized.effect.effectId,
            cards: lookedCards,
        });

        const selectable = lookedCards.filter((card) => card.matchesFilters);
        if (selectable.length === 0) {
            DeckZoneManager.moveToBottom(deck, lookedCarduids, parseTopDeckSelectionRestOrder(normalized.restOrder));
            emitTopDeckSelectionCardsMovedToBottom({
                gameEnv,
                playerId,
                sourceCarduid,
                effectId: normalized.effect.effectId,
                carduids: lookedCarduids,
                reason: 'select_from_top_deck_no_match'
            });
            emitTopDeckSelectionResolved({
                gameEnv,
                playerId,
                sourceCarduid,
                effectId: normalized.effect.effectId,
                toZone: normalized.toZone,
                result: 'NO_MATCH_MOVED_TO_BOTTOM',
                movedCarduids: lookedCarduids
            });
            return { success: true, autoApplied: true };
        }

        if (normalized.toZone === 'play' && !hasEmptySlot) {
            DeckZoneManager.moveToBottom(deck, lookedCarduids, parseTopDeckSelectionRestOrder(normalized.restOrder));
            emitTopDeckSelectionCardsMovedToBottom({
                gameEnv,
                playerId,
                sourceCarduid,
                effectId: normalized.effect.effectId,
                carduids: lookedCarduids,
                reason: 'select_from_top_deck_no_empty_slot'
            });
            emitTopDeckSelectionResolved({
                gameEnv,
                playerId,
                sourceCarduid,
                effectId: normalized.effect.effectId,
                toZone: normalized.toZone,
                result: 'NO_EMPTY_SLOT_MOVED_TO_BOTTOM',
                movedCarduids: lookedCarduids
            });
            return { success: true, autoApplied: true };
        }

        const singleLookBinaryMode =
            lookedCards.length === 1 &&
            selectable.length === 1 &&
            normalized.optional &&
            normalized.selectCount === 1;
        const options = buildTopDeckSelectionOptions({
            selectable,
            toZone: normalized.toZone,
            includeBottomOption: normalized.optional,
            singleLookBinaryMode
        });
        const defaultOptionIndex = normalized.optional ? options.length - 1 : undefined;

        if (singleLookBinaryMode) {
            ChoiceEventScheduler.enqueueOptionChoice(gameEnv, {
                playerId,
                sourceCarduid,
                effect: normalized.effect,
                headerText: 'Top of Deck',
                promptText: normalized.toZone === 'play'
                    ? 'Deploy this card or put it on the bottom of your deck?'
                    : 'Add this card to your hand or put it on the bottom of your deck?',
                availableOptions: options,
                defaultOptionIndex,
                context: {
                    topDeckSelection: {
                        lookedCarduids,
                        restOrder: parseTopDeckSelectionRestOrder(normalized.restOrder),
                        reveal: normalized.reveal,
                        toZone: normalized.toZone
                    }
                },
                cardPlayNotificationId
            });
            return { success: true, requiresSelection: true };
        }

        const optionChoicePromptText = normalized.toZone === 'play'
            ? (normalized.optional
                ? 'Choose 1 card to deploy, or put the looked cards on the bottom of your deck.'
                : 'Choose 1 card to deploy from the looked cards.')
            : 'Choose 1 card to reveal and add to your hand, or put the looked cards on the bottom of your deck.';
        const reviewContext = buildTopDeckSelectionReviewConfirmContext({
            lookedCards,
            restOrder: parseTopDeckSelectionRestOrder(normalized.restOrder),
            reveal: normalized.reveal,
            toZone: normalized.toZone,
            availableOptions: options,
            sourceCarduid,
            effect: normalized.effect,
            optionChoiceHeaderText: normalized.toZone === 'play' ? 'Deploy From Top Deck' : 'Triggered Effect',
            optionChoicePromptText,
            optionChoiceDefaultIndex: defaultOptionIndex,
            optionChoiceLayoutHint: normalized.optional ? 'hybrid' : 'card'
        });

        ChoiceEventScheduler.enqueuePromptChoice(gameEnv, {
            playerId,
            choiceId: TOP_DECK_SELECTION_REVIEW_CHOICE_ID,
            headerText: 'Top of Deck',
            promptText: 'Review the looked cards, then continue.',
            availableOptions: [
                {
                    index: 0,
                    label: 'Continue',
                    payload: { action: 'CONTINUE' },
                    display: ChoiceDisplayBuilder.text('Continue')
                }
            ],
            defaultOptionIndex: 0,
            sourceCarduid,
            context: reviewContext,
            cardPlayNotificationId
        });
        return { success: true, requiresSelection: true };
    }

    static executeReviewConfirmPromptChoice(event: PromptChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        const selectionIndex = event.data.selectedOptionIndex;
        if (typeof selectionIndex !== 'number') {
            return { success: false, error: 'No option selected for top deck review confirm' };
        }

        const reviewContext = parseTopDeckSelectionReviewConfirmContext(event.data.context);
        if (!reviewContext) {
            return { success: false, error: 'top deck review confirm missing context' };
        }

        const player = gameEnv.getPlayer(event.playerId);
        if (!player?.deck || !Array.isArray(player.deck.mainDeck)) {
            return { success: false, error: 'Player deck not found for top deck review confirm' };
        }

        if (reviewContext.topDeckSelection.toZone === 'play') {
            const emptySlots = player.zones ? SlotZoneUtils.getEmptySlotNames(player.zones) : [];
            if (emptySlots.length === 0) {
                DeckZoneManager.moveToBottom(
                    player.deck.mainDeck,
                    reviewContext.topDeckSelection.lookedCarduids,
                    reviewContext.topDeckSelection.restOrder
                );
                emitTopDeckSelectionCardsMovedToBottom({
                    gameEnv,
                    playerId: event.playerId,
                    sourceCarduid: reviewContext.topDeckSelection.sourceCarduid,
                    effectId: reviewContext.topDeckSelection.effect.effectId,
                    carduids: reviewContext.topDeckSelection.lookedCarduids,
                    reason: 'select_from_top_deck_no_empty_slot'
                });
                emitTopDeckSelectionResolved({
                    gameEnv,
                    playerId: event.playerId,
                    sourceCarduid: reviewContext.topDeckSelection.sourceCarduid,
                    effectId: reviewContext.topDeckSelection.effect.effectId,
                    toZone: 'play',
                    result: 'NO_EMPTY_SLOT_MOVED_TO_BOTTOM',
                    movedCarduids: reviewContext.topDeckSelection.lookedCarduids
                });
                return { success: true };
            }
        }

        const optionChoice = reviewContext.topDeckSelection.optionChoice;
        ChoiceEventScheduler.enqueueOptionChoice(gameEnv, {
            playerId: event.playerId,
            sourceCarduid: reviewContext.topDeckSelection.sourceCarduid,
            effect: reviewContext.topDeckSelection.effect,
            headerText: optionChoice.headerText,
            promptText: optionChoice.promptText,
            defaultOptionIndex: optionChoice.defaultOptionIndex,
            layoutHint: optionChoice.layoutHint,
            availableOptions: reviewContext.topDeckSelection.availableOptions,
            context: {
                topDeckSelection: {
                    lookedCarduids: reviewContext.topDeckSelection.lookedCarduids,
                    restOrder: reviewContext.topDeckSelection.restOrder,
                    reveal: reviewContext.topDeckSelection.reveal,
                    toZone: reviewContext.topDeckSelection.toZone
                }
            },
            cardPlayNotificationId: event.data.cardPlayNotificationId
        });
        return { success: true };
    }

    static executeOptionChoice(event: OptionChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        const selectionIndex = event.data.selectedOptionIndex;
        if (typeof selectionIndex !== 'number') {
            return { success: false, error: 'No option selected for select_from_top_deck' };
        }

        const player = gameEnv.getPlayer(event.playerId);
        if (!player?.deck || !Array.isArray(player.deck.mainDeck)) {
            return { success: false, error: 'Player deck not found for select_from_top_deck resolution' };
        }

        const runtimeContext = parseTopDeckSelectionRuntimeContext(event.data.context);
        if (!runtimeContext) {
            return { success: false, error: 'select_from_top_deck missing lookedCarduids context' };
        }

        const option = event.data.availableOptions.find((entry) => entry.index === selectionIndex);
        if (!option) {
            return { success: false, error: 'Selected option not found' };
        }

        const action = typeof option.payload?.action === 'string' ? option.payload.action : '';
        const chosenUid = typeof option.payload?.carduid === 'string' ? option.payload.carduid : undefined;

        if (action === 'BOTTOM') {
            DeckZoneManager.moveToBottom(player.deck.mainDeck, runtimeContext.lookedCarduids, runtimeContext.restOrder);
            emitTopDeckSelectionCardsMovedToBottom({
                gameEnv,
                playerId: event.playerId,
                sourceCarduid: event.data.sourceCarduid,
                effectId: event.data.effect?.effectId,
                carduids: runtimeContext.lookedCarduids,
                reason: 'select_from_top_deck_choice_bottom'
            });
            emitTopDeckSelectionResolved({
                gameEnv,
                playerId: event.playerId,
                sourceCarduid: event.data.sourceCarduid,
                effectId: event.data.effect?.effectId,
                toZone: runtimeContext.toZone,
                result: 'MOVED_TO_BOTTOM',
                movedCarduids: runtimeContext.lookedCarduids
            });
            return { success: true };
        }

        if (!chosenUid) {
            return { success: false, error: 'select_from_top_deck choice missing carduid' };
        }

        let destinationSlot: string | undefined;
        if (runtimeContext.toZone === 'play') {
            const emptySlots = player.zones ? SlotZoneUtils.getEmptySlotNames(player.zones) : [];
            if (emptySlots.length === 0) {
                DeckZoneManager.moveToBottom(player.deck.mainDeck, runtimeContext.lookedCarduids, runtimeContext.restOrder);
                emitTopDeckSelectionCardsMovedToBottom({
                    gameEnv,
                    playerId: event.playerId,
                    sourceCarduid: event.data.sourceCarduid,
                    effectId: event.data.effect?.effectId,
                    carduids: runtimeContext.lookedCarduids,
                    reason: 'select_from_top_deck_no_empty_slot'
                });
                emitTopDeckSelectionResolved({
                    gameEnv,
                    playerId: event.playerId,
                    sourceCarduid: event.data.sourceCarduid,
                    effectId: event.data.effect?.effectId,
                    toZone: runtimeContext.toZone,
                    result: 'NO_EMPTY_SLOT_MOVED_TO_BOTTOM',
                    movedCarduids: runtimeContext.lookedCarduids
                });
                return { success: true };
            }
            destinationSlot = emptySlots[0];
        }

        resolveTopDeckSelection(gameEnv, player.deck.mainDeck, runtimeContext.lookedCarduids, chosenUid, {
            order: runtimeContext.restOrder,
            toZone: runtimeContext.toZone,
            reveal: runtimeContext.reveal,
            playerId: event.playerId,
            sourceCarduid: event.data.sourceCarduid,
            effectId: event.data.effect?.effectId,
            destinationSlot,
        });
        return { success: true };
    }

    private static normalizeEffect(effect: EffectDefinition):
        | ({ success: true } & NormalizedTopDeckSelectionConfig)
        | { success: false; error: string } {
        const normalizedEffect = ensureEffectDefaults(effect);
        const lookCount = typeof normalizedEffect.parameters?.lookCount === 'number'
            ? normalizedEffect.parameters.lookCount
            : typeof normalizedEffect.parameters?.count === 'number'
                ? normalizedEffect.parameters.count
                : 0;
        if (lookCount <= 0) {
            return { success: false, error: 'select_from_top_deck requires a positive lookCount' };
        }

        const select = typeof normalizedEffect.parameters?.select === 'object' && normalizedEffect.parameters.select
            ? (normalizedEffect.parameters.select as TopDeckSelectionSelectConfig)
            : null;
        const rest = typeof normalizedEffect.parameters?.rest === 'object' && normalizedEffect.parameters.rest
            ? (normalizedEffect.parameters.rest as TopDeckSelectionRestConfig)
            : { toZone: 'deck_bottom', order: 'preserve' };
        const selectCount = typeof select?.count === 'number' ? select.count : 0;
        if (selectCount > 1) {
            return { success: false, error: 'select_from_top_deck select.count > 1 not supported yet' };
        }
        const toZone = select?.toZone;
        if (toZone !== 'hand' && toZone !== 'play') {
            return { success: false, error: `select_from_top_deck select.toZone must be 'hand' or 'play' (got ${String(toZone)})` };
        }
        const restToZone = typeof rest.toZone === 'string' ? rest.toZone : 'deck_bottom';
        if (restToZone !== 'deck_bottom') {
            return { success: false, error: `select_from_top_deck rest.toZone must be 'deck_bottom' (got ${restToZone})` };
        }

        const filters = typeof select?.filters === 'object' && select.filters ? select.filters : {};
        const filtersAny = Array.isArray(select?.filtersAny)
            ? select.filtersAny.filter((entry): entry is TopDeckSelectionFilter => Boolean(entry && typeof entry === 'object'))
            : [];

        return {
            success: true,
            effect: normalizedEffect,
            lookCount,
            selectCount,
            optional: select?.optional === true,
            toZone,
            reveal: select?.reveal === true,
            filters,
            filtersAny,
            restOrder: parseTopDeckSelectionRestOrder(rest.order),
        };
    }
}
