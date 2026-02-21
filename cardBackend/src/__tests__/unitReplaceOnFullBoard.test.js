const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { PlayCardPreparationManager } = require('../services/PlayCardPreparationManager');

function createUnit(carduid, cardId) {
    return {
        carduid,
        cardId,
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'unit',
            ap: 2,
            hp: 3,
            effects: { rules: [] }
        },
        originalAP: 2,
        originalHP: 3,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        effectUsage: {},
        isRested: false
    };
}

function createPilot(carduid, cardId) {
    return {
        carduid,
        cardId,
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'pilot',
            ap: 1,
            hp: 1,
            effects: { rules: [] }
        },
        originalAP: 1,
        originalHP: 1,
        continueModifyAP: 0,
        continueModifyHP: 0,
        effectUsage: {},
        isRested: false
    };
}

function fillBoardWithUnits(player) {
    ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'].forEach((slotName, index) => {
        player.zones[slotName].unit = createUnit(`FULL_${index + 1}`, `FULL-CARD-${index + 1}`);
    });
}

describe('unit play replace-slot on full board', () => {
    test('rejects full board unit play without replaceSlot', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        fillBoardWithUnits(player);

        const result = PlayCardPreparationManager.prepare(
            gameEnv,
            player.id,
            { carduid: 'ST01-001_test_1', playAs: 'unit' },
            true
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('Board is full. Choose a slot to replace.');
    });

    test('rejects invalid replaceSlot value', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        fillBoardWithUnits(player);

        const result = PlayCardPreparationManager.prepare(
            gameEnv,
            player.id,
            { carduid: 'ST01-001_test_2', playAs: 'unit', replaceSlot: 'slot9' },
            true
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid replaceSlot: slot9');
    });

    test('rejects replaceSlot when board is not full', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        player.zones.slot1.unit = createUnit('EXISTING_1', 'EXISTING-CARD-1');

        const result = PlayCardPreparationManager.prepare(
            gameEnv,
            player.id,
            { carduid: 'ST01-001_test_3', playAs: 'unit', replaceSlot: 'slot1' },
            true
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('replaceSlot can only be used when board is full.');
    });

    test('replacing a full slot trashes both existing unit and paired pilot', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        player.zones.slot1.unit = createUnit('OLD_UNIT_UID', 'OLD-UNIT-CARD');
        player.zones.slot1.pilot = createPilot('OLD_PILOT_UID', 'OLD-PILOT-CARD');
        fillBoardWithUnits(player);
        player.zones.slot1.unit = createUnit('OLD_UNIT_UID', 'OLD-UNIT-CARD');

        const placement = PlayerCardManager.placeCardWithEventData(gameEnv, player.id, {
            carduid: 'ST01-001_new_unit',
            playAs: 'unit',
            replaceSlot: 'slot1'
        });

        expect(placement.success).toBe(true);
        expect(placement.placedZone).toBe('slot1');
        expect(player.zones.slot1.unit?.carduid).toBe('ST01-001_new_unit');
        expect(player.zones.slot1.pilot).toBeNull();
        expect(player.zones.trashArea.map((card) => card.carduid)).toEqual(
            expect.arrayContaining(['OLD_UNIT_UID', 'OLD_PILOT_UID'])
        );
    });

    test('replaceSlot must point to a slot that currently has a unit', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');

        const placement = PlayerCardManager.placeCardWithEventData(gameEnv, player.id, {
            carduid: 'ST01-001_new_unit_2',
            playAs: 'unit',
            replaceSlot: 'slot1'
        });

        expect(placement.success).toBe(false);
        expect(placement.error).toBe('replaceSlot must reference an occupied unit slot.');
    });
});
