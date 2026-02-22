const { GameEnvironment } = require('../models/GameEnvironment');
const { EffectExecutor } = require('../services/effects/EffectExecutor');

function createUnit(carduid, cardId, traits = [], level = 4, ap = 3, hp = 4) {
    return {
        carduid,
        cardId,
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'unit',
            ap,
            hp,
            traits,
            level,
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

describe('returnToHand ownership policy matrix', () => {
    test('opponent scope defaults to returning to target owner hand', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p2.zones.slot1.unit = createUnit('OWN_POLICY_0001', 'OWN-POLICY-1');

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'default_owner_policy',
                action: 'returnToHand',
                target: { type: 'unit', scope: 'opponent', count: 1 }
            },
            [{ carduid: 'OWN_POLICY_0001', zone: 'slot1', playerId: 'playerId_2' }],
            'playerId_1',
            'SRC_DEFAULT_0001'
        );

        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit).toBeNull();
        expect(p2.deck.handUids).toContain('OWN_POLICY_0001');
        expect(p1.deck.handUids || []).not.toContain('OWN_POLICY_0001');
    });

    test('policy-aware UID fallback corrects drifted selected target playerId', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p2.zones.slot1.unit = createUnit('OWN_POLICY_0002', 'OWN-POLICY-2');

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'fallback_owner_policy',
                action: 'returnToHand',
                target: { type: 'unit', scope: 'opponent', count: 1 }
            },
            [{ carduid: 'OWN_POLICY_0002', zone: 'slot1', playerId: 'playerId_1' }],
            'playerId_1',
            'SRC_FALLBACK_0001'
        );

        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit).toBeNull();
        expect(p2.deck.handUids).toContain('OWN_POLICY_0002');
        expect(p1.deck.handUids || []).not.toContain('OWN_POLICY_0002');
    });

    test('explicit SOURCE_CONTROLLER policy routes returned card to source hand', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p2.zones.slot1.unit = createUnit('OWN_POLICY_0003', 'OWN-POLICY-3');

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'source_controller_override',
                action: 'returnToHand',
                target: { type: 'unit', scope: 'opponent', count: 1 },
                parameters: { ownershipPolicy: 'SOURCE_CONTROLLER' }
            },
            [{ carduid: 'OWN_POLICY_0003', zone: 'slot1', playerId: 'playerId_2' }],
            'playerId_1',
            'SRC_OVERRIDE_0001'
        );

        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit).toBeNull();
        expect(p1.deck.handUids).toContain('OWN_POLICY_0003');
        expect(p2.deck.handUids || []).not.toContain('OWN_POLICY_0003');
    });
});
