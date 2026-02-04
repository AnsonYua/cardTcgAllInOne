import { resolveEffectActionFromRule } from './EffectNormalizationUtils';

export function isBlockerRedirectRule(rule: unknown): boolean {
    if (!rule || typeof rule !== 'object') {
        return false;
    }

    const raw = rule as Record<string, unknown>;
    const trigger = typeof raw['trigger'] === 'string' ? raw['trigger'] : undefined;
    if (trigger !== 'ATTACK_REDIRECT') {
        return false;
    }

    const action = resolveEffectActionFromRule(raw);
    if (action !== 'redirect_attack') {
        return false;
    }

    const effectId = typeof raw['effectId'] === 'string' ? raw['effectId'] : '';
    return effectId.toLowerCase().includes('blocker');
}

