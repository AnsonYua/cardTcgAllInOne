import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { GameNotificationManager } from '../../GameNotificationManager';
import { BaseLifecycleManager } from '../../BaseLifecycleManager';
import { EventFactory } from '../../EventQueue/EventFactory';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { extractNumericValue } from './EffectActionUtils';
import { isShieldDamagePreventedByAttackerLevel } from '../../battle/BattleShieldUtils';
import { EffectDamagePreventionUtils } from '../EffectDamagePreventionUtils';

export function applyPreventShieldDamageEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition
): { success: boolean; error?: string } {
    const battle = gameEnv.currentBattle;
    if (!battle) {
        return { success: false, error: 'No active battle for prevent_shield_damage effect' };
    }

    const parameters = effect.parameters || {};
    const maxLevelRaw = parameters['maxEnemyLevel'] ?? parameters['value'];
    const maxEnemyLevel = typeof maxLevelRaw === 'number' ? maxLevelRaw : Number(maxLevelRaw) || 0;

    if (!battle.shieldDamagePreventions) {
        battle.shieldDamagePreventions = [];
    }

    battle.shieldDamagePreventions.push({
        playerId: sourcePlayerId,
        maxEnemyLevel,
        enemyLevelFilter: typeof maxLevelRaw === 'string' ? maxLevelRaw : undefined,
        from: 'enemy_units',
        sourceCarduid
    });

    console.log(`🛡️ Shield damage prevented vs enemy level <= ${maxEnemyLevel} for ${sourcePlayerId}`);
    return { success: true };
}

export function applyDamageShieldEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    const damageValue = extractNumericValue(effect.parameters) ?? 0;
    if (damageValue <= 0) {
        return { success: true };
    }

    const targetPlayerIds = new Set<string>();
    for (const target of selectedTargets) {
        if (target.playerId) {
            targetPlayerIds.add(target.playerId);
        }
    }

    if (targetPlayerIds.size === 0) {
        const opponentId = gameEnv.getOpponentId(sourcePlayerId);
        if (opponentId) {
            targetPlayerIds.add(opponentId);
        }
    }

    if (targetPlayerIds.size === 0) {
        return { success: false, error: 'No target player found for damageShield' };
    }

    const attackerSlot = sourceCarduid
        ? SlotZoneUtils.findSlotNameByUnitUidForPlayer(gameEnv, sourcePlayerId, sourceCarduid).slotName
        : undefined;

    for (const targetPlayerId of targetPlayerIds) {
        const defender = gameEnv.getPlayer(targetPlayerId);
        if (!defender) {
            return { success: false, error: `Defending player ${targetPlayerId} not found` };
        }

        const baseCards = defender.zones.base || [];
        if (baseCards.length > 0) {
            const baseCard = baseCards[0];
            const baseTarget = { carduid: baseCard.carduid, zone: 'base', playerId: defender.id as string };
            const prevention = EffectDamagePreventionUtils.isEffectDamagePrevented({
                targetCard: baseCard,
                target: baseTarget,
                sourcePlayerId,
                sourceCarduid
            });

            if (prevention.prevented) {
                const notificationManager = new GameNotificationManager(gameEnv);
                notificationManager.addNotificationEvent(
                    'EFFECT_DAMAGE_PREVENTED',
                    {
                        playerId: defender.id,
                        targetCarduid: baseCard.carduid,
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

            const currentDamage = baseCard.damageReceived || 0;
            const newDamage = currentDamage + damageValue;
            const maxHP = baseCard.originalHP || baseCard.cardData?.hp || 0;
            const remainingHP = Math.max(0, maxHP - newDamage);
            baseCard.damageReceived = newDamage;

            let baseDestroyed = false;
            if (remainingHP <= 0) {
                BaseLifecycleManager.destroyBase(gameEnv, defender.id, baseCard);
                baseDestroyed = true;
            }

            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.addNotificationEvent(
                baseDestroyed ? 'BASE_DESTROYED' : 'BASE_DAMAGED',
                {
                    defendingPlayerId: defender.id,
                    attackingPlayerId: sourcePlayerId,
                    attackerSlot,
                    damage: damageValue,
                    totalDamage: newDamage,
                    baseHP: remainingHP,
                    baseDestroyed
                },
                'normal'
            );

            console.log(`🏰 Breach damage applied to base: ${currentDamage} → ${newDamage} (remaining HP: ${remainingHP})`);
            continue;
        }

        const attackerCard = sourceCarduid ? SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, sourceCarduid) : null;
        const attackerLevel = attackerCard?.card?.cardData?.level
            ?? attackerCard?.unit?.cardData?.level
            ?? 0;
        const prevented = isShieldDamagePreventedByAttackerLevel(gameEnv, targetPlayerId, attackerLevel);
        if (prevented) {
            console.log(`🛡️ Shield damage prevented for ${targetPlayerId}`);
            continue;
        }

        if (defender.hasShield()) {
            const shieldCards = defender.getShieldCards();
            const firstShield = shieldCards[0];
            if (firstShield) {
                const shieldAttackEvent = EventFactory.createShieldCardAttackedEvent(
                    defender.id,
                    sourcePlayerId,
                    attackerSlot || 'unknown',
                    [{ carduid: firstShield.carduid, cardData: firstShield.cardData }],
                    damageValue
                );
                gameEnv.enqueueForProcessing(shieldAttackEvent);
                console.log(`🛡️ Shield damage event queued for ${firstShield.carduid}`);
            }
        } else {
            console.log(`🛡️ No shields available for damageShield on ${targetPlayerId}`);
        }
    }

    return { success: true };
}
