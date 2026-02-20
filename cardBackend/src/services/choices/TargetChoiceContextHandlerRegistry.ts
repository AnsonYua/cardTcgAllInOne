// src/services/choices/TargetChoiceContextHandlerRegistry.ts
// Centralizes context-specific TARGET_CHOICE resolution handlers.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetChoiceEvent, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { DiscardFromHandCostChoiceHandler } from '../costs/DiscardFromHandCostChoiceHandler';
import { DestroyFriendlyUnitCostChoiceHandler } from '../costs/DestroyFriendlyUnitCostChoiceHandler';
import { ExileFromTrashCostChoiceHandler } from '../costs/ExileFromTrashCostChoiceHandler';
import { MoveFromHandToDeckBottomCostChoiceHandler } from '../costs/MoveFromHandToDeckBottomCostChoiceHandler';
import { MoveFromTrashToDeckCostChoiceHandler } from '../costs/MoveFromTrashToDeckCostChoiceHandler';
import { ForcedAttackTargetChoiceHandler } from '../battle/ForcedAttackTargetChoiceHandler';
import { SequenceTargetChoiceHandler } from '../effects/SequenceTargetChoiceHandler';

export class TargetChoiceContextHandlerRegistry {
    static tryHandle(
        gameEnv: GameEnvironment,
        event: TargetChoiceEvent,
        normalizedTargets: TargetReference[]
    ): { handled: boolean; success: boolean; error?: string } {
        const discardCostResult = DiscardFromHandCostChoiceHandler.tryHandle(gameEnv, event, normalizedTargets);
        if (discardCostResult.handled) {
            return discardCostResult;
        }

        const exileCostResult = ExileFromTrashCostChoiceHandler.tryHandle(gameEnv, event, normalizedTargets);
        if (exileCostResult.handled) {
            return exileCostResult;
        }

        const destroyCostResult = DestroyFriendlyUnitCostChoiceHandler.tryHandle(gameEnv, event, normalizedTargets);
        if (destroyCostResult.handled) {
            return destroyCostResult;
        }

        const moveFromHandResult = MoveFromHandToDeckBottomCostChoiceHandler.tryHandle(gameEnv, event, normalizedTargets);
        if (moveFromHandResult.handled) {
            return moveFromHandResult;
        }

        const moveFromTrashResult = MoveFromTrashToDeckCostChoiceHandler.tryHandle(gameEnv, event, normalizedTargets);
        if (moveFromTrashResult.handled) {
            return moveFromTrashResult;
        }

        const forcedTargetResult = ForcedAttackTargetChoiceHandler.tryHandle(gameEnv, event, normalizedTargets);
        if (forcedTargetResult.handled) {
            return forcedTargetResult;
        }

        const sequenceResult = SequenceTargetChoiceHandler.tryHandle(gameEnv, event, normalizedTargets);
        if (sequenceResult.handled) {
            return sequenceResult;
        }

        return { handled: false, success: true };
    }
}
