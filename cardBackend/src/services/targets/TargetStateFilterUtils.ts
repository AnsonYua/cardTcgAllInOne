import type { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';

export type StateFilterResult = {
    ok: boolean;
    reason?: string;
};

export class TargetStateFilterUtils {
    static isDamaged(card: UnitZoneCard | PilotZoneCard): boolean {
        const damageReceived = typeof (card as any).damageReceived === 'number' ? ((card as any).damageReceived as number) : 0;
        return damageReceived > 0;
    }

    static validateDamagedFilter(
        card: UnitZoneCard | PilotZoneCard,
        desiredDamaged: boolean
    ): StateFilterResult {
        const actual = this.isDamaged(card);
        if (desiredDamaged !== actual) {
            return { ok: false, reason: `damaged: expected ${desiredDamaged}, got ${actual}` };
        }
        return { ok: true };
    }
}

