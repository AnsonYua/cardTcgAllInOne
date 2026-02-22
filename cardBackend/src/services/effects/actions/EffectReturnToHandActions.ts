// src/services/effects/actions/EffectReturnToHandActions.ts

import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { SlotExitCoordinator } from '../../zones/SlotExitCoordinator';
import { GameNotificationManager } from '../../GameNotificationManager';
import { ContinuousEffectManager } from '../../ContinuousEffectManager';
import { SlotExitPlanningService, type SlotExitHandPlan } from '../../zones/SlotExitPlanningService';
import { OwnershipPolicyResolver } from '../movement/OwnershipPolicyResolver';

export function applyReturnToHandEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (selectedTargets.length === 0) {
        return { success: true };
    }

    const preflight = preflightReturnToHandPlans(gameEnv, sourcePlayerId, sourceCarduid, effect, selectedTargets);
    if (!preflight.success || !preflight.plans) {
        return { success: false, error: preflight.error || 'returnToHand preflight failed' };
    }

    const returned: Array<{ carduid: string; fromZone: string; ownerPlayerId: string }> = [];

    for (const plan of preflight.plans) {
        const moveResult = SlotExitCoordinator.movePlannedToHand(
            gameEnv,
            plan.ownerPlayerId,
            plan.slotName,
            plan.plan.plannedCards,
            {
                sourcePlayerId,
                sourceCarduid,
                effectId: effect.effectId
            },
            plan.destinationPlayerId
        );
        if (!moveResult.success) {
            return { success: false, error: moveResult.error || 'Failed to move cards to hand' };
        }

        for (const moved of moveResult.moved) {
            returned.push({
                carduid: moved.carduid,
                fromZone: moved.fromZone,
                ownerPlayerId: moved.ownerPlayerId
            });
        }
    }

    ContinuousEffectManager.processAllContinuousEffects(gameEnv);

    const notificationManager = new GameNotificationManager(gameEnv);
    notificationManager.addNotificationEvent(
        'RETURN_TO_HAND_RESOLVED',
        {
            playerId: sourcePlayerId,
            sourceCarduid,
            effectId: effect.effectId,
            returned,
            timestamp: Date.now()
        },
        'normal'
    );

    return { success: true };
}

type PreflightPlan = {
    ownerPlayerId: string;
    destinationPlayerId: string;
    slotName: string;
    plan: SlotExitHandPlan;
};

function preflightReturnToHandPlans(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    _sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string; plans?: PreflightPlan[] } {
    const plans: PreflightPlan[] = [];
    const plannedCarduids = new Set<string>();

    for (const target of selectedTargets) {
        const resolved = resolveReturnTarget(gameEnv, sourcePlayerId, effect, target);
        if (!resolved) {
            return {
                success: false,
                error: `Target card ${target.carduid} not found in zone ${target.zone}`
            };
        }

        if (resolved.type !== 'unit' && resolved.type !== 'pilot') {
            return {
                success: false,
                error: `returnToHand currently supports unit/pilot targets only (got ${resolved.type || 'unknown'})`
            };
        }

        const ownerPlayerId = resolved.playerId;
        const destinationPlayerId = OwnershipPolicyResolver.resolveHandDestinationPlayer({
            effect,
            sourcePlayerId,
            targetOwnerPlayerId: ownerPlayerId
        });

        const planResult = SlotExitPlanningService.planTargetToHand(
            gameEnv,
            ownerPlayerId,
            resolved.slotName,
            resolved.type,
            effect
        );
        if (!planResult.success || !planResult.plan) {
            return {
                success: false,
                error: planResult.error || `Failed to build returnToHand plan for ${target.carduid}`
            };
        }

        for (const entry of planResult.plan.plannedCards) {
            const carduid = entry.card?.carduid;
            if (typeof carduid !== 'string' || carduid.length === 0) {
                continue;
            }
            if (plannedCarduids.has(carduid)) {
                return {
                    success: false,
                    error: `Duplicate returnToHand plan for card ${carduid}`
                };
            }
            plannedCarduids.add(carduid);
        }

        plans.push({
            ownerPlayerId,
            destinationPlayerId,
            slotName: resolved.slotName,
            plan: planResult.plan
        });
    }

    return { success: true, plans };
}

function resolveReturnTarget(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    effect: EffectDefinition,
    target: TargetReference
) {
    const direct = SlotZoneUtils.resolveTargetReference(gameEnv, target);
    const shouldAttemptFallback = OwnershipPolicyResolver.shouldAttemptUidFallback({
        effect,
        sourcePlayerId,
        incomingTarget: target,
        directResolvedPlayerId: direct?.playerId
    });
    if (!shouldAttemptFallback) {
        return direct;
    }
    const search = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, target.carduid);
    if (!search.found || !search.playerId || !search.slotName || !search.type || !search.card) {
        return direct;
    }

    if (target.zone && target.zone !== search.slotName) {
        return direct;
    }

    if (direct && direct.playerId === search.playerId && direct.slotName === search.slotName) {
        return direct;
    }

    console.warn(
        `[returnToHand] UID fallback resolved target ${target.carduid} from ${direct?.playerId || 'unresolved'} to ${search.playerId}`
    );

    return {
        card: search.card,
        type: search.type,
        slotName: search.slotName,
        playerId: search.playerId
    };
}
