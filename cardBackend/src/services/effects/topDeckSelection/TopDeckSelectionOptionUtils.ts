import type { OptionChoiceOption } from '../../EventQueue/interfaces/GameEvent';
import { ChoiceDisplayBuilder } from '../../choices/ChoiceDisplayBuilder';

export type TopDeckSelectionLookedCard = {
    carduid: string;
    cardId: string;
    name?: string;
    traits: string[];
    matchesFilters: boolean;
};

export function buildTopDeckSelectionOptions(params: {
    selectable: TopDeckSelectionLookedCard[];
    toZone: 'hand' | 'play';
    includeBottomOption: boolean;
    singleLookBinaryMode: boolean;
}): OptionChoiceOption[] {
    const verb = params.toZone === 'play' ? 'Deploy' : 'Reveal and add';
    const suffix = params.toZone === 'play' ? '' : ' to hand';
    const action = params.toZone === 'play' ? 'DEPLOY' : 'TAKE';

    const options: OptionChoiceOption[] = params.selectable.map((choice, index) => {
        const cardName = choice.name || choice.cardId;
        const label = params.singleLookBinaryMode
            ? (params.toZone === 'play' ? 'Deploy' : 'Add to hand')
            : `${verb} ${cardName}${suffix}`;
        return {
            index,
            label,
            payload: { action, carduid: choice.carduid, cardId: choice.cardId, name: cardName },
            display: ChoiceDisplayBuilder.card(choice.cardId, label)
        };
    });

    if (params.includeBottomOption) {
        const label = params.singleLookBinaryMode
            ? 'Bottom'
            : 'Put the looked cards on the bottom of your deck';
        options.push({
            index: options.length,
            label,
            payload: { action: 'BOTTOM' },
            display: ChoiceDisplayBuilder.text(label)
        });
    }

    return options;
}
