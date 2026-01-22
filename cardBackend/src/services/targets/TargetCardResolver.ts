// src/services/targets/TargetCardResolver.ts

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { ZoneCard } from '../../models/CardSystem';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import type { TargetReference } from '../EventQueue/interfaces/GameEvent';

export type ResolvedTargetCard =
    | { kind: 'unit' | 'pilot'; card: any }
    | { kind: 'energy'; card: any }
    | { kind: 'shield'; card: any }
    | { kind: 'base'; card: any };

export class TargetCardResolver {
    static resolve(gameEnv: GameEnvironment, target: TargetReference): ResolvedTargetCard | null {
        const player = gameEnv.getPlayer(target.playerId);
        if (!player?.zones) {
            return null;
        }

        if (target.zone === 'energy') {
            const energyArea = player.zones.energyArea;
            const energyCard = Array.isArray(energyArea)
                ? energyArea.find((card: any) => card?.carduid === target.carduid)
                : undefined;
            return energyCard ? { kind: 'energy', card: energyCard } : null;
        }

        if (target.zone === 'shield') {
            const shieldArea = player.zones.shieldArea;
            const shieldCard = Array.isArray(shieldArea)
                ? shieldArea.find((card: ZoneCard) => card?.carduid === target.carduid)
                : undefined;
            return shieldCard ? { kind: 'shield', card: shieldCard } : null;
        }

        if (target.zone === 'base') {
            const baseArea = player.zones.base;
            const baseCard = Array.isArray(baseArea)
                ? baseArea.find((card: ZoneCard) => card?.carduid === target.carduid)
                : undefined;
            return baseCard ? { kind: 'base', card: baseCard } : null;
        }

        const resolved = SlotZoneUtils.resolveTargetReference(gameEnv, target);
        return resolved ? { kind: resolved.type, card: resolved.card } : null;
    }
}

