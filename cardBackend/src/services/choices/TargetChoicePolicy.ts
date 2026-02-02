// src/services/choices/TargetChoicePolicy.ts

import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import type { ResolvedTargetConfig } from '../targets/TargetResolver';
import { TargetCountUtils } from '../targets/TargetCountUtils';

export class TargetChoicePolicy {
    static requiresChoice(
        targetConfig: ResolvedTargetConfig,
        availableTargets: TargetReference[],
        effect: EffectDefinition
    ): boolean {
        const selectionType = typeof effect.target?.selection?.type === 'string'
            ? effect.target.selection.type.toLowerCase()
            : '';
        if (selectionType === 'player_choice') {
            return TargetCountUtils.hasMeaningfulChoice(
                availableTargets.length,
                effect.target?.count,
                effect.optional === true
            );
        }

        const tieBreaker = typeof effect.target?.selection?.tieBreaker === 'string'
            ? effect.target.selection.tieBreaker.toLowerCase()
            : '';
        if (tieBreaker === 'controller_choice') {
            // When selection narrows to multiple candidates (e.g. HIGHEST_LEVEL ties) and count=1,
            // the controller must choose which one to apply to.
            return TargetCountUtils.hasMeaningfulChoice(
                availableTargets.length,
                effect.target?.count,
                effect.optional === true
            );
        }

        if (targetConfig.scope === 'self_shield' || targetConfig.scope === 'opponent_shield') {
            return false;
        }

        const scopeValue = typeof targetConfig.scope === 'string' ? targetConfig.scope.toLowerCase() : '';
        if (scopeValue.includes('all')) {
            return false;
        }

        if (targetConfig.count <= 0) {
            return false;
        }

        if (effect.optional === true) {
            return availableTargets.length > 0;
        }

        if (targetConfig.count > 1) {
            return availableTargets.length > 0;
        }

        return availableTargets.length > 1;
    }
}
