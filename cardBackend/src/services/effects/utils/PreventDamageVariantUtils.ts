import type { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';

const EFFECT_DAMAGE_VARIANT_ALLOWED_KEYS = new Set([
    'sourceCardType',
    'sourceController',
    'notes'
]);

type EffectDamageVariant = {
    kind: 'effect_damage';
    sourceCardType?: string;
    sourceController?: string;
};

type BaseBattleVariant = {
    kind: 'base_battle';
    from?: string;
    enemyLevel?: string;
};

type InvalidVariant = {
    kind: 'invalid';
    error: string;
};

export type PreventDamageVariantParseResult =
    | EffectDamageVariant
    | BaseBattleVariant
    | InvalidVariant;

export function parsePreventDamageVariant(effect: EffectDefinition): PreventDamageVariantParseResult {
    const parameters = effect.parameters && typeof effect.parameters === 'object'
        ? effect.parameters
        : {};

    const hasEffectDamageVariant = typeof parameters.sourceCardType === 'string'
        || typeof parameters.sourceController === 'string';
    const hasBaseBattleVariant = typeof parameters.from === 'string'
        || typeof parameters.enemyLevel === 'string';

    if (hasEffectDamageVariant && hasBaseBattleVariant) {
        return {
            kind: 'invalid',
            error: 'prevent_damage cannot mix sourceCardType/sourceController with from/enemyLevel'
        };
    }

    if (hasBaseBattleVariant) {
        return {
            kind: 'base_battle',
            from: typeof parameters.from === 'string' ? parameters.from : undefined,
            enemyLevel: typeof parameters.enemyLevel === 'string' ? parameters.enemyLevel : undefined
        };
    }

    if (!hasEffectDamageVariant) {
        return {
            kind: 'invalid',
            error: 'prevent_damage requires sourceCardType and/or sourceController for generic effect-damage prevention'
        };
    }

    for (const key of Object.keys(parameters)) {
        if (!EFFECT_DAMAGE_VARIANT_ALLOWED_KEYS.has(key)) {
            return {
                kind: 'invalid',
                error: `prevent_damage uses unsupported parameter key ${key} for generic effect-damage prevention`
            };
        }
    }

    return {
        kind: 'effect_damage',
        sourceCardType: typeof parameters.sourceCardType === 'string' ? parameters.sourceCardType : undefined,
        sourceController: typeof parameters.sourceController === 'string' ? parameters.sourceController : undefined
    };
}
