const { GameEnvironment } = require('../models/GameEnvironment');
const { CardDatabaseManager } = require('../models/CardSystem');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { ConditionEvaluators } = require('../services/conditions/ConditionEvaluators');
const { TrashConditionUtils } = require('../services/conditions/TrashConditionUtils');
const { matchesSingleTutorFilter } = require('../services/effects/tutorTopDeck/TutorTopDeckFilterUtils');
const { SlotExitCoordinator } = require('../services/zones/SlotExitCoordinator');

describe('runtime name alias matching', () => {
    test('unitsInPlayWithFilter nameIncludes matches runtime aliases', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const unitUid = 'GD01-001_alias_name_filter_unit_0001';
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: unitUid, playAs: 'unit' }).success
        ).toBe(true);

        const unit = gameEnv.getPlayer('playerId_1').zones.slot1.unit;
        unit.nameAliases = ['Alias Gundam'];

        const matches = ConditionEvaluators.unitsInPlayWithFilter(
            gameEnv,
            'playerId_1',
            { nameIncludes: 'alias gundam' },
            '>=1'
        );
        expect(matches).toBe(true);
    });

    test('trash nameIncludes matching uses runtime aliases', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const carduid = 'GD01-001_alias_trash_unit_0001';
        const player = gameEnv.getPlayer('playerId_1');
        const cardData = CardDatabaseManager.getCardDetails('GD01-001');
        player.zones.trashArea.push({
            carduid,
            cardId: 'GD01-001',
            cardData,
            nameAliases: ['RX Alias']
        });

        const count = TrashConditionUtils.countMatching(gameEnv, 'playerId_1', {
            nameIncludes: 'rx alias'
        });

        expect(count).toBe(1);
    });

    test('tutor nameContainsAny supports alias-aware matching when aliases are provided', () => {
        const cardData = {
            cardType: 'pilot',
            color: 'Blue',
            traits: ['AEUG'],
            name: 'Quattro Bajeena'
        };

        const matches = matchesSingleTutorFilter(
            cardData,
            {
                nameContainsAny: ['char aznable']
            },
            ['Char Aznable']
        );

        expect(matches).toBe(true);
    });

    test('cardData set_name_alias rule is recognized even without runtime nameAliases', () => {
        const cardData = CardDatabaseManager.getCardDetails('GD02-098');
        const matches = matchesSingleTutorFilter(
            cardData,
            {
                nameContainsAny: ['char aznable']
            }
        );

        expect(matches).toBe(true);
    });

    test('slot-to-trash transfer preserves runtime nameAliases', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const unitUid = 'GD01-001_alias_transfer_unit_0001';
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: unitUid, playAs: 'unit' }).success
        ).toBe(true);

        const player = gameEnv.getPlayer('playerId_1');
        player.zones.slot1.unit.nameAliases = ['Persisted Alias'];

        const moved = SlotExitCoordinator.moveTargetToTrash(
            gameEnv,
            'playerId_1',
            'slot1',
            'unit'
        );

        expect(moved.success).toBe(true);
        expect(Array.isArray(player.zones.trashArea)).toBe(true);
        expect(player.zones.trashArea.length).toBe(1);
        expect(player.zones.trashArea[0].nameAliases).toContain('Persisted Alias');
    });
});
