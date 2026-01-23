// src/services/effects/TemporaryEffectFactory.ts
// Centralized builders for TemporaryEffect records.

import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import type { TemporaryEffect } from '../../models/CardSystem';
import type { GameEnvironment } from '../../models/GameEnvironment';

export class TemporaryEffectFactory {
    static createBase(
        gameEnv: GameEnvironment,
        sourcePlayerId: string,
        sourceCarduid: string,
        effect: EffectDefinition
    ): Pick<TemporaryEffect, 'sourceCarduid' | 'duration' | 'appliedTurn' | 'appliedBy' | 'endOnSourceDestroyed'> {
        return {
            sourceCarduid,
            duration: effect.timing?.duration || 'UNTIL_END_OF_TURN',
            appliedTurn: gameEnv.currentTurn,
            appliedBy: sourcePlayerId,
            endOnSourceDestroyed: effect.timing?.endOnSourceDestroyed === true
        };
    }

    static createStatModifier(
        gameEnv: GameEnvironment,
        sourcePlayerId: string,
        sourceCarduid: string,
        effect: EffectDefinition
    ): TemporaryEffect {
        const parameters = effect.parameters || {};
        const parameterValue = parameters['value'];

        return {
            ...this.createBase(gameEnv, sourcePlayerId, sourceCarduid, effect),
            modifyAP: effect.action === 'modifyAP' && typeof parameterValue === 'number' ? parameterValue : undefined,
            modifyHP: effect.action === 'modifyHP' && typeof parameterValue === 'number' ? parameterValue : undefined
        };
    }

    static createGrantedKeyword(
        gameEnv: GameEnvironment,
        sourcePlayerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        keyword: string
    ): TemporaryEffect {
        const value = typeof effect.parameters?.value === 'number' ? effect.parameters.value : undefined;
        return {
            ...this.createBase(gameEnv, sourcePlayerId, sourceCarduid, effect),
            grantedKeywords: [keyword],
            ...(typeof value === 'number' ? { keywordValues: { [keyword]: value } } : {})
        };
    }

    static createGrantedBreach(
        gameEnv: GameEnvironment,
        sourcePlayerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        breachValue: number
    ): TemporaryEffect {
        return {
            ...this.createBase(gameEnv, sourcePlayerId, sourceCarduid, effect),
            breachValue
        };
    }

    static createBattleDamagePrevention(
        gameEnv: GameEnvironment,
        sourcePlayerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        prevention: { from?: string; enemyLevel?: string; maxEnemyAp?: number }
    ): TemporaryEffect {
        return {
            ...this.createBase(gameEnv, sourcePlayerId, sourceCarduid, effect),
            preventBattleDamage: {
                from: prevention.from,
                enemyLevel: prevention.enemyLevel,
                maxEnemyAp: prevention.maxEnemyAp
            }
        };
    }

    static createEffectDamagePrevention(
        gameEnv: GameEnvironment,
        sourcePlayerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        prevention: { sourceCardType?: string; sourceController?: string }
    ): TemporaryEffect {
        return {
            ...this.createBase(gameEnv, sourcePlayerId, sourceCarduid, effect),
            preventEffectDamage: {
                sourceCardType: prevention.sourceCardType,
                sourceController: prevention.sourceController
            }
        };
    }
}
