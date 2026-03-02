import type { DeckBottomOrder } from '../../zones/DeckZoneManager';
import type { EffectDefinition, OptionChoiceOption } from '../../EventQueue/interfaces/GameEvent';

export const DEPLOY_FROM_TOP_DECK_REVIEW_CHOICE_ID = 'deploy_from_top_deck_review_confirm';

export type DeployLookedCardDetail = {
    carduid: string;
    cardId: string;
    name?: string;
    traits: string[];
    matchesFilters: boolean;
};

export type DeployReviewConfirmContext = {
    kind: 'DEPLOY_FROM_TOP_DECK_REVIEW_CONFIRM';
    deployFromTopDeck: {
        lookedCards: DeployLookedCardDetail[];
        lookedCarduids: string[];
        restOrder: DeckBottomOrder;
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

export function buildDeployReviewConfirmContext(params: {
    lookedCards: DeployLookedCardDetail[];
    restOrder: DeckBottomOrder;
    availableOptions: OptionChoiceOption[];
    sourceCarduid: string;
    effect: EffectDefinition;
    optionChoiceHeaderText: string;
    optionChoicePromptText: string;
    optionChoiceDefaultIndex?: number;
    optionChoiceLayoutHint: 'card' | 'hybrid';
}): DeployReviewConfirmContext {
    return {
        kind: 'DEPLOY_FROM_TOP_DECK_REVIEW_CONFIRM',
        deployFromTopDeck: {
            lookedCards: params.lookedCards,
            lookedCarduids: params.lookedCards.map((card) => card.carduid),
            restOrder: params.restOrder,
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
