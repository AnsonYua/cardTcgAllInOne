// src/services/effects/continuous/ContinuousEffectExpansionUtils.ts
// Shared helpers for expanding continuous effects into concrete registry entries.

export function isSupportedContinuousAction(action: string): boolean {
    if (action === 'modifyAP' || action === 'modifyHP') {
        return true;
    }
    return action === 'grant_keyword'
        || action === 'grant_breach'
        || action === 'prevent_battle_damage'
        || action === 'prevent_damage'
        || action === 'prevent_ap_reduction';
}

export function normalizeContinuousStep(step: any): any {
    if (!step || typeof step.action !== 'string') {
        return step;
    }

    if (step.action !== 'grant_keyword') {
        return step;
    }

    const keyword = typeof step.parameters?.keyword === 'string' ? step.parameters.keyword : '';
    const rawValue = step.parameters?.value;
    const breachValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (keyword !== 'Breach' || !Number.isFinite(breachValue) || breachValue <= 0) {
        return step;
    }

    return {
        ...step,
        action: 'grant_breach',
        parameters: {
            value: breachValue
        }
    };
}
