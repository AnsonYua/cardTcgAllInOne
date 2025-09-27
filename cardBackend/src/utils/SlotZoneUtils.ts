/**
 * SlotZone Utilities
 * 
 * Centralized type-safe utilities for working with slot zones.
 * Eliminates repeated type guard logic across the codebase.
 * MERGED: Includes functionality from SlotUtils for comprehensive slot operations.
 */

import { SLOT_ZONES } from '../config/gameConstants';
import { GameEnvironment } from '../models/GameEnvironment';
import { TargetReference } from '../services/EventQueue/interfaces/GameEvent';

// Type for valid slot zone names
export type SlotZoneName = typeof SLOT_ZONES[number];

export interface SlotZone {
    unit?: any;    // UnitZoneCard
    pilot?: any;   // PilotZoneCard
}

export interface SlotValidationResult {
    isValid: boolean;
    slot?: SlotZone;
    error?: string;
}

// MERGED from SlotUtils: Search result interface
export interface SlotSearchResult {
    found: boolean;
    slotName?: string;
    playerId?: string;
    unit?: any;
    pilot?: any;
    card?: any;
    type?: 'unit' | 'pilot';
    error?: string;
}

export interface SlotSearchByCardResult {
    slotName: string | null;
    unit: any | null;
    pilot: any | null;
}

export interface ResolvedTargetReference {
    card: any;
    type: 'unit' | 'pilot';
    slotName: string;
    playerId: string;
}

export class SlotZoneUtils {

    /**
     * Validate that a slot is a proper SlotZone (not boolean or array)
     */
    static validateSlotZone(slot: any, zoneName: string): SlotValidationResult {
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
            slot: slot as SlotZone
        };
    }

    /**
     * Get slot zone with type safety
     */
    static getSlotZone(playerZones: any, zoneName: string): SlotValidationResult {
        const slot = playerZones[zoneName as keyof typeof playerZones];
        return this.validateSlotZone(slot, zoneName);
    }

    /**
     * Check if zone name is a valid slot zone
     */
    static isSlotZoneName(zoneName: string): zoneName is SlotZoneName {
        return SLOT_ZONES.includes(zoneName as SlotZoneName);
    }

    /**
     * Get all valid slot zones from player zones
     */
    static getAllSlotZones(playerZones: any): { [key: string]: SlotZone } {
        const slotZones: { [key: string]: SlotZone } = {};
        
        for (const zoneName of SLOT_ZONES) {
            const result = this.getSlotZone(playerZones, zoneName);
            if (result.isValid && result.slot) {
                slotZones[zoneName] = result.slot;
            }
        }
        
        return slotZones;
    }

    /**
     * Check if slot has a unit card
     */
    static hasUnit(slot: SlotZone): boolean {
        return !!(slot.unit && slot.unit.carduid);
    }

    /**
     * Check if slot has a pilot card
     */
    static hasPilot(slot: SlotZone): boolean {
        return !!(slot.pilot && slot.pilot.carduid);
    }

    /**
     * Check if slot is paired (has both unit and pilot)
     */
    static isPaired(slot: SlotZone): boolean {
        return this.hasUnit(slot) && this.hasPilot(slot);
    }

    /**
     * Check if slot is empty (no unit or pilot)
     */
    static isEmpty(slot: SlotZone): boolean {
        return !this.hasUnit(slot) && !this.hasPilot(slot);
    }

    /**
     * Get unit from slot with type safety
     */
    static getUnit(slot: SlotZone): any | null {
        return this.hasUnit(slot) ? slot.unit : null;
    }

    /**
     * Get pilot from slot with type safety
     */
    static getPilot(slot: SlotZone): any | null {
        return this.hasPilot(slot) ? slot.pilot : null;
    }

    /**
     * Find card in slot by UID
     */
    static findCardByUid(slot: SlotZone, carduid: string): { card: any; type: 'unit' | 'pilot' } | null {
        if (this.hasUnit(slot) && slot.unit.carduid === carduid) {
            return { card: slot.unit, type: 'unit' };
        }
        
        if (this.hasPilot(slot) && slot.pilot.carduid === carduid) {
            return { card: slot.pilot, type: 'pilot' };
        }
        
        return null;
    }

    /**
     * Locate the slot containing the provided carduid for a single player's zones.
     */
    static findSlotByCarduid(playerZones: any, carduid: string): SlotSearchByCardResult {
        if (!carduid) {
            return { slotName: null, unit: null, pilot: null };
        }

        for (const zoneName of SLOT_ZONES) {
            const validation = this.getSlotZone(playerZones, zoneName);
            if (!validation.isValid || !validation.slot) {
                continue;
            }

            const { unit, pilot } = validation.slot;
            if (unit?.carduid === carduid || pilot?.carduid === carduid) {
                return {
                    slotName: zoneName,
                    unit: unit || null,
                    pilot: pilot || null
                };
            }
        }

        return { slotName: null, unit: null, pilot: null };
    }

    static resolveTargetReference(gameEnv: GameEnvironment, target: TargetReference): ResolvedTargetReference | null {
        const player = typeof gameEnv.getPlayer === 'function'
            ? gameEnv.getPlayer(target.playerId)
            : gameEnv.players[target.playerId];

        if (!player?.zones) {
            console.error(`❌ Target player ${target.playerId} not found`);
            return null;
        }

        const slotResult = this.getSlotZone(player.zones, target.zone);
        if (!slotResult.isValid || !slotResult.slot) {
            console.log(`⚠️ Target zone ${target.zone} not found: ${slotResult.error}`);
            return null;
        }

        const cardResult = this.findCardByUid(slotResult.slot, target.carduid);
        if (!cardResult) {
            console.log(`⚠️ Target card ${target.carduid} not found in ${target.zone}`);
            return null;
        }

        return {
            card: cardResult.card,
            type: cardResult.type,
            slotName: target.zone,
            playerId: target.playerId
        };
    }

    /**
     * Locate a card by uid across all players and slot zones.
     */
    static findCardByUidAcrossPlayers(gameEnv: GameEnvironment, carduid: string): SlotSearchResult {
        if (!carduid) {
            return {
                found: false,
                error: 'Carduid is required'
            };
        }

        for (const [playerId, player] of Object.entries(gameEnv.players)) {
            const resolvedPlayer = typeof gameEnv.getPlayer === 'function'
                ? gameEnv.getPlayer(playerId)
                : player;

            if (!resolvedPlayer?.zones) {
                continue;
            }

            const result = this.findSlotByCarduid(resolvedPlayer.zones, carduid);
            if (!result.slotName) {
                continue;
            }

            const matchedUnit = result.unit && result.unit.carduid === carduid ? result.unit : null;
            const matchedPilot = result.pilot && result.pilot.carduid === carduid ? result.pilot : null;
            const matchedCard = matchedUnit || matchedPilot || null;
            const matchedType = matchedUnit ? 'unit' : matchedPilot ? 'pilot' : undefined;

            return {
                found: true,
                playerId,
                slotName: result.slotName,
                unit: result.unit || undefined,
                pilot: result.pilot || undefined,
                card: matchedCard || undefined,
                type: matchedType
            };
        }

        return {
            found: false,
            error: `Card ${carduid} not found in any player zones`
        };
    }

    /**
     * Convenience helper to retrieve the raw card object by uid across players.
     */
    static getCardByUid(gameEnv: GameEnvironment, carduid: string): any | null {
        const searchResult = this.findCardByUidAcrossPlayers(gameEnv, carduid);
        if (!searchResult.found) {
            return null;
        }

        return searchResult.card ?? searchResult.unit ?? searchResult.pilot ?? null;
    }

    /**
     * Get slot zone names as constant array
     */
    static getSlotZoneNames(): SlotZoneName[] {
        return [...SLOT_ZONES];
    }

    /**
     * Create error result for invalid slots
     */
    static createSlotError(zoneName: string, reason: string): SlotValidationResult {
        return {
            isValid: false,
            error: `Zone ${zoneName}: ${reason}`
        };
    }

    /**
     * Create success result for valid slots
     */
    static createSlotSuccess(slot: SlotZone): SlotValidationResult {
        return {
            isValid: true,
            slot
        };
    }

    // ===== MERGED METHODS FROM SlotUtils =====

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
                if (slot?.unit?.carduid === targetUnitUid) {
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
            if (slot?.unit?.carduid === targetUnitUid) {
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
