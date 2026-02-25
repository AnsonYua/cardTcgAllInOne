const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const { PairingEffectManager } = require('../services/PairingEffectManager');
const gd03 = require('../data/gd03Card.json');

function getLinkedEffect() {
    const card = gd03.cards['GD03-084'];
    return card.effects.rules.find((rule) => rule.effectId === 'linked_effect');
}

describe('GD03-084 linked effect conditional draw', () => {
    test('draws 1 when selected unit has Jupitris trait', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const player = gameEnv.getPlayer('playerId_1');
        player.deck.mainDeck = ['ST01-001_draw_0001'];

        const targetUid = 'GD03-002_target_0001'; // has trait: Jupitris
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: targetUid,
            playAs: 'unit'
        }).success).toBe(true);

        const linkedEffect = getLinkedEffect();
        expect(linkedEffect).toBeTruthy();

        const result = SequenceEffectManager.processSequenceEffect(
            gameEnv,
            'playerId_1',
            'GD03-084_source_0001',
            linkedEffect
        );

        expect(result.success).toBe(true);
        expect(player.deck.handUids).toHaveLength(1);

        const unit = player.zones.slot1.unit;
        expect(unit).toBeTruthy();
        expect(Array.isArray(unit.temporaryEffects)).toBe(true);
        const grantedRepair = unit.temporaryEffects.some((effect) =>
            Array.isArray(effect.grantedKeywords) && effect.grantedKeywords.includes('Repair 2')
        );
        expect(grantedRepair).toBe(true);
    });

    test('does not draw when selected unit is not Jupitris', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const player = gameEnv.getPlayer('playerId_1');
        player.deck.mainDeck = ['ST01-001_draw_0001'];

        const targetUid = 'GD03-001_target_0001'; // no Jupitris trait
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: targetUid,
            playAs: 'unit'
        }).success).toBe(true);

        const linkedEffect = getLinkedEffect();
        const result = SequenceEffectManager.processSequenceEffect(
            gameEnv,
            'playerId_1',
            'GD03-084_source_0002',
            linkedEffect
        );

        expect(result.success).toBe(true);
        expect(player.deck.handUids).toHaveLength(0);
    });

    test('does not draw when linked unit is Jupitris but only other selected unit is not', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const player = gameEnv.getPlayer('playerId_1');
        player.deck.mainDeck = ['ST01-001_draw_0001'];

        const linkedUnitUid = 'GD03-002_linked_0001'; // has trait: Jupitris
        const otherUnitUid = 'GD03-001_other_0001'; // no Jupitris trait
        const pilotUid = 'GD03-084_pilot_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: linkedUnitUid,
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: otherUnitUid,
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            playAs: 'pilot',
            targetUnit: linkedUnitUid
        }).success).toBe(true);

        const pairingEvent = PairingEffectManager.checkForPairingEffectsEvent(
            {
                playerId: 'playerId_1',
                carduid: pilotUid,
                playAs: 'pilot',
                targetUnit: linkedUnitUid
            },
            gameEnv,
            'playerId_1'
        );
        expect(pairingEvent).toBeTruthy();

        const linkedEffect = pairingEvent.data.effects.find((effect) => effect.effectId === 'linked_effect');
        expect(linkedEffect).toBeTruthy();

        const result = PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            effects: [linkedEffect]
        });

        expect(result.success).toBe(true);
        expect(player.deck.handUids).toHaveLength(0);
    });
});
