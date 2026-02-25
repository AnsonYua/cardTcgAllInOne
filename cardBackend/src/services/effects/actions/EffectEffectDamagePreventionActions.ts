import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { TargetCardResolver } from '../../targets/TargetCardResolver';
import { TemporaryEffectFactory } from '../TemporaryEffectFactory';
import { GameNotificationManager } from '../../GameNotificationManager';

const EFFECT_DAMAGE_VARIANT_ALLOWED_KEYS = new Set(['sourceCardType', 'sourceController', 'notes']);

export function applyPreventEffectDamageEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (!sourceCarduid) {
        return { success: false, error: 'prevent_damage requires sourceCarduid' };
    }

    if (selectedTargets.length === 0) {
        return { success: true };
    }

    const parameters = effect.parameters && typeof effect.parameters === 'object'
        ? effect.parameters
        : {};
    const hasEffectDamageVariant = typeof parameters.sourceCardType === 'string'
        || typeof parameters.sourceController === 'string';
    const hasBaseBattleVariant = typeof parameters.from === 'string'
        || typeof parameters.enemyLevel === 'string';

    if (hasEffectDamageVariant && hasBaseBattleVariant) {
        return {
            success: false,
            error: 'prevent_damage cannot mix sourceCardType/sourceController with from/enemyLevel'
        };
    }

    if (!hasEffectDamageVariant && hasBaseBattleVariant) {
        return {
            success: false,
            error: 'prevent_damage from/enemyLevel is base-battle semantics and not executable via generic effect-damage handler'
        };
    }

    if (!hasEffectDamageVariant) {
        return {
            success: false,
            error: 'prevent_damage requires sourceCardType and/or sourceController for generic effect-damage prevention'
        };
    }

    for (const key of Object.keys(parameters)) {
        if (!EFFECT_DAMAGE_VARIANT_ALLOWED_KEYS.has(key)) {
            return {
                success: false,
                error: `prevent_damage uses unsupported parameter key ${key} for generic effect-damage prevention`
            };
        }
    }

    const rawFrom = typeof parameters.from === 'string'
        ? parameters.from.toLowerCase()
        : '';
    const sourceController = typeof effect.parameters?.sourceController === 'string'
        ? effect.parameters.sourceController
        : (rawFrom === 'enemy' || rawFrom === 'enemy_units' ? 'opponent' : undefined);
    const sourceCardType = typeof effect.parameters?.sourceCardType === 'string'
        ? effect.parameters.sourceCardType
        : undefined;

    const appliedTargets: TargetReference[] = [];

    for (const target of selectedTargets) {
        const resolved = TargetCardResolver.resolve(gameEnv, target);
        if (!resolved) {
            return {
                success: false,
                error: `Target card ${target.carduid} not found in zone ${target.zone}`
            };
        }

        const card = resolved.card as any;
        if (!Array.isArray(card.temporaryEffects)) {
            card.temporaryEffects = [];
        }

        const tempEffect = TemporaryEffectFactory.createEffectDamagePrevention(
            gameEnv,
            sourcePlayerId,
            sourceCarduid,
            effect,
            { sourceCardType, sourceController }
        );

        card.temporaryEffects.push(tempEffect);
        appliedTargets.push(target);
    }

    const notificationManager = new GameNotificationManager(gameEnv);
    notificationManager.addNotificationEvent(
        'EFFECT_DAMAGE_PREVENTION_GRANTED',
        {
            playerId: sourcePlayerId,
            sourceCarduid,
            targets: appliedTargets.map(t => ({ carduid: t.carduid, zone: t.zone, playerId: t.playerId })),
            sourceCardType,
            sourceController,
            duration: effect.timing?.duration || 'UNTIL_END_OF_TURN',
            timestamp: Date.now()
        },
        'normal'
    );

    return { success: true };
}
