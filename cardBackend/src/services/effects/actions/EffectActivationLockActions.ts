// src/services/effects/actions/EffectActivationLockActions.ts

import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { UnitZoneCard } from '../../../models/CardSystem';
import type { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { GameNotificationManager } from '../../GameNotificationManager';
import { ActivationLockManager } from '../../statusEffects/ActivationLockManager';

export function applyPreventSetActiveNextTurnEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (selectedTargets.length === 0) {
        return { success: true };
    }

    const durationCountRaw = (effect.parameters as any)?.statusEffect?.duration?.count;
    const remainingStartPhases = typeof durationCountRaw === 'number' && durationCountRaw > 0
        ? durationCountRaw
        : 1;

    const appliedTargets: TargetReference[] = [];

    for (const target of selectedTargets) {
        const resolved = SlotZoneUtils.resolveTargetReference(gameEnv, target);
        if (!resolved) {
            return {
                success: false,
                error: `Target card ${target.carduid} not found in zone ${target.zone}`
            };
        }

        const card = resolved.card as UnitZoneCard;
        if (card.cardData?.cardType !== 'unit') {
            return {
                success: false,
                error: `prevent_set_active_next_turn requires a unit target (got ${card.cardData?.cardType || 'unknown'})`
            };
        }

        ActivationLockManager.addPreventSetActiveNextTurnLock(
            gameEnv,
            sourcePlayerId,
            sourceCarduid,
            card,
            remainingStartPhases
        );
        appliedTargets.push(target);
    }

    const notificationManager = new GameNotificationManager(gameEnv);
    notificationManager.addNotificationEvent(
        'PREVENT_SET_ACTIVE_NEXT_TURN_GRANTED',
        {
            playerId: sourcePlayerId,
            sourceCarduid,
            targets: appliedTargets.map(t => ({ carduid: t.carduid, zone: t.zone, playerId: t.playerId })),
            remainingStartPhases,
            timestamp: Date.now()
        },
        'normal'
    );

    return { success: true };
}
