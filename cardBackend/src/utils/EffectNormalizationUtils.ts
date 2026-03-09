import {
    EffectCondition,
    EffectDefinition,
    EffectSourceCondition,
    EffectSourceConditionObject,
    EffectTiming,
    EffectTargetConfig,
    TargetFilters
} from '../services/EventQueue/interfaces/GameEvent';
import {
    normalizeConditionTypeAlias,
    normalizeSelectionTypeAlias
} from '../services/effects/schema/EffectSchema';
import {
    compileEffectTimingFromRule
} from '../services/effects/timing/EffectTimingCompiler';
import {
    buildLegacyEffectTiming,
    deriveLegacyTriggerFromCompiledTiming
} from '../services/effects/timing/EffectTimingBridge';

interface NormalizeEffectRuleOptions {
    fallbackEffectId: string;
    expectedTriggers?: string[];
    defaultTrigger?: string;
    requireAction?: boolean;
    defaultTargetScope?: string;
    defaultTargetType?: string;
    defaultTargetCount?: number;
    includePairedMetadata?: {
        pairedSlot: string;
        sourceCarduid: string;
    };
}

const COMPARISON_FILTER_REGEX = /^(<=|>=|<|>|==|!=)(\d+)$/;

export function normalizeEffectRule(
    rule: unknown,
    options: NormalizeEffectRuleOptions
): EffectDefinition | null {
    if (!rule || typeof rule !== 'object') {
        return null;
    }

    const raw = rule as Record<string, unknown>;
    const type = typeof raw['type'] === 'string' ? raw['type'] : undefined;
    const compiledTiming = compileEffectTimingFromRule(raw);
    const trigger = deriveLegacyTriggerFromCompiledTiming(compiledTiming, type) || resolveTrigger(raw['trigger'], "");
    if (options.expectedTriggers && options.expectedTriggers.length > 0) {
        if (!trigger || !options.expectedTriggers.includes(trigger)) {
            return null;
        }
    }

    const action = resolveEffectActionFromRule(raw);
    if (options.requireAction && !action) {
        return null;
    }

    const parameters = normalizeEffectParameters(raw);
    const cost = normalizeEffectCost(raw['cost']);
    const timing = normalizeEffectTiming(raw['timing'], compiledTiming);
    const target = normalizeTargetConfig(raw['target'], {
        scope: options.defaultTargetScope,
        type: options.defaultTargetType,
        count: options.defaultTargetCount
    });

    const conditions = Array.isArray(raw['conditions'])
        ? normalizeConditions(raw['conditions'] as EffectCondition[])
        : undefined;

    const sourceConditions = Array.isArray(raw['sourceConditions'])
        ? normalizeSourceConditions(raw['sourceConditions'] as EffectSourceCondition[])
        : undefined;

    const description = typeof raw['description'] === 'string' || Array.isArray(raw['description'])
        ? (raw['description'] as string | string[])
        : undefined;

    const effectId = typeof raw['effectId'] === 'string' && raw['effectId'].length > 0
        ? raw['effectId']
        : options.fallbackEffectId;

    const sourceLevelScope = raw['sourceLevelScope'] === 'paired_unit' || raw['sourceLevelScope'] === 'source_card'
        ? (raw['sourceLevelScope'] as 'paired_unit' | 'source_card')
        : undefined;
    const optional = typeof raw['optional'] === 'boolean' ? raw['optional'] : undefined;
    const restrictions = Array.isArray(raw['restrictions'])
        ? raw['restrictions'].filter((value): value is string => typeof value === 'string')
        : undefined;

    const normalized: EffectDefinition = {
        effectId,
        type,
        trigger,
        compiledTiming,
        sourceLevelScope,
        optional,
        target,
        action,
        cost,
        parameters,
        timing,
        restrictions,
        conditions,
        description,
        sourceConditions
    };

    if (options.includePairedMetadata) {
        return {
            ...normalized,
            pairedSlot: options.includePairedMetadata.pairedSlot,
            sourceCarduid: options.includePairedMetadata.sourceCarduid
        } as EffectDefinition;
    }

    return normalized;
}

export function ensureEffectDefaults<TEffect extends EffectDefinition>(effect: TEffect): TEffect {
    return effect;
}

export function resolveEffectActionFromRule(rule: unknown): string | undefined {
    if (!rule || typeof rule !== 'object') {
        return resolveAction(rule);
    }

    const raw = rule as Record<string, unknown>;

    const direct = resolveAction(raw['action']);
    if (direct) {
        return direct;
    }

    const nestedEffect = raw['effect'];
    if (nestedEffect) {
        const nestedAction = resolveEffectActionFromRule(nestedEffect);
        if (nestedAction) {
            return nestedAction;
        }
    }

    const legacy = resolveAction(raw['effectAction']);
    if (legacy) {
        return legacy;
    }

    const operation = resolveAction(raw['operation']);
    if (operation) {
        return operation;
    }

    const parameters = raw['parameters'];
    if (parameters && typeof parameters === 'object') {
        const parameterAction = resolveAction((parameters as Record<string, unknown>)['action']);
        if (parameterAction) {
            return parameterAction;
        }

        const parameterOperation = resolveAction((parameters as Record<string, unknown>)['operation']);
        if (parameterOperation) {
            return parameterOperation;
        }
    }

    return undefined;
}

export interface NormalizedSourceCondition extends EffectSourceConditionObject {
    type: string;
}

export function normalizeSourceCondition(condition: EffectSourceCondition | undefined): NormalizedSourceCondition {
    if (!condition) {
        return { type: 'unknown' };
    }

    if (typeof condition === 'string') {
        return { type: condition };
    }

    const normalizedType = typeof condition.type === 'string' && condition.type.length > 0
        ? condition.type
        : 'unknown';

    const normalized: NormalizedSourceCondition = {
        ...condition,
        type: normalizedType
    };

    if (normalized.type === 'controller' && typeof normalized.value !== 'string') {
        const { value, ...rest } = normalized;
        return { ...rest };
    }

    return normalized;
}

export function normalizeSourceConditions(conditions?: EffectSourceCondition[]): NormalizedSourceCondition[] {
    if (!Array.isArray(conditions) || conditions.length === 0) {
        return [];
    }

    return conditions.map((condition) => normalizeSourceCondition(condition));
}

export function normalizeEffectParameters(
    rule: Record<string, unknown>
): Record<string, unknown> | undefined {
    const directParameters = rule['parameters'];
    if (directParameters && typeof directParameters === 'object') {
        return directParameters as Record<string, unknown>;
    }

    return undefined;
}

export function normalizeEffectCost(costValue: unknown): Record<string, unknown> | undefined {
    if (!costValue || typeof costValue !== 'object') {
        return undefined;
    }

    return costValue as Record<string, unknown>;
}

export function normalizeEffectTiming(
    timingValue: unknown,
    compiledTiming?: EffectDefinition['compiledTiming']
): EffectTiming | undefined {
    if (!compiledTiming) {
        return undefined;
    }

    return buildLegacyEffectTiming(timingValue, compiledTiming);
}

interface TargetDefaults {
    scope?: string;
    type?: string;
    count?: number;
}

export function normalizeTargetConfig(
    value: unknown,
    defaults: TargetDefaults = {}
): EffectTargetConfig | undefined {
    if (!value || typeof value !== 'object') {
        return createTargetFromDefaults(defaults);
    }

    const target = value as Record<string, unknown>;

    const scope = resolveString(target['scope']) ?? defaults.scope;
    const type = resolveString(target['type']) ?? defaults.type;
    const countValue = target['count'];
    const count = (() => {
        const direct = resolvePositiveNumber(countValue);
        if (typeof direct === 'number') {
            return direct;
        }

        if (countValue && typeof countValue === 'object') {
            const record = countValue as Record<string, unknown>;
            const minRaw = record['min'];
            const maxRaw = record['max'];
            const min = typeof minRaw === 'number' ? Math.max(0, minRaw) : undefined;
            const max = typeof maxRaw === 'number' ? Math.max(0, maxRaw) : undefined;
            if (typeof min === 'number' || typeof max === 'number') {
                const resolvedMin = typeof min === 'number' ? min : (defaults.count ?? 1);
                const resolvedMax = typeof max === 'number' ? max : resolvedMin;
                return { min: resolvedMin, max: Math.max(resolvedMin, resolvedMax) };
            }
        }

        return defaults.count;
    })();

    const filtersValue = target['filters'];
    const filters = filtersValue && typeof filtersValue === 'object'
        ? (filtersValue as TargetFilters)
        : undefined;

    const zoneValue = target['zone'];
    const zone = Array.isArray(zoneValue)
        ? zoneValue.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
        : undefined;

    const normalized: EffectTargetConfig = {};

    if (scope) {
        normalized.scope = scope;
    }
    if (type) {
        normalized.type = type;
    }
    if (typeof count === 'number' || (count && typeof count === 'object')) {
        normalized.count = count as any;
    }
    if (filters) {
        normalized.filters = filters;
    }
    if (zone && zone.length > 0) {
        normalized.zone = zone;
    }

    const selectionValue = target['selection'];
    if (selectionValue && typeof selectionValue === 'object') {
        const selection = selectionValue as Record<string, unknown>;
        const selectionTypeRaw = resolveString(selection['type']);
        const tieBreakerRaw = typeof selection['tieBreaker'] === 'string' ? selection['tieBreaker'] : undefined;
        const normalizedSelection = normalizeSelectionTypeAlias(selectionTypeRaw, tieBreakerRaw);
        if (normalizedSelection.type) {
            normalized.selection = {
                ...selection,
                type: normalizedSelection.type,
                ...(normalizedSelection.tieBreaker ? { tieBreaker: normalizedSelection.tieBreaker } : {})
            };
        }
    }

    if (Object.keys(normalized).length === 0) {
        return undefined;
    }

    return normalized;
}

export function validateComparisonFilter(value: number, filterString: string): boolean {
    const match = filterString.match(COMPARISON_FILTER_REGEX);
    if (!match) {
        return false;
    }

    const operator = match[1];
    const threshold = Number(match[2]);

    switch (operator) {
        case '<':
            return value < threshold;
        case '>':
            return value > threshold;
        case '<=':
            return value <= threshold;
        case '>=':
            return value >= threshold;
        case '==':
            return value === threshold;
        case '!=':
            return value !== threshold;
        default:
            return false;
    }
}

function resolveTrigger(triggerValue: unknown, defaultTrigger?: string): string | undefined {
    if (typeof triggerValue === 'string') {
        return triggerValue;
    }

    if (triggerValue && typeof triggerValue === 'object') {
        const triggerRecord = triggerValue as Record<string, unknown>;
        const nested = triggerRecord['event'];
        if (typeof nested === 'string') {
            return nested;
        }
    }

    return defaultTrigger;
}

function normalizeConditions(conditions: EffectCondition[]): EffectCondition[] {
    return conditions.map((condition) => {
        if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
            return condition;
        }
        const typed = condition as Record<string, unknown>;
        const rawType = typeof typed.type === 'string' ? typed.type : undefined;
        const normalizedType = normalizeConditionTypeAlias(rawType);
        if (!normalizedType || normalizedType === rawType) {
            return condition;
        }
        return {
            ...typed,
            type: normalizedType
        };
    });
}

function resolveAction(actionValue: unknown): string | undefined {
    if (typeof actionValue === 'string' && actionValue.length > 0) {
        return actionValue;
    }

    return undefined;
}

function resolveString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function resolvePositiveNumber(value: unknown): number | undefined {
    if (typeof value !== 'number') {
        return undefined;
    }

    return value > 0 ? value : undefined;
}

function createTargetFromDefaults(defaults: TargetDefaults): EffectTargetConfig | undefined {
    const normalized: EffectTargetConfig = {};

    if (defaults.scope) {
        normalized.scope = defaults.scope;
    }
    if (defaults.type) {
        normalized.type = defaults.type;
    }
    if (typeof defaults.count === 'number') {
        normalized.count = defaults.count;
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
}
