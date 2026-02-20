// src/services/effects/TutorTopDeckManager.ts
// Handles tutor_top_deck effects (look at top N, optionally take matching cards, move rest to bottom).

import type { GameEnvironment } from '../../models/GameEnvironment';
import { CardDatabaseManager, type CardData } from '../../models/CardSystem';
import type { EffectDefinition, OptionChoiceEvent, OptionChoiceOption, PromptChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { HandZoneManager } from '../zones/HandZoneManager';
import { DeckZoneManager, type DeckBottomOrder } from '../zones/DeckZoneManager';
import { ChoiceEventScheduler } from '../choices/ChoiceEventScheduler';
import { ChoiceDisplayBuilder } from '../choices/ChoiceDisplayBuilder';
import type { ExecutionResult } from '../ExecutionResult';
import { getCardIdFromUid } from '../../utils/CardUtils';
import {
    TUTOR_TOP_DECK_REVEAL_CHOICE_ID,
    buildTutorRevealConfirmContext,
    buildTutorTopDeckOptions,
    parseTutorRevealConfirmContext
} from './tutorTopDeck/TutorTopDeckFlowUtils';
import { parseTutorRestOrder, parseTutorRuntimeContext } from './tutorTopDeck/TutorTopDeckContextUtils';
import {
    emitTutorCardsMovedToBottom,
    emitTutorTopDeckResolved,
    emitTutorTopDeckViewed
} from './tutorTopDeck/TutorTopDeckNotificationUtils';
import { matchesSingleTutorFilter, type TutorCardFilter } from './tutorTopDeck/TutorTopDeckFilterUtils';

type TutorSelectConfig = {
    count?: number;
    optional?: boolean;
    toZone?: string;
    reveal?: boolean;
    filters?: TutorCardFilter;
    filtersAny?: TutorCardFilter[];
};

type TutorRestConfig = {
    toZone?: string;
    order?: 'random' | 'preserve';
};

export class TutorTopDeckManager {
    static processTutorTopDeckEffect(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        cardPlayNotificationId?: string
    ): { success: boolean; error?: string; requiresSelection?: boolean; autoApplied?: boolean } {
        const normalizedEffect = ensureEffectDefaults(effect);
        const sourceCardId = getCardIdFromUid(sourceCarduid);
        const sourceCardName = CardDatabaseManager.getCardDetails(sourceCardId)?.name || sourceCardId;
        const isGd01048DeployTutor = sourceCardId === 'GD01-048' && normalizedEffect.effectId === 'deploy_effect';

        const player = gameEnv.getPlayer(playerId);
        if (!player?.deck || !Array.isArray(player.deck.mainDeck)) {
            return { success: false, error: 'Player deck not found for tutor_top_deck' };
        }

        const count = typeof normalizedEffect.parameters?.count === 'number' ? normalizedEffect.parameters.count : 0;
        if (count <= 0) {
            return { success: false, error: 'tutor_top_deck requires a positive count' };
        }

        const deck = player.deck.mainDeck as string[];
        const looked = DeckZoneManager.peekTop(deck, count);
        if (looked.length === 0) {
            return { success: true, autoApplied: true };
        }

        const select: TutorSelectConfig | null = typeof normalizedEffect.parameters?.select === 'object' && normalizedEffect.parameters.select
            ? (normalizedEffect.parameters.select as TutorSelectConfig)
            : null;
        const rest: TutorRestConfig = typeof normalizedEffect.parameters?.rest === 'object' && normalizedEffect.parameters.rest
            ? (normalizedEffect.parameters.rest as TutorRestConfig)
            : { toZone: 'deck_bottom', order: 'preserve' };

        const selectCount = typeof select?.count === 'number' ? select.count : 0;
        if (selectCount > 1) {
            return { success: false, error: 'tutor_top_deck select.count > 1 not supported yet' };
        }

        const optional = select?.optional === true;
        const reveal = select?.reveal === true;
        const toZone = typeof select?.toZone === 'string' ? select.toZone : 'hand';
        const filters = typeof select?.filters === 'object' && select.filters ? select.filters : {};
        const filtersAny = Array.isArray(select?.filtersAny)
            ? select!.filtersAny.filter((entry): entry is NonNullable<TutorSelectConfig['filtersAny']>[number] => Boolean(entry && typeof entry === 'object'))
            : [];
        const hasDirectFilters = Object.keys(filters).length > 0;

        const lookedDetails = looked.map(carduid => {
            const cardId = getCardIdFromUid(carduid);
            const cardData = CardDatabaseManager.getCardDetails(cardId);
            const traits = Array.isArray(cardData?.traits) ? cardData.traits : [];
            const matchesDirectFilters = hasDirectFilters
                ? matchesSingleTutorFilter(cardData, filters)
                : false;
            const matchesAnyFilter = filtersAny.length === 0
                ? false
                : filtersAny.some((entry) => matchesSingleTutorFilter(cardData, entry));
            return {
                carduid,
                cardId,
                name: cardData?.name,
                traits,
                matchesFilters: hasDirectFilters || filtersAny.length > 0
                    ? (matchesDirectFilters || matchesAnyFilter)
                    : true
            };
        });

        emitTutorTopDeckViewed({
            gameEnv,
            playerId,
            sourceCarduid,
            effectId: normalizedEffect.effectId,
            cards: lookedDetails,
        });

        const selectable = lookedDetails.filter(card => card.matchesFilters);
        if (selectable.length === 0) {
            const lookedCarduids = lookedDetails.map(c => c.carduid);
            DeckZoneManager.moveToBottom(deck, lookedCarduids, parseTutorRestOrder(rest?.order));
            emitTutorCardsMovedToBottom({
                gameEnv,
                playerId,
                sourceCarduid,
                effectId: normalizedEffect.effectId,
                carduids: lookedCarduids,
                reason: 'tutor_top_deck_no_match'
            });
            emitTutorTopDeckResolved({
                gameEnv,
                playerId,
                sourceCarduid,
                effectId: normalizedEffect.effectId,
                result: 'NO_MATCH_MOVED_TO_BOTTOM',
                movedCarduids: lookedCarduids
            });
            return { success: true, autoApplied: true };
        }

        if (!optional && toZone === 'hand' && reveal) {
            const chosen = selectable[0];
            this.resolveSelection(deck, lookedDetails.map(c => c.carduid), chosen.carduid, {
                order: parseTutorRestOrder(rest?.order),
                toZone: 'hand',
                reveal: true,
                playerId,
                sourceCarduid,
                effectId: normalizedEffect.effectId
            }, gameEnv);
            return { success: true, autoApplied: true };
        }

        if (isGd01048DeployTutor) {
            const options: OptionChoiceOption[] = [
                {
                    index: 0,
                    label: 'Top',
                    payload: { action: 'TOP' },
                    display: ChoiceDisplayBuilder.text('Top')
                },
                {
                    index: 1,
                    label: 'Bottom',
                    payload: { action: 'BOTTOM' },
                    display: ChoiceDisplayBuilder.text('Bottom')
                }
            ];

            ChoiceEventScheduler.enqueuePromptChoice(gameEnv, {
                playerId,
                choiceId: 'tutor_top_deck_position',
                headerText: 'Choose Option',
                promptText: 'Put the card on top or bottom of your deck?',
                availableOptions: options,
                defaultOptionIndex: 1,
                sourceCarduid,
                context: {
                    tutor: {
                        lookedCarduids: lookedDetails.map(c => c.carduid),
                        restOrder: parseTutorRestOrder(rest?.order),
                        reveal
                    }
                },
                cardPlayNotificationId
            });

            return { success: true, requiresSelection: true };
        }

        const options = buildTutorTopDeckOptions(selectable);
        const noneIndex = options.length - 1;
        const revealContext = buildTutorRevealConfirmContext({
            lookedCards: lookedDetails,
            restOrder: parseTutorRestOrder(rest?.order),
            reveal,
            availableOptions: options,
            sourceCarduid,
            effect: normalizedEffect,
            optionChoiceHeaderText: normalizedEffect.trigger === 'DESTROYED' ? 'Destroyed Effect' : 'Triggered Effect',
            optionChoicePromptText: `${sourceCardName}: choose 1 card to reveal and add to your hand, or put the looked cards on the bottom of your deck.`,
            optionChoiceDefaultIndex: noneIndex
        });

        ChoiceEventScheduler.enqueuePromptChoice(gameEnv, {
            playerId,
            choiceId: TUTOR_TOP_DECK_REVEAL_CHOICE_ID,
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
            context: revealContext,
            cardPlayNotificationId
        });

        return { success: true, requiresSelection: true };
    }

    static executeRevealConfirmPromptChoice(event: PromptChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        const selectionIndex = event.data.selectedOptionIndex;
        if (typeof selectionIndex !== 'number') {
            return { success: false, error: 'No option selected for tutor_top_deck reveal confirm' };
        }

        const revealContext = parseTutorRevealConfirmContext(event.data.context);
        if (!revealContext) {
            return { success: false, error: 'tutor_top_deck reveal confirm missing context' };
        }

        const optionChoice = revealContext.tutor.optionChoice;
        ChoiceEventScheduler.enqueueOptionChoice(gameEnv, {
            playerId: event.playerId,
            sourceCarduid: revealContext.tutor.sourceCarduid,
            effect: revealContext.tutor.effect,
            headerText: optionChoice.headerText,
            promptText: optionChoice.promptText,
            defaultOptionIndex: optionChoice.defaultOptionIndex,
            layoutHint: optionChoice.layoutHint,
            availableOptions: revealContext.tutor.availableOptions,
            context: {
                tutor: {
                    lookedCarduids: revealContext.tutor.lookedCarduids,
                    restOrder: revealContext.tutor.restOrder,
                    reveal: revealContext.tutor.reveal
                }
            },
            cardPlayNotificationId: event.data.cardPlayNotificationId
        });

        return { success: true };
    }

    static executeOptionChoice(event: OptionChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        const selectionIndex = event.data.selectedOptionIndex;
        if (typeof selectionIndex !== 'number') {
            return { success: false, error: 'No option selected for tutor_top_deck' };
        }

        const player = gameEnv.getPlayer(event.playerId);
        if (!player?.deck || !Array.isArray(player.deck.mainDeck)) {
            return { success: false, error: 'Player deck not found for tutor_top_deck resolution' };
        }

        const tutorContext = parseTutorRuntimeContext(event.data.context);
        if (!tutorContext) {
            return { success: false, error: 'tutor_top_deck missing lookedCarduids context' };
        }

        const option = event.data.availableOptions.find(opt => opt.index === selectionIndex);
        if (!option) {
            return { success: false, error: 'Selected option not found' };
        }

        const payload = option.payload || {};
        const action = typeof payload.action === 'string' ? payload.action : '';

        const restOrder = tutorContext.restOrder;
        const reveal = tutorContext.reveal;

        if (action === 'TAKE') {
            const chosenUid = typeof payload.carduid === 'string' ? payload.carduid : undefined;
            if (!chosenUid) {
                return { success: false, error: 'tutor_top_deck TAKE missing carduid' };
            }

            this.resolveSelection(player.deck.mainDeck, tutorContext.lookedCarduids, chosenUid, {
                order: restOrder,
                toZone: 'hand',
                reveal,
                playerId: event.playerId,
                sourceCarduid: event.data.sourceCarduid,
                effectId: event.data.effect?.effectId
            }, gameEnv);

            return { success: true };
        }

        DeckZoneManager.moveToBottom(player.deck.mainDeck, tutorContext.lookedCarduids, restOrder);
        emitTutorCardsMovedToBottom({
            gameEnv,
            playerId: event.playerId,
            sourceCarduid: event.data.sourceCarduid,
            effectId: event.data.effect?.effectId,
            carduids: tutorContext.lookedCarduids,
            reason: 'tutor_top_deck_choice_bottom',
        });
        emitTutorTopDeckResolved({
            gameEnv,
            playerId: event.playerId,
            sourceCarduid: event.data.sourceCarduid,
            effectId: event.data.effect?.effectId,
            result: 'MOVED_TO_BOTTOM',
            movedCarduids: tutorContext.lookedCarduids,
        });
        return { success: true };
    }

    static executePromptChoice(event: PromptChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        const selectionIndex = event.data.selectedOptionIndex;
        if (typeof selectionIndex !== 'number') {
            return { success: false, error: 'No option selected for tutor_top_deck_position' };
        }

        const player = gameEnv.getPlayer(event.playerId);
        if (!player?.deck || !Array.isArray(player.deck.mainDeck)) {
            return { success: false, error: 'Player deck not found for tutor_top_deck_position resolution' };
        }

        const tutorContext = parseTutorRuntimeContext(event.data.context);
        if (!tutorContext) {
            return { success: false, error: 'tutor_top_deck_position missing lookedCarduids context' };
        }

        const option = event.data.availableOptions.find(opt => opt.index === selectionIndex);
        if (!option) {
            return { success: false, error: 'Selected option not found' };
        }

        const payload = option.payload || {};
        const action = typeof payload.action === 'string' ? payload.action : '';

        if (action === 'BOTTOM') {
            const sourceCarduid = (event.data.sourceCarduid ?? '').toString();
            DeckZoneManager.moveToBottom(player.deck.mainDeck, tutorContext.lookedCarduids, tutorContext.restOrder);
            emitTutorCardsMovedToBottom({
                gameEnv,
                playerId: event.playerId,
                sourceCarduid,
                effectId: undefined,
                carduids: tutorContext.lookedCarduids,
                reason: 'tutor_top_deck_choice_bottom',
            });
            emitTutorTopDeckResolved({
                gameEnv,
                playerId: event.playerId,
                sourceCarduid,
                effectId: undefined,
                result: 'MOVED_TO_BOTTOM',
                movedCarduids: tutorContext.lookedCarduids,
            });
            return { success: true };
        }

        const sourceCarduid = (event.data.sourceCarduid ?? '').toString();
        emitTutorTopDeckResolved({
            gameEnv,
            playerId: event.playerId,
            sourceCarduid,
            effectId: undefined,
            result: 'LEFT_ON_TOP',
            leftCarduids: tutorContext.lookedCarduids,
        });
        return { success: true };
    }

    private static resolveSelection(
        deck: string[],
        lookedCarduids: string[],
        chosenUid: string,
        params: {
            order: DeckBottomOrder;
            toZone: 'hand';
            reveal: boolean;
            playerId: string;
            sourceCarduid: string;
            effectId?: string;
        },
        gameEnv: GameEnvironment
    ): void {
        const extracted = DeckZoneManager.extractSpecific(deck, lookedCarduids);
        const chosenIndex = extracted.indexOf(chosenUid);
        const chosenCarduid = chosenIndex >= 0 ? extracted.splice(chosenIndex, 1)[0] : undefined;

        if (chosenCarduid) {
            const cardId = getCardIdFromUid(chosenCarduid);
            const cardData = CardDatabaseManager.getCardDetails(cardId) as CardData;
            HandZoneManager.addCardToHand(gameEnv, params.playerId, chosenCarduid, cardData, {
                eventType: 'CARD_ADDED_TO_HAND',
                sourceZone: 'deck',
                reason: 'tutor_top_deck',
                extraPayload: {
                    reveal: params.reveal,
                    revealToOpponent: params.reveal,
                    sourceCarduid: params.sourceCarduid,
                    effectId: params.effectId
                }
            });
        }

        DeckZoneManager.moveToBottom(deck, extracted, params.order);

        emitTutorTopDeckResolved({
            gameEnv,
            playerId: params.playerId,
            sourceCarduid: params.sourceCarduid,
            effectId: params.effectId,
            result: chosenCarduid ? 'ADDED_TO_HAND' : 'MOVED_TO_BOTTOM',
            addedCarduid: chosenCarduid,
            movedCarduids: extracted,
        });
    }
}
