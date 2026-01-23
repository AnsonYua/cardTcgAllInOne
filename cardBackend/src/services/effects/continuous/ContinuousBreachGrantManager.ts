// src/services/effects/continuous/ContinuousBreachGrantManager.ts
// Applies continuous breach grants by attaching a TemporaryEffect to targets.

import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../../utils/EffectNormalizationUtils';
import { TemporaryEffectFactory } from '../TemporaryEffectFactory';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { KeywordNotifier } from '../KeywordNotifier';

export class ContinuousBreachGrantManager {
    static applyToTargets(
        gameEnv: GameEnvironment,
        effectEntry: {
            sourceCarduid: string;
            sourcePlayerId: string;
            effectData: EffectDefinition;
        },
        targets: any[]
    ): number {
        const rawValue = effectEntry.effectData?.parameters?.value;
        const breachValue = typeof rawValue === 'number' ? rawValue : Number(rawValue) || 0;
        if (breachValue <= 0) {
            return 0;
        }

        let appliedCount = 0;
        for (const target of targets) {
            if (this.applyToTarget(gameEnv, effectEntry, target, breachValue)) {
                appliedCount += 1;
            }
        }

        return appliedCount;
    }

    private static applyToTarget(
        gameEnv: GameEnvironment,
        effectEntry: { sourceCarduid: string; sourcePlayerId: string; effectData: EffectDefinition },
        target: any,
        breachValue: number
    ): boolean {
        if (!target?.carduid || typeof target.carduid !== 'string') {
            return false;
        }

        if (!Array.isArray(target.temporaryEffects)) {
            target.temporaryEffects = [];
        }

        const existing = target.temporaryEffects.some((tempEffect: any) => {
            if (tempEffect?.sourceCarduid !== effectEntry.sourceCarduid) {
                return false;
            }
            return typeof tempEffect?.breachValue === 'number' && tempEffect.breachValue === breachValue;
        });
        if (existing) {
            return false;
        }

        const normalized = ensureEffectDefaults(effectEntry.effectData);
        const tempEffect = TemporaryEffectFactory.createGrantedBreach(
            gameEnv,
            effectEntry.sourcePlayerId,
            effectEntry.sourceCarduid,
            normalized,
            breachValue
        );
        tempEffect.duration = 'CONTINUOUS';
        tempEffect.endOnSourceDestroyed = true;
        target.temporaryEffects.push(tempEffect);

        const owner = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, target.carduid);
        const targetPlayerId = owner?.found && owner.playerId ? owner.playerId : effectEntry.sourcePlayerId;

        KeywordNotifier.notifyGranted(gameEnv, {
            playerId: targetPlayerId,
            sourceCarduid: effectEntry.sourceCarduid,
            targetCarduid: target.carduid,
            keyword: 'Breach',
            value: breachValue,
            duration: 'CONTINUOUS'
        });

        return true;
    }
}
