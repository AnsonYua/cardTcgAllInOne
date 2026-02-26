// src/services/effects/continuous/ContinuousBattleDamagePreventionManager.ts
// Applies battle-damage prevention as a temporary effect refreshed via ContinuousEffectManager.

import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { TemporaryEffectFactory } from '../TemporaryEffectFactory';
import { GameNotificationManager } from '../../GameNotificationManager';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';

function resolveEnemyApFilters(effectData: EffectDefinition): { enemyAp?: string; maxEnemyAp?: number } {
    const enemyAp = typeof effectData?.parameters?.enemyAp === 'string'
        ? effectData.parameters.enemyAp
        : undefined;
    const maxEnemyAp = typeof effectData?.parameters?.maxEnemyAp === 'number'
        ? effectData.parameters.maxEnemyAp
        : undefined;

    if (enemyAp) {
        return { enemyAp, maxEnemyAp };
    }
    if (typeof maxEnemyAp === 'number') {
        return { enemyAp: `<=${maxEnemyAp}`, maxEnemyAp };
    }
    return {};
}

function resolveEnemyHpFilter(effectData: EffectDefinition): string | undefined {
    return typeof effectData?.parameters?.enemyHp === 'string'
        ? effectData.parameters.enemyHp
        : undefined;
}

export class ContinuousBattleDamagePreventionManager {
    static applyToTargets(
        gameEnv: GameEnvironment,
        effectEntry: {
            sourceCarduid: string;
            sourcePlayerId: string;
            effectData: EffectDefinition;
        },
        targets: any[]
    ): number {
        const from = typeof effectEntry.effectData?.parameters?.from === 'string'
            ? effectEntry.effectData.parameters.from
            : undefined;
        const enemyLevel = typeof effectEntry.effectData?.parameters?.enemyLevel === 'string'
            ? effectEntry.effectData.parameters.enemyLevel
            : undefined;
        const { enemyAp, maxEnemyAp } = resolveEnemyApFilters(effectEntry.effectData);
        const enemyHp = resolveEnemyHpFilter(effectEntry.effectData);

        const targetScope = typeof effectEntry.effectData?.target?.scope === 'string'
            ? effectEntry.effectData.target.scope.toLowerCase()
            : '';
        const shieldScope = targetScope.includes('shield');
        const hasEnemyUnitPreventionSource = from === 'enemy_units';
        const hasUnitFilters = typeof enemyLevel === 'string' || typeof enemyAp === 'string'
            || typeof maxEnemyAp === 'number' || typeof enemyHp === 'string';
        if (!shieldScope && !hasEnemyUnitPreventionSource && !hasUnitFilters) {
            return 0;
        }

        if (shieldScope) {
            const battle = gameEnv.currentBattle;
            if (!battle) {
                return 0;
            }

            if (!battle.shieldDamagePreventions) {
                battle.shieldDamagePreventions = [];
            }

            const defenderId = battle.defendingPlayerId;
            if (defenderId !== effectEntry.sourcePlayerId) {
                return 0;
            }

            const maxEnemyLevel = typeof enemyLevel === 'string'
                ? Number(String(enemyLevel).replace(/[^\d]/g, '')) || 0
                : 0;

            const alreadyApplied = battle.shieldDamagePreventions.some((entry) =>
                entry.playerId === effectEntry.sourcePlayerId
                && entry.sourceCarduid === effectEntry.sourceCarduid
                && entry.from === from
                && entry.enemyLevelFilter === enemyLevel
                && (entry.maxEnemyLevel ?? 0) === maxEnemyLevel
            );

            if (!alreadyApplied) {
                battle.shieldDamagePreventions.push({
                    playerId: effectEntry.sourcePlayerId,
                    sourceCarduid: effectEntry.sourceCarduid,
                    from,
                    enemyLevelFilter: enemyLevel,
                    maxEnemyLevel
                });

                const notificationManager = new GameNotificationManager(gameEnv);
                notificationManager.addNotificationEvent(
                    'SHIELD_DAMAGE_PREVENTION_GRANTED',
                    {
                        playerId: effectEntry.sourcePlayerId,
                        sourceCarduid: effectEntry.sourceCarduid,
                        from,
                        enemyLevel,
                        duration: effectEntry.effectData.timing?.duration || 'CONTINUOUS',
                        timestamp: Date.now()
                    },
                    'normal'
                );
            }

            return 1;
        }

        const appliedTargets: Array<{ carduid: string; zone?: string; playerId?: string }> = [];

        for (const target of targets) {
            if (!target?.carduid || typeof target.carduid !== 'string') {
                continue;
            }

            if (!Array.isArray(target.temporaryEffects)) {
                target.temporaryEffects = [];
            }

            const alreadyApplied = target.temporaryEffects.some((tempEffect: any) => {
                if (tempEffect?.sourceCarduid !== effectEntry.sourceCarduid) {
                    return false;
                }
                const prevention = tempEffect?.preventBattleDamage;
                if (!prevention || typeof prevention !== 'object') {
                    return false;
                }
                return prevention.from === from
                    && prevention.enemyLevel === enemyLevel
                    && prevention.enemyAp === enemyAp
                    && prevention.enemyHp === enemyHp
                    && prevention.maxEnemyAp === maxEnemyAp;
            });

            if (alreadyApplied) {
                continue;
            }

            const tempEffect = TemporaryEffectFactory.createBattleDamagePrevention(
                gameEnv,
                effectEntry.sourcePlayerId,
                effectEntry.sourceCarduid,
                effectEntry.effectData,
                { from, enemyLevel, enemyAp, enemyHp, maxEnemyAp }
            );
            tempEffect.endOnSourceDestroyed = true;

            target.temporaryEffects.push(tempEffect);
            const owner = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, target.carduid);
            appliedTargets.push({
                carduid: target.carduid,
                zone: target.zone,
                playerId: owner?.found ? owner.playerId : undefined
            });
        }

        if (appliedTargets.length > 0) {
            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.addNotificationEvent(
                'BATTLE_DAMAGE_PREVENTION_GRANTED',
                {
                    playerId: effectEntry.sourcePlayerId,
                    sourceCarduid: effectEntry.sourceCarduid,
                    targets: appliedTargets,
                    from,
                    enemyLevel,
                    enemyAp,
                    enemyHp,
                    maxEnemyAp,
                    duration: effectEntry.effectData.timing?.duration || 'UNTIL_END_OF_TURN',
                    timestamp: Date.now()
                },
                'normal'
            );
        }

        return appliedTargets.length;
    }
}
