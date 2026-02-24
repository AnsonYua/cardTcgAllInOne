// src/services/effects/actions/EffectDestroyActions.ts

import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { GameNotificationManager } from '../../GameNotificationManager';
import { DestructionCoordinator } from '../../destruction/DestructionCoordinator';
import { PlayerCardManager } from '../../PlayerCardManager';

export function applyDestroyEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (selectedTargets.length === 0) {
        return { success: true };
    }

    const notificationManager = new GameNotificationManager(gameEnv);

    for (const target of selectedTargets) {
        const lookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, target.carduid);
        if (!lookup.found || !lookup.playerId || !lookup.slotName || !lookup.card) {
            return { success: false, error: `Target ${target.carduid} not found for destroy` };
        }

        const destroyedPlayerId = lookup.playerId;
        const slotName = lookup.slotName;
        const targetCardType = String((lookup.card as any)?.cardData?.cardType || '').toLowerCase();

        if (targetCardType === 'pilot') {
            const pilotDestroyed = PlayerCardManager.moveCardToTrashFromSlot(
                gameEnv,
                destroyedPlayerId,
                slotName,
                lookup.card as any,
                'pilot'
            );
            if (!pilotDestroyed) {
                return { success: false, error: `Failed to destroy pilot ${target.carduid}` };
            }
        } else {
            const destroyedResult = DestructionCoordinator.requestSlotDestruction(gameEnv, {
                unitCarduid: target.carduid,
                timing: 'IMMEDIATE',
                cause: 'EFFECT_DESTROY',
                allowNonLethal: true
            });
            if (!destroyedResult.success) {
                return { success: false, error: `Failed to destroy unit ${target.carduid}` };
            }
        }

        notificationManager.addNotificationEvent('UNIT_DESTROYED_BY_EFFECT', {
            playerId: destroyedPlayerId,
            carduid: target.carduid,
            destroyedCardType: targetCardType === 'pilot' ? 'pilot' : 'unit',
            zone: slotName,
            sourcePlayerId,
            sourceCarduid,
            effectId: effect.effectId,
            timestamp: Date.now()
        });
    }

    return { success: true };
}
