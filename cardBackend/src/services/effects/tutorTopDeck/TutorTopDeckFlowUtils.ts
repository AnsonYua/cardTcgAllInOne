import type { DeckBottomOrder } from '../../zones/DeckZoneManager';
import type { EffectDefinition, OptionChoiceOption } from '../../EventQueue/interfaces/GameEvent';
import { ChoiceDisplayBuilder } from '../../choices/ChoiceDisplayBuilder';

export const TUTOR_TOP_DECK_REVEAL_CHOICE_ID = 'tutor_top_deck_reveal_confirm';

export type TutorLookedCardDetail = {
    carduid: string;
    cardId: string;
    name?: string;
    traits: string[];
    matchesFilters: boolean;
};

export type TutorRevealConfirmContext = {
    kind: 'TUTOR_TOP_DECK_REVEAL_CONFIRM';
    tutor: {
        lookedCards: TutorLookedCardDetail[];
        lookedCarduids: string[];
        restOrder: DeckBottomOrder;
        reveal: boolean;
        availableOptions: OptionChoiceOption[];
        sourceCarduid: string;
        effect: EffectDefinition;
        optionChoice: {
            headerText: string;
            promptText: string;
            defaultOptionIndex: number;
            layoutHint: 'hybrid';
        };
    };
};

export function buildTutorTopDeckOptions(selectable: TutorLookedCardDetail[]): OptionChoiceOption[] {
    const options: OptionChoiceOption[] = selectable.map((choice, index) => {
        const choiceName = choice.name || choice.cardId;
        const label = `Reveal and add ${choiceName} to hand`;
        return {
            index,
            label,
            payload: { action: 'TAKE', carduid: choice.carduid, cardId: choice.cardId },
            display: ChoiceDisplayBuilder.card(choice.cardId, label)
        };
    });

    options.push({
        index: options.length,
        label: 'Put it on the bottom of your deck',
        payload: { action: 'BOTTOM' },
        display: ChoiceDisplayBuilder.text('Put it on the bottom of your deck')
    });

    return options;
}

export function buildTutorRevealConfirmContext(params: {
    lookedCards: TutorLookedCardDetail[];
    restOrder: DeckBottomOrder;
    reveal: boolean;
    availableOptions: OptionChoiceOption[];
    sourceCarduid: string;
    effect: EffectDefinition;
    optionChoiceHeaderText: string;
    optionChoicePromptText: string;
    optionChoiceDefaultIndex: number;
}): TutorRevealConfirmContext {
    return {
        kind: 'TUTOR_TOP_DECK_REVEAL_CONFIRM',
        tutor: {
            lookedCards: params.lookedCards,
            lookedCarduids: params.lookedCards.map((c) => c.carduid),
            restOrder: params.restOrder,
            reveal: params.reveal,
            availableOptions: params.availableOptions,
            sourceCarduid: params.sourceCarduid,
            effect: params.effect,
            optionChoice: {
                headerText: params.optionChoiceHeaderText,
                promptText: params.optionChoicePromptText,
                defaultOptionIndex: params.optionChoiceDefaultIndex,
                layoutHint: 'hybrid',
            },
        },
    };
}

export function parseTutorRevealConfirmContext(raw: unknown): TutorRevealConfirmContext | null {
    if (!raw || typeof raw !== 'object') return null;
    const ctx = raw as Record<string, unknown>;
    if (ctx.kind !== 'TUTOR_TOP_DECK_REVEAL_CONFIRM') return null;
    const tutor = ctx.tutor;
    if (!tutor || typeof tutor !== 'object') return null;
    const typed = tutor as Record<string, unknown>;
    if (!Array.isArray(typed.availableOptions) || typed.availableOptions.length === 0) return null;
    const sourceCarduid = typeof typed.sourceCarduid === 'string' ? typed.sourceCarduid : '';
    const effect = typed.effect as EffectDefinition | undefined;
    if (!sourceCarduid || !effect) return null;
    return raw as TutorRevealConfirmContext;
}
