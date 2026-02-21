import type { TriggerAdapter } from './StateChangedByEffectTypes';

export const STATE_CHANGED_BY_EFFECT_TRIGGER_ADAPTERS: TriggerAdapter[] = [
    {
        trigger: 'UNIT_RESTED_BY_EFFECT',
        fallbackEffectId: 'unit_rested_by_effect',
        expectedTriggers: ['UNIT_RESTED_BY_EFFECT'],
        matchesEvent: (context) => context.targetCardType === 'unit' && context.toState === 'rested'
    },
    {
        trigger: 'UNIT_SET_ACTIVE_BY_EFFECT',
        fallbackEffectId: 'unit_set_active_by_effect',
        expectedTriggers: ['UNIT_SET_ACTIVE_BY_EFFECT'],
        matchesEvent: (context) => context.targetCardType === 'unit' && context.toState === 'active'
    }
];
