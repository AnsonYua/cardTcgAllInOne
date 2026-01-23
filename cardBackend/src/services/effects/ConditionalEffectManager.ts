import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { SequenceEffectManager } from './SequenceEffectManager';

type ConditionalBranch = {
    conditions?: unknown[];
    steps?: unknown[];
};

export class ConditionalEffectManager {
    private static branchConditionsMet(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCard: unknown,
        conditions: unknown[]
    ): boolean {
        if (!Array.isArray(conditions) || conditions.length === 0) {
            return true;
        }

        return ContinuousEffectManager.validateEffectConditions(
            ensureEffectDefaults({
                effectId: `conditional_branch_check`,
                type: 'internal',
                trigger: 'CONDITIONAL_BRANCH_CHECK',
                action: 'noop',
                conditions: conditions as any[]
            } as any),
            gameEnv,
            playerId,
            sourceCard as any
        );
    }

    static processConditionalEffect(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        cardPlayNotificationId?: string
    ): { success: boolean; error?: string; requiresSelection?: boolean } {
        const sourceCard = SlotZoneUtils.getCardByUid(gameEnv, sourceCarduid) as any;
        const parameters = (effect.parameters || {}) as Record<string, unknown>;

        const branches = Array.isArray((parameters as any)?.branches)
            ? (((effect.parameters as any).branches as unknown[]) as ConditionalBranch[])
            : [];

        let steps: any[] = [];

        if (branches.length > 0) {
            let selected: ConditionalBranch | null = null;
            let fallback: ConditionalBranch | null = null;

            for (const branch of branches) {
                if (!branch || typeof branch !== 'object') {
                    continue;
                }

                const branchConditions = Array.isArray(branch.conditions) ? branch.conditions : [];
                if (branchConditions.length === 0 && !fallback) {
                    fallback = branch;
                    continue;
                }

                if (branchConditions.length === 0) {
                    continue;
                }

                if (this.branchConditionsMet(gameEnv, playerId, sourceCard, branchConditions)) {
                    selected = branch;
                    break;
                }
            }

            if (!selected && fallback) {
                selected = fallback;
            }

            steps = selected && Array.isArray(selected.steps) ? (selected.steps as any[]) : [];
        } else {
            const ifConditions = Array.isArray((parameters as any).if) ? ((parameters as any).if as unknown[]) : [];
            const thenSteps = Array.isArray((parameters as any).then) ? ((parameters as any).then as unknown[]) : [];
            const elseSteps = Array.isArray((parameters as any).else) ? ((parameters as any).else as unknown[]) : [];

            if (ifConditions.length === 0 && thenSteps.length === 0 && elseSteps.length === 0) {
                return { success: true };
            }

            const ok = this.branchConditionsMet(gameEnv, playerId, sourceCard, ifConditions);
            steps = (ok ? thenSteps : elseSteps) as any[];
        }

        if (!Array.isArray(steps) || steps.length === 0) {
            return { success: true };
        }

        const sequenceEffect = ensureEffectDefaults({
            effectId: `${effect.effectId}_conditional_resolved`,
            type: 'internal',
            trigger: 'CONDITIONAL_RESOLVED',
            action: 'sequence',
            parameters: { steps }
        } as any);

        const result = SequenceEffectManager.processSequenceEffect(
            gameEnv,
            playerId,
            sourceCarduid,
            sequenceEffect,
            cardPlayNotificationId
        );

        return {
            success: result.success,
            ...(result.error ? { error: result.error } : {}),
            ...(result.requiresSelection ? { requiresSelection: true } : {})
        };
    }
}
