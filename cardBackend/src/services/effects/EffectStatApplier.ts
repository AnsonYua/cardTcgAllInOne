import { GameEnvironment } from '../../models/GameEnvironment';
import { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import { TargetReference } from '../EventQueue/interfaces/GameEvent';
import { EffectNotifier } from './EffectNotifier';
import { extractNumericValue, resolvePlayerIdsForScope } from './actions/EffectActionUtils';
import { SlotHealthService } from '../health/SlotHealthService';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { EffectApReductionPreventionUtils } from './EffectApReductionPreventionUtils';
import { TriggeredEffectProcessor } from './TriggeredEffectProcessor';
import { TrashConditionUtils } from '../conditions/TrashConditionUtils';

type StatApplicationContext = {
    sourcePlayerId?: string;
    sourceCarduid?: string;
    effectId?: string;
};

export class EffectStatApplier {
    static applyEffectToResolvedCard(
        gameEnv: GameEnvironment,
        targetCard: UnitZoneCard | PilotZoneCard,
        action: string,
        parameters: Record<string, unknown> | undefined,
        target: TargetReference,
        context?: StatApplicationContext
    ): { success: boolean; error?: string } {
        switch (action) {
            case 'modifyAP':
            case 'modifyHP':
                return this.applyModifyStat(gameEnv, targetCard, action, parameters, target, context);

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
        target: TargetReference,
        context?: StatApplicationContext
    ): { success: boolean; error?: string } {
        const value = this.resolveModifyStatValue(gameEnv, parameters, context);
        if (value === undefined) {
            return {
                success: false,
                error: `${action} effect requires numeric value`
            };
        }

        if (action === 'modifyAP' && value < 0) {
            const prevention = EffectApReductionPreventionUtils.isApReductionPrevented({
                targetCard,
                target,
                sourcePlayerId: context?.sourcePlayerId
            });
            if (prevention.prevented) {
                console.log(
                    `  🛡️ ${target.carduid}: AP reduction prevented by ${prevention.preventedBySourceCarduid || 'unknown source'}`
                );
                return { success: true };
            }
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

    private static resolveModifyStatValue(
        gameEnv: GameEnvironment,
        parameters: Record<string, unknown> | undefined,
        context?: StatApplicationContext
    ): number | undefined {
        const directValue = extractNumericValue(parameters);
        if (directValue !== undefined) {
            return directValue;
        }

        const sourcePlayerId = typeof context?.sourcePlayerId === 'string' ? context.sourcePlayerId : '';
        if (!sourcePlayerId || !parameters) {
            return undefined;
        }

        return this.resolveValuePerModifier(gameEnv, sourcePlayerId, parameters);
    }

    private static resolveValuePerModifier(
        gameEnv: GameEnvironment,
        sourcePlayerId: string,
        parameters: Record<string, unknown>
    ): number | undefined {
        const valuePer = parameters['valuePer'];
        if (!valuePer || typeof valuePer !== 'object') {
            return undefined;
        }

        const amount = extractNumericValue(valuePer as Record<string, unknown>);
        if (amount === undefined) {
            return undefined;
        }

        const per = (valuePer as Record<string, unknown>)['per'];
        if (!per || typeof per !== 'object') {
            return undefined;
        }

        const perConfig = per as Record<string, unknown>;
        const perType = typeof perConfig.type === 'string' ? perConfig.type : '';
        if (perType !== 'cardsInTrashWithTraitsAny' && perType !== 'cardsInTrash') {
            return undefined;
        }

        const playerIds = resolvePlayerIdsForScope(gameEnv, sourcePlayerId, perConfig.scope as string | undefined);
        if (playerIds.length === 0) {
            return undefined;
        }

        const traitsAny = Array.isArray(perConfig.traitsAny)
            ? perConfig.traitsAny.filter((entry): entry is string => typeof entry === 'string')
            : Array.isArray(perConfig.traits)
                ? perConfig.traits.filter((entry): entry is string => typeof entry === 'string')
                : [];

        const nestedFilters = perConfig.filters && typeof perConfig.filters === 'object'
            ? (perConfig.filters as Record<string, unknown>)
            : undefined;

        const cardType = typeof nestedFilters?.cardType === 'string'
            ? nestedFilters.cardType
            : typeof perConfig.cardType === 'string'
                ? perConfig.cardType
                : undefined;

        let totalCount = 0;
        for (const playerId of playerIds) {
            const count = TrashConditionUtils.countMatching(gameEnv, playerId, {
                traitsAny,
                cardType
            });
            if (count === null) {
                return undefined;
            }
            totalCount += count;
        }

        return amount * totalCount;
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
        const applyResult = this.applyCardHealthChange(gameEnv, targetCard, target, value, 'heal');
        if (!applyResult.success) {
            return applyResult;
        }

        if ((applyResult as any).healedAmount > 0) {
            const triggerResult = this.processUnitHealedTriggers(gameEnv, target);
            if (!triggerResult.success) {
                return triggerResult;
            }
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
        return this.applyCardHealthChange(gameEnv, targetCard, target, value, 'damage');
    }

    private static applyCardHealthChange(
        gameEnv: GameEnvironment,
        targetCard: UnitZoneCard | PilotZoneCard,
        target: TargetReference,
        value: number,
        mode: 'heal' | 'damage'
    ): { success: boolean; error?: string; healedAmount?: number } {
        if (SlotZoneUtils.isSlotZoneName(target.zone)) {
            return this.applySlotHealthChange(gameEnv, targetCard, target, value, mode);
        }
        return this.applyDirectCardHealthChange(gameEnv, targetCard, target, value, mode);
    }

    private static applySlotHealthChange(
        gameEnv: GameEnvironment,
        targetCard: UnitZoneCard | PilotZoneCard,
        target: TargetReference,
        value: number,
        mode: 'heal' | 'damage'
    ): { success: boolean; error?: string; healedAmount?: number } {
        const change = mode === 'heal'
            ? SlotHealthService.applyHealToTarget(gameEnv, target, value)
            : SlotHealthService.applyDamageToTarget(gameEnv, target, value);

        if (!change) {
            return {
                success: false,
                error: `Card ${target.carduid} has no slot health information`
            };
        }

        if (mode === 'heal') {
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
            return { success: true, healedAmount: healed };
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

    private static applyDirectCardHealthChange(
        gameEnv: GameEnvironment,
        targetCard: UnitZoneCard | PilotZoneCard,
        target: TargetReference,
        value: number,
        mode: 'heal' | 'damage'
    ): { success: boolean; error?: string; healedAmount?: number } {
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

        const newDamage = mode === 'heal'
            ? Math.max(0, previousDamage - Math.max(0, value))
            : previousDamage + value;
        (targetCard as any).damageReceived = newDamage;
        const resultingHP = Math.max(0, maxHP - newDamage);

        if (mode === 'heal') {
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
            return { success: true, healedAmount: healed };
        }

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

    private static processUnitHealedTriggers(
        gameEnv: GameEnvironment,
        target: TargetReference
    ): { success: boolean; error?: string } {
        if (!target?.carduid || !target?.playerId) {
            return { success: true };
        }

        const slotLookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, target.carduid);
        if (!slotLookup.found || !slotLookup.playerId || !slotLookup.slotName) {
            return { success: true };
        }

        const owner = gameEnv.getPlayer(slotLookup.playerId);
        const slot = owner?.zones ? (owner.zones as any)[slotLookup.slotName] : null;
        if (!slot) {
            return { success: true };
        }

        const sources: any[] = [];
        if (slot.unit?.carduid) {
            sources.push(slot.unit);
        }
        if (slot.pilot?.carduid) {
            sources.push(slot.pilot);
        }

        for (const source of sources) {
            const triggered = TriggeredEffectProcessor.processForSourceCard(
                gameEnv,
                slotLookup.playerId,
                source,
                {
                    trigger: 'UNIT_HEALED',
                    expectedTriggers: ['UNIT_HEALED'],
                    fallbackEffectId: 'unit_healed',
                    defaultTargetScope: 'self'
                }
            );
            if (!triggered.success) {
                return { success: false, error: triggered.error || 'Failed to process UNIT_HEALED trigger' };
            }
        }

        return { success: true };
    }
}
