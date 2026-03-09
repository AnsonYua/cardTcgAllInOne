const { GameEnvironment } = require('../models/GameEnvironment');
const { CardDatabaseManager, createZoneCard } = require('../models/CardSystem');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const st02 = require('../data/st02Card.json');

function countUnitsInSlots(player) {
    return ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
        .filter((slot) => player.zones[slot] && player.zones[slot].unit)
        .length;
}

describe('ST02-016 (Corsica Base) turn gate on conditional token branches', () => {
    test('does not deploy tokens on opponent turn even when cardInTrash condition is satisfied', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const owner = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentPlayer = 'playerId_1';

        owner.zones.shieldArea = [
            {
                carduid: 'ST02-001_shield_0001',
                cardId: 'ST02-001',
                cardData: CardDatabaseManager.getCardDetails('ST02-001')
            }
        ];

        owner.zones.trashArea.push(
            createZoneCard('ST02-016_trash_0001', 'ST02-016', CardDatabaseManager.getCardDetails('ST02-016'), owner.id)
        );

        const effect = st02.cards['ST02-016'].effects.rules.find(
            (rule) => rule.effectId === 'deploy_shield_then_conditional_token' && rule.timing?.eventTrigger === 'ENTERS_PLAY'
        );

        const beforeUnits = countUnitsInSlots(owner);
        const result = SequenceEffectManager.processSequenceEffect(gameEnv, owner.id, 'ST02-016_SRC', effect);

        expect(result.success).toBe(true);
        expect(owner.deck.handUids).toContain('ST02-001_shield_0001');
        expect(countUnitsInSlots(owner)).toBe(beforeUnits);
    });
});
