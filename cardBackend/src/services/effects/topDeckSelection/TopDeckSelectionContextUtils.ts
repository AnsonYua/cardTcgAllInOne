import type { DeckBottomOrder } from '../../zones/DeckZoneManager';
import type { EffectDefinition, OptionChoiceOption } from '../../EventQueue/interfaces/GameEvent';
import type { TopDeckSelectionLookedCard } from './TopDeckSelectionOptionUtils';

export type TopDeckSelectionRuntimeContext = {
    lookedCarduids: string[];
    restOrder: DeckBottomOrder;
    reveal: boolean;
    toZone: 'hand' | 'play';
};

export type TopDeckSelectionReviewConfirmContext = {
    kind: 'TOP_DECK_SELECTION_REVIEW_CONFIRM';
    topDeckSelection: {
        lookedCards: TopDeckSelectionLookedCard[];
        lookedCarduids: string[];
        restOrder: DeckBottomOrder;
        reveal: boolean;
        toZone: 'hand' | 'play';
        availableOptions: OptionChoiceOption[];
        sourceCarduid: string;
        effect: EffectDefinition;
        optionChoice: {
            headerText: string;
            promptText: string;
            defaultOptionIndex?: number;
            layoutHint: 'card' | 'hybrid';
        };
    };
};

export function parseTopDeckSelectionRestOrder(raw: unknown): DeckBottomOrder {
    return raw === 'random' ? 'random' : 'preserve';
}

export function buildTopDeckSelectionReviewConfirmContext(params: {
    lookedCards: TopDeckSelectionLookedCard[];
    restOrder: DeckBottomOrder;
    reveal: boolean;
    toZone: 'hand' | 'play';
    availableOptions: OptionChoiceOption[];
    sourceCarduid: string;
    effect: EffectDefinition;
    optionChoiceHeaderText: string;
    optionChoicePromptText: string;
    optionChoiceDefaultIndex?: number;
    optionChoiceLayoutHint: 'card' | 'hybrid';
}): TopDeckSelectionReviewConfirmContext {
    return {
        kind: 'TOP_DECK_SELECTION_REVIEW_CONFIRM',
        topDeckSelection: {
            lookedCards: params.lookedCards,
            lookedCarduids: params.lookedCards.map((card) => card.carduid),
            restOrder: params.restOrder,
            reveal: params.reveal,
            toZone: params.toZone,
            availableOptions: params.availableOptions,
            sourceCarduid: params.sourceCarduid,
            effect: params.effect,
            optionChoice: {
                headerText: params.optionChoiceHeaderText,
                promptText: params.optionChoicePromptText,
                defaultOptionIndex: params.optionChoiceDefaultIndex,
                layoutHint: params.optionChoiceLayoutHint,
            },
        },
    };
}

export function parseTopDeckSelectionReviewConfirmContext(raw: unknown): TopDeckSelectionReviewConfirmContext | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const ctx = raw as Record<string, unknown>;
    if (ctx.kind !== 'TOP_DECK_SELECTION_REVIEW_CONFIRM') {
        return null;
    }
    const selection = ctx.topDeckSelection;
    if (!selection || typeof selection !== 'object') {
        return null;
    }

    const typed = selection as Record<string, unknown>;
    const looked = Array.isArray(typed.lookedCarduids)
        ? typed.lookedCarduids.filter((entry): entry is string => typeof entry === 'string')
        : [];
    const sourceCarduid = typeof typed.sourceCarduid === 'string' ? typed.sourceCarduid : '';
    const effect = typed.effect as EffectDefinition | undefined;
    const optionChoice = typed.optionChoice;
    const toZone = typed.toZone;
    if (!sourceCarduid || !effect || looked.length === 0 || !optionChoice || typeof optionChoice !== 'object') {
        return null;
    }
    if (toZone !== 'hand' && toZone !== 'play') {
        return null;
    }

    return raw as TopDeckSelectionReviewConfirmContext;
}

export function parseTopDeckSelectionRuntimeContext(raw: unknown): TopDeckSelectionRuntimeContext | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const context = raw as Record<string, unknown>;
    const selectionRaw = context.topDeckSelection;
    if (!selectionRaw || typeof selectionRaw !== 'object') {
        return null;
    }
    const selection = selectionRaw as Record<string, unknown>;
    const looked = selection.lookedCarduids;
    const lookedCarduids = Array.isArray(looked)
        ? looked.filter((entry): entry is string => typeof entry === 'string')
        : [];
    const toZone = selection.toZone;
    if (lookedCarduids.length === 0 || (toZone !== 'hand' && toZone !== 'play')) {
        return null;
    }

    return {
        lookedCarduids,
        restOrder: parseTopDeckSelectionRestOrder(selection.restOrder),
        reveal: selection.reveal === true,
        toZone,
    };
}
