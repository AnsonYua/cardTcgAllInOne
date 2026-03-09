import type { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';

type TimingReadable = Pick<EffectDefinition, 'action' | 'compiledTiming' | 'timing' | 'trigger' | 'type'>;

const ACTIVATION_WINDOWS = new Set(['MAIN_PHASE', 'ACTION_STEP']);

function normalizeArray(values: unknown): string[] {
    if (Array.isArray(values)) {
        return values
            .map((value) => (typeof value === 'string' ? value.toUpperCase() : ''))
            .filter(Boolean);
    }
    if (typeof values === 'string' && values.length > 0) {
        return [values.toUpperCase()];
    }
    return [];
}

function getTimingRecord(effect: TimingReadable | null | undefined): Record<string, unknown> | undefined {
    const timing = effect?.timing;
    return timing && typeof timing === 'object' && !Array.isArray(timing)
        ? (timing as Record<string, unknown>)
        : undefined;
}

function getCompiledTimingRecord(effect: TimingReadable | null | undefined): Record<string, unknown> | undefined {
    const timing = effect?.compiledTiming;
    return timing && typeof timing === 'object' && !Array.isArray(timing)
        ? (timing as unknown as Record<string, unknown>)
        : undefined;
}

export function getEffectEventTrigger(effect: TimingReadable | null | undefined): string | undefined {
    const compiledTiming = getCompiledTimingRecord(effect);
    const timingRecord = getTimingRecord(effect);

    if (typeof compiledTiming?.eventTrigger === 'string' && compiledTiming.eventTrigger.length > 0) {
        return compiledTiming.eventTrigger.toUpperCase();
    }
    if (typeof timingRecord?.eventTrigger === 'string' && timingRecord.eventTrigger.length > 0) {
        return timingRecord.eventTrigger.toUpperCase();
    }
    if (typeof effect?.trigger === 'string' && effect.trigger.length > 0) {
        const legacyTrigger = effect.trigger.toUpperCase();
        if (!ACTIVATION_WINDOWS.has(legacyTrigger) && legacyTrigger !== 'CONTINUOUS') {
            return legacyTrigger;
        }
    }
    return undefined;
}

export function getEffectActivationWindows(effect: TimingReadable | null | undefined): string[] {
    const compiledTiming = getCompiledTimingRecord(effect);
    const timingRecord = getTimingRecord(effect);
    const explicit = [
        ...normalizeArray(compiledTiming?.activationWindows),
        ...normalizeArray(timingRecord?.activationWindows),
        ...normalizeArray(timingRecord?.windows)
    ];

    if (explicit.length > 0) {
        return Array.from(new Set(explicit));
    }

    if (typeof effect?.trigger === 'string') {
        const legacyTrigger = effect.trigger.toUpperCase();
        if (ACTIVATION_WINDOWS.has(legacyTrigger)) {
            return [legacyTrigger];
        }
    }

    const effectType = typeof effect?.type === 'string' ? effect.type.toLowerCase() : '';
    const action = typeof effect?.action === 'string' ? effect.action.toLowerCase() : '';
    if (effectType === 'special' && action === 'designate_pilot') {
        return ['MAIN_PHASE'];
    }
    if ((effectType === 'play' || effectType === 'activated') && !getEffectEventTrigger(effect)) {
        return ['MAIN_PHASE'];
    }

    return [];
}

export function getEffectDuration(effect: TimingReadable | null | undefined): string | undefined {
    const compiledTiming = getCompiledTimingRecord(effect);
    const timingRecord = getTimingRecord(effect);

    if (typeof compiledTiming?.duration === 'string' && compiledTiming.duration.length > 0) {
        return compiledTiming.duration;
    }
    if (typeof timingRecord?.duration === 'string' && timingRecord.duration.length > 0) {
        return timingRecord.duration;
    }
    if (typeof effect?.trigger === 'string' && effect.trigger.toUpperCase() === 'CONTINUOUS') {
        return 'continuous';
    }
    if (typeof effect?.type === 'string' && effect.type.toLowerCase() === 'continuous') {
        return 'continuous';
    }
    return undefined;
}

export function isContinuousEffectTiming(effect: TimingReadable | null | undefined): boolean {
    return (getEffectDuration(effect) || '').toUpperCase() === 'CONTINUOUS';
}

export function hasEffectActivationWindow(
    effect: TimingReadable | null | undefined,
    window: string
): boolean {
    const normalized = typeof window === 'string' ? window.toUpperCase() : '';
    if (!normalized) {
        return false;
    }
    return getEffectActivationWindows(effect).includes(normalized);
}
