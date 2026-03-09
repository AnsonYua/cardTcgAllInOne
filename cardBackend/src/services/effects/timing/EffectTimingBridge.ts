import type { CompiledEffectTiming, EffectTiming } from '../../EventQueue/interfaces/GameEvent';
import { compileEffectTimingFromRule } from './EffectTimingCompiler';

type RawRule = Record<string, unknown>;
type RawTiming = Record<string, unknown>;

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
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

export function buildLegacyEffectTiming(
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

    const bridgedTiming = buildLegacyEffectTiming(rule.timing, compiledTiming);
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

    const bridgedRules = rules.map((rule) => {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
            return rule;
        }
        return applyCompiledTimingBridgeToRule(rule as RawRule);
    });

    return {
        ...(typed as TCardData & Record<string, unknown>),
        effects: {
            ...(effects as Record<string, unknown>),
            rules: bridgedRules
        }
    } as TCardData;
}
