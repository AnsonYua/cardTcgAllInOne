import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import {
    type SlotCardType,
    type SlotToHandMoveResult,
    type SlotToTrashMoveResult,
    SlotExitTransferService
} from './SlotExitTransferService';
import { SlotExitPolicy } from './SlotExitPolicy';

type HandMoveContext = {
    sourcePlayerId: string;
    sourceCarduid?: string;
    effectId?: string;
};

export class SlotExitCoordinator {
    static moveTargetToHand(
        gameEnv: GameEnvironment,
        ownerPlayerId: string,
        slotName: string,
        targetType: SlotCardType,
        effect: EffectDefinition,
        context: HandMoveContext
    ): SlotToHandMoveResult {
        const owner = gameEnv.getPlayer(ownerPlayerId);
        if (!owner?.zones) {
            return { success: false, error: `Owner player ${ownerPlayerId} not found`, moved: [] };
        }

        const slot = (owner.zones as any)[slotName];
        const includePairedPilotWithUnit = SlotExitPolicy.shouldIncludePairedPilotWithUnit('hand', targetType, effect);
        const plan = SlotExitTransferService.buildSlotExitPlan(slot, targetType, { includePairedPilotWithUnit });
        if (!plan.success) {
            return { success: false, error: plan.error || 'Failed to build return-to-hand plan', moved: [] };
        }

        return SlotExitTransferService.movePlannedCardsToHand(
            gameEnv,
            ownerPlayerId,
            slotName,
            plan.cards,
            context
        );
    }

    static moveTargetToTrash(
        gameEnv: GameEnvironment,
        ownerPlayerId: string,
        slotName: string,
        targetType: SlotCardType
    ): SlotToTrashMoveResult {
        const owner = gameEnv.getPlayer(ownerPlayerId);
        if (!owner?.zones) {
            return { success: false, error: `Owner player ${ownerPlayerId} not found`, moved: [] };
        }

        const slot = (owner.zones as any)[slotName];
        const includePairedPilotWithUnit = SlotExitPolicy.shouldIncludePairedPilotWithUnit('trash', targetType);
        const plan = SlotExitTransferService.buildSlotExitPlan(slot, targetType, { includePairedPilotWithUnit });
        if (!plan.success) {
            return { success: false, error: plan.error || 'Failed to build move-to-trash plan', moved: [] };
        }

        return SlotExitTransferService.movePlannedCardsToTrash(
            gameEnv,
            ownerPlayerId,
            slotName,
            plan.cards
        );
    }
}
