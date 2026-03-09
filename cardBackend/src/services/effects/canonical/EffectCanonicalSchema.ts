import type {
    EffectCondition,
    EffectDefinition,
    EffectSourceCondition,
    EffectTargetConfig,
    EffectTiming
} from '../../EventQueue/interfaces/GameEvent';
import { isContinuousEffectTiming } from '../timing/EffectTimingAccess';

export type CanonicalEffectKind = 'continuous' | 'triggered' | 'activated' | 'play' | 'replacement';

export interface CanonicalEffectOperation {
    action: string;
    parameters: Record<string, unknown>;
    baseValue: number;
    scaling?: Record<string, unknown>;
}

export interface CanonicalEffectDefinition {
    effectId: string;
    kind: CanonicalEffectKind;
    timing?: EffectTiming;
    target?: EffectTargetConfig;
    operations: CanonicalEffectOperation[];
    conditions: EffectCondition[];
    sourceConditions: EffectSourceCondition[];
    metadata?: {
        originalType?: string;
        originalTrigger?: string;
    };
}

export interface CanonicalEffectValidationResult {
    ok: boolean;
    errors: string[];
}

export class EffectCanonicalSchema {
    static validate(effect: CanonicalEffectDefinition): CanonicalEffectValidationResult {
        const errors: string[] = [];
        if (!effect || typeof effect !== 'object') {
            return { ok: false, errors: ['canonical effect must be an object'] };
        }

        if (typeof effect.effectId !== 'string' || effect.effectId.length === 0) {
            errors.push('effectId must be a non-empty string');
        }

        if (!Array.isArray(effect.operations) || effect.operations.length === 0) {
            errors.push('operations must contain at least one operation');
        }

        if (Array.isArray(effect.operations)) {
            for (const operation of effect.operations) {
                if (!operation || typeof operation !== 'object') {
                    errors.push('operation must be an object');
                    continue;
                }
                if (typeof operation.action !== 'string' || operation.action.length === 0) {
                    errors.push('operation.action must be a non-empty string');
                }
                if (!Number.isFinite(operation.baseValue)) {
                    errors.push('operation.baseValue must be a finite number');
                }
            }
        }

        return { ok: errors.length === 0, errors };
    }

    static fromLegacyKind(effect: EffectDefinition): CanonicalEffectKind {
        const type = typeof effect?.type === 'string' ? effect.type.toLowerCase() : '';

        if (type === 'continuous' || isContinuousEffectTiming(effect)) {
            return 'continuous';
        }
        if (type === 'activated') {
            return 'activated';
        }
        if (type === 'play') {
            return 'play';
        }
        return 'triggered';
    }
}
