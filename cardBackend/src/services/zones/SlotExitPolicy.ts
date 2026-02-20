import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import type { SlotCardType } from './SlotExitTransferService';

export type SlotExitDestination = 'hand' | 'trash';

export class SlotExitPolicy {
    static shouldIncludePairedPilotWithUnit(
        destination: SlotExitDestination,
        targetType: SlotCardType,
        effect?: EffectDefinition
    ): boolean {
        if (targetType !== 'unit') {
            return false;
        }

        if (destination === 'hand') {
            const configured = (effect?.parameters as any)?.returnPairedPilotWithUnit;
            if (typeof configured === 'boolean') {
                return configured;
            }
        }

        // Canonical default: when a unit leaves its slot, paired pilot follows to the same destination.
        return true;
    }
}
