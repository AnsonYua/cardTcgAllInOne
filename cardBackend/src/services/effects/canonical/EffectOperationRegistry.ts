import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { EffectExecutor } from '../EffectExecutor';
import { EffectScalingResolver } from '../scaling/EffectScalingResolver';
import type { CanonicalEffectDefinition, CanonicalEffectOperation } from './EffectCanonicalSchema';
import { ContinuousKeywordGrantManager } from '../continuous/ContinuousKeywordGrantManager';
import { ContinuousBreachGrantManager } from '../continuous/ContinuousBreachGrantManager';

export type CanonicalContinuousEntry = {
    effectId: string;
    sourceCarduid: string;
    sourcePlayerId: string;
    effectData: EffectDefinition;
    compiledEffect?: CanonicalEffectDefinition;
};

function applyStatOperation(
    gameEnv: GameEnvironment,
    operation: CanonicalEffectOperation,
    entry: CanonicalContinuousEntry,
    targets: any[]
): number {
    let applied = 0;
    const resolvedValue = EffectScalingResolver.resolveScaledValue(
        operation.baseValue,
        operation.scaling,
        {
            gameEnv,
            sourcePlayerId: entry.sourcePlayerId,
            sourceCarduid: entry.sourceCarduid,
            effectId: entry.effectId
        }
    );

    for (const target of targets) {
        if (EffectExecutor.applyContinueCardEffect(target, operation.action, resolvedValue)) {
            applied += 1;
        }
    }

    return applied;
}

export class EffectOperationRegistry {
    static applyContinuous(
        gameEnv: GameEnvironment,
        entry: CanonicalContinuousEntry,
        targets: any[]
    ): number | null {
        const compiled = entry.compiledEffect;
        if (!compiled || compiled.kind !== 'continuous' || !Array.isArray(compiled.operations)) {
            return null;
        }

        let totalApplied = 0;
        let handledAny = false;

        for (const operation of compiled.operations) {
            switch (operation.action) {
                case 'modifyAP':
                case 'modifyHP':
                    handledAny = true;
                    totalApplied += applyStatOperation(gameEnv, operation, entry, targets);
                    break;
                case 'grant_keyword':
                    handledAny = true;
                    totalApplied += ContinuousKeywordGrantManager.applyToTargets(gameEnv, entry, targets);
                    break;
                case 'grant_breach':
                    handledAny = true;
                    totalApplied += ContinuousBreachGrantManager.applyToTargets(gameEnv, entry, targets);
                    break;
                default:
                    break;
            }
        }

        if (!handledAny) {
            return null;
        }

        return totalApplied;
    }
}
