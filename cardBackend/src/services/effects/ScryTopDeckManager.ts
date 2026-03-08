import type { GameEnvironment } from '../../models/GameEnvironment';
import { CardDatabaseManager, createZoneCard } from '../../models/CardSystem';
import type { EffectDefinition, OptionChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import { ChoiceEventScheduler } from '../choices/ChoiceEventScheduler';
import { ChoiceDisplayBuilder } from '../choices/ChoiceDisplayBuilder';
import type { ExecutionResult } from '../ExecutionResult';

type ScryRuntimeContext = {
    kind: 'SCRY_TOP_DECK';
    sourcePlayerId: string;
    sourceCarduid?: string;
    effectId?: string;
    lookedCarduids: string[];
    choice?: string;
    keep: number;
    restDestination: 'bottom' | 'trash';
};

function parseRestDestination(effect: EffectDefinition): 'bottom' | 'trash' {
    const params = effect.parameters || {};
    const directRest = typeof params.rest === 'string' ? params.rest.toLowerCase() : '';
    if (directRest === 'trash') {
        return 'trash';
    }
    if (directRest === 'bottom' || directRest === 'deck_bottom') {
        return 'bottom';
    }

    if (typeof (params as any).bottom === 'number') {
        return 'bottom';
    }

    return 'bottom';
}

function parseChoiceMode(effect: EffectDefinition): string {
    const params = effect.parameters || {};
    const explicit = typeof params.choice === 'string' ? params.choice.toLowerCase() : '';
    if (explicit) {
        return explicit;
    }

    const legacyChoices = Array.isArray((params as any).choices)
        ? (params as any).choices
            .filter((entry: unknown): entry is string => typeof entry === 'string')
            .map((entry: string) => entry.toLowerCase())
        : [];
    if (legacyChoices.includes('top') && legacyChoices.includes('bottom')) {
        return 'top_or_bottom';
    }
    if (legacyChoices.includes('top') && legacyChoices.includes('trash')) {
        return 'top_or_trash';
    }

    return '';
}

function buildCardChoiceOptions(carduids: string[]) {
    return carduids.map((carduid, index) => {
        const cardId = carduid.split('_')[0];
        const cardData = CardDatabaseManager.getCardDetails(cardId);
        return {
            index,
            label: cardData?.name || cardId,
            payload: {
                action: 'KEEP_CARD',
                carduid
            },
            display: ChoiceDisplayBuilder.card(cardId, cardData?.name || cardId)
        };
    });
}

function moveCardsToTrash(gameEnv: GameEnvironment, playerId: string, carduids: string[]): void {
    const player = gameEnv.getPlayer(playerId);
    if (!player?.zones) {
        return;
    }

    if (!Array.isArray(player.zones.trashArea)) {
        player.zones.trashArea = [];
    }

    for (const carduid of carduids) {
        if (typeof carduid !== 'string' || carduid.length === 0) {
            continue;
        }

        const cardId = carduid.split('_')[0];
        const cardData = CardDatabaseManager.getCardDetails(cardId) || {
            id: cardId,
            name: `Unknown Card ${cardId}`,
            cardType: 'command'
        };

        const zoneCard = createZoneCard(carduid, cardId, cardData as any, playerId);
        player.zones.trashArea.push(zoneCard);
    }
}

function applyResolvedScryChoice(gameEnv: GameEnvironment, context: ScryRuntimeContext, selectedOptionIndex: number): ExecutionResult {
    const player = gameEnv.getPlayer(context.sourcePlayerId);
    if (!player?.deck || !Array.isArray(player.deck.mainDeck)) {
        return { success: false, error: `Player ${context.sourcePlayerId} deck not found for scry` };
    }

    const looked = Array.isArray(context.lookedCarduids) ? [...context.lookedCarduids] : [];
    if (looked.length === 0) {
        return { success: true };
    }

    const choice = typeof context.choice === 'string' ? context.choice : '';

    if (looked.length === 1 && choice === 'top_or_bottom') {
        const [carduid] = looked;
        if (selectedOptionIndex === 1) {
            player.deck.mainDeck.push(carduid);
            return { success: true };
        }

        player.deck.mainDeck.unshift(carduid);
        return { success: true };
    }

    const keepIndex = Math.max(0, Math.min(selectedOptionIndex, looked.length - 1));
    const keepCarduid = looked[keepIndex];
    const restCarduids = looked.filter((carduid) => carduid !== keepCarduid);

    if (keepCarduid) {
        player.deck.mainDeck.unshift(keepCarduid);
    }

    if (restCarduids.length > 0) {
        if (context.restDestination === 'trash') {
            moveCardsToTrash(gameEnv, context.sourcePlayerId, restCarduids);
        } else {
            player.deck.mainDeck.push(...restCarduids);
        }
    }

    return { success: true };
}

export class ScryTopDeckManager {
    static processScryTopDeckEffect(
        gameEnv: GameEnvironment,
        sourcePlayerId: string,
        sourceCarduid: string | undefined,
        effect: EffectDefinition
    ): { success: boolean; error?: string } {
        const params = effect.parameters || {};
        const countRaw = params.count ?? (params as any).lookCount ?? params.value;
        const count = typeof countRaw === 'number' ? countRaw : Number(countRaw) || 0;
        const keep = typeof params.keep === 'number' ? params.keep : 1;
        const choice = parseChoiceMode(effect);

        if (count <= 0) {
            return { success: false, error: 'scry_top_deck requires a positive count' };
        }

        const player = gameEnv.getPlayer(sourcePlayerId);
        if (!player?.deck || !Array.isArray(player.deck.mainDeck)) {
            return { success: false, error: `Player ${sourcePlayerId} deck not found for scry` };
        }

        const looked = player.deck.mainDeck.splice(0, count);
        if (looked.length === 0) {
            return { success: true };
        }

        const keepCount = Math.max(0, Math.min(keep, looked.length));
        const restDestination = parseRestDestination(effect);

        // Interactive modes supported now: top/bottom positioning for single-card scry,
        // and choose-1-keep flows for looked card sets.
        const supportsInteractive =
            (choice === 'top_or_bottom' && looked.length === 1) ||
            (keepCount === 1 && looked.length > 1);

        if (!supportsInteractive) {
            const keepCards = looked.slice(0, keepCount);
            const restCards = looked.slice(keepCount);
            player.deck.mainDeck = keepCards.concat(player.deck.mainDeck);
            if (restCards.length > 0) {
                if (restDestination === 'trash') {
                    moveCardsToTrash(gameEnv, sourcePlayerId, restCards);
                } else {
                    player.deck.mainDeck.push(...restCards);
                }
            }
            return { success: true };
        }

        if (choice === 'top_or_bottom' && looked.length === 1) {
            ChoiceEventScheduler.enqueueOptionChoice(gameEnv, {
                playerId: sourcePlayerId,
                sourceCarduid: sourceCarduid ?? '',
                effect,
                headerText: 'Top of Deck',
                promptText: 'Put the card on top or bottom of your deck?',
                availableOptions: [
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
                ],
                defaultOptionIndex: 0,
                context: {
                    kind: 'SCRY_TOP_DECK',
                    sourcePlayerId,
                    sourceCarduid,
                    effectId: effect.effectId,
                    lookedCarduids: looked,
                    choice,
                    keep: keepCount,
                    restDestination
                } satisfies ScryRuntimeContext
            });

            return { success: true };
        }

        ChoiceEventScheduler.enqueueOptionChoice(gameEnv, {
            playerId: sourcePlayerId,
            sourceCarduid: sourceCarduid ?? '',
            effect,
            headerText: 'Top of Deck',
            promptText: `Choose ${keepCount} card to keep on top of your deck.`,
            availableOptions: buildCardChoiceOptions(looked),
            defaultOptionIndex: 0,
            context: {
                kind: 'SCRY_TOP_DECK',
                sourcePlayerId,
                sourceCarduid,
                effectId: effect.effectId,
                lookedCarduids: looked,
                choice,
                keep: keepCount,
                restDestination
            } satisfies ScryRuntimeContext
        });

        return { success: true };
    }

    private static resolveChoiceByIndex(selectedOptionIndex: number, rawContext: unknown, gameEnv: GameEnvironment): ExecutionResult {
        if (selectedOptionIndex < 0) {
            return { success: false, error: 'No option selected for scry_top_deck' };
        }

        const context = rawContext && typeof rawContext === 'object' ? (rawContext as Partial<ScryRuntimeContext>) : null;
        if (!context || context.kind !== 'SCRY_TOP_DECK' || typeof context.sourcePlayerId !== 'string') {
            return { success: false, error: 'scry_top_deck missing runtime context' };
        }

        return applyResolvedScryChoice(gameEnv, context as ScryRuntimeContext, selectedOptionIndex);
    }

    static executeOptionChoice(event: OptionChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        const selectedOptionIndex = typeof event.data.selectedOptionIndex === 'number'
            ? event.data.selectedOptionIndex
            : -1;
        return this.resolveChoiceByIndex(selectedOptionIndex, event.data.context, gameEnv);
    }

}
