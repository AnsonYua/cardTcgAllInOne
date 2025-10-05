// src/services/effects/EffectTargetResolver.ts
// Shared utilities for resolving card targets across effect managers

import { GameEnvironment } from '../../models/GameEnvironment';
import { TargetReference } from '../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils, SlotSearchResult } from '../../utils/SlotZoneUtils';

export interface ResolvedTargetContext {
    reference: TargetReference;
    searchResult: SlotSearchResult;
    requestedPlayerId?: string;
}

export type TargetResolutionResult =
    | { success: true; context: ResolvedTargetContext }
    | { success: false; error: string };

export class EffectTargetResolver {
    /**
     * Resolve a carduid into a TargetReference together with slot search metadata.
     */
    static resolveSingleTarget(
        gameEnv: GameEnvironment,
        targetCarduid: string,
        providedZone?: string,
        requestedPlayerId?: string
    ): TargetResolutionResult {
        if (!targetCarduid) {
            return {
                success: false,
                error: 'Target carduid is required'
            };
        }

        const searchResult = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, targetCarduid);
        if (!searchResult.found || !searchResult.slotName || !searchResult.playerId) {
            return {
                success: false,
                error: searchResult.error || `Target ${targetCarduid} not found in any player zones`
            };
        }

        if (providedZone && providedZone !== searchResult.slotName) {
            return {
                success: false,
                error: `Target ${targetCarduid} is not in zone ${providedZone}`
            };
        }

        if (requestedPlayerId && requestedPlayerId !== searchResult.playerId) {
            return {
                success: false,
                error: `Target ${targetCarduid} is not controlled by the requested player ${requestedPlayerId}`
            };
        }

        const reference: TargetReference = {
            carduid: targetCarduid,
            zone: searchResult.slotName,
            playerId: searchResult.playerId,
            cardData: (searchResult.card || searchResult.unit || searchResult.pilot)?.cardData
        };

        return {
            success: true,
            context: {
                reference,
                searchResult,
                requestedPlayerId
            }
        };
    }
}
