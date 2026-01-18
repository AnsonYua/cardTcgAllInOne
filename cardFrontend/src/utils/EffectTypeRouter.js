export const isPlayEffect = (effect) => effect?.type === 'play';

export const isActivatedEffect = (effect) => effect?.type === 'activated';

export const isPlayOrActivatedEffect = (effect) => isPlayEffect(effect) || isActivatedEffect(effect);
