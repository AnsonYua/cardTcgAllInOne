// src/services/effects/DeployFromTopDeckManager.ts
// Supports deploy_from_top_deck (look at top N, optionally deploy 1 matching unit, move rest to bottom).

import type { GameEnvironment } from '../../models/GameEnvironment';
import { CardDatabaseManager, type CardData } from '../../models/CardSystem';
import type { EffectDefinition, OptionChoiceEvent, PromptChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import type { ExecutionResult } from '../ExecutionResult';
import { ensureEffectDefaults, validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { DeckZoneManager, type DeckBottomOrder } from '../zones/DeckZoneManager';
import { getCardIdFromUid } from '../../utils/CardUtils';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { ChoiceEventScheduler } from '../choices/ChoiceEventScheduler';
import { buildDeployOptions } from './deployFromTopDeck/DeployFromTopDeckOptionUtils';
import {
    parseDeployFromTopDeckContext,
    parseDeployReviewConfirmContext,
    parseRestOrder
} from './deployFromTopDeck/DeployFromTopDeckContextUtils';
import { resolveDeployFromTopDeckSelection } from './deployFromTopDeck/DeployFromTopDeckResolution';
import {
    buildDeployReviewConfirmContext,
    DEPLOY_FROM_TOP_DECK_REVIEW_CHOICE_ID
} from './deployFromTopDeck/DeployFromTopDeckFlowUtils';
import {
    emitDeployCardsMovedToBottom,
    emitDeployFromTopDeckResolved,
    emitDeployTopDeckViewed
} from './deployFromTopDeck/DeployFromTopDeckNotificationUtils';
import { ChoiceDisplayBuilder } from '../choices/ChoiceDisplayBuilder';

type DeployFromTopDeckSelectConfig = {
    count?: number;
    toZone?: string;
    filters?: {
        cardType?: string;
        traitsAny?: string[];
        level?: string;
    };
};

type DeployFromTopDeckRestConfig = {
    toZone?: string;
    order?: DeckBottomOrder;
};

export class DeployFromTopDeckManager {
    static processDeployFromTopDeckEffect(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        cardPlayNotificationId?: string
    ): { success: boolean; error?: string; requiresSelection?: boolean; autoApplied?: boolean } {
        const normalizedEffect = ensureEffectDefaults(effect);

        const player = gameEnv.getPlayer(playerId);
        if (!player?.deck || !Array.isArray(player.deck.mainDeck)) {
            return { success: false, error: 'Player deck not found for deploy_from_top_deck' };
        }

        const lookCount = typeof normalizedEffect.parameters?.lookCount === 'number'
            ? normalizedEffect.parameters.lookCount
            : 0;
        if (lookCount <= 0) {
            return { success: false, error: 'deploy_from_top_deck requires a positive lookCount' };
        }

        const select: DeployFromTopDeckSelectConfig | null =
            typeof normalizedEffect.parameters?.select === 'object' && normalizedEffect.parameters.select
                ? (normalizedEffect.parameters.select as DeployFromTopDeckSelectConfig)
                : null;
        const rest: DeployFromTopDeckRestConfig =
            typeof normalizedEffect.parameters?.rest === 'object' && normalizedEffect.parameters.rest
                ? (normalizedEffect.parameters.rest as DeployFromTopDeckRestConfig)
                : { toZone: 'deck_bottom', order: 'preserve' };
        const restToZone = typeof rest.toZone === 'string' ? rest.toZone : 'deck_bottom';
        if (restToZone !== 'deck_bottom') {
            return {
                success: false,
                error: `deploy_from_top_deck rest.toZone must be 'deck_bottom' (got ${restToZone})`
            };
        }
        const restOrder = parseRestOrder(rest.order);

        const selectCount = typeof select?.count === 'number' ? select.count : 0;
        if (selectCount > 1) {
            return { success: false, error: 'deploy_from_top_deck select.count > 1 not supported yet' };
        }

        const toZone = typeof select?.toZone === 'string' ? select.toZone : 'play';
        if (toZone !== 'play') {
            return { success: false, error: `deploy_from_top_deck select.toZone must be 'play' (got ${toZone})` };
        }

        const deck = player.deck.mainDeck as string[];
        const lookedCarduids = DeckZoneManager.peekTop(deck, lookCount);
        if (lookedCarduids.length === 0) {
            return { success: true, autoApplied: true };
        }

        const emptySlots = player.zones ? SlotZoneUtils.getEmptySlotNames(player.zones) : [];
        const hasEmptySlot = emptySlots.length > 0;

        const filters = typeof select?.filters === 'object' && select.filters ? select.filters : {};
        const traitsAny = Array.isArray(filters.traitsAny)
            ? filters.traitsAny.filter((t: unknown) => typeof t === 'string')
            : [];
        const cardType = typeof filters.cardType === 'string' ? filters.cardType : undefined;
        const levelFilter = typeof filters.level === 'string' ? filters.level : undefined;

        const lookedDetails = lookedCarduids.map(carduid => {
            const cardId = getCardIdFromUid(carduid);
            const cardData = CardDatabaseManager.getCardDetails(cardId) as CardData | undefined;
            const traits = Array.isArray(cardData?.traits) ? cardData!.traits : [];
            const level = typeof cardData?.level === 'number' ? cardData.level : 0;
            const matchesTraits = traitsAny.length === 0 ? true : traitsAny.some((trait: string) => traits.includes(trait));
            const matchesCardType = !cardType || cardData?.cardType === cardType;
            const matchesLevel = !levelFilter || validateComparisonFilter(level, levelFilter);
            return {
                carduid,
                cardId,
                name: cardData?.name || cardId,
                traits,
                matchesFilters: matchesTraits && matchesCardType && matchesLevel
            };
        });

        emitDeployTopDeckViewed({
            gameEnv,
            playerId,
            sourceCarduid,
            effectId: normalizedEffect.effectId,
            cards: lookedDetails
        });

        const selectable = lookedDetails.filter(card => card.matchesFilters);

        const isOptional = normalizedEffect.optional === true;

        if (!hasEmptySlot || selectable.length === 0) {
            DeckZoneManager.moveToBottom(deck, lookedCarduids, restOrder);
            emitDeployCardsMovedToBottom({
                gameEnv,
                playerId,
                sourceCarduid,
                effectId: normalizedEffect.effectId,
                carduids: lookedCarduids,
                reason: 'deploy_from_top_deck_auto_bottom'
            });
            emitDeployFromTopDeckResolved({
                gameEnv,
                playerId,
                sourceCarduid,
                effectId: normalizedEffect.effectId,
                result: hasEmptySlot ? 'NO_MATCH_MOVED_TO_BOTTOM' : 'NO_EMPTY_SLOT_MOVED_TO_BOTTOM',
                movedCarduids: lookedCarduids
            });
            return { success: true, autoApplied: true };
        }

        const options = buildDeployOptions(selectable, isOptional);
        const defaultOptionIndex = isOptional ? options.length - 1 : undefined;
        const optionChoicePromptText = isOptional
            ? 'Choose 1 card to deploy, or put the looked cards on the bottom of your deck.'
            : 'Choose 1 card to deploy from the looked cards.';

        const reviewContext = buildDeployReviewConfirmContext({
            lookedCards: lookedDetails,
            restOrder,
            availableOptions: options,
            sourceCarduid,
            effect: normalizedEffect,
            optionChoiceHeaderText: 'Deploy From Top Deck',
            optionChoicePromptText,
            optionChoiceDefaultIndex: defaultOptionIndex,
            optionChoiceLayoutHint: isOptional ? 'hybrid' : 'card'
        });

        ChoiceEventScheduler.enqueuePromptChoice(gameEnv, {
            playerId,
            choiceId: DEPLOY_FROM_TOP_DECK_REVIEW_CHOICE_ID,
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
        const selectedOptionIndex = event.data.selectedOptionIndex;
        if (typeof selectedOptionIndex !== 'number') {
            return { success: false, error: 'No option selected for deploy_from_top_deck review confirm' };
        }

        const reviewContext = parseDeployReviewConfirmContext(event.data.context);
        if (!reviewContext) {
            return { success: false, error: 'deploy_from_top_deck review confirm missing context' };
        }

        const player = gameEnv.getPlayer(event.playerId);
        if (!player?.deck || !Array.isArray(player.deck.mainDeck)) {
            return { success: false, error: 'Player deck not found for deploy_from_top_deck review confirm' };
        }

        const emptySlots = player.zones ? SlotZoneUtils.getEmptySlotNames(player.zones) : [];
        const lookedCarduids = reviewContext.deployFromTopDeck.lookedCarduids;
        const effect = reviewContext.deployFromTopDeck.effect;

        if (emptySlots.length === 0) {
            DeckZoneManager.moveToBottom(player.deck.mainDeck, lookedCarduids, reviewContext.deployFromTopDeck.restOrder);
            emitDeployCardsMovedToBottom({
                gameEnv,
                playerId: event.playerId,
                sourceCarduid: reviewContext.deployFromTopDeck.sourceCarduid,
                effectId: effect.effectId,
                carduids: lookedCarduids,
                reason: 'deploy_from_top_deck_auto_bottom'
            });
            emitDeployFromTopDeckResolved({
                gameEnv,
                playerId: event.playerId,
                sourceCarduid: reviewContext.deployFromTopDeck.sourceCarduid,
                effectId: effect.effectId,
                result: 'NO_EMPTY_SLOT_MOVED_TO_BOTTOM',
                movedCarduids: lookedCarduids
            });
            return { success: true };
        }

        const deployOptions = reviewContext.deployFromTopDeck.availableOptions.filter((option) => option.payload?.action === 'DEPLOY');
        if (deployOptions.length === 0) {
            DeckZoneManager.moveToBottom(player.deck.mainDeck, lookedCarduids, reviewContext.deployFromTopDeck.restOrder);
            emitDeployCardsMovedToBottom({
                gameEnv,
                playerId: event.playerId,
                sourceCarduid: reviewContext.deployFromTopDeck.sourceCarduid,
                effectId: effect.effectId,
                carduids: lookedCarduids,
                reason: 'deploy_from_top_deck_auto_bottom'
            });
            emitDeployFromTopDeckResolved({
                gameEnv,
                playerId: event.playerId,
                sourceCarduid: reviewContext.deployFromTopDeck.sourceCarduid,
                effectId: effect.effectId,
                result: 'NO_MATCH_MOVED_TO_BOTTOM',
                movedCarduids: lookedCarduids
            });
            return { success: true };
        }

        const isOptional = effect.optional === true;
        if (!isOptional && deployOptions.length === 1) {
            const chosenUid = typeof deployOptions[0].payload?.carduid === 'string'
                ? deployOptions[0].payload.carduid
                : '';
            if (!chosenUid) {
                return { success: false, error: 'deploy_from_top_deck review confirm missing deploy carduid' };
            }

            resolveDeployFromTopDeckSelection(gameEnv, player.deck.mainDeck, lookedCarduids, chosenUid, {
                order: reviewContext.deployFromTopDeck.restOrder,
                playerId: event.playerId,
                sourceCarduid: reviewContext.deployFromTopDeck.sourceCarduid,
                destinationSlot: emptySlots[0],
                effectId: effect.effectId
            });
            return { success: true };
        }

        const optionChoice = reviewContext.deployFromTopDeck.optionChoice;
        ChoiceEventScheduler.enqueueOptionChoice(gameEnv, {
            playerId: event.playerId,
            sourceCarduid: reviewContext.deployFromTopDeck.sourceCarduid,
            effect,
            headerText: optionChoice.headerText,
            promptText: optionChoice.promptText,
            defaultOptionIndex: optionChoice.defaultOptionIndex,
            layoutHint: optionChoice.layoutHint,
            availableOptions: reviewContext.deployFromTopDeck.availableOptions,
            context: {
                deployFromTopDeck: {
                    lookedCarduids,
                    restOrder: reviewContext.deployFromTopDeck.restOrder
                }
            },
            cardPlayNotificationId: event.data.cardPlayNotificationId
        });

        return { success: true };
    }

    static executeOptionChoice(event: OptionChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        const selectionIndex = event.data.selectedOptionIndex;
        if (typeof selectionIndex !== 'number') {
            return { success: false, error: 'No option selected for deploy_from_top_deck' };
        }

        const player = gameEnv.getPlayer(event.playerId);
        if (!player?.deck || !Array.isArray(player.deck.mainDeck)) {
            return { success: false, error: 'Player deck not found for deploy_from_top_deck resolution' };
        }

        const ctx = parseDeployFromTopDeckContext(event.data.context);
        if (!ctx) {
            return { success: false, error: 'deploy_from_top_deck missing lookedCarduids context' };
        }

        const option = event.data.availableOptions.find(opt => opt.index === selectionIndex);
        if (!option) {
            return { success: false, error: 'Selected option not found' };
        }

        const payload = option.payload || {};
        const action = typeof payload.action === 'string' ? payload.action : '';

        const deck = player.deck.mainDeck as string[];

        if (action === 'DEPLOY') {
            const chosenUid = typeof payload.carduid === 'string' ? payload.carduid : undefined;
            if (!chosenUid) {
                return { success: false, error: 'deploy_from_top_deck DEPLOY missing carduid' };
            }

            const emptySlots = player.zones ? SlotZoneUtils.getEmptySlotNames(player.zones) : [];
            if (emptySlots.length === 0) {
                return { success: false, error: 'No empty unit slots available for deploy_from_top_deck' };
            }

            resolveDeployFromTopDeckSelection(gameEnv, deck, ctx.lookedCarduids, chosenUid, {
                order: ctx.restOrder,
                playerId: event.playerId,
                sourceCarduid: event.data.sourceCarduid,
                destinationSlot: emptySlots[0],
                effectId: event.data.effect?.effectId
            });

            return { success: true };
        }

        DeckZoneManager.moveToBottom(deck, ctx.lookedCarduids, ctx.restOrder);
        emitDeployCardsMovedToBottom({
            gameEnv,
            playerId: event.playerId,
            sourceCarduid: event.data.sourceCarduid,
            effectId: event.data.effect?.effectId,
            carduids: ctx.lookedCarduids,
            reason: 'deploy_from_top_deck_choice_bottom'
        });
        emitDeployFromTopDeckResolved({
            gameEnv,
            playerId: event.playerId,
            sourceCarduid: event.data.sourceCarduid,
            effectId: event.data.effect?.effectId,
            result: 'MOVED_TO_BOTTOM',
            movedCarduids: ctx.lookedCarduids
        });
        return { success: true };
    }
}
