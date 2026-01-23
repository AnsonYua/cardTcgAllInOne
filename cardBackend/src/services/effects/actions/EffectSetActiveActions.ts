import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { TargetCardResolver } from '../../targets/TargetCardResolver';
import { GameNotificationManager } from '../../GameNotificationManager';
import { UnitRestrictionUtils } from '../../restrictions/UnitRestrictionUtils';
import { RestrictionNotificationEmitter } from '../../restrictions/RestrictionNotificationEmitter';

export function applySetActiveEffect(
    gameEnv: GameEnvironment,
    _sourcePlayerId: string,
    _effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (selectedTargets.length === 0) {
        return { success: true };
    }

    const notificationManager = new GameNotificationManager(gameEnv);

    for (const target of selectedTargets) {
        const resolvedTarget = TargetCardResolver.resolve(gameEnv, target);
        if (!resolvedTarget) {
            return {
                success: false,
                error: `Target card ${target.carduid} not found in zone ${target.zone}`
            };
        }

        if (UnitRestrictionUtils.cannotBeSetActive(resolvedTarget.card as any)) {
            RestrictionNotificationEmitter.emitSetActiveBlocked(gameEnv, {
                playerId: target.playerId,
                carduid: target.carduid,
                zone: target.zone,
                reason: 'restrict_set_active'
            });
            continue;
        }

        resolvedTarget.card.isRested = false;
        console.log(`  😌 ${target.carduid}: activated`);

        notificationManager.addNotificationEvent('CARD_SET_ACTIVE', {
            playerId: target.playerId,
            carduid: target.carduid,
            zone: target.zone,
            timestamp: Date.now()
        });
    }

    return { success: true };
}
