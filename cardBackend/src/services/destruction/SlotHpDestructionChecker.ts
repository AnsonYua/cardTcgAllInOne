import type { GameEnvironment } from '../../models/GameEnvironment';
import { DestructionCoordinator } from './DestructionCoordinator';
import type { DestructionCause, DestructionTiming } from './DestructionTypes';

export class SlotHpDestructionChecker {
    static destroyUnitIfSlotHpZero(
        gameEnv: GameEnvironment,
        unitCarduid: string,
        options?: {
            timing?: DestructionTiming;
            cause?: DestructionCause;
            battleContextId?: string;
            orderKey?: number;
        }
    ): boolean {
        const result = DestructionCoordinator.requestSlotDestruction(gameEnv, {
            unitCarduid,
            timing: options?.timing || 'IMMEDIATE',
            cause: options?.cause || 'RULE_DESTROY',
            battleContextId: options?.battleContextId,
            orderKey: options?.orderKey
        });
        return result.success;
    }
}
