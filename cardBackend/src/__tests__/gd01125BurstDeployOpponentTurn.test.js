const { GameEnvironment } = require('../models/GameEnvironment');
const { CardDatabaseManager } = require('../models/CardSystem');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const gd01 = require('../data/gd01Card.json');

function getEligibleZeonUnitCardId() {
    const cards = Object.values(CardDatabaseManager.getAllCards());
    const match = cards.find((card) =>
        card &&
        card.cardType === 'unit' &&
        Array.isArray(card.traits) &&
        card.traits.includes('Zeon') &&
        typeof card.level === 'number' &&
        card.level <= 4
    );

    if (!match) {
        throw new Error('No eligible Zeon unit card found for GD01-125 test');
    }

    return match.id;
}

function countUnitsInSlots(player) {
    return ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
        .filter((slot) => player.zones[slot] && player.zones[slot].unit)
        .length;
}

describe('GD01-125 (Zanzibar) deploy effect turn gating', () => {
    test('on opponent turn, shield add executes but deploy_from_hand step is skipped', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const owner = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentPlayer = 'playerId_1';

        const zeonId = getEligibleZeonUnitCardId();
        const zeonUid = `${zeonId}_hand_0001`;
        owner.deck._handUids = [zeonUid];

        const shieldUid = 'GD01-001_shield_0001';
        owner.zones.shieldArea = [
            {
                carduid: shieldUid,
                cardId: 'GD01-001',
                cardData: CardDatabaseManager.getCardDetails('GD01-001')
            }
        ];

        const deployEffect = gd01.cards['GD01-125'].effects.rules.find(
            (rule) => rule.effectId === 'deploy_shield_to_hand_then_optional_deploy_zeon_unit_le_4_if_your_turn'
        );

        const beforeUnits = countUnitsInSlots(owner);
        const result = SequenceEffectManager.processSequenceEffect(gameEnv, owner.id, 'GD01-125_SRC', deployEffect);

        expect(result.success).toBe(true);
        expect(owner.deck.handUids).toContain(shieldUid);
        expect(owner.deck.handUids).toContain(zeonUid);
        expect(countUnitsInSlots(owner)).toBe(beforeUnits);
    });
});
