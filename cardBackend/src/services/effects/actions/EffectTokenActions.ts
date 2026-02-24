import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { ConditionalTokenDeployManager } from '../ConditionalTokenDeployManager';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { PlayerCardManager } from '../../PlayerCardManager';

export function applyConditionalTokenDeployEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[] = []
): { success: boolean; error?: string } {
    if (Array.isArray(selectedTargets) && selectedTargets.length > 0) {
        for (const target of selectedTargets) {
            const lookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, target.carduid);
            if (!lookup.found || lookup.playerId !== sourcePlayerId || !lookup.slotName) {
                return { success: false, error: `Invalid slot-clear target: ${target.carduid}` };
            }
            const slotLookup = SlotZoneUtils.getSlotZone(gameEnv.players[sourcePlayerId]?.zones, lookup.slotName);
            const slot = slotLookup.isValid ? slotLookup.slot : null;
            if (!slot?.unit || slot.unit.carduid !== target.carduid) {
                return { success: false, error: `Selected target is not the unit in ${lookup.slotName}` };
            }
            const moved = PlayerCardManager.moveCardToTrashFromSlot(
                gameEnv,
                sourcePlayerId,
                lookup.slotName,
                slot.unit,
                'unit'
            );
            if (!moved) {
                return { success: false, error: `Failed to clear slot ${lookup.slotName} for token deploy` };
            }
        }
    }

    if (!ConditionalTokenDeployManager.conditionsSatisfied(effect, gameEnv, sourcePlayerId)) {
        return { success: true };
    }

    const planResult = ConditionalTokenDeployManager.buildPlan(gameEnv, sourcePlayerId, effect);
    if (!planResult.success) {
        if (planResult.error === 'No matching token condition found for board state') {
            return { success: true };
        }
        return { success: false, error: planResult.error };
    }

    return ConditionalTokenDeployManager.executePlan(
        gameEnv,
        sourcePlayerId,
        sourceCarduid || 'unknown',
        planResult.plan
    );
}
