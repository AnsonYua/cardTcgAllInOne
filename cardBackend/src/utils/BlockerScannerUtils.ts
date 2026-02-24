// src/utils/BlockerScannerUtils.ts
// Centralized Blocker availability scanning (explicit ATTACK_REDIRECT rules + keyword-granted Blocker).

import type { GameEnvironment } from '../models/GameEnvironment';
import { SLOT_ZONES } from '../config/gameConstants';
import { SlotZoneUtils } from './SlotZoneUtils';
import type { EffectDefinition } from '../services/EventQueue/interfaces/GameEvent';
import { isBlockerRedirectRule } from './BlockerRuleUtils';
import { KeywordUtils } from './KeywordUtils';

export interface BlockerUnit {
    carduid: string;
    effect?: EffectDefinition;
}

export function scanForBlockerUnits(gameEnv: GameEnvironment, playerId: string): BlockerUnit[] {
    const results: BlockerUnit[] = [];
    const player = gameEnv.getPlayer(playerId);

    if (!player || !player.zones) {
        return results;
    }

    for (const slotName of SLOT_ZONES) {
        const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotName);
        if (!slotResult.isValid || !slotResult.slot?.unit) {
            continue;
        }

        const unit = slotResult.slot.unit;

        // Skip rested units and invalid cards
        if (!unit.carduid || unit.isRested) {
            continue;
        }

        const cardData = unit.cardData;
        const rules = cardData?.effects?.rules;
        const hasTemporarilyGrantedBlocker = typeof KeywordUtils.getKeywordValue(unit as any, 'Blocker') === 'number';

        // Primary: explicit ATTACK_REDIRECT rule (may have conditions)
        if (Array.isArray(rules)) {
            const blockerRule = rules.find(rule => isBlockerRedirectRule(rule));
            if (blockerRule) {
                // If Blocker was granted temporarily (e.g. GD03-118), treat it as keyword-based blocker.
                // This avoids conditional native blocker rules (like "while friendly base in play")
                // from suppressing the temporary grant during blocker availability checks.
                if (hasTemporarilyGrantedBlocker) {
                    results.push({ carduid: unit.carduid });
                    continue;
                }
                results.push({
                    carduid: unit.carduid,
                    effect: blockerRule
                });
                continue;
            }
        }

        // Secondary: keyword-based blocker (e.g. granted by continuous effects like GD01-019)
        if (KeywordUtils.hasKeyword(unit as any, 'Blocker')) {
            results.push({ carduid: unit.carduid });
        }
    }

    return results;
}
