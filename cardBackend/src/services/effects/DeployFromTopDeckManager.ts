// src/services/effects/DeployFromTopDeckManager.ts
// Supports deploy_from_top_deck (look at top N, optionally deploy 1 matching unit, move rest to bottom).

import type { GameEnvironment } from '../../models/GameEnvironment';
import { CardDatabaseManager, type CardData } from '../../models/CardSystem';
import type { EffectDefinition, OptionChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import type { ExecutionResult } from '../ExecutionResult';
import { ensureEffectDefaults, validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { DeckZoneManager, type DeckBottomOrder } from '../zones/DeckZoneManager';
import { GameNotificationManager } from '../GameNotificationManager';
import { getCardIdFromUid } from '../../utils/CardUtils';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { ChoiceEventScheduler } from '../choices/ChoiceEventScheduler';
import { buildDeployOptions } from './deployFromTopDeck/DeployFromTopDeckOptionUtils';
import { parseDeployFromTopDeckContext, parseRestOrder } from './deployFromTopDeck/DeployFromTopDeckContextUtils';
import { resolveDeployFromTopDeckSelection } from './deployFromTopDeck/DeployFromTopDeckResolution';

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
                cardData,
                matches: matchesTraits && matchesCardType && matchesLevel
            };
        });

        const selectable = lookedDetails.filter(card => card.matches);

        const notificationManager = new GameNotificationManager(gameEnv);

        const isOptional = normalizedEffect.optional === true;

        if (!hasEmptySlot || selectable.length === 0) {
            DeckZoneManager.moveToBottom(deck, lookedCarduids, restOrder);
            notificationManager.addNotificationEvent(
                'CARDS_MOVED_TO_DECK_BOTTOM',
                {
                    playerId,
                    sourceCarduid,
                    effectId: normalizedEffect.effectId,
                    carduids: lookedCarduids,
                    reason: 'deploy_from_top_deck_auto_bottom',
                    timestamp: Date.now()
                },
                'normal'
            );
            notificationManager.addNotificationEvent(
                'DEPLOY_FROM_TOP_DECK_RESOLVED',
                {
                    playerId,
                    sourceCarduid,
                    effectId: normalizedEffect.effectId,
                    result: hasEmptySlot ? 'NO_MATCH_MOVED_TO_BOTTOM' : 'NO_EMPTY_SLOT_MOVED_TO_BOTTOM',
                    movedCarduids: lookedCarduids,
                    timestamp: Date.now()
                },
                'normal'
            );
            return { success: true, autoApplied: true };
        }

        if (!isOptional) {
            if (selectable.length === 1) {
                const chosen = selectable[0];
                resolveDeployFromTopDeckSelection(gameEnv, deck, lookedCarduids, chosen.carduid, {
                    order: restOrder,
                    playerId,
                    sourceCarduid,
                    destinationSlot: emptySlots[0],
                    effectId: normalizedEffect.effectId
                });
                return { success: true, autoApplied: true };
            }

            const options = buildDeployOptions(selectable, false);

            ChoiceEventScheduler.enqueueOptionChoice(gameEnv, {
                playerId,
                sourceCarduid,
                effect: normalizedEffect,
                availableOptions: options,
                context: {
                    deployFromTopDeck: {
                        lookedCarduids,
                        restOrder
                    }
                },
                cardPlayNotificationId
            });

            return { success: true, requiresSelection: true };
        }

        const options = buildDeployOptions(selectable, true);

        ChoiceEventScheduler.enqueueOptionChoice(gameEnv, {
            playerId,
            sourceCarduid,
            effect: normalizedEffect,
            availableOptions: options,
            context: {
                deployFromTopDeck: {
                    lookedCarduids,
                    restOrder
                }
            },
            cardPlayNotificationId
        });

        return { success: true, requiresSelection: true };
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
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent(
            'CARDS_MOVED_TO_DECK_BOTTOM',
            {
                playerId: event.playerId,
                sourceCarduid: event.data.sourceCarduid,
                effectId: event.data.effect?.effectId,
                carduids: ctx.lookedCarduids,
                reason: 'deploy_from_top_deck_choice_bottom',
                timestamp: Date.now()
            },
            'normal'
        );
        notificationManager.addNotificationEvent(
            'DEPLOY_FROM_TOP_DECK_RESOLVED',
            {
                playerId: event.playerId,
                sourceCarduid: event.data.sourceCarduid,
                effectId: event.data.effect?.effectId,
                result: 'MOVED_TO_BOTTOM',
                movedCarduids: ctx.lookedCarduids,
                timestamp: Date.now()
            },
            'normal'
        );
        return { success: true };
    }
}
