// src/services/targets/TargetSelectionPipeline.ts
// Centralizes common target-list post-processing (e.g. excludeSource, selection rules).

import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { TargetSelectionUtils } from './TargetSelectionUtils';

export class TargetSelectionPipeline {
    static apply(
        targets: TargetReference[],
        effect: EffectDefinition,
        sourceCarduid: string
    ): TargetReference[] {
        let result = targets;

        const excludeSource = effect.parameters?.excludeSource === true;
        if (excludeSource) {
            result = TargetSelectionUtils.excludeCarduid(result, sourceCarduid);
        }

        result = TargetSelectionUtils.applySelection(result, effect.target?.selection);
        return result;
    }
}

