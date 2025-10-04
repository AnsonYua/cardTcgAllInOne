// src/services/effects/AttackPhaseEffectManager.ts
// Handles ATTACK_PHASE triggered effects for attacking units and attached pilots

import { GameEnvironment } from '../../models/GameEnvironment';
import { UnitZoneCard, PilotZoneCard, ZoneCard } from '../../models/CardSystem';
import { EffectDefinition, PlayerActionEvent, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { EffectExecutor } from './EffectExecutor';

export interface AttackPhaseEffectResult {
    success: boolean;
    error?: string;
    effectsProcessed?: number;
}

type TriggeredEffectRule = EffectDefinition & {
    restrictions?: string[];
};

export class AttackPhaseEffectManager {
    static processAttackPhaseEffects(
        gameEnv: GameEnvironment,
        event: PlayerActionEvent
    ): AttackPhaseEffectResult {
        const eventData = event.data || {};
        const playerId = typeof eventData.playerId === 'string' ? eventData.playerId : undefined;
        const attackerCarduid = typeof eventData.attackerCarduid === 'string' ? eventData.attackerCarduid : undefined;

        if (!playerId || !attackerCarduid) {
            return { success: true, effectsProcessed: 0 };
        }

        const attackerSlotResult = SlotZoneUtils.findSlotNameByUnitUidForPlayer(
            gameEnv,
            playerId,
            attackerCarduid
        );

        if (!attackerSlotResult.found || !attackerSlotResult.slotName || !attackerSlotResult.unit) {
            // No unit found – nothing to trigger
            return { success: true, effectsProcessed: 0 };
        }

        const attackingUnit = attackerSlotResult.unit as UnitZoneCard;
        const slotZone = SlotZoneUtils.getSlotZone(
            gameEnv.players[playerId].zones,
            attackerSlotResult.slotName
        );
        const pairedPilot = slotZone?.slot?.pilot as PilotZoneCard | undefined;

        const effectSources: Array<UnitZoneCard | PilotZoneCard> = [attackingUnit];
        if (pairedPilot) {
            effectSources.push(pairedPilot);
        }

        let effectsProcessed = 0;

        for (const sourceCard of effectSources) {
            const rules = sourceCard.cardData?.effects?.rules || [];
            for (const rule of rules) {
                const effect = rule as TriggeredEffectRule;
                if (!this.isAttackPhaseTrigger(effect)) {
                    continue;
                }

                const normalizedEffect = ensureEffectDefaults({ ...effect }) as TriggeredEffectRule;

                if (!this.sourceConditionsSatisfied(normalizedEffect, sourceCard, gameEnv, playerId)) {
                    continue;
                }

                if (!this.restrictionsAllowUse(effect, sourceCard, gameEnv.currentTurn)) {
                    continue;
                }

                const applyResult = this.applyAttackEffect(
                    gameEnv,
                    playerId,
                    sourceCard,
                    normalizedEffect
                );

                if (!applyResult.success) {
                    return applyResult;
                }

                this.markEffectUsed(
                    sourceCard,
                    normalizedEffect.effectId || normalizedEffect.action || 'attack_effect',
                    gameEnv.currentTurn
                );
                effectsProcessed++;
            }
        }

        return { success: true, effectsProcessed };
    }

    private static isAttackPhaseTrigger(effect: EffectDefinition): boolean {
        if (!effect) {
            return false;
        }

        return (
            effect.type === 'triggered' &&
            typeof effect.trigger === 'string' &&
            effect.trigger.toUpperCase() === 'ATTACK_PHASE'
        );
    }

    private static sourceConditionsSatisfied(
        effect: EffectDefinition,
        card: UnitZoneCard | PilotZoneCard,
        gameEnv: GameEnvironment,
        playerId: string
    ): boolean {
        if (!effect.sourceConditions || effect.sourceConditions.length === 0) {
            return true;
        }

        try {
            return ContinuousEffectManager.sourceConditionsMet(
                effect,
                card as unknown as any,
                gameEnv,
                playerId
            );
        } catch (error) {
            console.error('❌ Failed to evaluate source conditions for attack effect:', error);
            return false;
        }
    }

    private static restrictionsAllowUse(
        effect: TriggeredEffectRule,
        card: ZoneCard,
        currentTurn: number
    ): boolean {
        const restrictions = effect.restrictions || [];
        if (restrictions.includes('once_per_turn')) {
            const usage = card.effectUsage?.[effect.effectId];
            if (usage && usage.lastUsedTurn === currentTurn) {
                console.log(`⚠️ Effect ${effect.effectId} already used this turn for card ${card.carduid}`);
                return false;
            }
        }

        return true;
    }

    private static markEffectUsed(card: ZoneCard, effectId: string, currentTurn: number): void {
        if (!card.effectUsage) {
            card.effectUsage = {};
        }
        card.effectUsage[effectId] = { lastUsedTurn: currentTurn };
    }

    private static applyAttackEffect(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCard: UnitZoneCard | PilotZoneCard,
        effect: EffectDefinition
    ): AttackPhaseEffectResult {
        const action = EffectExecutor.getEffectAction(effect);

        if (!action) {
            return {
                success: false,
                error: 'Attack phase effect missing action'
            };
        }

        if (effect.optional) {
            console.log(`ℹ️ Optional attack effect ${effect.effectId || action} auto-applied for card ${sourceCard.carduid}`);
        }

        const targetReference = this.buildTargetReference(gameEnv, playerId, sourceCard);
        if (!targetReference) {
            return {
                success: false,
                error: `Unable to resolve attack effect target for card ${sourceCard.carduid}`
            };
        }

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            effect,
            [targetReference],
            playerId,
            sourceCard.carduid
        );

        if (!result.success) {
            return { success: false, error: result.error };
        }

        return { success: true };
}

    private static buildTargetReference(
        gameEnv: GameEnvironment,
        fallbackPlayerId: string,
        sourceCard: UnitZoneCard | PilotZoneCard
    ): TargetReference | null {
        const slotLookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, sourceCard.carduid);

        if (!slotLookup.found || !slotLookup.slotName) {
            return null;
        }

        const resolvedPlayerId = slotLookup.playerId || fallbackPlayerId;

        if (!resolvedPlayerId) {
            return null;
        }

        return {
            carduid: sourceCard.carduid,
            zone: slotLookup.slotName,
            playerId: resolvedPlayerId
        };
    }
}
