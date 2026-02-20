const { GameEnvironment } = require('../models/GameEnvironment');
const { EffectExecutor } = require('../services/effects/EffectExecutor');

function createUnit(carduid, cardId, hp = 3, ap = 2) {
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

function createPilot(carduid, cardId, hp = 1, ap = 1) {
    return {
        carduid,
        cardId,
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'pilot',
            ap,
            hp,
            effects: { rules: [] }
        },
        originalAP: ap,
        originalHP: hp,
        continueModifyAP: 0,
        continueModifyHP: 0,
        effectUsage: {},
        isRested: false
    };
}

function targetRef(carduid, zone, playerId) {
    return { carduid, zone, playerId };
}

describe('returnToHand paired slot policy', () => {
    test('returning a unit returns paired pilot to hand by default', () => {
        const gameEnv = new GameEnvironment();
        const sourcePlayerId = 'playerId_1';
        const targetPlayerId = 'playerId_2';
        gameEnv.addPlayer(sourcePlayerId, 'P1');
        const targetPlayer = gameEnv.addPlayer(targetPlayerId, 'P2');

        const targetUnit = createUnit('ST04-001_unit_0001', 'ST04-001', 4, 4);
        const targetPilot = createPilot('ST04-010_pilot_0001', 'ST04-010', 1, 2);
        targetPlayer.zones.slot1.unit = targetUnit;
        targetPlayer.zones.slot1.pilot = targetPilot;

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            { effectId: 'pair_bounce_low_hp_if_pilot_ge_4', action: 'returnToHand', parameters: {} },
            [targetRef(targetUnit.carduid, 'slot1', targetPlayerId)],
            sourcePlayerId,
            'ST04-001_source_0001'
        );

        expect(result.success).toBe(true);
        expect(targetPlayer.zones.slot1.unit).toBeNull();
        expect(targetPlayer.zones.slot1.pilot).toBeNull();
        expect(targetPlayer.deck.handUids).toEqual(
            expect.arrayContaining([targetUnit.carduid, targetPilot.carduid])
        );

        const returnedEvents = (gameEnv.notificationQueue || []).filter((event) => event.type === 'CARD_RETURNED_TO_HAND');
        expect(returnedEvents.length).toBe(2);
    });

    test('returning a pilot only returns that pilot', () => {
        const gameEnv = new GameEnvironment();
        const sourcePlayerId = 'playerId_1';
        const targetPlayerId = 'playerId_2';
        gameEnv.addPlayer(sourcePlayerId, 'P1');
        const targetPlayer = gameEnv.addPlayer(targetPlayerId, 'P2');

        const targetUnit = createUnit('UNIT_uid_0001', 'TST-UNIT', 3, 3);
        const targetPilot = createPilot('PILOT_uid_0001', 'TST-PILOT', 1, 1);
        targetPlayer.zones.slot1.unit = targetUnit;
        targetPlayer.zones.slot1.pilot = targetPilot;

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            { effectId: 'pilot_only_bounce', action: 'returnToHand', parameters: {} },
            [targetRef(targetPilot.carduid, 'slot1', targetPlayerId)],
            sourcePlayerId,
            'TST_SOURCE_0001'
        );

        expect(result.success).toBe(true);
        expect(targetPlayer.zones.slot1.unit).toBeTruthy();
        expect(targetPlayer.zones.slot1.pilot).toBeNull();
        expect(targetPlayer.deck.handUids).toContain(targetPilot.carduid);
        expect(targetPlayer.deck.handUids).not.toContain(targetUnit.carduid);
    });

    test('unit return can opt out of paired pilot transfer via parameter override', () => {
        const gameEnv = new GameEnvironment();
        const sourcePlayerId = 'playerId_1';
        const targetPlayerId = 'playerId_2';
        gameEnv.addPlayer(sourcePlayerId, 'P1');
        const targetPlayer = gameEnv.addPlayer(targetPlayerId, 'P2');

        const targetUnit = createUnit('UNIT_uid_0002', 'TST-UNIT-2', 3, 3);
        const targetPilot = createPilot('PILOT_uid_0002', 'TST-PILOT-2', 1, 1);
        targetPlayer.zones.slot1.unit = targetUnit;
        targetPlayer.zones.slot1.pilot = targetPilot;

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'unit_only_bounce_override',
                action: 'returnToHand',
                parameters: { returnPairedPilotWithUnit: false }
            },
            [targetRef(targetUnit.carduid, 'slot1', targetPlayerId)],
            sourcePlayerId,
            'TST_SOURCE_0002'
        );

        expect(result.success).toBe(true);
        expect(targetPlayer.zones.slot1.unit).toBeNull();
        expect(targetPlayer.zones.slot1.pilot).toBeTruthy();
        expect(targetPlayer.deck.handUids).toContain(targetUnit.carduid);
        expect(targetPlayer.deck.handUids).not.toContain(targetPilot.carduid);
    });
});
