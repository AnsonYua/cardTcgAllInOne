const gd01 = require('../data/gd01Card.json');
const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { TargetResolver } = require('../services/targets/TargetResolver');
const { EventConditionEvaluator } = require('../services/conditions/EventConditionEvaluator');
const { BaseAbilityManager } = require('../services/effects/BaseAbilityManager');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const { CardPlayExecutor } = require('../services/CardPlayExecutor');

describe('GD01 audit fixes', () => {
    test('card data includes fixed linked/keyword rule mappings', () => {
        const gd01006 = gd01.cards['GD01-006'];
        const hpRule = gd01006.effects.rules.find((rule) => rule.effectId === 'during_link_hp_plus_1');
        expect(hpRule).toBeTruthy();
        expect(hpRule.action).toBe('modifyHP');
        expect(hpRule.sourceConditions).toEqual(expect.arrayContaining([{ type: 'linked' }]));

        const gd01014 = gd01.cards['GD01-014'];
        const healRule = gd01014.effects.rules.find((rule) => rule.effectId === 'activate_heal');
        expect(healRule).toBeTruthy();
        expect(healRule.sourceConditions).toEqual(expect.arrayContaining([{ type: 'linked' }]));

        const gd01032 = gd01.cards['GD01-032'];
        const destroyRule = gd01032.effects.rules.find((rule) => rule.effectId === 'pair_destroy_blocker_low_level');
        expect(destroyRule).toBeTruthy();
        expect(destroyRule.target.filters.keywords).toContain('Blocker');
        expect(destroyRule.parameters?.requiresKeyword).toBeUndefined();

        const gd01094 = gd01.cards['GD01-094'];
        const drawRule = gd01094.effects.rules.find((rule) => rule.effectId === 'linked_battle_destroy_draw_once_per_turn');
        expect(drawRule).toBeTruthy();
        expect(drawRule.trigger).toBe('BATTLE_DESTROY');
        expect(drawRule.restrictions).toContain('once_per_turn');

        const gd01095 = gd01.cards['GD01-095'];
        const linkedRule = gd01095.effects.rules.find((rule) => rule.effectId === 'linked_discard_then_draw');
        expect(linkedRule).toBeTruthy();
        expect(linkedRule.trigger).toBe('PAIRING_COMPLETE');
        expect(linkedRule.action).toBe('sequence');
        expect(linkedRule.sourceConditions).toEqual(expect.arrayContaining([{ type: 'linked' }]));

        const gd01002 = gd01.cards['GD01-002'];
        const replacementRule = gd01002.effects.rules.find((rule) => rule.effectId === 'play_destroy_linked_unicorn_mode_lv5_as_zero');
        expect(replacementRule).toBeTruthy();
        expect(replacementRule.action).toBe('replace_cost');

        const gd01046 = gd01.cards['GD01-046'];
        const supportTrigger = gd01046.effects.rules.find((rule) => rule.effectId === 'support_ap_up_zaft_set_self_active_once_per_turn');
        expect(supportTrigger).toBeTruthy();
        expect(supportTrigger.trigger).toBe('SUPPORT_AP_INCREASED');
        expect(supportTrigger.restrictions).toContain('once_per_turn');

        const gd01090 = gd01.cards['GD01-090'];
        const apReductionPreventRule = gd01090.effects.rules.find((rule) => rule.effectId === 'during_link_prevent_enemy_ap_reduction');
        expect(apReductionPreventRule).toBeTruthy();
        expect(apReductionPreventRule.action).toBe('prevent_ap_reduction');
    });

    test('GD01-032 target resolution includes only blocker units for pair destroy effect', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const sourceUid = 'GD01-032_source_0001';
        const blockerUid = 'ST01-009_enemy_blocker_0001';
        const nonBlockerUid = 'GD01-007_enemy_nonblocker_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: sourceUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: blockerUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: nonBlockerUid, playAs: 'unit' }).success).toBe(true);

        const destroyRule = gd01.cards['GD01-032'].effects.rules.find((rule) => rule.effectId === 'pair_destroy_blocker_low_level');
        const targetConfig = TargetResolver.resolveTargetConfig(destroyRule);
        const targets = TargetResolver.generateAvailableTargets(gameEnv, 'playerId_1', targetConfig, sourceUid);

        const targetUids = targets.map((target) => target.carduid);
        expect(targetUids).toContain(blockerUid);
        expect(targetUids).not.toContain(nonBlockerUid);
    });

    test('eventTargetLinkStatus condition recognizes linked vs unlinked battle target', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const linkedUnitUid = 'GD01-046_unit_linked_0001';
        const linkedPilotUid = 'GD01-095_pilot_linked_0001';
        const unlinkedUnitUid = 'GD01-046_unit_unlinked_0001';
        const unlinkedPilotUid = 'GD01-087_pilot_unlinked_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: linkedUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: linkedPilotUid,
                playAs: 'pilot',
                targetUnit: linkedUnitUid
            }).success
        ).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: unlinkedUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: unlinkedPilotUid,
                playAs: 'pilot',
                targetUnit: unlinkedUnitUid
            }).success
        ).toBe(true);

        gameEnv.currentBattle = {
            attackerCarduid: 'attacker_uid_0001',
            targetCarduid: linkedUnitUid,
            actionType: 'attackUnit'
        };

        expect(EventConditionEvaluator.eventTargetLinkStatus(gameEnv, { value: 'linked' })).toBe(true);
        expect(EventConditionEvaluator.eventTargetLinkStatus(gameEnv, { value: 'unlinked' })).toBe(false);

        gameEnv.currentBattle = {
            attackerCarduid: 'attacker_uid_0001',
            targetCarduid: unlinkedUnitUid,
            actionType: 'attackUnit'
        };

        expect(EventConditionEvaluator.eventTargetLinkStatus(gameEnv, { value: 'linked' })).toBe(false);
        expect(EventConditionEvaluator.eventTargetLinkStatus(gameEnv, { value: 'unlinked' })).toBe(true);
    });

    test('GD01-002 can auto-apply linked unicorn replacement to play at 0 cost when energy is insufficient', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        const unicornModeUid = 'GD01-005_unit_0001';
        const banagherUid = 'GD01-088_pilot_0001';
        const destroyModeUid = 'GD01-002_unit_0001';
        p1.deck._handUids = [destroyModeUid];

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: unicornModeUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: banagherUid,
                playAs: 'pilot',
                targetUnit: unicornModeUid
            }).success
        ).toBe(true);

        const result = CardPlayExecutor.execute(
            {
                id: 'play_evt_1',
                type: 'PLAY_CARD',
                status: 'DECLARED',
                priority: 1,
                playerId: 'playerId_1',
                timestamp: Date.now(),
                data: {
                    carduid: destroyModeUid,
                    playAs: 'unit',
                    playerId: 'playerId_1'
                }
            },
            gameEnv
        );

        expect(result.success).toBe(true);
        expect(p1.deck.handUids).not.toContain(destroyModeUid);
        expect(p1.zones.trashArea.map((card) => card.carduid)).toEqual(
            expect.arrayContaining([unicornModeUid, banagherUid])
        );
        const deployedUids = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
            .map((slot) => p1.zones[slot]?.unit?.carduid)
            .filter(Boolean);
        expect(deployedUids).toContain(destroyModeUid);
    });

    test('GD01-046 support trigger sets source active once per turn when boosting ZAFT unit AP', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        const sourceUid = 'GD01-046_unit_0001';
        const targetUid = 'GD01-046_unit_0002';
        const coordinatorUid = 'GD01-095_pilot_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: sourceUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: targetUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: coordinatorUid,
                playAs: 'pilot',
                targetUnit: sourceUid
            }).success
        ).toBe(true);

        const first = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'ability_evt_1',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: sourceUid,
                effectId: 'activate_support_3',
                targetCarduid: targetUid
            }
        });
        expect(first.success).toBe(true);

        const sourceSlot = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
            .find((slot) => gameEnv.players.playerId_1.zones[slot]?.unit?.carduid === sourceUid);
        const targetSlot = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
            .find((slot) => gameEnv.players.playerId_1.zones[slot]?.unit?.carduid === targetUid);
        expect(sourceSlot).toBeTruthy();
        expect(targetSlot).toBeTruthy();
        expect(gameEnv.players.playerId_1.zones[sourceSlot].unit.isRested).toBe(false);
        expect(gameEnv.players.playerId_1.zones[targetSlot].unit.modifyAP || 0).toBe(3);

        const second = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'ability_evt_2',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: sourceUid,
                effectId: 'activate_support_3',
                targetCarduid: targetUid
            }
        });
        expect(second.success).toBe(true);
        expect(gameEnv.players.playerId_1.zones[sourceSlot].unit.isRested).toBe(true);
        expect(gameEnv.players.playerId_1.zones[targetSlot].unit.modifyAP || 0).toBe(6);
    });

    test('GD01-090 linked unit prevents AP reduction from enemy effects only', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const protectedUnitUid = 'GD01-033_unit_0001';
        const duoUid = 'GD01-090_pilot_0001';
        const enemySourceUid = 'GD01-047_unit_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: protectedUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: duoUid,
                playAs: 'pilot',
                targetUnit: protectedUnitUid
            }).success
        ).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: enemySourceUid, playAs: 'unit' }).success).toBe(true);

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        const targetRef = {
            carduid: protectedUnitUid,
            zone: 'slot1',
            playerId: 'playerId_1'
        };

        const enemyApDown = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'enemy_ap_down',
                action: 'modifyAP',
                parameters: { value: -2 }
            },
            [targetRef],
            'playerId_2',
            enemySourceUid
        );
        expect(enemyApDown.success).toBe(true);
        expect(gameEnv.players.playerId_1.zones.slot1.unit.modifyAP || 0).toBe(0);

        const selfApDown = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'self_ap_down',
                action: 'modifyAP',
                parameters: { value: -2 }
            },
            [targetRef],
            'playerId_1',
            protectedUnitUid
        );
        expect(selfApDown.success).toBe(true);
        expect(gameEnv.players.playerId_1.zones.slot1.unit.modifyAP || 0).toBe(-2);
    });
});
