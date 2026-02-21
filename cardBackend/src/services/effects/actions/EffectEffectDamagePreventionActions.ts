import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { TargetCardResolver } from '../../targets/TargetCardResolver';
import { TemporaryEffectFactory } from '../TemporaryEffectFactory';
import { GameNotificationManager } from '../../GameNotificationManager';

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

    const rawFrom = typeof effect.parameters?.from === 'string'
        ? effect.parameters.from.toLowerCase()
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
