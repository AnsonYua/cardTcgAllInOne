import type { GameEnvironment } from '../../models/GameEnvironment';
import { SLOT_ZONES } from '../../config/gameConstants';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { LinkUtils } from '../../utils/LinkUtils';

export class SlotCardStateUtils {
    static isCardPaired(gameEnv: GameEnvironment, carduid: string): boolean {
        if (!carduid) {
            return false;
        }

        for (const player of Object.values(gameEnv.players)) {
            if (!player?.zones) {
                continue;
            }

            for (const slotName of SLOT_ZONES) {
                const slot = (player.zones as any)[slotName];
                if (!slot) {
                    continue;
                }

                if (slot?.unit?.carduid === carduid) {
                    return slot.pilot != null;
                }

                if (slot?.pilot?.carduid === carduid) {
                    return slot.unit != null;
                }
            }
        }

        return false;
    }

    static isCardLinked(gameEnv: GameEnvironment, carduid: string): boolean {
        if (!carduid) {
            return false;
        }

        for (const player of Object.values(gameEnv.players)) {
            if (!player?.zones) {
                continue;
            }

            for (const slotName of SLOT_ZONES) {
                const slot = (player.zones as any)[slotName];
                if (!slot?.unit && !slot?.pilot) {
                    continue;
                }

                const isUnit = slot?.unit?.carduid === carduid;
                const isPilot = slot?.pilot?.carduid === carduid;
                if (!isUnit && !isPilot) {
                    continue;
                }

                if (slot.unit && slot.pilot) {
                    return LinkUtils.isLinkedPair(slot.unit, slot.pilot);
                }

                return false;
            }
        }

        return false;
    }

    static playerHasPairedUnits(gameEnv: GameEnvironment, playerId: string | null): boolean {
        if (!playerId) {
            return false;
        }

        const player = gameEnv.players[playerId];
        if (!player?.zones) {
            return false;
        }

        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            if (slot?.unit && slot?.pilot) {
                return true;
            }
        }

        return false;
    }

    static playerHasLinkedUnits(gameEnv: GameEnvironment, playerId: string | null): boolean {
        if (!playerId) {
            return false;
        }

        const player = gameEnv.players[playerId];
        if (!player?.zones) {
            return false;
        }

        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            if (slot?.unit && slot?.pilot && LinkUtils.isLinkedPair(slot.unit, slot.pilot)) {
                return true;
            }
        }

        return false;
    }

    static findCardOwner(gameEnv: GameEnvironment, carduid: string): string | null {
        if (!carduid) {
            return null;
        }

        for (const [playerId, player] of Object.entries(gameEnv.players)) {
            if (!player?.zones) {
                continue;
            }

            for (const slotName of SLOT_ZONES) {
                const slot = (player.zones as any)[slotName];
                if (slot?.unit?.carduid === carduid || slot?.pilot?.carduid === carduid) {
                    return playerId;
                }
            }

            const otherZones = ['base', 'shieldArea', 'energyArea', 'trashArea'];
            for (const zoneName of otherZones) {
                const zone = (player.zones as any)[zoneName];
                if (Array.isArray(zone)) {
                    for (const card of zone) {
                        if (card?.carduid === carduid) {
                            return playerId;
                        }
                    }
                } else if (zone?.carduid === carduid) {
                    return playerId;
                }
            }
        }

        return null;
    }

    static noUnitTokenWithTraits(gameEnv: GameEnvironment, playerId: string | null, traits: string[]): boolean {
        if (!playerId || traits.length === 0) {
            return true;
        }

        const units = SlotZoneUtils.getAllPlayerSlotUnits(gameEnv, playerId);
        return !units.some(unitResult => {
            const cardData = unitResult?.unit?.cardData;
            if (!cardData) {
                return false;
            }
            const isToken = cardData.color === 'Token' || (typeof cardData.id === 'string' && cardData.id.startsWith('T-'));
            if (!isToken) {
                return false;
            }
            const unitTraits = Array.isArray(cardData.traits) ? cardData.traits : [];
            return traits.some(trait => unitTraits.includes(trait));
        });
    }
}

