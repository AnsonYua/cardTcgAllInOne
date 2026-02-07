import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import {
    normalizeSourceConditions,
    type NormalizedSourceCondition
} from '../../utils/EffectNormalizationUtils';
import { SlotCardStateUtils } from './SlotCardStateUtils';

type ZoneCardWithData = {
    carduid: string;
    [key: string]: unknown;
};

export class EffectSourceConditionEvaluator {
    static sourceConditionsMet(
        effectRule: EffectDefinition,
        card: ZoneCardWithData,
        gameEnv: GameEnvironment,
        cardOwnerPlayerId: string | null
    ): boolean {
        const normalizedConditions = normalizeSourceConditions(effectRule.sourceConditions);
        if (normalizedConditions.length === 0) {
            return true;
        }

        for (const condition of normalizedConditions) {
            if (!EffectSourceConditionEvaluator.evaluateSourceCondition(condition, card, gameEnv, cardOwnerPlayerId)) {
                return false;
            }
        }

        return true;
    }

    private static evaluateSourceCondition(
        condition: NormalizedSourceCondition,
        card: ZoneCardWithData,
        gameEnv: GameEnvironment,
        cardOwnerPlayerId: string | null
    ): boolean {
        const type = condition.type || '';

        switch (type) {
            case 'paired':
            case 'isPaired':
                return SlotCardStateUtils.isCardPaired(gameEnv, card.carduid);

            case 'linked':
            case 'isLinked':
                return SlotCardStateUtils.isCardLinked(gameEnv, card.carduid);

            case 'controller': {
                const desired = typeof condition.value === 'string' ? (condition.value as string) : undefined;
                if (!desired) {
                    return true;
                }
                const ownerId = SlotCardStateUtils.findCardOwner(gameEnv, card.carduid);
                if (!ownerId) {
                    return false;
                }
                if (desired === 'self') {
                    return ownerId === cardOwnerPlayerId;
                }
                if (desired === 'opponent') {
                    return cardOwnerPlayerId ? ownerId !== cardOwnerPlayerId : false;
                }
                return ownerId === desired;
            }

            default:
                console.log(`⚠️ Unknown source condition type: ${type}`);
                return true;
        }
    }
}

