import type { PilotZoneCard, UnitZoneCard } from '../../models/CardSystem';
import type { SlotHealthLike } from './SlotHealthMath';
import { normalizeSharedDamage } from './SlotHealthMath';

type DamageCarrier = UnitZoneCard | PilotZoneCard | undefined;

export class SlotHealthStorage {
    static getDamageCarrier(slot: SlotHealthLike | undefined): DamageCarrier {
        if (!slot) {
            return undefined;
        }
        if (slot.unit) {
            return slot.unit;
        }
        if (slot.pilot) {
            return slot.pilot;
        }
        return undefined;
    }

    static getSharedDamage(slot: SlotHealthLike | undefined): number {
        const carrier = this.getDamageCarrier(slot);
        if (!carrier) {
            return 0;
        }
        return normalizeSharedDamage((carrier as any).damageReceived);
    }

    static setSharedDamage(slot: SlotHealthLike | undefined, value: number): boolean {
        if (!slot) {
            return false;
        }
        const normalized = normalizeSharedDamage(value);
        const carrier = this.getDamageCarrier(slot);
        if (!carrier) {
            return false;
        }

        (carrier as any).damageReceived = normalized;

        // Keep legacy pilot-local damage neutral while a unit exists so all readers
        // observe one canonical shared value.
        if (slot.unit && slot.pilot && typeof (slot.pilot as any).damageReceived === 'number') {
            (slot.pilot as any).damageReceived = 0;
        }

        return true;
    }
}
