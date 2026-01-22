// src/services/targets/TargetSelectionUtils.ts

import type { EffectTargetConfig, TargetReference } from '../EventQueue/interfaces/GameEvent';

export class TargetSelectionUtils {
    static applySelection(
        targets: TargetReference[],
        selection: EffectTargetConfig['selection'] | undefined
    ): TargetReference[] {
        if (!selection || !selection.type) {
            return targets;
        }

        switch (selection.type) {
            case 'HIGHEST_LEVEL':
                return this.filterHighestLevelTargets(targets);
            default:
                return targets;
        }
    }

    private static filterHighestLevelTargets(targets: TargetReference[]): TargetReference[] {
        if (targets.length <= 1) {
            return targets;
        }

        let highestLevel = -Infinity;
        for (const target of targets) {
            const level = typeof target.cardData?.level === 'number' ? target.cardData.level : 0;
            if (level > highestLevel) {
                highestLevel = level;
            }
        }

        return targets.filter(target => {
            const level = typeof target.cardData?.level === 'number' ? target.cardData.level : 0;
            return level === highestLevel;
        });
    }
}
