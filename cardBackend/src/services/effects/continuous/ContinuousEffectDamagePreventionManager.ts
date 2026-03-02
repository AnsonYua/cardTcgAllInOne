// src/services/effects/continuous/ContinuousEffectDamagePreventionManager.ts
// Applies effect-damage prevention as a temporary effect refreshed via ContinuousEffectManager.

import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { TemporaryEffectFactory } from '../TemporaryEffectFactory';
import { GameNotificationManager } from '../../GameNotificationManager';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { SLOT_ZONES } from '../../../config/gameConstants';
import { parsePreventDamageVariant } from '../utils/PreventDamageVariantUtils';

export class ContinuousEffectDamagePreventionManager {
    private static removeExistingPrevention(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        prevention: { sourceCardType?: string; sourceController?: string }
    ): number {
        const removedCards: string[] = [];

        for (const player of Object.values(gameEnv.players)) {
            const zones = (player as any)?.zones;
            if (!zones) continue;

            const cards: any[] = [];

            for (const slotName of SLOT_ZONES) {
                const slot = zones[slotName];
                if (slot?.unit) cards.push(slot.unit);
                if (slot?.pilot) cards.push(slot.pilot);
            }

            if (Array.isArray(zones.base)) {
                cards.push(...zones.base);
            }
            if (Array.isArray(zones.shieldArea)) {
                cards.push(...zones.shieldArea);
            }

            for (const card of cards) {
                if (!card?.temporaryEffects || !Array.isArray(card.temporaryEffects)) {
                    continue;
                }

                const before = card.temporaryEffects.length;
                card.temporaryEffects = card.temporaryEffects.filter((tempEffect: any) => {
                    if (tempEffect?.sourceCarduid !== sourceCarduid) {
                        return true;
                    }
                    const prevent = tempEffect?.preventEffectDamage;
                    if (!prevent || typeof prevent !== 'object') {
                        return true;
                    }
                    return !(
                        prevent.sourceCardType === prevention.sourceCardType
                        && prevent.sourceController === prevention.sourceController
                    );
                });

                if (before !== card.temporaryEffects.length) {
                    removedCards.push(card.carduid);
                }
            }
        }

        if (removedCards.length > 0) {
            console.log(
                `🧹 Removed ${removedCards.length} stale effect-damage prevention effect(s) from ${sourceCarduid}`
            );
        }

        return removedCards.length;
    }

    static applyToTargets(
        gameEnv: GameEnvironment,
        effectEntry: {
            sourceCarduid: string;
            sourcePlayerId: string;
            effectData: EffectDefinition;
        },
        targets: any[]
    ): number {
        const parsed = parsePreventDamageVariant(effectEntry.effectData);
        if (parsed.kind === 'invalid') {
            return 0;
        }

        if (parsed.kind !== 'effect_damage') {
            // Base battle prevention variant is evaluated in BattleBaseDamagePreventionUtils.
            return 0;
        }

        const sourceCardType = parsed.sourceCardType;
        const sourceController = parsed.sourceController;

        if (!sourceCardType && !sourceController) {
            return 0;
        }

        this.removeExistingPrevention(gameEnv, effectEntry.sourceCarduid, { sourceCardType, sourceController });

        const appliedTargets: Array<{ carduid: string; zone?: string; playerId?: string }> = [];

        for (const target of targets) {
            if (!target?.carduid || typeof target.carduid !== 'string') {
                continue;
            }

            if (!Array.isArray(target.temporaryEffects)) {
                target.temporaryEffects = [];
            }

            const alreadyApplied = target.temporaryEffects.some((tempEffect: any) => {
                if (tempEffect?.sourceCarduid !== effectEntry.sourceCarduid) {
                    return false;
                }
                const prevention = tempEffect?.preventEffectDamage;
                if (!prevention || typeof prevention !== 'object') {
                    return false;
                }
                return prevention.sourceCardType === sourceCardType
                    && prevention.sourceController === sourceController;
            });

            if (alreadyApplied) {
                continue;
            }

            const tempEffect = TemporaryEffectFactory.createEffectDamagePrevention(
                gameEnv,
                effectEntry.sourcePlayerId,
                effectEntry.sourceCarduid,
                effectEntry.effectData,
                { sourceCardType, sourceController }
            );
            tempEffect.duration = 'CONTINUOUS';
            tempEffect.endOnSourceDestroyed = true;

            target.temporaryEffects.push(tempEffect);
            const owner = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, target.carduid);
            appliedTargets.push({
                carduid: target.carduid,
                zone: target.zone,
                playerId: owner?.found ? owner.playerId : undefined
            });
        }

        if (appliedTargets.length > 0) {
            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.addNotificationEvent(
                'EFFECT_DAMAGE_PREVENTION_GRANTED',
                {
                    playerId: effectEntry.sourcePlayerId,
                    sourceCarduid: effectEntry.sourceCarduid,
                    targets: appliedTargets,
                    sourceCardType,
                    sourceController,
                    duration: effectEntry.effectData.timing?.duration || 'UNTIL_END_OF_TURN',
                    timestamp: Date.now()
                },
                'normal'
            );
        }

        return appliedTargets.length;
    }
}
