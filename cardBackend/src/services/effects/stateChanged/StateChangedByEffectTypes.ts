export type CardState = 'rested' | 'active' | 'unknown';

export type CardStateChangedByEffectContext = {
    sourcePlayerId: string;
    targetPlayerId: string;
    targetCarduid: string;
    targetCardType: 'unit' | 'pilot' | 'base' | 'unknown';
    fromState: CardState;
    toState: CardState;
};

export type TriggerAdapter = {
    trigger: string;
    fallbackEffectId: string;
    expectedTriggers: string[];
    matchesEvent: (context: CardStateChangedByEffectContext) => boolean;
};
