import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { DeferredEffectDamageReceivedEntry } from '../../../models/EffectDamageReceivedTriggerContext';
import { EffectDamageReceivedTriggeredEffectManager } from '../EffectDamageReceivedTriggeredEffectManager';

const DEPTH_KEY = '__sequenceExecutionDepth';
const DEFERRED_DAMAGE_KEY = '__deferredEffectDamageReceivedEntries';
const PERSISTED_DEFERRED_DAMAGE_KEY = 'deferredEffectDamageReceivedEntries';

function readDepth(gameEnv: GameEnvironment): number {
    const raw = (gameEnv as any)[DEPTH_KEY];
    return typeof raw === 'number' && raw > 0 ? raw : 0;
}

function setDepth(gameEnv: GameEnvironment, depth: number): void {
    if (depth > 0) {
        (gameEnv as any)[DEPTH_KEY] = depth;
    } else {
        delete (gameEnv as any)[DEPTH_KEY];
    }
}

export function runWithinSequenceExecutionContext<T>(
    gameEnv: GameEnvironment,
    fn: () => T
): T {
    const currentDepth = readDepth(gameEnv);
    setDepth(gameEnv, currentDepth + 1);
    try {
        return fn();
    } finally {
        setDepth(gameEnv, readDepth(gameEnv) - 1);
    }
}

export function isSequenceExecutionActive(gameEnv: GameEnvironment): boolean {
    return readDepth(gameEnv) > 0;
}

export function deferEffectDamageReceivedTrigger(
    gameEnv: GameEnvironment,
    entry: DeferredEffectDamageReceivedEntry
): void {
    const list = readDeferredEffectDamageReceivedEntries(gameEnv);
    list.push(entry);
    writeDeferredEffectDamageReceivedEntries(gameEnv, list);
}

export function clearDeferredEffectDamageReceivedTriggers(gameEnv: GameEnvironment): void {
    delete (gameEnv as any)[PERSISTED_DEFERRED_DAMAGE_KEY];
    delete (gameEnv as any)[DEFERRED_DAMAGE_KEY];
}

export function flushDeferredEffectDamageReceivedTriggers(
    gameEnv: GameEnvironment
): { success: boolean; error?: string; requiresSelection?: boolean } {
    const list = readDeferredEffectDamageReceivedEntries(gameEnv);

    if (list.length === 0) {
        return { success: true };
    }

    clearDeferredEffectDamageReceivedTriggers(gameEnv);

    for (const entry of list) {
        const result = EffectDamageReceivedTriggeredEffectManager.execute(gameEnv, {
            damagedPlayerId: entry.damagedPlayerId,
            sourcePlayerId: entry.sourcePlayerId,
            damagedCarduid: entry.damagedCarduid,
            notificationOverride: entry.notificationOverride
        });
        if (!result.success) {
            return { success: false, error: result.error || 'Failed to process deferred EFFECT_DAMAGE_RECEIVED trigger' };
        }
        if (result.requiresSelection) {
            return { success: true, requiresSelection: true };
        }
    }

    return { success: true };
}

function readDeferredEffectDamageReceivedEntries(gameEnv: GameEnvironment): DeferredEffectDamageReceivedEntry[] {
    const persisted = Array.isArray((gameEnv as any)[PERSISTED_DEFERRED_DAMAGE_KEY])
        ? ((gameEnv as any)[PERSISTED_DEFERRED_DAMAGE_KEY] as DeferredEffectDamageReceivedEntry[])
        : [];
    const legacy = Array.isArray((gameEnv as any)[DEFERRED_DAMAGE_KEY])
        ? ((gameEnv as any)[DEFERRED_DAMAGE_KEY] as DeferredEffectDamageReceivedEntry[])
        : [];

    if (legacy.length === 0) {
        return [...persisted];
    }

    if (persisted.length === 0) {
        writeDeferredEffectDamageReceivedEntries(gameEnv, legacy);
        return [...legacy];
    }

    const merged = [...persisted, ...legacy];
    writeDeferredEffectDamageReceivedEntries(gameEnv, merged);
    return merged;
}

function writeDeferredEffectDamageReceivedEntries(
    gameEnv: GameEnvironment,
    entries: DeferredEffectDamageReceivedEntry[]
): void {
    (gameEnv as any)[PERSISTED_DEFERRED_DAMAGE_KEY] = entries;
    (gameEnv as any)[DEFERRED_DAMAGE_KEY] = entries;
}
