const { GameEnvironment } = require('../models/GameEnvironment');
const { CardDatabaseManager } = require('../models/CardSystem');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const { EffectConditionEvaluator } = require('../services/conditions/EffectConditionEvaluator');
const { EffectSourceConditionEvaluator } = require('../services/conditions/EffectSourceConditionEvaluator');
const { TargetResolver } = require('../services/targets/TargetResolver');
const { createPilotZoneCard, createUnitZoneCard } = require('./helpers/zoneCardFactory');

function addTrashCard(player, cardId, suffix, extras = {}) {
    const cardData = CardDatabaseManager.getCardDetails(cardId);
    const carduid = `${cardId}_${suffix}`;
    player.zones.trashArea.push({
        carduid,
        cardId,
        cardData,
        ...extras
    });
    return carduid;
}

function addCustomTrashCard(player, carduid, cardData, extras = {}) {
    player.zones.trashArea.push({
        carduid,
        cardId: cardData.id,
        cardData,
        ...extras
    });
}

describe('ST09 runtime support', () => {
    test('ST09-001 sequence returns self to deck bottom and deploys the matching trash unit', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const sourceUid = 'ST09-001_runtime_0001';
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: sourceUid,
                playAs: 'unit'
            }).success
        ).toBe(true);

        const deployUid = addTrashCard(player, 'ST09-002', 'runtime_0001');
        const effect = CardDatabaseManager.getCardDetails('ST09-001').effects.rules[0];

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            effect,
            [],
            'playerId_1',
            sourceUid
        );

        expect(result.success).toBe(true);
        expect(player.zones.slot1.unit.carduid).toBe(deployUid);
        expect(player.zones.trashArea.some((card) => card.carduid === deployUid)).toBe(false);
        expect(player.deck.mainDeck[player.deck.mainDeck.length - 1]).toBe(sourceUid);
    });

    test('ST09-002 excludes Force Impulse Gundam from valid trash targets', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const excludedUid = addTrashCard(player, 'ST09-002', 'excluded_0001');
        const validUid = addTrashCard(player, 'ST09-006', 'valid_0001');
        const effect = CardDatabaseManager.getCardDetails('ST09-002').effects.rules[0];
        const targetConfig = TargetResolver.resolveTargetConfig(effect);

        const targets = TargetResolver.generateAvailableTargets(
            gameEnv,
            'playerId_1',
            targetConfig,
            'ST09-002_source_0001'
        );

        expect(targets.map((target) => target.carduid)).toEqual([validUid]);
        expect(targets.map((target) => target.carduid)).not.toContain(excludedUid);

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            effect,
            targets,
            'playerId_1',
            'ST09-002_source_0001'
        );

        expect(result.success).toBe(true);
        expect(player.zones.trashArea.some((card) => card.carduid === validUid)).toBe(false);
        expect(player.zones.trashArea.some((card) => card.carduid === excludedUid)).toBe(true);
        expect(player.deck.handUids).toContain(validUid);
    });

    test('ST09-003 requires five purple trash cards before the linked damage rule applies', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        const opponent = gameEnv.addPlayer('playerId_2', 'P2');

        const sourceUid = 'ST09-003_runtime_0001';
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: sourceUid,
                playAs: 'unit'
            }).success
        ).toBe(true);

        player.zones.slot1.pilot = createPilotZoneCard({
            carduid: 'ATHRUN_RUNTIME_0001',
            cardId: 'ATHRUN-RUNTIME-1',
            name: 'Athrun Runtime',
            traits: ['Athrun Zala']
        });

        player.zones.slot2.unit = createUnitZoneCard({
            carduid: 'ALLY_WEAK_0001',
            cardId: 'ALLY-WEAK-1',
            name: 'Ally Weak',
            ap: 5,
            hp: 4
        });
        opponent.zones.slot1.unit = createUnitZoneCard({
            carduid: 'ENEMY_WEAK_0001',
            cardId: 'ENEMY-WEAK-1',
            name: 'Enemy Weak',
            ap: 4,
            hp: 4
        });
        opponent.zones.slot2.unit = createUnitZoneCard({
            carduid: 'ENEMY_BIG_0001',
            cardId: 'ENEMY-BIG-1',
            name: 'Enemy Big',
            ap: 6,
            hp: 4
        });

        for (let i = 0; i < 4; i++) {
            addTrashCard(player, 'ST09-001', `purple_${i}`);
        }
        addCustomTrashCard(player, 'CUSTOM_RED_0001', {
            id: 'CUSTOM-RED-1',
            name: 'Custom Red Card',
            cardType: 'command',
            color: 'Red',
            traits: []
        });

        const sourceUnit = player.zones.slot1.unit;
        const effect = CardDatabaseManager.getCardDetails('ST09-003').effects.rules[1];

        expect(
            EffectSourceConditionEvaluator.sourceConditionsMet(effect, sourceUnit, gameEnv, 'playerId_1')
        ).toBe(true);
        expect(
            EffectConditionEvaluator.validateEffectConditions(effect, gameEnv, 'playerId_1', sourceUnit)
        ).toBe(false);

        addTrashCard(player, 'ST09-002', 'purple_4');

        expect(
            EffectConditionEvaluator.validateEffectConditions(effect, gameEnv, 'playerId_1', sourceUnit)
        ).toBe(true);

        const targets = TargetResolver.generateAvailableTargets(
            gameEnv,
            'playerId_1',
            TargetResolver.resolveTargetConfig(effect),
            sourceUid
        );

        expect(targets.map((target) => target.carduid).sort()).toEqual([
            'ALLY_WEAK_0001',
            'ENEMY_WEAK_0001'
        ].sort());

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            effect,
            targets,
            'playerId_1',
            sourceUid
        );

        expect(result.success).toBe(true);
        expect(player.zones.slot1.unit.damageReceived).toBe(0);
        expect(player.zones.slot2.unit.damageReceived).toBe(2);
        expect(opponent.zones.slot1.unit.damageReceived).toBe(2);
        expect(opponent.zones.slot2.unit.damageReceived).toBe(0);
    });
});
