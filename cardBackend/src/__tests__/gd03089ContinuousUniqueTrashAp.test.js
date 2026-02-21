const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');

function findUnit(gameEnv, playerId, carduid) {
    const player = gameEnv.getPlayer(playerId);
    expect(player).toBeTruthy();
    for (let i = 1; i <= 6; i++) {
        const slot = player.zones[`slot${i}`];
        if (slot && slot.unit && slot.unit.carduid === carduid) {
            return slot.unit;
        }
    }
    return null;
}

describe('GD03-089 continuous AP scaling', () => {
    test('grants AP equal to unique Cyclops Team Pilot/Command names in trash', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const unitUid = 'GD03-032_unit_089_0001';
        const pilotUid = 'GD03-089_pilot_089_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: unitUid,
            playAs: 'unit'
        }).success).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            playAs: 'pilot',
            targetUnit: unitUid
        }).success).toBe(true);

        p1.zones.trashArea = [
            { carduid: 'trash_1', cardData: { name: 'Bernard Wiseman', cardType: 'pilot', traits: ['Cyclops Team'] } },
            { carduid: 'trash_2', cardData: { name: 'Bernard Wiseman', cardType: 'pilot', traits: ['Cyclops Team'] } }, // duplicate
            { carduid: 'trash_3', cardData: { name: 'Mikhail Kaminsky', cardType: 'command', traits: ['Cyclops Team'] } },
            { carduid: 'trash_4', cardData: { name: 'Cyclops Unit', cardType: 'unit', traits: ['Cyclops Team'] } }, // wrong type
            { carduid: 'trash_5', cardData: { name: 'Other Pilot', cardType: 'pilot', traits: ['Zeon'] } } // wrong trait
        ];

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        const unit = findUnit(gameEnv, 'playerId_1', unitUid);
        expect(unit).toBeTruthy();
        expect(unit.continueModifyAP).toBe(2);
    });
});
