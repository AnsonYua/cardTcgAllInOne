const { GameEnvironment } = require('../models/GameEnvironment');
const { createZoneCard } = require('../models/CardSystem');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { EventType } = require('../models/GameEnums');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');

const gd01 = require('../data/gd01Card.json');
const gd02 = require('../data/gd02Card.json');
const gd03 = require('../data/gd03Card.json');

function findFirstPendingTargetChoice(gameEnv) {
    return gameEnv.processingQueue.find((evt) => evt && evt.type === EventType.TARGET_CHOICE);
}

describe('card data consistency regressions', () => {
    test('GD03-123 deploy_rest: shield add always resolves and conditional rest resolves when friendly Jupitris unit exists', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = p1.id;

        const sourceUid = 'GD03-123_base_src_0001';
        p1.zones.base.push(createZoneCard(sourceUid, 'GD03-123', gd03.cards['GD03-123'], p1.id));

        const shieldUid = 'GD03-001_shield_pick_0001';
        p1.zones.shieldArea.push(createZoneCard(shieldUid, 'GD03-001', gd03.cards['GD03-001'], p1.id));

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-003_friendly_jupitris_0001',
            cardId: 'GD03-003',
            traits: ['Titans', 'Jupitris'],
            cardDataExtras: { level: 6 }
        });
        p2.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-007_enemy_lv3_0001',
            cardId: 'GD03-007',
            cardDataExtras: { level: 3 }
        });

        const deployEffect = gd03.cards['GD03-123'].effects.rules.find((rule) => rule.effectId === 'deploy_rest');
        const result = SequenceEffectManager.processSequenceEffect(gameEnv, p1.id, sourceUid, deployEffect);

        expect(result.success).toBe(true);
        expect(p1.deck.handUids).toContain(shieldUid);
        expect(p1.zones.shieldArea.some((card) => card.carduid === shieldUid)).toBe(false);
        expect(p2.zones.slot1.unit.isRested).toBe(true);
    });

    test('GD03-123 deploy_rest: shield add resolves and rest step is skipped when no friendly Jupitris unit exists', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = p1.id;

        const sourceUid = 'GD03-123_base_src_0002';
        p1.zones.base.push(createZoneCard(sourceUid, 'GD03-123', gd03.cards['GD03-123'], p1.id));

        const shieldUid = 'GD03-002_shield_pick_0001';
        p1.zones.shieldArea.push(createZoneCard(shieldUid, 'GD03-002', gd03.cards['GD03-002'], p1.id));

        p2.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-007_enemy_lv3_0002',
            cardId: 'GD03-007',
            cardDataExtras: { level: 3 }
        });

        const deployEffect = gd03.cards['GD03-123'].effects.rules.find((rule) => rule.effectId === 'deploy_rest');
        const result = SequenceEffectManager.processSequenceEffect(gameEnv, p1.id, sourceUid, deployEffect);

        expect(result.success).toBe(true);
        expect(p1.deck.handUids).toContain(shieldUid);
        expect(p1.zones.shieldArea.some((card) => card.carduid === shieldUid)).toBe(false);
        expect(p2.zones.slot1.unit.isRested).toBe(false);
    });

    test('GD01-123 deploy_rest: shield add resolves before enemy hp<=3 rest', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = p1.id;

        const sourceUid = 'GD01-123_base_src_0001';
        p1.zones.base.push(createZoneCard(sourceUid, 'GD01-123', gd01.cards['GD01-123'], p1.id));

        const shieldUid = 'GD01-001_shield_pick_0001';
        p1.zones.shieldArea.push(createZoneCard(shieldUid, 'GD01-001', gd01.cards['GD01-001'], p1.id));

        p2.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD01-010_enemy_hp3_0001',
            cardId: 'GD01-010',
            hp: 3
        });

        const deployEffect = gd01.cards['GD01-123'].effects.rules.find((rule) => rule.effectId === 'deploy_rest');
        const result = SequenceEffectManager.processSequenceEffect(gameEnv, p1.id, sourceUid, deployEffect);

        expect(result.success).toBe(true);
        expect(p1.deck.handUids).toContain(shieldUid);
        expect(p2.zones.slot1.unit.isRested).toBe(true);
    });

    test('GD02-075 attack_rest: opponent unit target resolves with unit typing', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = p1.id;

        const sourceUid = 'GD02-075_src_0001';
        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: sourceUid,
            cardId: 'GD02-075',
            cardDataExtras: { level: 4 }
        });
        p2.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD02-010_enemy_lv4_0001',
            cardId: 'GD02-010',
            cardDataExtras: { level: 4 }
        });

        const effect = gd02.cards['GD02-075'].effects.rules.find((rule) => rule.effectId === 'attack_rest');
        const result = DeployTargetManager.processEffectWithTargetChoice(gameEnv, p1.id, sourceUid, effect);

        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit.isRested).toBe(true);
    });

    test('GD02-120 play_effect: unit path can be declined and base fallback can be selected', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = p1.id;

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD02-071_aeug_unit_0001',
            cardId: 'GD02-071',
            traits: ['AEUG'],
            zoneExtras: { damageReceived: 1 }
        });

        const aeugBase = createZoneCard('GD02-129_aeug_base_0001', 'GD02-129', gd02.cards['GD02-129'], p1.id);
        aeugBase.damageReceived = 2;
        p1.zones.base.push(aeugBase);

        const effect = gd02.cards['GD02-120'].effects.rules.find((rule) => rule.effectId === 'play_effect');
        const result = SequenceEffectManager.processSequenceEffect(gameEnv, p1.id, 'GD02-120_src_0001', effect);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const firstChoice = findFirstPendingTargetChoice(gameEnv);
        expect(firstChoice).toBeTruthy();
        firstChoice.data.selectedTargets = [];
        firstChoice.data.userDecisionMade = true;
        const firstProcess = gameEnv.processEvents();
        expect(firstProcess.success).toBe(true);

        const secondChoice = findFirstPendingTargetChoice(gameEnv);
        expect(secondChoice).toBeTruthy();
        expect(secondChoice.id).not.toBe(firstChoice.id);
        const baseTarget = secondChoice.data.availableTargets.find((target) => target.zone === 'base');
        expect(baseTarget).toBeTruthy();
        secondChoice.data.selectedTargets = [baseTarget];
        secondChoice.data.userDecisionMade = true;
        const secondProcess = gameEnv.processEvents();
        expect(secondProcess.success).toBe(true);

        expect((p1.zones.slot1.unit.damageReceived || 0)).toBe(1);
        expect((p1.zones.base[0].damageReceived || 0)).toBe(0);
    });

    test('GD02-120 play_effect: selecting AEUG unit heals 2 HP', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = p1.id;

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD02-071_aeug_unit_0002',
            cardId: 'GD02-071',
            traits: ['AEUG'],
            zoneExtras: { damageReceived: 2 }
        });

        const effect = gd02.cards['GD02-120'].effects.rules.find((rule) => rule.effectId === 'play_effect');
        const result = SequenceEffectManager.processSequenceEffect(gameEnv, p1.id, 'GD02-120_src_0002', effect);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const choice = findFirstPendingTargetChoice(gameEnv);
        expect(choice).toBeTruthy();
        expect(choice.data.availableTargets).toHaveLength(1);
        choice.data.selectedTargets = [choice.data.availableTargets[0]];
        choice.data.userDecisionMade = true;
        const processResult = gameEnv.processEvents();
        expect(processResult.success).toBe(true);

        expect((p1.zones.slot1.unit.damageReceived || 0)).toBe(0);
    });
});
