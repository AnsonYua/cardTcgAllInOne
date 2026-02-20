export type ChoiceDisplay = {
    mode: 'card' | 'text';
    cardId?: string;
    label?: string;
};

export class ChoiceDisplayBuilder {
    static card(cardId: string, label?: string): ChoiceDisplay {
        return {
            mode: 'card',
            cardId,
            ...(label ? { label } : {})
        };
    }

    static text(label: string): ChoiceDisplay {
        return {
            mode: 'text',
            label
        };
    }
}

