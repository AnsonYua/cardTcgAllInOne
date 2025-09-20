// src/utils/SlotUtils.ts
// Utility class for slot-related operations

import { GameEnvironment } from '../models/GameEnvironment';
import { SLOT_ZONES } from '../config/gameConstants';

export interface SlotSearchResult {
    found: boolean;
    slotName?: string;
    playerId?: string;
    unit?: any;
    pilot?: any;
    error?: string;
}

/**
 * Utility class for slot-related operations
 * Provides methods to search, validate, and manipulate slot data
 */
export class SlotUtils {

    /**
     * Find the target slot name using target unit UID
     * Searches through all players and all slots to find the unit with the specified UID
     * 
     * @param gameEnv - Game environment containing all player data
     * @param targetUnitUid - The UID of the unit to find
     * @returns SlotSearchResult with slot information or error
     */
    static findSlotNameByUnitUid(gameEnv: GameEnvironment, targetUnitUid: string): SlotSearchResult {
        if (!targetUnitUid) {
            return {
                found: false,
                error: 'Target unit UID is required'
            };
        }

        if (!gameEnv?.players) {
            return {
                found: false,
                error: 'Game environment or players not found'
            };
        }

        // Search through all players
        for (const [playerId, player] of Object.entries(gameEnv.players)) {
            if (!player?.zones) {
                continue;
            }

            // Search through all slot zones for this player
            for (const slotName of SLOT_ZONES) {
                const slotKey = slotName as keyof Pick<typeof player.zones, 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6'>;
                const slot = player.zones[slotKey];

                // Check if unit in this slot matches the target UID
                if (slot?.unit?.cardUid === targetUnitUid) {
                    return {
                        found: true,
                        slotName: slotName,
                        playerId: playerId,
                        unit: slot.unit,
                        pilot: slot.pilot || null
                    };
                }
            }
        }

        return {
            found: false,
            error: `Unit with UID ${targetUnitUid} not found in any slot`
        };
    }

    /**
     * Find slot name by unit UID for a specific player
     * More efficient when you know which player owns the unit
     * 
     * @param gameEnv - Game environment
     * @param playerId - Specific player ID to search
     * @param targetUnitUid - The UID of the unit to find
     * @returns SlotSearchResult with slot information or error
     */
    static findSlotNameByUnitUidForPlayer(gameEnv: GameEnvironment, playerId: string, targetUnitUid: string): SlotSearchResult {
        if (!targetUnitUid) {
            return {
                found: false,
                error: 'Target unit UID is required'
            };
        }

        if (!playerId) {
            return {
                found: false,
                error: 'Player ID is required'
            };
        }

        const player = gameEnv?.players?.[playerId];
        if (!player?.zones) {
            return {
                found: false,
                error: `Player ${playerId} not found or has no zones`
            };
        }

        // Search through all slot zones for this specific player
        for (const slotName of SLOT_ZONES) {
            const slotKey = slotName as keyof Pick<typeof player.zones, 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6'>;
            const slot = player.zones[slotKey];

            // Check if unit in this slot matches the target UID
            if (slot?.unit?.cardUid === targetUnitUid) {
                return {
                    found: true,
                    slotName: slotName,
                    playerId: playerId,
                    unit: slot.unit,
                    pilot: slot.pilot || null
                };
            }
        }

        return {
            found: false,
            error: `Unit with UID ${targetUnitUid} not found in any slot for player ${playerId}`
        };
    }

    /**
     * Get all units in slots for a specific player
     * Useful for getting all targetable units
     * 
     * @param gameEnv - Game environment
     * @param playerId - Player ID to get units for
     * @returns Array of slot information with units
     */
    static getAllPlayerSlotUnits(gameEnv: GameEnvironment, playerId: string): SlotSearchResult[] {
        const player = gameEnv?.players?.[playerId];
        if (!player?.zones) {
            return [];
        }

        const results: SlotSearchResult[] = [];

        for (const slotName of SLOT_ZONES) {
            const slotKey = slotName as keyof Pick<typeof player.zones, 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6'>;
            const slot = player.zones[slotKey];

            if (slot?.unit) {
                results.push({
                    found: true,
                    slotName: slotName,
                    playerId: playerId,
                    unit: slot.unit,
                    pilot: slot.pilot || null
                });
            }
        }

        return results;
    }

    /**
     * Check if a slot exists and has a unit
     * 
     * @param gameEnv - Game environment
     * @param playerId - Player ID
     * @param slotName - Slot name (e.g., 'slot1', 'slot2')
     * @returns SlotSearchResult indicating if slot has unit
     */
    static validateSlotHasUnit(gameEnv: GameEnvironment, playerId: string, slotName: string): SlotSearchResult {
        const player = gameEnv?.players?.[playerId];
        if (!player?.zones) {
            return {
                found: false,
                error: `Player ${playerId} not found or has no zones`
            };
        }

        if (!SLOT_ZONES.includes(slotName as any)) {
            return {
                found: false,
                error: `Invalid slot name: ${slotName}`
            };
        }

        const slotKey = slotName as keyof Pick<typeof player.zones, 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6'>;
        const slot = player.zones[slotKey];

        if (!slot?.unit) {
            return {
                found: false,
                error: `No unit found in ${slotName} for player ${playerId}`
            };
        }

        return {
            found: true,
            slotName: slotName,
            playerId: playerId,
            unit: slot.unit,
            pilot: slot.pilot || null
        };
    }
}