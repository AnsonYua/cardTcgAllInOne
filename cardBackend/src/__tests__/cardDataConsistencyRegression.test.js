const { GameEnvironment } = require('../models/GameEnvironment');
const { createZoneCard } = require('../models/CardSystem');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
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

    test('GD03-123 deploy_rest: with multiple shields, top shield is the one moved to hand', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = p1.id;

        const sourceUid = 'GD03-123_base_src_000_top';
        p1.zones.base.push(createZoneCard(sourceUid, 'GD03-123', gd03.cards['GD03-123'], p1.id));

        const topShieldUid = 'GD03-001_shield_top_0001';
        const lowerShieldUid = 'GD03-002_shield_lower_0002';
        p1.zones.shieldArea.push(createZoneCard(topShieldUid, 'GD03-001', gd03.cards['GD03-001'], p1.id));
        p1.zones.shieldArea.push(createZoneCard(lowerShieldUid, 'GD03-002', gd03.cards['GD03-002'], p1.id));

        const deployEffect = gd03.cards['GD03-123'].effects.rules.find((rule) => rule.effectId === 'deploy_rest');
        const result = SequenceEffectManager.processSequenceEffect(gameEnv, p1.id, sourceUid, deployEffect);

        expect(result.success).toBe(true);
        expect(p1.deck.handUids).toContain(topShieldUid);
        expect(p1.deck.handUids).not.toContain(lowerShieldUid);
        expect(p1.zones.shieldArea[0].carduid).toBe(lowerShieldUid);
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

    test('GD01-123 deploy_rest: with multiple shields, top shield is the one moved to hand', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = p1.id;

        const sourceUid = 'GD01-123_base_src_top_0001';
        p1.zones.base.push(createZoneCard(sourceUid, 'GD01-123', gd01.cards['GD01-123'], p1.id));

        const topShieldUid = 'GD01-001_shield_top_0001';
        const lowerShieldUid = 'GD01-002_shield_lower_0002';
        p1.zones.shieldArea.push(createZoneCard(topShieldUid, 'GD01-001', gd01.cards['GD01-001'], p1.id));
        p1.zones.shieldArea.push(createZoneCard(lowerShieldUid, 'GD01-002', gd01.cards['GD01-002'], p1.id));

        const deployEffect = gd01.cards['GD01-123'].effects.rules.find((rule) => rule.effectId === 'deploy_rest');
        const result = SequenceEffectManager.processSequenceEffect(gameEnv, p1.id, sourceUid, deployEffect);

        expect(result.success).toBe(true);
        expect(p1.deck.handUids).toContain(topShieldUid);
        expect(p1.deck.handUids).not.toContain(lowerShieldUid);
        expect(p1.zones.shieldArea[0].carduid).toBe(lowerShieldUid);
    });

    test('GD02-075 attack_rest: rule keeps if-you-do sequence semantics (rest base -> AP-2 in battle)', () => {
        const effect = gd02.cards['GD02-075'].effects.rules.find((rule) => rule.effectId === 'attack_rest');
        expect(effect).toBeTruthy();
        expect(effect.action).toBe('sequence');

        const steps = effect.parameters?.steps;
        expect(Array.isArray(steps)).toBe(true);
        expect(steps).toHaveLength(2);

        const restStep = steps[0];
        expect(restStep.stepId).toBe('rest_friendly_base');
        expect(restStep.action).toBe('rest');
        expect(restStep.target).toMatchObject({
            type: 'card',
            scope: 'self_in_play',
            count: 1,
            filters: {
                cardType: 'base',
                isRested: false
            }
        });

        const conditionalStep = steps[1];
        expect(conditionalStep.action).toBe('conditional');
        expect(conditionalStep.parameters?.if).toEqual(
            expect.arrayContaining([{ type: 'stepResolved', stepId: 'rest_friendly_base' }])
        );
        const thenSteps = conditionalStep.parameters?.then;
        expect(Array.isArray(thenSteps)).toBe(true);
        expect(thenSteps[0]).toMatchObject({
            action: 'modifyAP',
            timing: { duration: 'UNTIL_END_OF_BATTLE' },
            target: {
                type: 'unit',
                scope: 'opponent',
                filters: { level: '<=4' },
                count: 1
            },
            parameters: { value: -2 }
        });
    });

    test('GD01-112 rest: rule keeps if-you-do sequence semantics (rest 2 friendly active units -> damage 3)', () => {
        const effect = gd01.cards['GD01-112'].effects.rules.find((rule) => rule.effectId === 'rest');
        expect(effect).toBeTruthy();
        expect(effect.action).toBe('sequence');

        const steps = effect.parameters?.steps;
        expect(Array.isArray(steps)).toBe(true);
        expect(steps).toHaveLength(2);

        const restStep = steps[0];
        expect(restStep.stepId).toBe('rest_two_friendly_units');
        expect(restStep.action).toBe('rest');
        expect(restStep.target).toMatchObject({
            type: 'unit',
            scope: 'self_all_unit',
            count: 2,
            filters: { status: 'active' }
        });

        const conditionalStep = steps[1];
        expect(conditionalStep.action).toBe('conditional');
        expect(conditionalStep.parameters?.if).toEqual(
            expect.arrayContaining([{ type: 'stepResolved', stepId: 'rest_two_friendly_units' }])
        );
        const thenSteps = conditionalStep.parameters?.then;
        expect(Array.isArray(thenSteps)).toBe(true);
        expect(thenSteps[0]).toMatchObject({
            action: 'damage',
            target: {
                type: 'unit',
                scope: 'opponent',
                count: 1
            },
            parameters: { value: 3 }
        });
    });

    test('GD03-039 deploy_rest: rule keeps if-you-do sequence semantics (rest other friendly Clan -> damage 2 to AP<=2 enemy)', () => {
        const effect = gd03.cards['GD03-039'].effects.rules.find((rule) => rule.effectId === 'deploy_rest');
        expect(effect).toBeTruthy();
        expect(effect.action).toBe('sequence');

        const steps = effect.parameters?.steps;
        expect(Array.isArray(steps)).toBe(true);
        expect(steps).toHaveLength(2);

        const restStep = steps[0];
        expect(restStep.stepId).toBe('rest_other_friendly_clan_unit');
        expect(restStep.action).toBe('rest');
        expect(restStep.target).toMatchObject({
            type: 'unit',
            scope: 'self_all_unit',
            count: 1,
            filters: {
                status: 'active',
                traits: ['Clan'],
                excludeSelf: true
            }
        });

        const conditionalStep = steps[1];
        expect(conditionalStep.action).toBe('conditional');
        expect(conditionalStep.parameters?.if).toEqual(
            expect.arrayContaining([{ type: 'stepResolved', stepId: 'rest_other_friendly_clan_unit' }])
        );
        const thenSteps = conditionalStep.parameters?.then;
        expect(Array.isArray(thenSteps)).toBe(true);
        expect(thenSteps[0]).toMatchObject({
            action: 'damage',
            target: {
                type: 'unit',
                scope: 'opponent',
                filters: { ap: '<=2' },
                count: 1
            },
            parameters: { value: 2 }
        });
    });

    test('GD02-120 play_effect: single target choice can select AEUG unit or AEUG base', () => {
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
        const steps = effect.parameters?.steps;
        expect(Array.isArray(steps)).toBe(true);
        expect(steps).toHaveLength(1);
        expect(steps[0].target).toMatchObject({
            type: 'card',
            scope: 'self_unit_or_base',
            filters: {
                traits: ['AEUG'],
                cardTypeAny: ['unit', 'base']
            }
        });

        const result = SequenceEffectManager.processSequenceEffect(gameEnv, p1.id, 'GD02-120_src_0001', effect);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const choice = findFirstPendingTargetChoice(gameEnv);
        expect(choice).toBeTruthy();
        expect(choice.data.availableTargets).toHaveLength(2);

        const baseTarget = choice.data.availableTargets.find((target) => target.zone === 'base');
        expect(baseTarget).toBeTruthy();
        choice.data.selectedTargets = [baseTarget];
        choice.data.userDecisionMade = true;
        const processResult = gameEnv.processEvents();
        expect(processResult.success).toBe(true);

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
        expect(findFirstPendingTargetChoice(gameEnv)).toBeFalsy();

        expect((p1.zones.slot1.unit.damageReceived || 0)).toBe(0);
    });

    test('GD02-021 deploy_effect: optional discard resolves into EX+1 and draw when player is Lv.7+', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = p1.id;
        p1.zones.energyArea = Array.from({ length: 7 }, (_, index) => ({
            cardId: 'energy_basic',
            carduid: `GD02-021_energy_test_0001_${index}`,
            isExtraEnergy: false,
            isRested: false,
            placedAt: 0,
            placedBy: p1.id
        }));

        const sourceUid = 'GD02-021_src_0001';
        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: sourceUid,
            cardId: 'GD02-021',
            cardDataExtras: gd02.cards['GD02-021']
        });

        p1.deck._handUids = ['GD02-021_hand_ef_unit_0001'];
        p1.deck.mainDeck = ['GD02-011_draw_0001'];

        const effect = gd02.cards['GD02-021'].effects.rules.find((rule) => rule.effectId === 'deploy_effect');
        const energyBefore = p1.zones.energyArea.length;
        const handBefore = p1.deck._handUids.length;
        const result = SequenceEffectManager.processSequenceEffect(gameEnv, p1.id, sourceUid, effect);

        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const discardChoice = findFirstPendingTargetChoice(gameEnv);
        expect(discardChoice).toBeTruthy();
        expect(discardChoice.data.availableTargets).toHaveLength(1);
        discardChoice.data.selectedTargets = [discardChoice.data.availableTargets[0]];
        discardChoice.data.userDecisionMade = true;

        const processResult = gameEnv.processEvents();
        expect(processResult.success).toBe(true);
        expect(p1.zones.energyArea.length).toBe(energyBefore + 1);
        expect(p1.deck._handUids.length).toBe(handBefore);
    });

    test('GD02-021 deploy_effect: declining optional discard skips EX and draw', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = p1.id;
        p1.zones.energyArea = Array.from({ length: 7 }, (_, index) => ({
            cardId: 'energy_basic',
            carduid: `GD02-021_energy_test_0002_${index}`,
            isExtraEnergy: false,
            isRested: false,
            placedAt: 0,
            placedBy: p1.id
        }));

        const sourceUid = 'GD02-021_src_0002';
        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: sourceUid,
            cardId: 'GD02-021',
            cardDataExtras: gd02.cards['GD02-021']
        });

        p1.deck._handUids = ['GD02-021_hand_ef_unit_0002'];
        p1.deck.mainDeck = ['GD02-011_draw_0002'];

        const effect = gd02.cards['GD02-021'].effects.rules.find((rule) => rule.effectId === 'deploy_effect');
        const energyBefore = p1.zones.energyArea.length;
        const handBefore = p1.deck._handUids.length;
        const result = SequenceEffectManager.processSequenceEffect(gameEnv, p1.id, sourceUid, effect);

        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const discardChoice = findFirstPendingTargetChoice(gameEnv);
        expect(discardChoice).toBeTruthy();
        discardChoice.data.selectedTargets = [];
        discardChoice.data.userDecisionMade = true;

        const processResult = gameEnv.processEvents();
        expect(processResult.success).toBe(true);
        expect(p1.zones.energyArea.length).toBe(energyBefore);
        expect(p1.deck._handUids.length).toBe(handBefore);
        expect(p1.deck.mainDeck).toContain('GD02-011_draw_0002');
    });

    test('GD03-064 deploy_effect: choose X-Rounder from trash then discard 1', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = p1.id;

        const sourceUid = 'GD03-064_src_0001';
        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: sourceUid,
            cardId: 'GD03-064',
            cardDataExtras: gd03.cards['GD03-064']
        });

        const xRounderTrashUid = 'GD03-095_trash_x_rounder_0001';
        p1.zones.trashArea.push({
            carduid: xRounderTrashUid,
            cardId: 'GD03-095',
            cardData: {
                id: 'GD03-095',
                name: 'X-Rounder Test Card',
                cardType: 'pilot',
                color: 'Purple',
                traits: ['X-Rounder'],
                level: 4,
                cost: 1,
                ap: 1,
                hp: 2,
                effects: { description: [], rules: [] }
            }
        });
        p1.deck.hand = [
            {
                carduid: 'GD03-001_hand_discard_0001',
                cardId: 'GD03-001',
                cardData: gd03.cards['GD03-001']
            }
        ];
        p1.deck.handUids = ['GD03-001_hand_discard_0001'];
        p1.deck._handUids = ['GD03-001_hand_discard_0001'];

        const effect = gd03.cards['GD03-064'].effects.rules.find((rule) => rule.effectId === 'deploy_effect');
        const result = SequenceEffectManager.processSequenceEffect(gameEnv, p1.id, sourceUid, effect);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const addChoice = findFirstPendingTargetChoice(gameEnv);
        expect(addChoice).toBeTruthy();
        expect(addChoice.data.availableTargets.some((target) => target.carduid === xRounderTrashUid)).toBe(true);
        addChoice.data.selectedTargets = [addChoice.data.availableTargets.find((target) => target.carduid === xRounderTrashUid)];
        addChoice.data.userDecisionMade = true;
        expect(gameEnv.processEvents().success).toBe(true);

        const discardChoice = findFirstPendingTargetChoice(gameEnv);
        expect(discardChoice).toBeTruthy();
        expect(discardChoice.data.availableTargets).toHaveLength(2);
        const discardTarget = discardChoice.data.availableTargets.find((target) => target.carduid !== xRounderTrashUid);
        discardChoice.data.selectedTargets = [discardTarget];
        discardChoice.data.userDecisionMade = true;
        expect(gameEnv.processEvents().success).toBe(true);

        expect(p1.zones.trashArea.some((card) => card.carduid === xRounderTrashUid)).toBe(false);
        expect(p1.deck._handUids).toContain(xRounderTrashUid);
    });

    test('GD03-064 deploy_effect: declining trash add skips discard step', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = p1.id;

        const sourceUid = 'GD03-064_src_0002';
        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: sourceUid,
            cardId: 'GD03-064',
            cardDataExtras: gd03.cards['GD03-064']
        });

        const xRounderTrashUid = 'GD03-095_trash_x_rounder_0002';
        p1.zones.trashArea.push({
            carduid: xRounderTrashUid,
            cardId: 'GD03-095',
            cardData: {
                id: 'GD03-095',
                name: 'X-Rounder Test Card',
                cardType: 'pilot',
                color: 'Purple',
                traits: ['X-Rounder'],
                level: 4,
                cost: 1,
                ap: 1,
                hp: 2,
                effects: { description: [], rules: [] }
            }
        });
        p1.deck.hand = [
            {
                carduid: 'GD03-001_hand_discard_0002',
                cardId: 'GD03-001',
                cardData: gd03.cards['GD03-001']
            }
        ];
        p1.deck.handUids = ['GD03-001_hand_discard_0002'];
        p1.deck._handUids = ['GD03-001_hand_discard_0002'];

        const effect = gd03.cards['GD03-064'].effects.rules.find((rule) => rule.effectId === 'deploy_effect');
        const result = SequenceEffectManager.processSequenceEffect(gameEnv, p1.id, sourceUid, effect);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const addChoice = findFirstPendingTargetChoice(gameEnv);
        expect(addChoice).toBeTruthy();
        addChoice.data.selectedTargets = [];
        addChoice.data.userDecisionMade = true;
        expect(gameEnv.processEvents().success).toBe(true);

        const pendingAfter = findFirstPendingTargetChoice(gameEnv);
        expect(pendingAfter).toBeUndefined();
        expect(p1.zones.trashArea.some((card) => card.carduid === xRounderTrashUid)).toBe(true);
        expect(p1.deck._handUids).toEqual(['GD03-001_hand_discard_0002']);
    });
});
