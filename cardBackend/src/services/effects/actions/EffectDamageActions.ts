import { GameEnvironment } from '../../../models/GameEnvironment';
import type { BaseCard, PilotZoneCard, UnitZoneCard } from '../../../models/CardSystem';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { BaseLifecycleManager } from '../../BaseLifecycleManager';
import { GameNotificationManager } from '../../GameNotificationManager';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { TargetCardResolver } from '../../targets/TargetCardResolver';
import { EffectDamagePreventionUtils } from '../EffectDamagePreventionUtils';
import { EffectStatApplier } from '../EffectStatApplier';
import { EffectDamageReceivedTriggeredEffectManager } from '../EffectDamageReceivedTriggeredEffectManager';
import { SlotHpDestructionChecker } from '../../destruction/SlotHpDestructionChecker';
import { SlotHealthService } from '../../health/SlotHealthService';
import { resolveEffectDamageValue } from './EffectDamageValueResolver';
import { deferEffectDamageReceivedTrigger, isSequenceExecutionActive } from '../sequence/SequenceExecutionContext';

export function applyDamageEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    const damageValue = resolveEffectDamageValue(gameEnv, sourcePlayerId, effect, sourceCarduid);
    if (damageValue <= 0) {
        return { success: true };
    }
    const resolvedDamageParameters = {
        ...(effect.parameters || {}),
        value: damageValue
    };

    const attackerSlot = sourceCarduid
        ? SlotZoneUtils.findSlotNameByUnitUidForPlayer(gameEnv, sourcePlayerId, sourceCarduid).slotName
        : undefined;

    for (const target of selectedTargets) {
        const resolvedTarget = TargetCardResolver.resolve(gameEnv, target);
        if (!resolvedTarget) {
            return { success: false, error: `Target card ${target.carduid} not found in zone ${target.zone}` };
        }

        if (resolvedTarget.kind === 'base') {
            const prevention = EffectDamagePreventionUtils.isEffectDamagePrevented({
                targetCard: resolvedTarget.card,
                target,
                sourcePlayerId,
                sourceCarduid
            });

            if (prevention.prevented) {
                const notificationManager = new GameNotificationManager(gameEnv);
                notificationManager.addNotificationEvent(
                    'EFFECT_DAMAGE_PREVENTED',
                    {
                        playerId: target.playerId,
                        targetCarduid: target.carduid,
                        sourcePlayerId,
                        sourceCarduid,
                        preventedBySourceCarduid: prevention.preventedBySourceCarduid,
                        effectId: effect.effectId,
                        timestamp: Date.now()
                    },
                    'normal'
                );
                continue;
            }

            const baseCard = resolvedTarget.card as BaseCard;
            const currentDamage = baseCard.damageReceived || 0;
            const newDamage = currentDamage + damageValue;
            const maxHP = baseCard.originalHP || baseCard.cardData?.hp || 0;
            const remainingHP = Math.max(0, maxHP - newDamage);

            baseCard.damageReceived = newDamage;

            let baseDestroyed = false;
            if (remainingHP <= 0) {
                BaseLifecycleManager.destroyBase(gameEnv, target.playerId, baseCard);
                baseDestroyed = true;
            }

            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.addNotificationEvent(
                baseDestroyed ? 'BASE_DESTROYED' : 'BASE_DAMAGED',
                {
                    defendingPlayerId: target.playerId,
                    attackingPlayerId: sourcePlayerId,
                    attackerSlot,
                    damage: damageValue,
                    totalDamage: newDamage,
                    baseHP: remainingHP,
                    baseDestroyed,
                    ...(baseDestroyed && {
                        destroyedCard: {
                            carduid: baseCard.carduid,
                            cardId: baseCard.cardId,
                            name: baseCard.cardData?.name || 'Unknown Base'
                        }
                    })
                },
                'normal'
            );

            continue;
        }

        if (resolvedTarget.kind !== 'unit' && resolvedTarget.kind !== 'pilot') {
            return {
                success: false,
                error: `damage effect does not support target zone ${target.zone}`
            };
        }

        const prevention = EffectDamagePreventionUtils.isEffectDamagePrevented({
            targetCard: resolvedTarget.card,
            target,
            sourcePlayerId,
            sourceCarduid
        });

        if (prevention.prevented) {
            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.addNotificationEvent(
                'EFFECT_DAMAGE_PREVENTED',
                {
                    playerId: target.playerId,
                    targetCarduid: target.carduid,
                    sourcePlayerId,
                    sourceCarduid,
                    preventedBySourceCarduid: prevention.preventedBySourceCarduid,
                    effectId: effect.effectId,
                    timestamp: Date.now()
                },
                'normal'
            );
            continue;
        }

        const applyResult = EffectStatApplier.applyEffectToResolvedCard(
            gameEnv,
            resolvedTarget.card as UnitZoneCard | PilotZoneCard,
            'damage',
            resolvedDamageParameters,
            target
        );
        if (!applyResult.success) {
            return applyResult;
        }

        if (isSequenceExecutionActive(gameEnv)) {
            deferEffectDamageReceivedTrigger(gameEnv, {
                damagedPlayerId: target.playerId,
                sourcePlayerId
            });
        } else {
            const triggerResult = EffectDamageReceivedTriggeredEffectManager.execute(gameEnv, {
                damagedPlayerId: target.playerId,
                sourcePlayerId
            });
            if (!triggerResult.success) {
                return { success: false, error: triggerResult.error || 'Failed to process EFFECT_DAMAGE_RECEIVED triggers' };
            }
        }

        // Destroy the slot when shared slot HP is exhausted, regardless of whether
        // the selected target was unit or pilot.
        if (resolvedTarget.kind === 'unit' || resolvedTarget.kind === 'pilot') {
            const slotHealth = SlotHealthService.getSlotHealthStateByTarget(gameEnv, target);
            if (slotHealth && slotHealth.remainingHp <= 0 && slotHealth.unitCarduid) {
                const destroyed = SlotHpDestructionChecker.destroyUnitIfSlotHpZero(gameEnv, slotHealth.unitCarduid, {
                    timing: 'IMMEDIATE',
                    cause: 'EFFECT_DAMAGE'
                });
                if (!destroyed) {
                    return { success: false, error: `Failed to destroy unit ${slotHealth.unitCarduid} at slot HP 0` };
                }
            }
        }
    }

    return { success: true };
}
