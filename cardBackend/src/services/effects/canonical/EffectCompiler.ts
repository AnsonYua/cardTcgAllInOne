import type { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../../utils/EffectNormalizationUtils';
import {
    CanonicalEffectDefinition,
    CanonicalEffectOperation,
    EffectCanonicalSchema
} from './EffectCanonicalSchema';

function normalizeBaseValue(parameters: Record<string, unknown> | undefined): number {
    const raw = parameters?.value;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return raw;
    }
    if (typeof raw === 'string') {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return 0;
}

function buildOperation(effect: EffectDefinition): CanonicalEffectOperation {
    const action = typeof effect.action === 'string' && effect.action.length > 0
        ? effect.action
        : 'modifyAP';
    const parameters = (effect.parameters && typeof effect.parameters === 'object')
        ? effect.parameters
        : {};
    const scaling = (parameters as Record<string, unknown>).scaling;

    return {
        action,
        parameters,
        baseValue: normalizeBaseValue(parameters),
        scaling: (scaling && typeof scaling === 'object')
            ? (scaling as Record<string, unknown>)
            : undefined
    };
}

export class EffectCompiler {
    static compile(effect: EffectDefinition): CanonicalEffectDefinition {
        const normalized = ensureEffectDefaults(effect);
        const compiled: CanonicalEffectDefinition = {
            effectId: normalized.effectId,
            kind: EffectCanonicalSchema.fromLegacyKind(normalized),
            timing: normalized.timing,
            target: normalized.target,
            operations: [buildOperation(normalized)],
            conditions: Array.isArray(normalized.conditions) ? normalized.conditions : [],
            sourceConditions: Array.isArray(normalized.sourceConditions) ? normalized.sourceConditions : [],
            metadata: {
                originalType: normalized.type,
                originalTrigger: normalized.trigger
            }
        };

        const result = EffectCanonicalSchema.validate(compiled);
        if (!result.ok) {
            throw new Error(`Failed to compile effect ${normalized.effectId}: ${result.errors.join(', ')}`);
        }

        return compiled;
    }

    static compileMany(rules: EffectDefinition[]): CanonicalEffectDefinition[] {
        if (!Array.isArray(rules)) {
            return [];
        }
        return rules.map(rule => this.compile(rule));
    }
}
