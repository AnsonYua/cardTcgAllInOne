import { ZoneCard } from '../../models/CardSystem';

export class EffectUsageTracker {
    static getUsageKey(effect: { effectId?: string; action?: string }, fallback: string): string {
        return effect.effectId || effect.action || fallback;
    }

    static canUseOncePerTurn(card: ZoneCard, usageKey: string, currentTurn: number): boolean {
        const usage = card.effectUsage?.[usageKey];
        return !(usage && usage.lastUsedTurn === currentTurn);
    }

    static markUsedThisTurn(card: ZoneCard, usageKey: string, currentTurn: number): void {
        if (!card.effectUsage) {
            card.effectUsage = {};
        }
        card.effectUsage[usageKey] = { lastUsedTurn: currentTurn };
    }
}

