import { SLOT_ZONES } from '../config/gameConstants';

export type SlotZoneLookupResult = {
    isValid: boolean;
    slot?: any;
    error?: string;
};

export function validateSlotZone(slot: any, zoneName: string): SlotZoneLookupResult {
    if (!slot) {
        return {
            isValid: false,
            error: `Zone ${zoneName} is empty`
        };
    }

    if (typeof slot === 'boolean') {
        return {
            isValid: false,
            error: `Zone ${zoneName} is a boolean, not a valid slot zone`
        };
    }

    if (Array.isArray(slot)) {
        return {
            isValid: false,
            error: `Zone ${zoneName} is an array, not a valid slot zone`
        };
    }

    return {
        isValid: true,
        slot
    };
}

export function getSlotZone(playerZones: any, zoneName: string): SlotZoneLookupResult {
    const slot = playerZones?.[zoneName as keyof typeof playerZones];
    return validateSlotZone(slot, zoneName);
}

export function isSlotZoneName(zoneName: string): boolean {
    return SLOT_ZONES.includes(zoneName as any);
}

export function findCardByUid(slot: any, carduid: string): { card: any; type: 'unit' | 'pilot' } | null {
    if (slot?.unit?.carduid === carduid) {
        return { card: slot.unit, type: 'unit' };
    }
    if (slot?.pilot?.carduid === carduid) {
        return { card: slot.pilot, type: 'pilot' };
    }
    return null;
}

