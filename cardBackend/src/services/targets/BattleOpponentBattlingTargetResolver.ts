import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';

export class BattleOpponentBattlingTargetResolver {
    static resolve(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        effect: EffectDefinition
    ): TargetReference[] {
        void effect;

        const battle = gameEnv.currentBattle;
        if (!battle || battle.actionType !== 'attackShieldArea') {
            return [];
        }

        const attackerCarduid = typeof battle.attackerCarduid === 'string' ? battle.attackerCarduid : '';
        if (!sourceCarduid || !attackerCarduid || sourceCarduid !== attackerCarduid) {
            return [];
        }

        const defendingPlayerId =
            typeof battle.defendingPlayerId === 'string'
                ? battle.defendingPlayerId
                : (typeof battle.targetPlayerId === 'string' ? battle.targetPlayerId : '');
        if (!defendingPlayerId) {
            return [];
        }

        const defender = gameEnv.getPlayer(defendingPlayerId);
        if (!defender) {
            return [];
        }

        const baseCards = Array.isArray(defender.zones?.base) ? defender.zones.base : [];
        if (baseCards.length > 0) {
            return baseCards
                .filter((card: any) => typeof card?.carduid === 'string' && card.carduid.length > 0)
                .map((card: any) => ({
                    carduid: card.carduid,
                    zone: 'base',
                    playerId: defendingPlayerId,
                    cardData: card.cardData as Record<string, unknown> | undefined
                }));
        }

        const shieldCards = Array.isArray(defender.zones?.shieldArea) ? defender.zones.shieldArea : [];
        const topShield = shieldCards.find((card: any) => typeof card?.carduid === 'string' && card.carduid.length > 0);
        if (!topShield) {
            return [];
        }

        return [{
            carduid: topShield.carduid,
            zone: 'shield',
            playerId: defendingPlayerId,
            cardData: topShield.cardData as Record<string, unknown> | undefined
        }];
    }
}
