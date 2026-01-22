import { GameEnvironment } from '../../models/GameEnvironment';
import { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import { TargetReference } from '../EventQueue/interfaces/GameEvent';
import { EffectNotifier } from './EffectNotifier';

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
                return this.applyHealToCard(targetCard, parameters, target);

            case 'damage':
                return this.applyDamageToCard(targetCard, parameters, target);

            case 'rest':
                return this.applyRestState(targetCard, true, target);

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
        const value = this.extractNumericValue(parameters);
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
        targetCard: UnitZoneCard | PilotZoneCard,
        parameters: Record<string, unknown> | undefined,
        target: TargetReference
    ): { success: boolean; error?: string } {
        const value = this.extractNumericValue(parameters);
        if (value === undefined) {
            return {
                success: false,
                error: 'Heal effect requires numeric value'
            };
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

        console.log(`  🩹 ${target.carduid}: damage ${previousDamage} → ${newDamage} (HP ${resultingHP}/${maxHP})`);
        return { success: true };
    }

    static applyDamageToCard(
        targetCard: UnitZoneCard | PilotZoneCard,
        parameters: Record<string, unknown> | undefined,
        target: TargetReference
    ): { success: boolean; error?: string } {
        const value = this.extractNumericValue(parameters);
        if (value === undefined) {
            return {
                success: false,
                error: 'Damage effect requires numeric value'
            };
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
        return { success: true };
    }

    static applyRestState(
        targetCard: UnitZoneCard | PilotZoneCard,
        shouldRest: boolean,
        target: TargetReference
    ): { success: boolean; error?: string } {
        targetCard.isRested = shouldRest;
        console.log(`  😌 ${target.carduid}: ${shouldRest ? 'rested' : 'activated'}`);
        return { success: true };
    }

    private static extractNumericValue(parameters?: Record<string, unknown>): number | undefined {
        if (!parameters) {
            return undefined;
        }

        const rawValue =
            parameters['value'] ??
            parameters['amount'] ??
            parameters['modifier'];
        if (typeof rawValue === 'number') {
            return rawValue;
        }

        if (typeof rawValue === 'string') {
            const parsed = Number(rawValue);
            return Number.isNaN(parsed) ? undefined : parsed;
        }

        return undefined;
    }
}
