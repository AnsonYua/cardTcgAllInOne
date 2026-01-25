/**
 * SlotZone Utilities
 *
 * Centralized utilities for working with slot zones (validation + basic slot access).
 * Searching across zones/players lives in `SlotSearchUtils`.
 */

import { SLOT_ZONES } from '../config/gameConstants';
import type { GameEnvironment } from '../models/GameEnvironment';
import type { TargetReference } from '../services/EventQueue/interfaces/GameEvent';
import type { SlotSearchByCardResult, SlotSearchResult, ResolvedTargetReference } from './SlotSearchUtils';
import { SlotSearchUtils } from './SlotSearchUtils';
import { findCardByUid as findCardByUidCore, getSlotZone as getSlotZoneCore, isSlotZoneName as isSlotZoneNameCore, validateSlotZone as validateSlotZoneCore } from './SlotZoneCoreUtils';

export type { SlotSearchResult, SlotSearchByCardResult, ResolvedTargetReference } from './SlotSearchUtils';

export type SlotZoneName = typeof SLOT_ZONES[number];

export interface SlotZone {
    unit?: any;
    pilot?: any;
}

export interface SlotValidationResult {
    isValid: boolean;
    slot?: SlotZone;
    error?: string;
}

export class SlotZoneUtils {
    static validateSlotZone(slot: any, zoneName: string): SlotValidationResult {
        const validated = validateSlotZoneCore(slot, zoneName);
        return validated.isValid
            ? { isValid: true, slot: validated.slot as SlotZone }
            : { isValid: false, error: validated.error };
    }

    static getSlotZone(playerZones: any, zoneName: string): SlotValidationResult {
        const validated = getSlotZoneCore(playerZones, zoneName);
        return validated.isValid
            ? { isValid: true, slot: validated.slot as SlotZone }
            : { isValid: false, error: validated.error };
    }

    static isSlotZoneName(zoneName: string): zoneName is SlotZoneName {
        return isSlotZoneNameCore(zoneName);
    }

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

    static hasUnit(slot: SlotZone): boolean {
        return !!(slot.unit && slot.unit.carduid);
    }

    static hasPilot(slot: SlotZone): boolean {
        return !!(slot.pilot && slot.pilot.carduid);
    }

    static isPaired(slot: SlotZone): boolean {
        return this.hasUnit(slot) && this.hasPilot(slot);
    }

    static isEmpty(slot: SlotZone): boolean {
        return !this.hasUnit(slot) && !this.hasPilot(slot);
    }

    static getEmptySlotNames(playerZones: any): string[] {
        const empty: string[] = [];

        for (const zoneName of SLOT_ZONES) {
            const result = this.getSlotZone(playerZones, zoneName);
            if (!result.isValid || !result.slot) {
                continue;
            }
            if (this.isEmpty(result.slot)) {
                empty.push(zoneName);
            }
        }

        return empty;
    }

    static getUnit(slot: SlotZone): any | null {
        return this.hasUnit(slot) ? slot.unit : null;
    }

    static getPilot(slot: SlotZone): any | null {
        return this.hasPilot(slot) ? slot.pilot : null;
    }

    static findCardByUid(slot: SlotZone, carduid: string): { card: any; type: 'unit' | 'pilot' } | null {
        return findCardByUidCore(slot, carduid);
    }

    static findSlotByCarduid(playerZones: any, carduid: string): SlotSearchByCardResult {
        return SlotSearchUtils.findSlotByCarduid(playerZones, carduid);
    }

    static resolveTargetReference(gameEnv: GameEnvironment, target: TargetReference): ResolvedTargetReference | null {
        return SlotSearchUtils.resolveTargetReference(gameEnv, target);
    }

    static findCardByUidAcrossPlayers(gameEnv: GameEnvironment, carduid: string): SlotSearchResult {
        return SlotSearchUtils.findCardByUidAcrossPlayers(gameEnv, carduid);
    }

    static getCardByUid(gameEnv: GameEnvironment, carduid: string): any | null {
        return SlotSearchUtils.getCardByUid(gameEnv, carduid);
    }

    static findSlotNameByUnitUid(gameEnv: GameEnvironment, targetUnitUid: string): SlotSearchResult {
        return SlotSearchUtils.findSlotNameByUnitUid(gameEnv, targetUnitUid);
    }

    static findSlotNameByUnitUidForPlayer(gameEnv: GameEnvironment, playerId: string, targetUnitUid: string): SlotSearchResult {
        return SlotSearchUtils.findSlotNameByUnitUidForPlayer(gameEnv, playerId, targetUnitUid);
    }

    static getAllPlayerSlotUnits(gameEnv: GameEnvironment, playerId: string): SlotSearchResult[] {
        return SlotSearchUtils.getAllPlayerSlotUnits(gameEnv, playerId);
    }

    static getAllUnitAndPilotCarduids(gameEnv: GameEnvironment): string[] {
        return SlotSearchUtils.getAllUnitAndPilotCarduids(gameEnv);
    }

    static validateSlotHasUnit(gameEnv: GameEnvironment, playerId: string, slotName: string): SlotSearchResult {
        return SlotSearchUtils.validateSlotHasUnit(gameEnv, playerId, slotName);
    }

    static getSlotZoneNames(): SlotZoneName[] {
        return [...SLOT_ZONES];
    }

    static createSlotError(zoneName: string, reason: string): SlotValidationResult {
        return {
            isValid: false,
            error: `Zone ${zoneName}: ${reason}`
        };
    }

    static createSlotSuccess(slot: SlotZone): SlotValidationResult {
        return {
            isValid: true,
            slot
        };
    }
}
