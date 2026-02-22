import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import {
    type SlotCardType,
    type SlotCardEntry,
    type SlotToHandMoveResult,
    type SlotToTrashMoveResult,
    SlotExitTransferService
} from './SlotExitTransferService';
import { SlotExitPlanningService } from './SlotExitPlanningService';

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
        context: HandMoveContext,
        destinationPlayerId: string = ownerPlayerId
    ): SlotToHandMoveResult {
        const planResult = SlotExitPlanningService.planTargetToHand(
            gameEnv,
            ownerPlayerId,
            slotName,
            targetType,
            effect
        );
        if (!planResult.success || !planResult.plan) {
            return { success: false, error: planResult.error || 'Failed to build return-to-hand plan', moved: [] };
        }

        return this.movePlannedToHand(
            gameEnv,
            ownerPlayerId,
            slotName,
            planResult.plan.plannedCards,
            context,
            destinationPlayerId
        );
    }

    static movePlannedToHand(
        gameEnv: GameEnvironment,
        ownerPlayerId: string,
        slotName: string,
        plannedCards: SlotCardEntry[],
        context: HandMoveContext,
        destinationPlayerId: string = ownerPlayerId
    ): SlotToHandMoveResult {
        return SlotExitTransferService.movePlannedCardsToHand(
            gameEnv,
            ownerPlayerId,
            destinationPlayerId,
            slotName,
            plannedCards,
            context
        );
    }

    static moveTargetToTrash(
        gameEnv: GameEnvironment,
        ownerPlayerId: string,
        slotName: string,
        targetType: SlotCardType
    ): SlotToTrashMoveResult {
        const planResult = SlotExitPlanningService.planTargetToTrash(
            gameEnv,
            ownerPlayerId,
            slotName,
            targetType
        );
        if (!planResult.success || !planResult.plan) {
            return { success: false, error: planResult.error || 'Failed to build move-to-trash plan', moved: [] };
        }

        return SlotExitTransferService.movePlannedCardsToTrash(
            gameEnv,
            ownerPlayerId,
            slotName,
            planResult.plan.plannedCards
        );
    }
}
