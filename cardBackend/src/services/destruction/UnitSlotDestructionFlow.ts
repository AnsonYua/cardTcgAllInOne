import type { GameEnvironment } from '../../models/GameEnvironment';
import type { PilotZoneCard, UnitZoneCard } from '../../models/CardSystem';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { DestroyedTriggeredEffectManager } from '../effects/DestroyedTriggeredEffectManager';
import { ContinuousEffectManager } from '../ContinuousEffectManager';

type MoveCardToTrashFromSlotFn = (
    gameEnv: GameEnvironment,
    playerId: string,
    slotName: string,
    card: UnitZoneCard | PilotZoneCard,
    cardType: 'unit' | 'pilot'
) => boolean;

export class UnitSlotDestructionFlow {
    static destroyUnitInSlot(
        gameEnv: GameEnvironment,
        playerId: string,
        slotName: string,
        unit: UnitZoneCard,
        deps: {
            moveCardToTrashFromSlot: MoveCardToTrashFromSlotFn;
        }
    ): boolean {
        const player = gameEnv.getPlayer(playerId);
        const slotBefore = player?.zones ? SlotZoneUtils.getSlotZone(player.zones, slotName).slot : undefined;
        const pilotCardBefore = slotBefore?.pilot as PilotZoneCard | undefined;

        const destroyedEffectResult = DestroyedTriggeredEffectManager.processDestroyedCard(gameEnv, playerId, unit);
        if (!destroyedEffectResult.success) {
            console.warn(`⚠️ Failed to resolve destroyed effects for ${unit.carduid}: ${destroyedEffectResult.error}`);
        }

        // Re-resolve slot state after unit DESTROYED triggers, since effects may have moved cards
        // (e.g., GD01-005 returns its paired pilot to hand before discard).
        const slotAfter = player?.zones ? SlotZoneUtils.getSlotZone(player.zones, slotName).slot : undefined;
        const unitAfter = slotAfter?.unit as UnitZoneCard | undefined;
        const pilotAfter = slotAfter?.pilot as PilotZoneCard | undefined;

        // Only process paired pilot DESTROYED triggers if the pilot is still present in the slot after unit triggers.
        // If the unit's destroyed effect moved the pilot away (e.g., returned to hand), the pilot was not destroyed.
        if (pilotAfter) {
            const pilotDestroyedResult = DestroyedTriggeredEffectManager.processDestroyedCard(gameEnv, playerId, pilotAfter);
            if (!pilotDestroyedResult.success) {
                console.warn(
                    `⚠️ Failed to resolve destroyed effects for paired pilot ${pilotAfter.carduid}: ${pilotDestroyedResult.error}`
                );
            }
        } else if (pilotCardBefore) {
            console.log(
                `ℹ️ Paired pilot ${pilotCardBefore.carduid} no longer in ${slotName} after unit DESTROYED triggers; skipping pilot DESTROYED effects`
            );
        }

        const destroyedUnit = unitAfter ? deps.moveCardToTrashFromSlot(gameEnv, playerId, slotName, unitAfter, 'unit') : true;
        if (!destroyedUnit) {
            return false;
        }

        if (pilotAfter) {
            deps.moveCardToTrashFromSlot(gameEnv, playerId, slotName, pilotAfter, 'pilot');
        }

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        return true;
    }
}

