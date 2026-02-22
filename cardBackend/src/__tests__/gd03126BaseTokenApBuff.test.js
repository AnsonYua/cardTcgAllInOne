const gd03 = require('../data/gd03Card.json');
const { GameEnvironment } = require('../models/GameEnvironment');
const { createZoneCard } = require('../models/CardSystem');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');

describe('GD03-126 (Cyclops Team) burst/deploy/continuous implementation', () => {
    test('card data has 3 description lines and 3 executable rules', () => {
        const card = gd03.cards['GD03-126'];
        expect(card.effects.description).toHaveLength(3);
        expect(card.effects.rules).toHaveLength(3);

        const burstRule = card.effects.rules.find((rule) => rule.effectId === 'burst_effect');
        const deployRule = card.effects.rules.find((rule) => rule.effectId === 'deploy_shield_to_hand');
        const continuousRule = card.effects.rules.find((rule) => rule.effectId === 'opponent_turn_tokens_ap_plus_1');

        expect(burstRule?.trigger).toBe('BURST_CONDITION');
        expect(deployRule?.trigger).toBe('ENTERS_PLAY');
        expect(deployRule?.action).toBe('addToHand');
        expect(continuousRule?.trigger).toBe('continuous');
        expect(continuousRule?.action).toBe('modifyAP');
        expect(continuousRule?.timing?.actionTurn).toBe('OPPONENT_TURN');
        expect(continuousRule?.target?.scope).toBe('self_all_unit');
        expect(continuousRule?.target?.filters?.color).toBe('Token');
    });

    test('deploy effect adds one self shield to hand', () => {
        const gameEnv = new GameEnvironment();
        const owner = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const baseUid = 'GD03-126_base_0001';
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, owner.id, {
                carduid: baseUid,
                playAs: 'base'
            }).success
        ).toBe(true);

        const shieldUid = 'GD03-001_shield_pick_0001';
        owner.zones.shieldArea.push(
            createZoneCard(shieldUid, 'GD03-001', gd03.cards['GD03-001'], owner.id)
        );

        const deployRule = gd03.cards['GD03-126'].effects.rules.find((rule) => rule.effectId === 'deploy_shield_to_hand');
        expect(deployRule).toBeTruthy();

        const result = DeployTargetManager.processEffectWithTargetChoice(gameEnv, owner.id, baseUid, deployRule);
        expect(result.success).toBe(true);
        expect(owner.deck.handUids).toContain(shieldUid);
        expect(owner.zones.shieldArea.some((card) => card.carduid === shieldUid)).toBe(false);
    });

    test('continuous AP+1 applies only to friendly token units during opponent turn', () => {
        const gameEnv = new GameEnvironment();
        const owner = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const baseUid = 'GD03-126_base_0002';
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, owner.id, {
                carduid: baseUid,
                playAs: 'base'
            }).success
        ).toBe(true);

        owner.zones.slot1.unit = createUnitZoneCard({
            carduid: 'friendly_token_unit_0001',
            cardId: 'T-006',
            ap: 2,
            hp: 1,
            cardDataExtras: {
                color: 'Token',
                traits: ['Zeon']
            }
        });

        owner.zones.slot2.unit = createUnitZoneCard({
            carduid: 'friendly_non_token_unit_0001',
            cardId: 'GD03-001',
            ap: 3,
            hp: 3,
            cardDataExtras: {
                color: 'Green',
                traits: ['Zeon']
            }
        });

        gameEnv.currentPlayer = 'playerId_2';
        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        expect(owner.zones.slot1.unit.continueModifyAP || 0).toBe(1);
        expect(owner.zones.slot2.unit.continueModifyAP || 0).toBe(0);

        gameEnv.currentPlayer = owner.id;
        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        expect(owner.zones.slot1.unit.continueModifyAP || 0).toBe(0);
        expect(owner.zones.slot2.unit.continueModifyAP || 0).toBe(0);
    });
});
