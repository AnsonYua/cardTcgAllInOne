// src/services/effects/InPlayTriggeredEffectManager.ts
// Shared helper for trigger managers that scan in-play sources (slots + bases) for a player.

import type { GameEnvironment } from '../../models/GameEnvironment';
import { SLOT_ZONES } from '../../config/gameConstants';
import { TriggeredEffectProcessor } from './TriggeredEffectProcessor';

export class InPlayTriggeredEffectManager {
    static processForPlayer(params: {
        gameEnv: GameEnvironment;
        playerId: string;
        trigger: string;
        fallbackEffectId: string;
        expectedTriggers?: string[];
        defaultTargetScope?: string;
        preFilter?: (rawRule: Record<string, unknown>) => boolean;
    }): { success: boolean; error?: string; requiresSelection?: boolean } {
        const { gameEnv, playerId, trigger, fallbackEffectId } = params;
        const expectedTriggers = Array.isArray(params.expectedTriggers) && params.expectedTriggers.length > 0
            ? params.expectedTriggers
            : [trigger];

        const player = gameEnv.getPlayer(playerId) || gameEnv.players[playerId];
        if (!player?.zones) {
            return { success: true };
        }

        const sources: any[] = [];

        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            if (slot?.unit) sources.push(slot.unit);
            if (slot?.pilot) sources.push(slot.pilot);
        }

        const bases = Array.isArray((player.zones as any).base) ? (player.zones as any).base : [];
        for (const base of bases) {
            if (base) sources.push(base);
        }

        for (const sourceCard of sources) {
            const processed = TriggeredEffectProcessor.processForSourceCard(gameEnv, playerId, sourceCard, {
                trigger,
                expectedTriggers,
                fallbackEffectId,
                defaultTargetScope: params.defaultTargetScope || 'self',
                ...(params.preFilter ? { preFilter: params.preFilter } : {})
            });

            if (!processed.success) {
                return { success: false, error: processed.error };
            }

            if (processed.requiresSelection) {
                return { success: true, requiresSelection: true };
            }
        }

        return { success: true };
    }
}
