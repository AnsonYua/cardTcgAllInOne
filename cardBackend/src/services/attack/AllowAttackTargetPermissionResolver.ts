// src/services/attack/AllowAttackTargetPermissionResolver.ts
// Resolves whether an attacker has permission to target an active (non-rested) enemy unit.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { UnitZoneCard } from '../../models/CardSystem';
import { getSlotTotals } from '../../utils/FieldValueCalculator';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { AllowAttackTargetRuleEvaluator } from './AllowAttackTargetRuleEvaluator';
import { SlotHealthStorage } from '../health/SlotHealthStorage';
import { EffectSourceConditionEvaluator } from '../conditions/EffectSourceConditionEvaluator';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';

type AllowAttackTargetRuleLike = {
    action?: unknown;
    conditions?: unknown;
    parameters?: unknown;
    sourceConditions?: unknown;
};

export class AllowAttackTargetPermissionResolver {
    static canTargetActiveUnit(
        gameEnv: GameEnvironment,
        attacker: UnitZoneCard,
        target: UnitZoneCard
    ): boolean {
        const attackerLookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, attacker.carduid);
        const attackerSlot = (attackerLookup.found && attackerLookup.playerId && attackerLookup.slotName)
            ? (gameEnv.players[attackerLookup.playerId]?.zones as any)?.[attackerLookup.slotName]
            : undefined;
        const attackerSlotTotals = getSlotTotals(attackerSlot);

        const targetLookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, target.carduid);
        const targetSlot = (targetLookup.found && targetLookup.playerId && targetLookup.slotName)
            ? (gameEnv.players[targetLookup.playerId]?.zones as any)?.[targetLookup.slotName]
            : undefined;
        const targetSlotTotals = getSlotTotals(targetSlot);
        const targetDamaged = SlotHealthStorage.getSharedDamage(targetSlot) > 0;

        const effectSources: any[] = [attacker];
        if (attackerLookup.found && attackerLookup.playerId && attackerLookup.slotName) {
            const player = gameEnv.getPlayer(attackerLookup.playerId);
            if (player?.zones) {
                const slotResult = SlotZoneUtils.getSlotZone(player.zones, attackerLookup.slotName);
                if (slotResult.isValid && slotResult.slot?.pilot) {
                    effectSources.push(slotResult.slot.pilot);
                }
            }
        }

        const allowsTarget = (rule: AllowAttackTargetRuleLike): boolean =>
            AllowAttackTargetRuleEvaluator.ruleAllowsTarget({
                sourceSlotTotals: attackerSlotTotals,
                targetLevel: target.cardData?.level || 0,
                targetTotalAp: targetSlotTotals.totalAP,
                targetDamaged,
                rule
            });

        const sourceOwnerPlayerId = attackerLookup.found && attackerLookup.playerId
            ? attackerLookup.playerId
            : null;

        for (const source of effectSources) {
            const effects = source?.cardData?.effects?.rules || [];
            for (const rule of effects) {
                if (!rule || (rule as any).action !== 'allow_attack_target') {
                    continue;
                }
                if (!AllowAttackTargetRuleEvaluator.canGrantActiveTargetPermission(rule as any)) {
                    continue;
                }
                if (
                    !EffectSourceConditionEvaluator.sourceConditionsMet(
                        rule as EffectDefinition,
                        source as any,
                        gameEnv,
                        sourceOwnerPlayerId
                    )
                ) {
                    continue;
                }
                if (allowsTarget(rule as any)) {
                    return true;
                }
            }

            const tempEffects = source?.temporaryEffects;
            if (!Array.isArray(tempEffects) || tempEffects.length === 0) {
                continue;
            }

            for (const tempEffect of tempEffects) {
                const allow = tempEffect?.allowAttackTarget;
                if (!allow || typeof allow !== 'object') {
                    continue;
                }

                const synthesizedRule: AllowAttackTargetRuleLike = {
                    action: 'allow_attack_target',
                    conditions: [],
                    parameters: allow
                };

                if (!AllowAttackTargetRuleEvaluator.canGrantActiveTargetPermission(synthesizedRule as any)) {
                    continue;
                }

                if (allowsTarget(synthesizedRule)) {
                    return true;
                }
            }
        }

        return false;
    }
}
