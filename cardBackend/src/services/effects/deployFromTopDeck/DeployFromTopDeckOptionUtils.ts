// src/services/effects/deployFromTopDeck/DeployFromTopDeckOptionUtils.ts

import type { OptionChoiceOption } from '../../EventQueue/interfaces/GameEvent';
import { ChoiceDisplayBuilder } from '../../choices/ChoiceDisplayBuilder';

export function buildDeployOptions(
    selectable: Array<{ carduid: string; cardId: string; name: string }>,
    includeBottomOption: boolean
): OptionChoiceOption[] {
    const options: OptionChoiceOption[] = selectable.map((choice, index) => {
        const cardName = choice.name || choice.cardId;
        const label = `Deploy ${cardName}`;
        return {
            index,
            label,
            payload: { action: 'DEPLOY', carduid: choice.carduid, cardId: choice.cardId, name: cardName },
            display: ChoiceDisplayBuilder.card(choice.cardId, label)
        };
    });

    if (includeBottomOption) {
        options.push({
            index: options.length,
            label: 'Put the cards on the bottom of your deck',
            payload: { action: 'BOTTOM' },
            display: ChoiceDisplayBuilder.text('Put the cards on the bottom of your deck')
        });
    }

    return options;
}
