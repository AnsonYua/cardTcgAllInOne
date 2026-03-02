const { GameEnvironment } = require('../models/GameEnvironment');
const { EventStatus } = require('../services/EventQueue/interfaces/GameEvent');
const { EventFactory } = require('../services/EventQueue/EventFactory');
const { BurstEffectManager } = require('../services/BurstEffectManager');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const { getSlotTotals } = require('../utils/FieldValueCalculator');
const gd02 = require('../data/gd02Card.json');

function createUnit(carduid, cardId, cardData) {
    return {
        carduid,
        cardId,
        cardData,
        originalAP: cardData.ap || 0,
        originalHP: cardData.hp || 0,
        continueModifyAP: 0,
        continueModifyHP: 0,
        modifyAP: 0,
        modifyHP: 0,
        temporaryEffects: [],
        damageReceived: 0,
        effectUsage: {},
        isRested: false,
    };
}

function createPilot(carduid, cardId, cardData) {
    return {
        carduid,
        cardId,
        cardData,
        originalAP: cardData.ap || 0,
        originalHP: cardData.hp || 0,
        continueModifyAP: 0,
        continueModifyHP: 0,
        modifyAP: 0,
        modifyHP: 0,
        temporaryEffects: [],
        effectUsage: {},
        isRested: false,
    };
}

describe('GD02-086 Jerid Messa continuous AP boost', () => {
    test('grants paired unit AP+1 only while another Titans unit is in play', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const owner = gameEnv.addPlayer('playerId_2', 'P2');

        const barzam = gd02.cards['GD02-016']; // Titans unit (AP 3)
        const jerid = gd02.cards['GD02-086']; // Titans pilot
        const anotherTitans = gd02.cards['GD02-014']; // Titans unit

        owner.zones.slot1.unit = createUnit('GD02-016_unit_0001', 'GD02-016', barzam);
        owner.zones.slot1.pilot = createPilot('GD02-086_pilot_0001', 'GD02-086', jerid);

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        expect(owner.zones.slot1.unit.continueModifyAP || 0).toBe(0);

        owner.zones.slot2.unit = createUnit('GD02-014_unit_0001', 'GD02-014', anotherTitans);
        ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        expect(owner.zones.slot1.unit.continueModifyAP || 0).toBe(1);

        const totals = getSlotTotals(owner.zones.slot1);
        expect(totals.totalAP).toBe(5); // unit 3 + pilot 1 + continuous +1
    });

    test('Burst: adds this card to your hand from shield', () => {
        const gameEnv = new GameEnvironment();
        const attacker = gameEnv.addPlayer('playerId_1', 'P1');
        const defender = gameEnv.addPlayer('playerId_2', 'P2');

        attacker.zones.slot1.unit = createUnit('attacker_unit_0001', 'GD02-016', gd02.cards['GD02-016']);

        const shieldUid = 'GD02-086_shield_0001';
        const shieldCard = {
            carduid: shieldUid,
            cardId: 'GD02-086',
            cardData: gd02.cards['GD02-086'],
        };
        defender.zones.shieldArea.push(shieldCard);

        const attackEvent = EventFactory.createShieldCardAttackedEvent(
            defender.id,
            attacker.id,
            'slot1',
            [shieldCard],
            6
        );
        const result = BurstEffectManager.processShieldCardAttack(attackEvent, gameEnv);
        expect(result.success).toBe(true);

        const burstChoiceEvent = (gameEnv.processingQueue || []).find((evt) => evt.type === 'BURST_EFFECT_CHOICE');
        expect(burstChoiceEvent).toBeTruthy();

        burstChoiceEvent.status = EventStatus.RESOLVING;
        burstChoiceEvent.data.userDecisionMade = true;
        burstChoiceEvent.data.userDecision = 'ACTIVATE';

        const choiceResult = BurstEffectManager.processBurstEffectChoice(burstChoiceEvent, gameEnv);
        expect(choiceResult.success).toBe(true);

        expect(defender.zones.shieldArea.some((card) => card?.carduid === shieldUid)).toBe(false);
        expect(defender.deck.handUids).toContain(shieldUid);
    });
});
