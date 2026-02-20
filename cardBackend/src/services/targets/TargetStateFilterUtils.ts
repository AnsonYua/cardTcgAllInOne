import type { GameEnvironment } from '../../models/GameEnvironment';
import type { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import { SlotHealthService } from '../health/SlotHealthService';

export type StateFilterResult = {
    ok: boolean;
    reason?: string;
};

export class TargetStateFilterUtils {
    static isDamaged(gameEnv: GameEnvironment, card: UnitZoneCard | PilotZoneCard): boolean {
        if (typeof card?.carduid === 'string' && card.carduid.length > 0) {
            const slotState = SlotHealthService.getSlotHealthState(gameEnv, card.carduid);
            if (slotState) {
                return slotState.sharedDamage > 0;
            }
        }
        const damageReceived = typeof (card as any).damageReceived === 'number' ? ((card as any).damageReceived as number) : 0;
        return damageReceived > 0;
    }

    static validateDamagedFilter(
        gameEnv: GameEnvironment,
        card: UnitZoneCard | PilotZoneCard,
        desiredDamaged: boolean
    ): StateFilterResult {
        const actual = this.isDamaged(gameEnv, card);
        if (desiredDamaged !== actual) {
            return { ok: false, reason: `damaged: expected ${desiredDamaged}, got ${actual}` };
        }
        return { ok: true };
    }
}
