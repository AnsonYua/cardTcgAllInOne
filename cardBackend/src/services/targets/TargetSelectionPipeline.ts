// src/services/targets/TargetSelectionPipeline.ts
// Centralizes common target-list post-processing (e.g. excludeSource, selection rules).

import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import type { GameEnvironment } from '../../models/GameEnvironment';
import { TargetSelectionUtils } from './TargetSelectionUtils';
import { TargetCardResolver } from './TargetCardResolver';

export class TargetSelectionPipeline {
    static apply(
        gameEnv: GameEnvironment,
        targets: TargetReference[],
        effect: EffectDefinition,
        sourceCarduid: string,
        selectionContext?: {
            justLinkedUnitCarduid?: string;
        }
    ): TargetReference[] {
        let result = targets;

        const excludeSource = effect.parameters?.excludeSource === true;
        if (excludeSource) {
            result = TargetSelectionUtils.excludeCarduid(result, sourceCarduid);
        }

        result = this.filterByActionStateEligibility(gameEnv, result, effect);
        result = TargetSelectionUtils.applySelection(gameEnv, result, effect.target?.selection, selectionContext);
        return result;
    }

    private static filterByActionStateEligibility(
        gameEnv: GameEnvironment,
        targets: TargetReference[],
        effect: EffectDefinition
    ): TargetReference[] {
        const action = typeof effect.action === 'string' ? effect.action.toLowerCase() : '';
        if (action !== 'rest' && action !== 'setactive') {
            return targets;
        }

        return targets.filter((target) => {
            const resolved = TargetCardResolver.resolve(gameEnv, target);
            if (!resolved) {
                return true;
            }

            const isRested = resolved.card?.isRested === true;
            if (action === 'rest') {
                return !isRested;
            }
            return isRested;
        });
    }
}
