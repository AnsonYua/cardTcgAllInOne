// src/services/effects/TutorTopDeckManager.ts
// Handles tutor_top_deck effects (look at top N, optionally take matching cards, move rest to bottom).

import type { GameEnvironment } from '../../models/GameEnvironment';
import { CardDatabaseManager, type CardData } from '../../models/CardSystem';
import type { EffectDefinition, OptionChoiceEvent, OptionChoiceOption, PromptChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { GameNotificationManager } from '../GameNotificationManager';
import { HandZoneManager } from '../zones/HandZoneManager';
import { DeckZoneManager, type DeckBottomOrder } from '../zones/DeckZoneManager';
import { ChoiceEventScheduler } from '../choices/ChoiceEventScheduler';
import { ChoiceDisplayBuilder } from '../choices/ChoiceDisplayBuilder';
import type { ExecutionResult } from '../ExecutionResult';
import { getCardIdFromUid } from '../../utils/CardUtils';

type TutorSelectConfig = {
    count?: number;
    optional?: boolean;
    toZone?: string;
    reveal?: boolean;
    filters?: {
        cardType?: string;
        traitsAny?: string[];
    };
};

type TutorRestConfig = {
    toZone?: string;
    order?: DeckBottomOrder;
};

function parseRestOrder(raw: unknown): DeckBottomOrder {
    return raw === 'random' ? 'random' : 'preserve';
}

function parseTutorContext(raw: unknown): { lookedCarduids: string[]; restOrder: DeckBottomOrder; reveal: boolean } | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const context = raw as Record<string, unknown>;
    const tutorRaw = context['tutor'];
    if (!tutorRaw || typeof tutorRaw !== 'object') {
        return null;
    }
    const tutor = tutorRaw as Record<string, unknown>;
    const looked = tutor['lookedCarduids'];
    const lookedCarduids = Array.isArray(looked)
        ? looked.filter((c: unknown) => typeof c === 'string')
        : [];
    const restOrder = parseRestOrder(tutor['restOrder']);
    const reveal = tutor['reveal'] === true;
    if (lookedCarduids.length === 0) {
        return null;
    }
    return { lookedCarduids, restOrder, reveal };
}

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
        const traitsAny = Array.isArray(filters.traitsAny) ? filters.traitsAny.filter((t: unknown) => typeof t === 'string') : [];
        const cardType = typeof filters.cardType === 'string' ? filters.cardType : undefined;

        const lookedDetails = looked.map(carduid => {
            const cardId = getCardIdFromUid(carduid);
            const cardData = CardDatabaseManager.getCardDetails(cardId);
            const traits = Array.isArray(cardData?.traits) ? cardData.traits : [];
            const matchesTraits = traitsAny.length === 0 ? true : traitsAny.some((trait: string) => traits.includes(trait));
            const matchesCardType = !cardType || (typeof cardData?.cardType === 'string' && cardData.cardType === cardType);
            return {
                carduid,
                cardId,
                name: cardData?.name,
                traits,
                matchesFilters: matchesTraits && matchesCardType
            };
        });

        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent(
            'TOP_DECK_VIEWED',
            {
                playerId,
                sourceCarduid,
                effectId: normalizedEffect.effectId,
                count: lookedDetails.length,
                cards: lookedDetails,
                revealToOpponent: false,
                timestamp: Date.now()
            },
            'normal'
        );

        const selectable = lookedDetails.filter(card => card.matchesFilters);
        if (selectable.length === 0) {
            DeckZoneManager.moveToBottom(deck, lookedDetails.map(c => c.carduid), parseRestOrder(rest?.order));
            notificationManager.addNotificationEvent(
                'CARDS_MOVED_TO_DECK_BOTTOM',
                {
                    playerId,
                    sourceCarduid,
                    effectId: normalizedEffect.effectId,
                    carduids: lookedDetails.map(c => c.carduid),
                    reason: 'tutor_top_deck_no_match',
                    timestamp: Date.now()
                },
                'normal'
            );
            notificationManager.addNotificationEvent(
                'TUTOR_TOP_DECK_RESOLVED',
                {
                    playerId,
                    sourceCarduid,
                    effectId: normalizedEffect.effectId,
                    result: 'NO_MATCH_MOVED_TO_BOTTOM',
                    movedCarduids: lookedDetails.map(c => c.carduid),
                    timestamp: Date.now()
                },
                'normal'
            );
            return { success: true, autoApplied: true };
        }

        if (!optional && toZone === 'hand' && reveal) {
            const chosen = selectable[0];
            this.resolveSelection(deck, lookedDetails.map(c => c.carduid), chosen.carduid, {
                order: parseRestOrder(rest?.order),
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
                        restOrder: parseRestOrder(rest?.order),
                        reveal
                    }
                },
                cardPlayNotificationId
            });

            return { success: true, requiresSelection: true };
        }

        const options: OptionChoiceOption[] = [];
        for (let i = 0; i < selectable.length; i++) {
            const choice = selectable[i];
            options.push({
                index: i,
                label: `Reveal and add ${choice.cardId} to hand`,
                payload: { action: 'TAKE', carduid: choice.carduid, cardId: choice.cardId },
                display: ChoiceDisplayBuilder.card(choice.cardId, `Reveal and add ${choice.cardId} to hand`)
            });
        }

        const noneIndex = options.length;
        options.push({
            index: noneIndex,
            label: 'Put it on the bottom of your deck',
            payload: { action: 'BOTTOM' },
            display: ChoiceDisplayBuilder.text('Put it on the bottom of your deck')
        });

        ChoiceEventScheduler.enqueueOptionChoice(gameEnv, {
            playerId,
            sourceCarduid,
            effect: normalizedEffect,
            availableOptions: options,
            context: {
                tutor: {
                    lookedCarduids: lookedDetails.map(c => c.carduid),
                    restOrder: parseRestOrder(rest?.order),
                    reveal
                }
            },
            cardPlayNotificationId
        });

        return { success: true, requiresSelection: true };
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

        const tutorContext = parseTutorContext(event.data.context);
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
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent(
            'CARDS_MOVED_TO_DECK_BOTTOM',
            {
                playerId: event.playerId,
                sourceCarduid: event.data.sourceCarduid,
                effectId: event.data.effect?.effectId,
                carduids: tutorContext.lookedCarduids,
                reason: 'tutor_top_deck_choice_bottom',
                timestamp: Date.now()
            },
            'normal'
        );
        notificationManager.addNotificationEvent(
            'TUTOR_TOP_DECK_RESOLVED',
            {
                playerId: event.playerId,
                sourceCarduid: event.data.sourceCarduid,
                effectId: event.data.effect?.effectId,
                result: 'MOVED_TO_BOTTOM',
                movedCarduids: tutorContext.lookedCarduids,
                timestamp: Date.now()
            },
            'normal'
        );
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

        const tutorContext = parseTutorContext(event.data.context);
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
            DeckZoneManager.moveToBottom(player.deck.mainDeck, tutorContext.lookedCarduids, tutorContext.restOrder);
            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.addNotificationEvent(
                'CARDS_MOVED_TO_DECK_BOTTOM',
                {
                    playerId: event.playerId,
                    sourceCarduid: event.data.sourceCarduid,
                    effectId: undefined,
                    carduids: tutorContext.lookedCarduids,
                    reason: 'tutor_top_deck_choice_bottom',
                    timestamp: Date.now()
                },
                'normal'
            );
            notificationManager.addNotificationEvent(
                'TUTOR_TOP_DECK_RESOLVED',
                {
                    playerId: event.playerId,
                    sourceCarduid: event.data.sourceCarduid,
                    effectId: undefined,
                    result: 'MOVED_TO_BOTTOM',
                    movedCarduids: tutorContext.lookedCarduids,
                    timestamp: Date.now()
                },
                'normal'
            );
            return { success: true };
        }

        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent(
            'TUTOR_TOP_DECK_RESOLVED',
            {
                playerId: event.playerId,
                sourceCarduid: event.data.sourceCarduid,
                effectId: undefined,
                result: 'LEFT_ON_TOP',
                leftCarduids: tutorContext.lookedCarduids,
                timestamp: Date.now()
            },
            'normal'
        );
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
                    sourceCarduid: params.sourceCarduid,
                    effectId: params.effectId
                }
            });
        }

        DeckZoneManager.moveToBottom(deck, extracted, params.order);

        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent(
            'TUTOR_TOP_DECK_RESOLVED',
            {
                playerId: params.playerId,
                sourceCarduid: params.sourceCarduid,
                effectId: params.effectId,
                result: chosenCarduid ? 'ADDED_TO_HAND' : 'MOVED_TO_BOTTOM',
                addedCarduid: chosenCarduid,
                movedCarduids: extracted,
                timestamp: Date.now()
            },
            'normal'
        );
    }
}
