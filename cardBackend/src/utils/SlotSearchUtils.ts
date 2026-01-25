import { SLOT_ZONES } from '../config/gameConstants';
import type { GameEnvironment } from '../models/GameEnvironment';
import type { TargetReference } from '../services/EventQueue/interfaces/GameEvent';
import { findCardByUid, getSlotZone, isSlotZoneName } from './SlotZoneCoreUtils';

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

export class SlotSearchUtils {
    static findSlotByCarduid(playerZones: any, carduid: string): SlotSearchByCardResult {
        if (!carduid) {
            return { slotName: null, unit: null, pilot: null };
        }

        for (const zoneName of SLOT_ZONES) {
            const validation = getSlotZone(playerZones, zoneName);
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

        const slotResult = getSlotZone(player.zones, target.zone);
        if (!slotResult.isValid || !slotResult.slot) {
            console.log(`⚠️ Target zone ${target.zone} not found: ${slotResult.error}`);
            return null;
        }

        const cardResult = findCardByUid(slotResult.slot, target.carduid);
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

    static getCardByUid(gameEnv: GameEnvironment, carduid: string): any | null {
        const searchResult = this.findCardByUidAcrossPlayers(gameEnv, carduid);
        if (!searchResult.found) {
            return null;
        }

        return searchResult.card ?? searchResult.unit ?? searchResult.pilot ?? null;
    }

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

        for (const [playerId, player] of Object.entries(gameEnv.players)) {
            if (!player?.zones) {
                continue;
            }

            for (const slotName of SLOT_ZONES) {
                const slotKey = slotName as keyof Pick<typeof player.zones, 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6'>;
                const slot = player.zones[slotKey];

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

        for (const slotName of SLOT_ZONES) {
            const slotKey = slotName as keyof Pick<typeof player.zones, 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6'>;
            const slot = player.zones[slotKey];

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

    static getAllUnitAndPilotCarduids(gameEnv: GameEnvironment): string[] {
        const result: string[] = [];
        const seen = new Set<string>();

        for (const player of Object.values(gameEnv.players)) {
            if (!player?.zones) {
                continue;
            }

            for (const slotName of SLOT_ZONES) {
                const slotKey = slotName as keyof Pick<typeof player.zones, 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6'>;
                const slot = player.zones[slotKey];
                const unitUid = slot?.unit?.carduid;
                const pilotUid = slot?.pilot?.carduid;

                if (typeof unitUid === 'string' && unitUid.length > 0 && !seen.has(unitUid)) {
                    seen.add(unitUid);
                    result.push(unitUid);
                }
                if (typeof pilotUid === 'string' && pilotUid.length > 0 && !seen.has(pilotUid)) {
                    seen.add(pilotUid);
                    result.push(pilotUid);
                }
            }
        }

        return result;
    }

    static validateSlotHasUnit(gameEnv: GameEnvironment, playerId: string, slotName: string): SlotSearchResult {
        const player = gameEnv?.players?.[playerId];
        if (!player?.zones) {
            return {
                found: false,
                error: `Player ${playerId} not found or has no zones`
            };
        }

        if (!isSlotZoneName(slotName)) {
            return {
                found: false,
                error: `Slot ${slotName} is not a valid slot zone`
            };
        }

        const slotKey = slotName as keyof Pick<typeof player.zones, 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6'>;
        const slot = player.zones[slotKey];
        const unit = slot?.unit;

        if (!unit) {
            return {
                found: false,
                error: `Slot ${slotName} has no unit`
            };
        }

        return {
            found: true,
            slotName,
            playerId,
            unit,
            pilot: slot?.pilot || null
        };
    }
}
