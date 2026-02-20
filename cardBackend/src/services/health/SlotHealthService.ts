import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetReference } from '../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import {
    applyDamage,
    applyHeal,
    resolveRemainingHp,
    resolveSlotEffectiveMaxHp,
    type SlotHealthLike
} from './SlotHealthMath';
import { SlotHealthStorage } from './SlotHealthStorage';

type SlotName = 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6';

export interface SlotHealthResolution {
    playerId: string;
    slotName: SlotName;
    slot: SlotHealthLike;
    unitCarduid?: string;
    pilotCarduid?: string;
}

export interface SlotHealthState extends SlotHealthResolution {
    maxHp: number;
    sharedDamage: number;
    remainingHp: number;
}

export interface SlotHealthChange extends SlotHealthState {
    previousDamage: number;
    previousRemainingHp: number;
}

export class SlotHealthService {
    static resolveByCarduid(
        gameEnv: GameEnvironment,
        carduid: string
    ): SlotHealthResolution | null {
        if (!carduid) {
            return null;
        }

        const lookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, carduid);
        if (!lookup?.found || !lookup.playerId || !lookup.slotName) {
            return null;
        }
        const player = gameEnv.getPlayer(lookup.playerId);
        if (!player?.zones) {
            return null;
        }
        const slotResult = SlotZoneUtils.getSlotZone(player.zones, lookup.slotName);
        if (!slotResult.isValid || !slotResult.slot) {
            return null;
        }

        return {
            playerId: lookup.playerId,
            slotName: lookup.slotName as SlotName,
            slot: slotResult.slot as SlotHealthLike,
            unitCarduid: slotResult.slot.unit?.carduid,
            pilotCarduid: slotResult.slot.pilot?.carduid
        };
    }

    static resolveByTarget(
        gameEnv: GameEnvironment,
        target: TargetReference,
        requireCardInSlot = true
    ): SlotHealthResolution | null {
        if (!target?.playerId || !target?.zone || !SlotZoneUtils.isSlotZoneName(target.zone)) {
            return null;
        }
        const player = gameEnv.getPlayer(target.playerId);
        if (!player?.zones) {
            return null;
        }
        const slotResult = SlotZoneUtils.getSlotZone(player.zones, target.zone);
        if (!slotResult.isValid || !slotResult.slot) {
            return null;
        }
        const slot = slotResult.slot as SlotHealthLike;
        const unitCarduid = slot.unit?.carduid;
        const pilotCarduid = slot.pilot?.carduid;

        if (requireCardInSlot) {
            const matchesTarget = target.carduid && (target.carduid === unitCarduid || target.carduid === pilotCarduid);
            if (!matchesTarget) {
                return null;
            }
        }

        return {
            playerId: target.playerId,
            slotName: target.zone as SlotName,
            slot,
            unitCarduid,
            pilotCarduid
        };
    }

    static getSlotHealthState(
        gameEnv: GameEnvironment,
        carduid: string
    ): SlotHealthState | null {
        const resolved = this.resolveByCarduid(gameEnv, carduid);
        return resolved ? this.toState(resolved) : null;
    }

    static getSlotHealthStateByTarget(
        gameEnv: GameEnvironment,
        target: TargetReference
    ): SlotHealthState | null {
        const resolved = this.resolveByTarget(gameEnv, target, false);
        return resolved ? this.toState(resolved) : null;
    }

    static isSlotDamaged(
        gameEnv: GameEnvironment,
        carduid: string
    ): boolean {
        const state = this.getSlotHealthState(gameEnv, carduid);
        return !!state && state.sharedDamage > 0;
    }

    static getSlotRemainingHp(
        gameEnv: GameEnvironment,
        carduid: string
    ): number | null {
        const state = this.getSlotHealthState(gameEnv, carduid);
        return state ? state.remainingHp : null;
    }

    static wouldDestroySlot(
        gameEnv: GameEnvironment,
        carduid: string,
        incomingDamage: number
    ): boolean {
        const state = this.getSlotHealthState(gameEnv, carduid);
        if (!state) {
            return false;
        }
        const newDamage = applyDamage(state.sharedDamage, incomingDamage);
        return resolveRemainingHp(state.maxHp, newDamage) <= 0;
    }

    static applyDamageByCarduid(
        gameEnv: GameEnvironment,
        carduid: string,
        value: number
    ): SlotHealthChange | null {
        const resolved = this.resolveByCarduid(gameEnv, carduid);
        if (!resolved) {
            return null;
        }
        return this.applySharedDamage(resolved, value);
    }

    static applyHealByCarduid(
        gameEnv: GameEnvironment,
        carduid: string,
        value: number
    ): SlotHealthChange | null {
        const resolved = this.resolveByCarduid(gameEnv, carduid);
        if (!resolved) {
            return null;
        }
        return this.applySharedHeal(resolved, value);
    }

    static applyDamageToTarget(
        gameEnv: GameEnvironment,
        target: TargetReference,
        value: number
    ): SlotHealthChange | null {
        const resolved = this.resolveByTarget(gameEnv, target, true);
        if (!resolved) {
            return null;
        }
        return this.applySharedDamage(resolved, value);
    }

    static applyHealToTarget(
        gameEnv: GameEnvironment,
        target: TargetReference,
        value: number
    ): SlotHealthChange | null {
        const resolved = this.resolveByTarget(gameEnv, target, true);
        if (!resolved) {
            return null;
        }
        return this.applySharedHeal(resolved, value);
    }

    static getUnitCarduidForTarget(
        gameEnv: GameEnvironment,
        target: TargetReference
    ): string | null {
        const resolved = this.resolveByTarget(gameEnv, target, false);
        return resolved?.unitCarduid || null;
    }

    private static applySharedDamage(
        resolved: SlotHealthResolution,
        value: number
    ): SlotHealthChange {
        const state = this.toState(resolved);
        const newDamage = applyDamage(state.sharedDamage, value);
        SlotHealthStorage.setSharedDamage(resolved.slot, newDamage);
        return this.toChange(state, resolved);
    }

    private static applySharedHeal(
        resolved: SlotHealthResolution,
        value: number
    ): SlotHealthChange {
        const state = this.toState(resolved);
        const newDamage = applyHeal(state.sharedDamage, value);
        SlotHealthStorage.setSharedDamage(resolved.slot, newDamage);
        return this.toChange(state, resolved);
    }

    private static toState(resolved: SlotHealthResolution): SlotHealthState {
        const maxHp = resolveSlotEffectiveMaxHp(resolved.slot);
        const sharedDamage = SlotHealthStorage.getSharedDamage(resolved.slot);
        const remainingHp = resolveRemainingHp(maxHp, sharedDamage);

        return {
            ...resolved,
            maxHp,
            sharedDamage,
            remainingHp
        };
    }

    private static toChange(
        previous: SlotHealthState,
        resolved: SlotHealthResolution
    ): SlotHealthChange {
        const current = this.toState(resolved);
        return {
            ...current,
            previousDamage: previous.sharedDamage,
            previousRemainingHp: previous.remainingHp
        };
    }
}
