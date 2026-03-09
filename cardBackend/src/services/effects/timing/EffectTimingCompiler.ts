import type { CompiledEffectTiming } from '../../EventQueue/interfaces/GameEvent';
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
    }
    if (duration) {
        compiledTiming.duration = duration;
    }
    if (internalHook) {
        compiledTiming.internalHook = internalHook;
    }

    return compiledTiming;
}
