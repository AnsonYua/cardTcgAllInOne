import { EffectDefinition } from '../services/EventQueue/interfaces/GameEvent';

export function isPlayEffect(effect: EffectDefinition | undefined): boolean {
    return effect?.type === 'play';
}

export function isActivatedEffect(effect: EffectDefinition | undefined): boolean {
    return effect?.type === 'activated';
}

export function isPlayOrActivatedEffect(effect: EffectDefinition | undefined): boolean {
    return isPlayEffect(effect) || isActivatedEffect(effect);
}
