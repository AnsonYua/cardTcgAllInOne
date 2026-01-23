// src/services/effects/continuous/ContinuousKeywordGrantManager.ts
// Applies continuous keyword grants by attaching a TemporaryEffect to targets.

import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../../utils/EffectNormalizationUtils';
import { TemporaryEffectFactory } from '../TemporaryEffectFactory';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { KeywordNotifier } from '../KeywordNotifier';
import { ContinuousScopeUtils } from './ContinuousScopeUtils';

export class ContinuousKeywordGrantManager {
    static applyToTargets(
        gameEnv: GameEnvironment,
        effectEntry: {
            sourceCarduid: string;
            sourcePlayerId: string;
            effectData: EffectDefinition;
        },
        targets: any[]
    ): number {
        const keyword = typeof effectEntry.effectData?.parameters?.keyword === 'string'
            ? effectEntry.effectData.parameters.keyword
            : undefined;
        const keywordValue = typeof effectEntry.effectData?.parameters?.value === 'number'
            ? effectEntry.effectData.parameters.value
            : undefined;
        if (!keyword) {
            return 0;
        }

        let appliedCount = 0;
        for (const target of targets) {
            if (this.applyToTarget(gameEnv, effectEntry, target, keyword, keywordValue)) {
                appliedCount += 1;
            }
        }
        return appliedCount;
    }

    private static applyToTarget(
        gameEnv: GameEnvironment,
        effectEntry: { sourceCarduid: string; sourcePlayerId: string; effectData: EffectDefinition },
        target: any,
        keyword: string,
        keywordValue?: number
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
            const keywords = Array.isArray(tempEffect?.grantedKeywords) ? tempEffect.grantedKeywords : [];
            const values = tempEffect?.keywordValues && typeof tempEffect.keywordValues === 'object' ? tempEffect.keywordValues : null;
            return keywords.includes(keyword) || (values && typeof values[keyword] === 'number');
        });

        if (existing) {
            return false;
        }

        const normalized = ensureEffectDefaults(effectEntry.effectData);
        const tempEffect = TemporaryEffectFactory.createGrantedKeyword(
            gameEnv,
            effectEntry.sourcePlayerId,
            effectEntry.sourceCarduid,
            normalized,
            keyword
        );
        tempEffect.duration = ContinuousScopeUtils.isBattleScope(effectEntry.effectData?.target?.scope)
            ? 'UNTIL_END_OF_BATTLE'
            : 'CONTINUOUS';
        tempEffect.endOnSourceDestroyed = true;
        target.temporaryEffects.push(tempEffect);

        const owner = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, target.carduid);
        const targetPlayerId = owner?.found && owner.playerId ? owner.playerId : effectEntry.sourcePlayerId;

        KeywordNotifier.notifyGranted(gameEnv, {
            playerId: targetPlayerId,
            sourceCarduid: effectEntry.sourceCarduid,
            targetCarduid: target.carduid,
            keyword,
            ...(typeof keywordValue === 'number' ? { value: keywordValue } : {}),
            duration: tempEffect.duration
        });

        return true;
    }
}
