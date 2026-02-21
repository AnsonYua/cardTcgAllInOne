import type { GameEnvironment } from '../../models/GameEnvironment';
import { SLOT_ZONES, type SlotZone } from '../../config/gameConstants';

export const UNIT_BOARD_FULL_PROMPT = 'Board is full. Choose a slot to replace.';
export const INVALID_REPLACE_SLOT = (value: unknown) => `Invalid replaceSlot: ${String(value)}`;
export const REPLACE_SLOT_MUST_HAVE_UNIT = 'replaceSlot must reference an occupied unit slot.';
export const REPLACE_SLOT_ONLY_ON_FULL_BOARD = 'replaceSlot can only be used when board is full.';

export type UnitReplaceValidationResult =
    | { success: true; boardFull: boolean; replaceSlot?: SlotZone }
    | { success: false; error: string };

export const normalizeReplaceSlot = (rawReplaceSlot: unknown): SlotZone | null | undefined => {
    if (rawReplaceSlot === undefined || rawReplaceSlot === null || rawReplaceSlot === '') {
        return undefined;
    }
    if (typeof rawReplaceSlot !== 'string') {
        return null;
    }
    return SLOT_ZONES.includes(rawReplaceSlot as SlotZone) ? (rawReplaceSlot as SlotZone) : null;
};

export const validateUnitReplaceSlotForPlay = (
    playerZones: any,
    rawReplaceSlot: unknown
): UnitReplaceValidationResult => {
    const replaceSlot = normalizeReplaceSlot(rawReplaceSlot);
    if (replaceSlot === null) {
        return {
            success: false,
            error: INVALID_REPLACE_SLOT(rawReplaceSlot)
        };
    }

    const boardFull = SLOT_ZONES.every((slotName) => !!playerZones?.[slotName]?.unit);
    if (boardFull) {
        if (!replaceSlot) {
            return {
                success: false,
                error: UNIT_BOARD_FULL_PROMPT
            };
        }

        const targetSlot = playerZones?.[replaceSlot];
        if (!targetSlot?.unit) {
            return {
                success: false,
                error: REPLACE_SLOT_MUST_HAVE_UNIT
            };
        }
    } else if (replaceSlot) {
        return {
            success: false,
            error: REPLACE_SLOT_ONLY_ON_FULL_BOARD
        };
    }

    return {
        success: true,
        boardFull,
        ...(replaceSlot ? { replaceSlot } : {})
    };
};

export type UnitPlacementSlotResult =
    | { success: true; targetZone: SlotZone }
    | { success: false; error: string };

export const resolveUnitPlacementSlot = (
    playerZones: any,
    opts: {
        gameEnv: GameEnvironment;
        playerId: string;
        replaceSlot?: unknown;
        findFirstEmptySlot: (zones: any) => string | null;
        moveUnitFromSlotToTrash: (gameEnv: GameEnvironment, playerId: string, slotName: string, unitCard: any) => boolean;
    }
): UnitPlacementSlotResult => {
    const normalized = normalizeReplaceSlot(opts.replaceSlot);
    if (normalized === null) {
        return {
            success: false,
            error: INVALID_REPLACE_SLOT(opts.replaceSlot)
        };
    }

    if (normalized) {
        const targetSlot = playerZones?.[normalized];
        const targetUnit = targetSlot?.unit;
        if (!targetUnit) {
            return {
                success: false,
                error: REPLACE_SLOT_MUST_HAVE_UNIT
            };
        }

        const moved = opts.moveUnitFromSlotToTrash(opts.gameEnv, opts.playerId, normalized, targetUnit);
        if (!moved) {
            return {
                success: false,
                error: `Failed to trash existing unit in ${normalized}`
            };
        }
        return { success: true, targetZone: normalized };
    }

    const firstEmpty = opts.findFirstEmptySlot(playerZones);
    if (!firstEmpty) {
        return {
            success: false,
            error: 'No empty unit slots available in zones slot1-slot6'
        };
    }

    return { success: true, targetZone: firstEmpty as SlotZone };
};
