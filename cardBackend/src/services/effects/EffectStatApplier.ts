import { GameEnvironment } from '../../models/GameEnvironment';
import { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import { TargetReference } from '../EventQueue/interfaces/GameEvent';
import { EffectNotifier } from './EffectNotifier';
import { extractNumericValue } from './actions/EffectActionUtils';
import { SlotHealthService } from '../health/SlotHealthService';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';

export class EffectStatApplier {
    static applyEffectToResolvedCard(
        gameEnv: GameEnvironment,
        targetCard: UnitZoneCard | PilotZoneCard,
        action: string,
        parameters: Record<string, unknown> | undefined,
        target: TargetReference
    ): { success: boolean; error?: string } {
        switch (action) {
            case 'modifyAP':
            case 'modifyHP':
                return this.applyModifyStat(gameEnv, targetCard, action, parameters, target);

            case 'heal':
                return this.applyHealToCard(gameEnv, targetCard, parameters, target);

            case 'damage':
                return this.applyDamageToCard(gameEnv, targetCard, parameters, target);

            default:
                console.log(`⚠️ Unsupported effect action: ${action}`);
                return {
                    success: false,
                    error: `Unsupported effect action: ${action}`
                };
        }
    }

    static applyModifyStat(
        gameEnv: GameEnvironment,
        targetCard: UnitZoneCard | PilotZoneCard,
        action: 'modifyAP' | 'modifyHP',
        parameters: Record<string, unknown> | undefined,
        target: TargetReference
    ): { success: boolean; error?: string } {
        const value = extractNumericValue(parameters);
        if (value === undefined) {
            return {
                success: false,
                error: `${action} effect requires numeric value`
            };
        }

        const property = action === 'modifyAP' ? 'modifyAP' : 'modifyHP';
        const previousValue = (targetCard as any)[property] || 0;
        (targetCard as any)[property] = previousValue + value;

        console.log(`  ⚙️ ${target.carduid}: ${property} ${previousValue} → ${(targetCard as any)[property]} (${value > 0 ? '+' : ''}${value})`);
        EffectNotifier.notifyCardStatChange(
            gameEnv,
            targetCard,
            target,
            action,
            value,
            (targetCard as any)[property]
        );
        return { success: true };
    }

    static applyHealToCard(
        gameEnv: GameEnvironment,
        targetCard: UnitZoneCard | PilotZoneCard,
        parameters: Record<string, unknown> | undefined,
        target: TargetReference
    ): { success: boolean; error?: string } {
        const value = extractNumericValue(parameters);
        if (value === undefined) {
            return {
                success: false,
                error: 'Heal effect requires numeric value'
            };
        }

        if (SlotZoneUtils.isSlotZoneName(target.zone)) {
            const change = SlotHealthService.applyHealToTarget(gameEnv, target, value);
            if (!change) {
                return {
                    success: false,
                    error: `Card ${target.carduid} has no slot health information`
                };
            }

            const healed = Math.max(0, change.previousDamage - change.sharedDamage);
            console.log(`  🩹 ${target.carduid}: shared damage ${change.previousDamage} → ${change.sharedDamage} (HP ${change.remainingHp}/${change.maxHp})`);

            if (healed > 0) {
                EffectNotifier.notifyCardHealed(
                    gameEnv,
                    targetCard,
                    target,
                    healed,
                    change.sharedDamage,
                    change.remainingHp,
                    change.maxHp,
                    'heal'
                );
            }

            return { success: true };
        }

        const maxHP = targetCard.originalHP ?? targetCard.cardData?.hp ?? 0;
        if (maxHP === 0) {
            return {
                success: false,
                error: `Card ${target.carduid} has no HP information`
            };
        }

        const previousDamage = typeof (targetCard as any).damageReceived === 'number'
            ? (targetCard as any).damageReceived
            : 0;

        const healAmount = Math.max(0, value);
        const newDamage = Math.max(0, previousDamage - healAmount);
        (targetCard as any).damageReceived = newDamage;

        const resultingHP = Math.max(0, maxHP - newDamage);
        const healed = Math.max(0, previousDamage - newDamage);

        console.log(`  🩹 ${target.carduid}: damage ${previousDamage} → ${newDamage} (HP ${resultingHP}/${maxHP})`);

        if (healed > 0) {
            EffectNotifier.notifyCardHealed(
                gameEnv,
                targetCard,
                target,
                healed,
                newDamage,
                resultingHP,
                maxHP,
                'heal'
            );
        }
        return { success: true };
    }

    static applyDamageToCard(
        gameEnv: GameEnvironment,
        targetCard: UnitZoneCard | PilotZoneCard,
        parameters: Record<string, unknown> | undefined,
        target: TargetReference
    ): { success: boolean; error?: string } {
        const value = extractNumericValue(parameters);
        if (value === undefined) {
            return {
                success: false,
                error: 'Damage effect requires numeric value'
            };
        }

        if (SlotZoneUtils.isSlotZoneName(target.zone)) {
            const change = SlotHealthService.applyDamageToTarget(gameEnv, target, value);
            if (!change) {
                return {
                    success: false,
                    error: `Card ${target.carduid} has no slot health information`
                };
            }

            const appliedDamage = Math.max(0, change.sharedDamage - change.previousDamage);
            console.log(`  💥 ${target.carduid}: shared damage ${change.previousDamage} → ${change.sharedDamage} (HP ${change.remainingHp}/${change.maxHp})`);
            EffectNotifier.notifyCardDamageApplied(
                gameEnv,
                targetCard,
                target,
                appliedDamage,
                change.remainingHp,
                change.maxHp
            );
            return { success: true };
        }

        const maxHP = targetCard.originalHP ?? targetCard.cardData?.hp ?? 0;
        if (maxHP === 0) {
            return {
                success: false,
                error: `Card ${target.carduid} has no HP information`
            };
        }

        const previousDamage = typeof (targetCard as any).damageReceived === 'number'
            ? (targetCard as any).damageReceived
            : 0;
        const newDamage = previousDamage + value;
        (targetCard as any).damageReceived = newDamage;

        const resultingHP = Math.max(0, maxHP - newDamage);

        console.log(`  💥 ${target.carduid}: damage ${previousDamage} → ${newDamage} (HP ${resultingHP}/${maxHP})`);
        EffectNotifier.notifyCardDamageApplied(
            gameEnv,
            targetCard,
            target,
            value,
            resultingHP,
            maxHP
        );
        return { success: true };
    }
}
