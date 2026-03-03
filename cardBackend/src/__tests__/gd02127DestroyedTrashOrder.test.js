const { GameEnvironment } = require('../models/GameEnvironment');
const { BaseLifecycleManager } = require('../services/BaseLifecycleManager');
const { CardDatabaseManager, createZoneCard } = require('../models/CardSystem');

describe('GD02-127 destroyed effect trash ordering', () => {
    test('moves base to trash before destroyed mill resolves', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const owner = gameEnv.getPlayer('playerId_2');
        owner.zones.trashArea = [];
        owner.zones.base = [];
        owner.deck.mainDeck = [
            'GD01-001_p2_top_0001',
            'GD01-002_p2_top_0002',
            'GD01-003_p2_top_0003'
        ];

        const baseCardData = CardDatabaseManager.getCardDetails('GD02-127');
        const baseUid = 'GD02-127_base_p2_0001';
        const baseCard = createZoneCard(baseUid, 'GD02-127', baseCardData, 'playerId_2');
        owner.zones.base.push(baseCard);

        BaseLifecycleManager.destroyBase(gameEnv, 'playerId_2', baseCard);

        expect(owner.zones.base).toHaveLength(0);
        expect(owner.deck.mainDeck).toEqual(['GD01-003_p2_top_0003']);
        expect(owner.zones.trashArea.map((card) => card.carduid)).toEqual([
            'GD02-127_base_p2_0001',
            'GD01-001_p2_top_0001',
            'GD01-002_p2_top_0002'
        ]);
    });
});
