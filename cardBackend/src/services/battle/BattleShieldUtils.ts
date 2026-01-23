import { GameEnvironment } from '../../models/GameEnvironment';
import { UnitZoneCard } from '../../models/CardSystem';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';

export function getShieldCardsToAttack(
    defender: any,
    maxCards: number = 1
): Array<{ carduid: string; cardId: string; cardData: any }> {
    const availableShields = defender.getShieldCards();
    const cardsToAttack: Array<{ carduid: string; cardId: string; cardData: any }> = [];

    for (let i = 0; i < Math.min(maxCards, availableShields.length); i++) {
        const shieldCard = availableShields[i];
        cardsToAttack.push({
            carduid: shieldCard.carduid,
            cardId: shieldCard.cardId,
            cardData: shieldCard.cardData
        });
    }

    return cardsToAttack;
}

export function isShieldDamagePrevented(
    gameEnv: GameEnvironment,
    defendingPlayerId: string,
    attackingUnit: UnitZoneCard
): boolean {
    const attackerLevel = attackingUnit.cardData?.level || 0;
    return isShieldDamagePreventedByAttackerLevel(gameEnv, defendingPlayerId, attackerLevel);
}

export function isShieldDamagePreventedByAttackerLevel(
    gameEnv: GameEnvironment,
    defendingPlayerId: string,
    attackerLevel: number
): boolean {
    const battle = gameEnv.currentBattle;
    if (!battle?.shieldDamagePreventions || battle.shieldDamagePreventions.length === 0) {
        return false;
    }

    return battle.shieldDamagePreventions.some((prevention) => {
        if (prevention.playerId !== defendingPlayerId) {
            return false;
        }
        if (typeof prevention.enemyLevelFilter === 'string' && prevention.enemyLevelFilter.length > 0) {
            return validateComparisonFilter(attackerLevel, prevention.enemyLevelFilter);
        }
        if (typeof prevention.maxEnemyLevel === 'number' && prevention.maxEnemyLevel > 0) {
            return attackerLevel <= prevention.maxEnemyLevel;
        }
        return true;
    });
}
