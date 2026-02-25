import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { TargetCardResolver } from '../../targets/TargetCardResolver';
import { TemporaryEffectFactory } from '../TemporaryEffectFactory';
import { GameNotificationManager } from '../../GameNotificationManager';
import { parsePreventDamageVariant } from '../utils/PreventDamageVariantUtils';

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

    const parsed = parsePreventDamageVariant(effect);
    if (parsed.kind === 'invalid') {
        return {
            success: false,
            error: parsed.error
        };
    }

    if (parsed.kind === 'base_battle') {
        return {
            success: false,
            error: 'prevent_damage from/enemyLevel is base-battle semantics and not executable via generic effect-damage handler'
        };
    }

    const sourceController = parsed.sourceController;
    const sourceCardType = parsed.sourceCardType;

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
