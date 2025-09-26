import {
    EffectCondition,
    EffectDefinition,
    EffectDetails,
    EffectTiming,
    EffectTargetConfig,
    TargetFilters
} from '../services/EventQueue/interfaces/GameEvent';

interface NormalizeEffectRuleOptions {
    fallbackEffectId: string;
    expectedTriggers?: string[];
    defaultTrigger?: string;
    requireAction?: boolean;
    defaultTargetScope?: string;
    defaultTargetType?: string;
    defaultTargetCount?: number;
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
    const effectDetails = normalizeEffectDetails(raw['effect'] as EffectDetails | undefined);

    const trigger = resolveTrigger(raw['trigger'], options.defaultTrigger);
    if (options.expectedTriggers && options.expectedTriggers.length > 0) {
        if (!trigger || !options.expectedTriggers.includes(trigger)) {
            return null;
        }
    }

    const action = resolveAction(raw['action'], effectDetails);
    if (options.requireAction && !action) {
        return null;
    }

    const parameters = normalizeEffectParameters(raw, effectDetails);
    const timing = normalizeEffectTiming(raw['timing']);
    const target = normalizeTargetConfig(raw['target'], {
        scope: options.defaultTargetScope,
        type: options.defaultTargetType,
        count: options.defaultTargetCount
    });

    const conditions = Array.isArray(raw['conditions'])
        ? (raw['conditions'] as EffectCondition[])
        : undefined;

    const description = typeof raw['description'] === 'string' || Array.isArray(raw['description'])
        ? (raw['description'] as string | string[])
        : undefined;

    const effectId = typeof raw['effectId'] === 'string' && raw['effectId'].length > 0
        ? raw['effectId']
        : options.fallbackEffectId;

    const type = typeof raw['type'] === 'string' ? raw['type'] : undefined;
    const optional = typeof raw['optional'] === 'boolean' ? raw['optional'] : undefined;

    const normalized: EffectDefinition = {
        effectId,
        type,
        trigger,
        optional,
        target,
        action,
        parameters,
        timing,
        conditions,
        description
    };

    if (effectDetails) {
        normalized.effect = effectDetails;
    }

    return normalized;
}

export function ensureEffectDefaults(effect: EffectDefinition): EffectDefinition {
    const effectDetails = effect.effect;
    const action = resolveAction(effect.action, effectDetails);
    const parameters = effect.parameters ?? effectDetails?.parameters;

    if (action === effect.action && parameters === effect.parameters) {
        return effect;
    }

    return {
        ...effect,
        action,
        parameters
    };
}

export function normalizeEffectDetails(effect: EffectDetails | undefined): EffectDetails | undefined {
    if (!effect || typeof effect !== 'object') {
        return undefined;
    }

    if (typeof effect.action !== 'string' || effect.action.length === 0) {
        return undefined;
    }

    const normalized: EffectDetails = {
        action: effect.action
    };

    if (effect.parameters && typeof effect.parameters === 'object') {
        normalized.parameters = effect.parameters;
    }

    if (typeof effect.duration === 'string') {
        normalized.duration = effect.duration;
    }

    return normalized;
}

export function normalizeEffectParameters(
    rule: Record<string, unknown>,
    effectDetails?: EffectDetails
): Record<string, unknown> | undefined {
    const directParameters = rule['parameters'];
    if (directParameters && typeof directParameters === 'object') {
        return directParameters as Record<string, unknown>;
    }

    if (effectDetails?.parameters && typeof effectDetails.parameters === 'object') {
        return effectDetails.parameters;
    }

    return undefined;
}

export function normalizeEffectTiming(timingValue: unknown): EffectTiming | undefined {
    if (!timingValue || typeof timingValue !== 'object') {
        return undefined;
    }

    const timing = timingValue as Record<string, unknown>;
    const duration = typeof timing['duration'] === 'string' ? timing['duration'] : undefined;
    const actionTurn = typeof timing['actionTurn'] === 'string' ? timing['actionTurn'] : undefined;

    if (!duration && !actionTurn) {
        return undefined;
    }

    return { duration, actionTurn };
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
    const count = resolvePositiveNumber(target['count']) ?? defaults.count;

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
    if (typeof count === 'number') {
        normalized.count = count;
    }
    if (filters) {
        normalized.filters = filters;
    }
    if (zone && zone.length > 0) {
        normalized.zone = zone;
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

function resolveAction(actionValue: unknown, effectDetails?: EffectDetails): string | undefined {
    if (typeof actionValue === 'string' && actionValue.length > 0) {
        return actionValue;
    }

    if (effectDetails && typeof effectDetails.action === 'string' && effectDetails.action.length > 0) {
        return effectDetails.action;
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
