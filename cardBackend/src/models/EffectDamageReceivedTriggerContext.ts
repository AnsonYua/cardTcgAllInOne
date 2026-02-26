export interface EffectDamageReceivedTriggerContext {
    damagedPlayerId: string;
    sourcePlayerId: string;
    damagedCarduid?: string;
    notificationOverride?: Record<string, unknown> | null;
}

export type DeferredEffectDamageReceivedEntry = EffectDamageReceivedTriggerContext;
