// src/services/effects/actions/EffectKeywordActions.ts

import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { GameNotificationManager } from '../../GameNotificationManager';
import { TargetCardResolver } from '../../targets/TargetCardResolver';
import { TemporaryEffectFactory } from '../TemporaryEffectFactory';

export function applyGrantKeywordEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    const keyword = typeof effect.parameters?.keyword === 'string'
        ? effect.parameters.keyword
        : undefined;

    if (!keyword) {
        return { success: false, error: 'grant_keyword requires parameters.keyword' };
    }

    if (selectedTargets.length === 0) {
        return { success: true };
    }

    for (const target of selectedTargets) {
        const resolved = TargetCardResolver.resolve(gameEnv, target);
        if (!resolved) {
            return { success: false, error: `Target card ${target.carduid} not found for grant_keyword` };
        }

        if (resolved.kind !== 'unit' && resolved.kind !== 'pilot') {
            return { success: false, error: `grant_keyword target zone ${target.zone} is not supported` };
        }

        const targetCard: any = resolved.card;
        if (!Array.isArray(targetCard.temporaryEffects)) {
            targetCard.temporaryEffects = [];
        }

        const tempEffect = TemporaryEffectFactory.createGrantedKeyword(
            gameEnv,
            sourcePlayerId,
            sourceCarduid || 'unknown',
            effect,
            keyword
        );

        targetCard.temporaryEffects.push(tempEffect);

        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent('KEYWORD_GRANTED', {
            playerId: target.playerId,
            sourceCarduid,
            targetCarduid: target.carduid,
            keyword,
            duration: effect.timing?.duration || 'UNTIL_END_OF_TURN',
            timestamp: Date.now()
        }, 'normal');
    }

    return { success: true };
}
