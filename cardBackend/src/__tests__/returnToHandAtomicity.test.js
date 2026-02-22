const { GameEnvironment } = require('../models/GameEnvironment');
const { EffectExecutor } = require('../services/effects/EffectExecutor');

function createUnit(carduid, cardId, hp = 4, ap = 3) {
    return {
        carduid,
        cardId,
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'unit',
            ap,
            hp,
            effects: { rules: [] }
        },
        originalAP: ap,
        originalHP: hp,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        effectUsage: {},
        isRested: false,
        playedThisTurn: false,
        canAttackOnPlayTurn: false,
        canAttackThisTurn: true
    };
}

describe('returnToHand atomic preflight', () => {
    test('does not partially move cards when any selected target is invalid', () => {
        const gameEnv = new GameEnvironment();
        const sourcePlayerId = 'playerId_1';
        const targetPlayerId = 'playerId_2';

        gameEnv.addPlayer(sourcePlayerId, 'P1');
        const targetPlayer = gameEnv.addPlayer(targetPlayerId, 'P2');

        const unit1 = createUnit('UNIT_ATOMIC_0001', 'ATOMIC-1');
        const unit2 = createUnit('UNIT_ATOMIC_0002', 'ATOMIC-2');
        targetPlayer.zones.slot1.unit = unit1;
        targetPlayer.zones.slot2.unit = unit2;

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'atomic_return',
                action: 'returnToHand',
                target: { type: 'unit', scope: 'opponent', count: 2 }
            },
            [
                { carduid: unit1.carduid, zone: 'slot1', playerId: targetPlayerId },
                { carduid: unit2.carduid, zone: 'slot9', playerId: targetPlayerId }
            ],
            sourcePlayerId,
            'SOURCE_ATOMIC_0001'
        );

        expect(result.success).toBe(false);
        expect(targetPlayer.zones.slot1.unit?.carduid).toBe(unit1.carduid);
        expect(targetPlayer.zones.slot2.unit?.carduid).toBe(unit2.carduid);
        expect(targetPlayer.deck.handUids || []).not.toContain(unit1.carduid);
        expect(targetPlayer.deck.handUids || []).not.toContain(unit2.carduid);
    });
});
