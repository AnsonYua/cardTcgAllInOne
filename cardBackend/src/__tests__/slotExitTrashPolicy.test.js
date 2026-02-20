const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');

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
        isRested: false
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

describe('slot exit trash policy', () => {
    test('moving a unit to trash also moves paired pilot', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');

        const unit = createUnit('UNIT_uid_1001', 'TST-UNIT-TRASH');
        const pilot = createPilot('PILOT_uid_1001', 'TST-PILOT-TRASH');
        player.zones.slot1.unit = unit;
        player.zones.slot1.pilot = pilot;

        const success = PlayerCardManager.moveCardToTrashFromSlot(gameEnv, player.id, 'slot1', unit, 'unit');
        expect(success).toBe(true);
        expect(player.zones.slot1.unit).toBeNull();
        expect(player.zones.slot1.pilot).toBeNull();
        expect(player.zones.trashArea.map((card) => card.carduid)).toEqual(
            expect.arrayContaining([unit.carduid, pilot.carduid])
        );
    });

    test('moving only a pilot to trash keeps paired unit in slot', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');

        const unit = createUnit('UNIT_uid_1002', 'TST-UNIT-TRASH-2');
        const pilot = createPilot('PILOT_uid_1002', 'TST-PILOT-TRASH-2');
        player.zones.slot1.unit = unit;
        player.zones.slot1.pilot = pilot;

        const success = PlayerCardManager.moveCardToTrashFromSlot(gameEnv, player.id, 'slot1', pilot, 'pilot');
        expect(success).toBe(true);
        expect(player.zones.slot1.unit).toBeTruthy();
        expect(player.zones.slot1.pilot).toBeNull();
        expect(player.zones.trashArea.map((card) => card.carduid)).toContain(pilot.carduid);
        expect(player.zones.trashArea.map((card) => card.carduid)).not.toContain(unit.carduid);
    });
});
