import type { CompiledEffectTiming, EffectTiming } from '../../EventQueue/interfaces/GameEvent';
import { normalizeEffectTriggerAlias } from '../schema/EffectSchema';

const ACTIVATION_WINDOWS = new Set(['MAIN_PHASE', 'ACTION_STEP']);
const INTERNAL_HOOKS = new Set(['SEQUENCE_STEP', 'CHOICE_RESOLUTION']);

type RawRule = Record<string, unknown>;
type RawTiming = Record<string, unknown>;

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
    }
    if (typeof value === 'string' && value.length > 0) {
        return [value];
    }
    return [];
}

function dedupe(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.length > 0)));
}

function getRawTiming(rule: RawRule): RawTiming {
    const value = rule.timing;
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as RawTiming)
        : {};
}

function resolveRawTrigger(rule: RawRule): string | undefined {
    const direct = asString(rule.trigger);
    if (direct) {
        return normalizeEffectTriggerAlias(direct);
    }
    const timing = getRawTiming(rule);
    const eventTrigger = asString(timing.eventTrigger);
    if (eventTrigger) {
        return normalizeEffectTriggerAlias(eventTrigger);
    }
    const nestedTrigger = rule.trigger;
    if (nestedTrigger && typeof nestedTrigger === 'object' && !Array.isArray(nestedTrigger)) {
        return normalizeEffectTriggerAlias(asString((nestedTrigger as RawTiming).event));
    }
    return undefined;
}

function resolveActivationWindows(rule: RawRule, eventTrigger: string | undefined): string[] {
    const timing = getRawTiming(rule);
    const windows = dedupe([
        ...toStringArray(timing.activationWindows),
        ...toStringArray(timing.windows),
        ...toStringArray(timing.window)
    ]);
    if (windows.length > 0) {
        return windows;
    }

    if (eventTrigger && ACTIVATION_WINDOWS.has(eventTrigger)) {
        return [eventTrigger];
    }

    const type = asString(rule.type);
    const action = asString(rule.action);
    if (type === 'special' && action === 'designate_pilot') {
        return ['MAIN_PHASE'];
    }
    if ((type === 'play' || type === 'activated') && !eventTrigger) {
        return ['MAIN_PHASE'];
    }

    return [];
}

function resolveDuration(rule: RawRule, eventTrigger: string | undefined): string | undefined {
    const timing = getRawTiming(rule);
    const explicit = asString(timing.duration);
    if (explicit) {
        return explicit;
    }

    const type = asString(rule.type);
    if (type === 'continuous' || eventTrigger === 'continuous') {
        return 'continuous';
    }

    return undefined;
}

function resolveInternalHook(rule: RawRule, eventTrigger: string | undefined): string | undefined {
    const timing = getRawTiming(rule);
    const explicit = asString(timing.internalHook);
    if (explicit) {
        return explicit;
    }
    if (eventTrigger && INTERNAL_HOOKS.has(eventTrigger)) {
        return eventTrigger;
    }
    return undefined;
}

export function deriveLegacyTriggerFromCompiledTiming(
    compiledTiming: CompiledEffectTiming,
    ruleType?: string
): string | undefined {
    if (compiledTiming.internalHook) {
        return compiledTiming.internalHook;
    }
    if (compiledTiming.eventTrigger) {
        return compiledTiming.eventTrigger;
    }
    if (compiledTiming.duration === 'continuous' || ruleType === 'continuous') {
        return 'continuous';
    }
    if (Array.isArray(compiledTiming.activationWindows) && compiledTiming.activationWindows.length === 1) {
        return compiledTiming.activationWindows[0];
    }
    return undefined;
}

export function compileEffectTimingFromRule(rule: RawRule): CompiledEffectTiming {
    const type = asString(rule.type);
    const eventTrigger = resolveRawTrigger(rule);
    const activationWindows = resolveActivationWindows(rule, eventTrigger);
    const duration = resolveDuration(rule, eventTrigger);
    const internalHook = resolveInternalHook(rule, eventTrigger);

    let timingClass: CompiledEffectTiming['timingClass'];
    if (internalHook) {
        timingClass = 'engine_internal';
    } else if (duration === 'continuous' || type === 'continuous') {
        timingClass = 'continuous_passive';
    } else if (eventTrigger) {
        timingClass = 'event_triggered';
    } else if (activationWindows.length > 0) {
        timingClass = 'player_activated';
    } else if (duration) {
        timingClass = 'temporary_effect';
    } else {
        timingClass = 'event_triggered';
    }

    const compiledTiming: CompiledEffectTiming = {
        timingClass
    };

    if (eventTrigger && !ACTIVATION_WINDOWS.has(eventTrigger) && eventTrigger !== 'continuous' && !INTERNAL_HOOKS.has(eventTrigger)) {
        compiledTiming.eventTrigger = eventTrigger;
    }
    if (activationWindows.length > 0) {
        compiledTiming.activationWindows = activationWindows;
        compiledTiming.windows = activationWindows;
    }
    if (duration) {
        compiledTiming.duration = duration;
    }
    if (internalHook) {
        compiledTiming.internalHook = internalHook;
    }

    const legacyTrigger = deriveLegacyTriggerFromCompiledTiming(compiledTiming, type);
    if (legacyTrigger) {
        compiledTiming.legacyTrigger = legacyTrigger;
    }

    return compiledTiming;
}

export function buildBridgedEffectTiming(
    timingValue: unknown,
    compiledTiming: CompiledEffectTiming
): EffectTiming | undefined {
    const rawTiming = timingValue && typeof timingValue === 'object' && !Array.isArray(timingValue)
        ? (timingValue as RawTiming)
        : {};

    const normalized: EffectTiming = {};

    if (compiledTiming.eventTrigger) {
        normalized.eventTrigger = compiledTiming.eventTrigger;
    }
    if (compiledTiming.activationWindows && compiledTiming.activationWindows.length > 0) {
        normalized.activationWindows = [...compiledTiming.activationWindows];
        normalized.windows = [...compiledTiming.activationWindows];
    }
    if (compiledTiming.duration) {
        normalized.duration = compiledTiming.duration;
    }

    const actionTurn = asString(rawTiming.actionTurn);
    if (actionTurn) {
        normalized.actionTurn = actionTurn;
    }
    if (typeof rawTiming.endOnSourceDestroyed === 'boolean') {
        normalized.endOnSourceDestroyed = rawTiming.endOnSourceDestroyed;
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function applyCompiledTimingBridgeToRule(rule: RawRule): RawRule {
    const compiledTiming = compileEffectTimingFromRule(rule);
    const nextRule: RawRule = {
        ...rule,
        compiledTiming
    };

    const bridgedTiming = buildBridgedEffectTiming(rule.timing, compiledTiming);
    if (bridgedTiming) {
        nextRule.timing = bridgedTiming;
    }

    const type = asString(rule.type);
    const legacyTrigger = deriveLegacyTriggerFromCompiledTiming(compiledTiming, type);
    if (legacyTrigger) {
        nextRule.trigger = legacyTrigger;
    }

    return nextRule;
}

export function applyCompiledTimingBridgeToCardData<TCardData>(cardData: TCardData): TCardData {
    if (!cardData || typeof cardData !== 'object') {
        return cardData;
    }

    const typed = cardData as Record<string, unknown>;
    const effects = typed.effects;
    if (!effects || typeof effects !== 'object' || Array.isArray(effects)) {
        return cardData;
    }

    const rules = Array.isArray((effects as RawTiming).rules) ? ((effects as RawTiming).rules as unknown[]) : null;
    if (!rules) {
        return cardData;
    }

    const compiledRules = rules.map((rule) => {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
            return rule;
        }
        return applyCompiledTimingBridgeToRule(rule as RawRule);
    });

    return {
        ...(typed as object),
        effects: {
            ...(effects as object),
            rules: compiledRules
        }
    } as TCardData;
}
