// src/services/effects/actions/EffectBattleDamagePreventionActions.ts

import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { TemporaryEffectFactory } from '../TemporaryEffectFactory';
import { GameNotificationManager } from '../../GameNotificationManager';

function resolveEnemyApFilters(effect: EffectDefinition): { enemyAp?: string; maxEnemyAp?: number } {
    const enemyAp = typeof effect.parameters?.enemyAp === 'string' ? effect.parameters.enemyAp : undefined;
    const maxEnemyAp = typeof effect.parameters?.maxEnemyAp === 'number' ? effect.parameters.maxEnemyAp : undefined;

    if (enemyAp) {
        return { enemyAp, maxEnemyAp };
    }
    if (typeof maxEnemyAp === 'number') {
        return { enemyAp: `<=${maxEnemyAp}`, maxEnemyAp };
    }
    return {};
}

function resolveEnemyHpFilter(effect: EffectDefinition): string | undefined {
    return typeof effect.parameters?.enemyHp === 'string' ? effect.parameters.enemyHp : undefined;
}

export function applyPreventBattleDamageEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (!sourceCarduid) {
        return { success: false, error: 'prevent_battle_damage requires sourceCarduid' };
    }

    if (selectedTargets.length === 0) {
        return { success: true };
    }

    const from = typeof effect.parameters?.from === 'string' ? effect.parameters.from : undefined;
    const enemyLevel = typeof effect.parameters?.enemyLevel === 'string' ? effect.parameters.enemyLevel : undefined;
    const { enemyAp, maxEnemyAp } = resolveEnemyApFilters(effect);
    const enemyHp = resolveEnemyHpFilter(effect);

    const appliedTargets: TargetReference[] = [];

    for (const target of selectedTargets) {
        const resolved = SlotZoneUtils.resolveTargetReference(gameEnv, target);
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

        const tempEffect = TemporaryEffectFactory.createBattleDamagePrevention(
            gameEnv,
            sourcePlayerId,
            sourceCarduid,
            effect,
            { from, enemyLevel, enemyAp, enemyHp, maxEnemyAp }
        );

        card.temporaryEffects.push(tempEffect);
        appliedTargets.push(target);
    }

    const notificationManager = new GameNotificationManager(gameEnv);
    notificationManager.addNotificationEvent(
        'BATTLE_DAMAGE_PREVENTION_GRANTED',
        {
            playerId: sourcePlayerId,
            sourceCarduid,
            targets: appliedTargets.map(t => ({ carduid: t.carduid, zone: t.zone, playerId: t.playerId })),
            from,
            enemyLevel,
            enemyAp,
            enemyHp,
            maxEnemyAp,
            duration: effect.timing?.duration || 'UNTIL_END_OF_TURN',
            timestamp: Date.now()
        },
        'normal'
    );

    return { success: true };
}
