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
    const defender = gameEnv.getPlayer(defendingPlayerId);
    const defaultTargets = defender ? getShieldCardsToAttack(defender, 1) : [];
    return areShieldCardsDamagePrevented(gameEnv, defendingPlayerId, attackingUnit, defaultTargets);
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

function isShieldDamagePreventedByTemporaryEffect(
    shieldCard: any,
    attackingUnit: UnitZoneCard
): boolean {
    const tempEffects = Array.isArray(shieldCard?.temporaryEffects) ? shieldCard.temporaryEffects : [];
    if (tempEffects.length === 0) {
        return false;
    }

    const enemyLevel = typeof attackingUnit.cardData?.level === 'number' ? attackingUnit.cardData.level : 0;
    const enemyAp = typeof attackingUnit.cardData?.ap === 'number'
        ? attackingUnit.cardData.ap
        : ((attackingUnit as any).originalAP || 0);
    const enemyHp = Math.max(0, (attackingUnit.cardData?.hp || 0) - ((attackingUnit as any).damageReceived || 0));

    return tempEffects.some((tempEffect: any) => {
        const prevention = tempEffect?.preventBattleDamage;
        if (!prevention || typeof prevention !== 'object') {
            return false;
        }

        const from = typeof prevention.from === 'string' ? prevention.from : undefined;
        if (from && from !== 'enemy_units') {
            return false;
        }

        if (typeof prevention.enemyLevel === 'string' && !validateComparisonFilter(enemyLevel, prevention.enemyLevel)) {
            return false;
        }

        if (typeof prevention.enemyAp === 'string' && !validateComparisonFilter(enemyAp, prevention.enemyAp)) {
            return false;
        } else if (typeof prevention.maxEnemyAp === 'number' && enemyAp > prevention.maxEnemyAp) {
            return false;
        }

        if (typeof prevention.enemyHp === 'string' && !validateComparisonFilter(enemyHp, prevention.enemyHp)) {
            return false;
        }

        if (
            typeof prevention.enemyLevel !== 'string'
            && typeof prevention.enemyAp !== 'string'
            && typeof prevention.enemyHp !== 'string'
            && typeof prevention.maxEnemyAp !== 'number'
            && from !== 'enemy_units'
        ) {
            return false;
        }

        return true;
    });
}

export function areShieldCardsDamagePrevented(
    gameEnv: GameEnvironment,
    defendingPlayerId: string,
    attackingUnit: UnitZoneCard,
    shieldCardsToCheck: Array<{ carduid: string }>
): boolean {
    const attackerLevel = attackingUnit.cardData?.level || 0;
    if (isShieldDamagePreventedByAttackerLevel(gameEnv, defendingPlayerId, attackerLevel)) {
        return true;
    }

    if (!Array.isArray(shieldCardsToCheck) || shieldCardsToCheck.length === 0) {
        return false;
    }

    const defender = gameEnv.getPlayer(defendingPlayerId);
    const shieldArea = Array.isArray(defender?.zones?.shieldArea) ? defender.zones.shieldArea : [];
    if (shieldArea.length === 0) {
        return false;
    }

    return shieldCardsToCheck.every((target) => {
        const shieldCard = shieldArea.find((card: any) => card?.carduid === target.carduid);
        if (!shieldCard) {
            return false;
        }
        return isShieldDamagePreventedByTemporaryEffect(shieldCard, attackingUnit);
    });
}
