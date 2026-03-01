const { GameEnvironment } = require('../models/GameEnvironment');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');
const gd02 = require('../data/gd02Card.json');
const { EventType } = require('../models/GameEnums');

function createBase(carduid, hp = 6) {
    return {
        carduid,
        cardId: 'TEST-BASE',
        cardData: {
            id: 'TEST-BASE',
            name: 'Test Base',
            cardType: 'base',
            hp,
            effects: { rules: [] }
        },
        originalHP: hp,
        damageReceived: 0,
        isRested: false,
        temporaryEffects: []
    };
}

function createShield(carduid) {
    return {
        carduid,
        cardId: 'TEST-SHIELD',
        cardData: {
            id: 'TEST-SHIELD',
            name: 'Test Shield',
            cardType: 'command',
            effects: { rules: [] }
        }
    };
}

function setupGame() {
    const gameEnv = new GameEnvironment();
    const p1 = gameEnv.addPlayer('playerId_1', 'P1');
    const p2 = gameEnv.addPlayer('playerId_2', 'P2');

    gameEnv.currentTurn = 1;
    gameEnv.currentPlayer = 'playerId_1';
    gameEnv.phase = 'ACTION_STEP';

    const sourceEffect = gd02.cards['GD02-011'].effects.rules.find((rule) => rule.effectId === 'activate_effect');
    expect(sourceEffect).toBeTruthy();

    p1.zones.slot1.unit = createUnitZoneCard({
        carduid: 'GD02-011_source_0001',
        cardId: 'GD02-011',
        name: 'Moebius (Peacemaker Team)',
        ap: 0,
        hp: 1,
        effectsRules: [sourceEffect],
        cardDataExtras: {
            color: 'Blue',
            level: 4,
            cost: 2,
            zone: ['Space'],
            traits: ['Earth Alliance']
        },
        zoneExtras: {
            placedAt: 0,
            placedBy: 'playerId_1',
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            isFirstPlay: false
        }
    });

    gameEnv.setCurrentBattle({
        actionType: 'attackShieldArea',
        attackingPlayerId: 'playerId_1',
        defendingPlayerId: 'playerId_2',
        attackerCarduid: 'GD02-011_source_0001',
        targetPlayerId: 'playerId_2',
        status: 'ACTION_STEP',
        openedAt: Date.now()
    });

    return { gameEnv, p1, p2, sourceEffect };
}

describe('GD02-011 activate effect targeting regression', () => {
    test('targets enemy base in battle context even when defender has shields', () => {
        const { gameEnv, p1, p2, sourceEffect } = setupGame();
        p2.zones.base.push(createBase('defender_base_0001', 6));
        p2.zones.shieldArea.push(createShield('defender_shield_0001'));

        const result = SequenceEffectManager.processSequenceEffect(
            gameEnv,
            'playerId_1',
            'GD02-011_source_0001',
            sourceEffect
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);

        expect(p1.zones.slot1.unit).toBeFalsy();
        expect(p1.zones.trashArea.some((card) => card.carduid === 'GD02-011_source_0001')).toBe(true);
        expect(p2.zones.base).toHaveLength(0);
        expect(p2.zones.shieldArea).toHaveLength(1);
    });

    test('targets top battling shield when no enemy base is in play (no player choice)', () => {
        const { gameEnv, p1, p2, sourceEffect } = setupGame();
        p2.zones.shieldArea.push(createShield('defender_shield_0001'));
        p2.zones.shieldArea.push(createShield('defender_shield_0002'));

        const result = SequenceEffectManager.processSequenceEffect(
            gameEnv,
            'playerId_1',
            'GD02-011_source_0001',
            sourceEffect
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);

        expect(p1.zones.slot1.unit).toBeFalsy();
        expect(p1.zones.trashArea.some((card) => card.carduid === 'GD02-011_source_0001')).toBe(true);

        const shieldAttackEvents = gameEnv.processingQueue.filter((evt) => evt.type === EventType.SHIELD_CARD_ATTACKED);
        expect(shieldAttackEvents).toHaveLength(1);
        expect(shieldAttackEvents[0].data.defendingPlayerId).toBe('playerId_2');
        expect(shieldAttackEvents[0].data.shieldCards[0].carduid).toBe('defender_shield_0001');
        expect(shieldAttackEvents[0].data.shieldCards).toHaveLength(1);
        expect(shieldAttackEvents[0].data.attackPower).toBe(6);
    });
});
