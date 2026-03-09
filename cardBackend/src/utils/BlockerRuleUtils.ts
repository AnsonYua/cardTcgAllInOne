import { resolveEffectActionFromRule } from './EffectNormalizationUtils';
import { EffectTimingWindowUtils } from './EffectTimingWindowUtils';

export function isBlockerRedirectRule(rule: unknown): boolean {
    if (!rule || typeof rule !== 'object') {
        return false;
    }

    const raw = rule as Record<string, unknown>;
    if (EffectTimingWindowUtils.getEventTrigger(raw as any) !== 'ATTACK_REDIRECT') {
        return false;
    }

    const action = resolveEffectActionFromRule(raw);
    if (action !== 'redirect_attack') {
        return false;
    }

    const effectId = typeof raw['effectId'] === 'string' ? raw['effectId'] : '';
    return effectId.toLowerCase().includes('blocker');
}
