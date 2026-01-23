// src/services/effects/attack/AttackEffectUsageTracker.ts
// Centralizes "once per turn" usage tracking for triggered attack effects.

import type { ZoneCard } from '../../../models/CardSystem';

export class AttackEffectUsageTracker {
    static hasEffectBeenUsedThisTurn(card: ZoneCard, effectId: string, currentTurn: number): boolean {
        const usage = (card as any)?.effectUsage?.[effectId];
        return Boolean(usage && usage.lastUsedTurn === currentTurn);
    }

    static markEffectUsed(card: ZoneCard, effectId: string, currentTurn: number): void {
        if (!(card as any).effectUsage) {
            (card as any).effectUsage = {};
        }
        (card as any).effectUsage[effectId] = { lastUsedTurn: currentTurn };
    }
}

