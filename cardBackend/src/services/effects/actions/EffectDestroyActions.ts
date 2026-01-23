// src/services/effects/actions/EffectDestroyActions.ts

import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { PlayerCardManager } from '../../PlayerCardManager';
import { GameNotificationManager } from '../../GameNotificationManager';
import type { UnitZoneCard } from '../../../models/CardSystem';

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
        const unit = lookup.card as UnitZoneCard;

        const destroyed = PlayerCardManager.destroyUnitInSlot(gameEnv, destroyedPlayerId, slotName, unit);
        if (!destroyed) {
            return { success: false, error: `Failed to destroy unit ${target.carduid}` };
        }

        notificationManager.addNotificationEvent('UNIT_DESTROYED_BY_EFFECT', {
            playerId: destroyedPlayerId,
            carduid: target.carduid,
            zone: slotName,
            sourcePlayerId,
            sourceCarduid,
            effectId: effect.effectId,
            timestamp: Date.now()
        });
    }

    return { success: true };
}

