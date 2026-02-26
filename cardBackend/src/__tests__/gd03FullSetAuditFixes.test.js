const gd03 = require('../data/gd03Card.json');
const gd02 = require('../data/gd02Card.json');
const st01 = require('../data/st01Card.json');
const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { PairingEffectManager } = require('../services/PairingEffectManager');
const { AllowAttackTargetPermissionResolver } = require('../services/attack/AllowAttackTargetPermissionResolver');
const { BaseAbilityManager } = require('../services/effects/BaseAbilityManager');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const { BlockerEffectManager } = require('../services/effects/BlockerEffectManager');
const { SlotCardStateUtils } = require('../services/conditions/SlotCardStateUtils');
const { EffectConditionEvaluator } = require('../services/conditions/EffectConditionEvaluator');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const { UnitDeployService } = require('../services/deploy/UnitDeployService');
const { EventType } = require('../models/GameEnums');
const { createUnitZoneCard, createPilotZoneCard, findUnit, findSlotByUnit } = require('./helpers/zoneCardFactory');

describe('GD03 full-set audit fixes', () => {
    test('card data contains fixed rules for GD03-017/052/053/073/097', () => {
        const gd03017 = gd03.cards['GD03-017'];
        const pairedRule = gd03017.effects.rules.find((rule) => rule.effectId === 'paired_cyclops_allow_attack_target_active_enemy_ap_le_5');
        expect(pairedRule).toBeTruthy();
        expect(pairedRule.trigger).toBe('PAIRING_COMPLETE');
        expect(pairedRule.action).toBe('sequence');
        expect(pairedRule.conditions).toEqual(expect.arrayContaining([{ type: 'pairedPilotTrait', scope: 'source', value: 'Cyclops Team' }]));

        const gd03052 = gd03.cards['GD03-052'];
        expect(gd03052.effects.description).toHaveLength(2);
        expect(gd03052.effects.rules).toHaveLength(2);
        const battleDamageRule = gd03052.effects.rules.find((rule) => rule.effectId === 'battle_damage_destroy_if_cb_pilot_in_play');
        expect(battleDamageRule).toBeTruthy();
        expect(battleDamageRule.trigger).toBe('BATTLE_DAMAGE_TO_UNIT');
        expect(battleDamageRule.action).toBe('destroy');

        const gd03053 = gd03.cards['GD03-053'];
        const oncePerTurnPairRule = gd03053.effects.rules.find((rule) => rule.effectId === 'during_pair_effect');
        expect(oncePerTurnPairRule).toBeTruthy();
        expect(oncePerTurnPairRule.restrictions).toContain('once_per_turn');

        const gd03067 = gd03.cards['GD03-067'];
        const gd03067Deploy = gd03067.effects.rules.find((rule) => rule.effectId === 'deploy_effect');
        const gd03067ModifyApStep = gd03067Deploy?.parameters?.steps?.[1]?.parameters?.then?.[0];
        expect(gd03067ModifyApStep?.action).toBe('modifyAP');
        expect(gd03067ModifyApStep?.target?.scope).toBe('previous_target');

        const gd03073 = gd03.cards['GD03-073'];
        const linkedActivateRule = gd03073.effects.rules.find((rule) => rule.effectId === 'activate_effect');
        expect(linkedActivateRule).toBeTruthy();
        expect(linkedActivateRule.conditions).toEqual(expect.arrayContaining([{ type: 'isLinked', scope: 'source' }]));

        const gd03097 = gd03.cards['GD03-097'];
        const oncePerTurnLinkRule = gd03097.effects.rules.find((rule) => rule.effectId === 'during_link_effect');
        expect(oncePerTurnLinkRule).toBeTruthy();
        expect(oncePerTurnLinkRule.restrictions).toContain('once_per_turn');
    });

    test('GD03-017 paired effect grants AP<=5 active-target permission to friendly Cyclops units', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const sourceUid = 'GD03-017_source_0001';
        const allyCyclopsUid = 'GD03-020_ally_cyclops_0001';
        const pilotUid = 'GD03-090_pilot_0001';
        const validTargetUid = 'GD03-053_enemy_ap5_0001';
        const invalidTargetUid = 'GD03-073_enemy_ap6_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: sourceUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: allyCyclopsUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: validTargetUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: invalidTargetUid, playAs: 'unit' }).success).toBe(true);

        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: pilotUid,
                playAs: 'pilot',
                targetUnit: sourceUid
            }).success
        ).toBe(true);

        const pairingEvent = PairingEffectManager.checkForPairingEffectsEvent(
            { playerId: 'playerId_1', carduid: pilotUid, playAs: 'pilot', targetUnit: sourceUid },
            gameEnv,
            'playerId_1'
        );
        expect(pairingEvent).toBeTruthy();
        const unitEffect = pairingEvent.data.effects.find((effect) => effect.effectId === 'paired_cyclops_allow_attack_target_active_enemy_ap_le_5');
        expect(unitEffect).toBeTruthy();

        expect(
            PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', {
                carduid: sourceUid,
                effects: [unitEffect]
            }).success
        ).toBe(true);

        const sourceUnit = findUnit(gameEnv, 'playerId_1', sourceUid);
        const allyCyclops = findUnit(gameEnv, 'playerId_1', allyCyclopsUid);
        const validTarget = findUnit(gameEnv, 'playerId_2', validTargetUid);
        const invalidTarget = findUnit(gameEnv, 'playerId_2', invalidTargetUid);

        expect(AllowAttackTargetPermissionResolver.canTargetActiveUnit(gameEnv, sourceUnit, validTarget)).toBe(true);
        expect(AllowAttackTargetPermissionResolver.canTargetActiveUnit(gameEnv, sourceUnit, invalidTarget)).toBe(false);
        expect(AllowAttackTargetPermissionResolver.canTargetActiveUnit(gameEnv, allyCyclops, validTarget)).toBe(true);
        expect(AllowAttackTargetPermissionResolver.canTargetActiveUnit(gameEnv, allyCyclops, invalidTarget)).toBe(false);
    });

    test('GD03-073 activated effect requires linked state', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'ACTION_STEP';

        const activateEffect = gd03.cards['GD03-073'].effects.rules.find((rule) => rule.effectId === 'activate_effect');
        expect(activateEffect).toBeTruthy();

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-073_source_0001',
            cardId: 'GD03-073',
            name: 'Graze Ein',
            ap: 6,
            hp: 4,
            traits: ['Gjallarhorn'],
            link: ['Ein Dalton'],
            effectsRules: [activateEffect],
            zoneExtras: { isRested: true }
        });

        p2.zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_battle_unit_0001',
            cardId: 'ST01-001',
            name: 'Enemy',
            ap: 3,
            hp: 3
        });

        for (let i = 0; i < 6; i++) {
            p1.zones.trashArea.push({
                carduid: `gj_${i}`,
                cardId: `GJ-${i}`,
                cardData: { id: `GJ-${i}`, name: `Gj ${i}`, cardType: 'unit', traits: ['Gjallarhorn'] }
            });
        }

        gameEnv.currentBattle = {
            attackerCarduid: 'enemy_battle_unit_0001',
            targetCarduid: 'GD03-073_source_0001',
            actionType: 'attackUnit'
        };

        const unlinkedResult = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'ability_unlinked_1',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: 'GD03-073_source_0001',
                effectId: 'activate_effect'
            }
        });
        expect(unlinkedResult.success).toBe(false);

        p1.zones.slot1.pilot = createPilotZoneCard({
            carduid: 'pilot_ein_dalton_0001',
            cardId: 'custom-ein-dalton',
            name: 'Ein Dalton'
        });

        const linkedResult = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'ability_linked_1',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: 'GD03-073_source_0001',
                effectId: 'activate_effect'
            }
        });
        expect(linkedResult.success).toBe(true);
    });

    test('GD03-073 activated effect targets only the enemy unit battling source', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'ACTION_STEP';

        const activateEffect = gd03.cards['GD03-073'].effects.rules.find((rule) => rule.effectId === 'activate_effect');
        expect(activateEffect).toBeTruthy();

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-073_source_0001',
            cardId: 'GD03-073',
            name: 'Graze Ein',
            ap: 6,
            hp: 4,
            traits: ['Gjallarhorn'],
            link: ['Ein Dalton'],
            effectsRules: [activateEffect],
            zoneExtras: { isRested: true }
        });
        p1.zones.slot1.pilot = createPilotZoneCard({
            carduid: 'pilot_ein_dalton_0001',
            cardId: 'custom-ein-dalton',
            name: 'Ein Dalton'
        });

        p2.zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_battling_unit_0001',
            cardId: 'ST01-001',
            name: 'Enemy Battling',
            ap: 5,
            hp: 4
        });
        p2.zones.slot2.unit = createUnitZoneCard({
            carduid: 'enemy_other_unit_0001',
            cardId: 'ST01-002',
            name: 'Enemy Other',
            ap: 4,
            hp: 4
        });

        for (let i = 0; i < 6; i++) {
            p1.zones.trashArea.push({
                carduid: `gj_target_${i}`,
                cardId: `GJ-T-${i}`,
                cardData: { id: `GJ-T-${i}`, name: `Gj ${i}`, cardType: 'unit', traits: ['Gjallarhorn'] }
            });
        }

        gameEnv.currentBattle = {
            attackerCarduid: 'enemy_battling_unit_0001',
            targetCarduid: 'GD03-073_source_0001',
            attackingPlayerId: 'playerId_2',
            defendingPlayerId: 'playerId_1',
            actionType: 'attackUnit',
            status: 'ACTION_STEP'
        };

        const linkedResult = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'ability_linked_targeting_1',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: 'GD03-073_source_0001',
                effectId: 'activate_effect'
            }
        });
        expect(linkedResult.success).toBe(true);

        const battlingUnit = findUnit(gameEnv, 'playerId_2', 'enemy_battling_unit_0001');
        const otherUnit = findUnit(gameEnv, 'playerId_2', 'enemy_other_unit_0001');
        expect(battlingUnit).toBeTruthy();
        expect(otherUnit).toBeTruthy();
        expect(battlingUnit.modifyAP || 0).toBe(-3);
        expect(otherUnit.modifyAP || 0).toBe(0);
    });

    test('GD03-073 activated effect no-ops on shield attack (no battling enemy unit target)', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'ACTION_STEP';

        const activateEffect = gd03.cards['GD03-073'].effects.rules.find((rule) => rule.effectId === 'activate_effect');
        expect(activateEffect).toBeTruthy();

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-073_source_0001',
            cardId: 'GD03-073',
            name: 'Graze Ein',
            ap: 6,
            hp: 4,
            traits: ['Gjallarhorn'],
            link: ['Ein Dalton'],
            effectsRules: [activateEffect]
        });
        p1.zones.slot1.pilot = createPilotZoneCard({
            carduid: 'pilot_ein_dalton_0001',
            cardId: 'custom-ein-dalton',
            name: 'Ein Dalton'
        });

        p2.zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_nonbattle_0001',
            cardId: 'ST01-003',
            name: 'Enemy Nonbattle',
            ap: 5,
            hp: 4
        });

        for (let i = 0; i < 6; i++) {
            p1.zones.trashArea.push({
                carduid: `gj_shield_${i}`,
                cardId: `GJ-S-${i}`,
                cardData: { id: `GJ-S-${i}`, name: `Gj ${i}`, cardType: 'unit', traits: ['Gjallarhorn'] }
            });
        }

        gameEnv.currentBattle = {
            attackerCarduid: 'enemy_nonbattle_0001',
            attackingPlayerId: 'playerId_2',
            defendingPlayerId: 'playerId_1',
            actionType: 'attackShieldArea',
            status: 'ACTION_STEP'
        };

        const result = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'ability_linked_shield_1',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: 'GD03-073_source_0001',
                effectId: 'activate_effect'
            }
        });
        expect(result.success).toBe(true);

        const sourceSlot = findSlotByUnit(gameEnv, 'playerId_1', 'GD03-073_source_0001');
        const enemyUnit = findUnit(gameEnv, 'playerId_2', 'enemy_nonbattle_0001');
        expect(sourceSlot?.unit?.effectUsage?.activate_effect?.lastUsedTurn).toBe(1);
        expect(enemyUnit.modifyAP || 0).toBe(0);
    });

    test('GD03-073 activated effect can be used off-turn during ACTION_STEP when awaiting response target', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 2;
        gameEnv.currentPlayer = 'playerId_2';
        gameEnv.phase = 'ACTION_STEP_PHASE';

        const activateEffect = gd03.cards['GD03-073'].effects.rules.find((rule) => rule.effectId === 'activate_effect');
        expect(activateEffect).toBeTruthy();

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-073_source_0001',
            cardId: 'GD03-073',
            name: 'Graze Ein',
            ap: 6,
            hp: 4,
            traits: ['Gjallarhorn'],
            link: ['Ein Dalton'],
            effectsRules: [activateEffect]
        });
        p1.zones.slot1.pilot = createPilotZoneCard({
            carduid: 'pilot_ein_dalton_0001',
            cardId: 'GD02-118',
            name: 'Ein Dalton'
        });

        p2.zones.slot2.unit = createUnitZoneCard({
            carduid: 'enemy_battling_unit_0001',
            cardId: 'GD03-068',
            name: 'Gundam Hajiroboshi',
            ap: 3,
            hp: 3,
            zoneExtras: { isRested: true }
        });

        for (let i = 0; i < 6; i++) {
            p1.zones.trashArea.push({
                carduid: `gj_offturn_${i}`,
                cardId: `GJ-OFF-${i}`,
                cardData: { id: `GJ-OFF-${i}`, name: `Gj ${i}`, cardType: 'unit', traits: ['Gjallarhorn'] }
            });
        }

        gameEnv.currentBattle = {
            attackerCarduid: 'enemy_battling_unit_0001',
            targetCarduid: 'GD03-073_source_0001',
            attackingPlayerId: 'playerId_2',
            defendingPlayerId: 'playerId_1',
            targetPlayerId: 'playerId_1',
            actionType: 'attackUnit',
            status: 'ACTION_STEP',
            openedAt: Date.now(),
            confirmations: {
                playerId_2: false,
                playerId_1: false
            },
            actionTargets: {
                playerId_2: [],
                playerId_1: [
                    {
                        carduid: 'GD03-073_source_0001',
                        cardId: 'GD03-073',
                        cardName: 'Graze Ein',
                        cardType: 'unit',
                        location: 'slot1',
                        zoneType: 'unit',
                        effectIds: ['activate_effect']
                    }
                ]
            }
        };

        const result = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'ability_off_turn_action_step_1',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: 'GD03-073_source_0001',
                effectId: 'activate_effect'
            }
        });

        const enemyUnit = findUnit(gameEnv, 'playerId_2', 'enemy_battling_unit_0001');
        expect(enemyUnit.modifyAP || 0).toBe(-3);
        expect(result.success || (result.error || '').includes('Target unit must be rested')).toBe(true);
    });

    test('command card played as pilot links via designate_pilot pilotName even when playedAs flag is missing', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');

        const st01004 = st01.cards['ST01-004'];
        const st01012 = st01.cards['ST01-012'];
        expect(st01004).toBeTruthy();
        expect(st01012).toBeTruthy();

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'ST01-004_unit_0001',
            cardId: 'ST01-004',
            name: st01004.name,
            ap: st01004.ap,
            hp: st01004.hp,
            traits: st01004.traits,
            link: st01004.link,
            cardDataExtras: { effects: st01004.effects }
        });

        p1.zones.slot1.pilot = {
            carduid: 'ST01-012_pilot_0001',
            cardId: 'ST01-012',
            // Intentionally omit playedAs to reproduce runtime payloads that lack this flag.
            isRested: false,
            isFirstPlay: false,
            cardData: st01012
        };

        expect(SlotCardStateUtils.isCardLinked(gameEnv, 'ST01-004_unit_0001')).toBe(true);
        expect(SlotCardStateUtils.isCardLinked(gameEnv, 'ST01-012_pilot_0001')).toBe(true);
    });

    test('GD03-071 deploy modifyAP valuePer scales by AEUG unit cards in trash', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        const gd03071 = gd03.cards['GD03-071'];
        expect(gd03071).toBeTruthy();

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-071_source_0001',
            cardId: 'GD03-071',
            name: gd03071.name,
            ap: gd03071.ap,
            hp: gd03071.hp,
            traits: gd03071.traits,
            link: gd03071.link,
            cardDataExtras: { effects: gd03071.effects }
        });

        p2.zones.slot2.unit = createUnitZoneCard({
            carduid: 'enemy_target_0001',
            cardId: 'ST01-001',
            name: 'Enemy Target',
            ap: 6,
            hp: 5
        });

        p1.zones.trashArea.push(
            { carduid: 'aeug_unit_1', cardId: 'X1', cardData: { id: 'X1', name: 'AEUG 1', cardType: 'unit', traits: ['AEUG'] } },
            { carduid: 'aeug_unit_2', cardId: 'X2', cardData: { id: 'X2', name: 'AEUG 2', cardType: 'unit', traits: ['AEUG'] } },
            { carduid: 'aeug_command_1', cardId: 'X3', cardData: { id: 'X3', name: 'AEUG Cmd', cardType: 'command', traits: ['AEUG'] } },
            { carduid: 'non_aeug_unit_1', cardId: 'X4', cardData: { id: 'X4', name: 'Other Unit', cardType: 'unit', traits: ['Titans'] } }
        );

        const deployRule = gd03071.effects.rules.find((rule) => rule.effectId === 'deploy_effect');
        const modifyStep = deployRule?.parameters?.steps?.find((step) => step.action === 'modifyAP');
        expect(modifyStep).toBeTruthy();

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            modifyStep,
            [{ carduid: 'enemy_target_0001', playerId: 'playerId_2', zone: 'slot2', type: 'unit' }],
            'playerId_1',
            'GD03-071_source_0001'
        );

        expect(result.success).toBe(true);

        const enemyTarget = findUnit(gameEnv, 'playerId_2', 'enemy_target_0001');
        expect(enemyTarget.modifyAP || 0).toBe(-2);
    });

    test('GD03-068 native blocker is available only while a friendly base is in play', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const hajiroboshi = createUnitZoneCard({
            carduid: 'GD03-068_friendly_0001',
            cardId: 'GD03-068',
            cardDataExtras: gd03.cards['GD03-068']
        });
        hajiroboshi.isRested = false;
        gameEnv.getPlayer('playerId_1').zones.slot1.unit = hajiroboshi;

        const beforeBase = BlockerEffectManager.getAvailableBlockerTargets(gameEnv, 'playerId_1');
        expect(beforeBase.some((entry) => entry.carduid === 'GD03-068_friendly_0001')).toBe(false);

        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: 'GD03-123_base_0001',
                playAs: 'base'
            }).success
        ).toBe(true);

        const afterBase = BlockerEffectManager.getAvailableBlockerTargets(gameEnv, 'playerId_1');
        expect(afterBase.some((entry) => entry.carduid === 'GD03-068_friendly_0001')).toBe(true);
    });

    test('GD03-069 linked end-turn reactive continuous effect sets the unit active', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-069_unit_0001',
            cardId: 'GD03-069',
            name: gd03.cards['GD03-069'].name,
            ap: gd03.cards['GD03-069'].ap,
            hp: gd03.cards['GD03-069'].hp,
            traits: gd03.cards['GD03-069'].traits,
            link: gd03.cards['GD03-069'].link,
            cardDataExtras: { effects: gd03.cards['GD03-069'].effects },
            zoneExtras: { isRested: true }
        });
        p1.zones.slot1.pilot = createPilotZoneCard({
            carduid: 'GD03-098_pilot_0001',
            cardId: 'GD03-098',
            name: gd03.cards['GD03-098'].name,
            ap: gd03.cards['GD03-098'].ap,
            hp: gd03.cards['GD03-098'].hp,
            traits: gd03.cards['GD03-098'].traits,
            cardDataExtras: { effects: gd03.cards['GD03-098'].effects }
        });

        expect(SlotCardStateUtils.isCardLinked(gameEnv, 'GD03-069_unit_0001')).toBe(true);
        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        gameEnv.phase = 'END_PHASE';
        gameEnv.processingQueue = [{
            id: 'test_end_turn_event_1',
            type: EventType.TRIGGER_END_OF_TURN_EFFECT,
            status: 'RESOLVING',
            priority: 1,
            timestamp: Date.now(),
            playerId: 'playerId_1',
            data: {
                sourceCarduid: 'GD03-069_unit_0001',
                effect: { effectId: 'noop_end_turn' }
            }
        }];

        const reactiveResult = ContinuousEffectManager.processReactiveContinuousEffects(gameEnv);
        expect(reactiveResult.success).toBe(true);
        expect(p1.zones.slot1.unit.isRested).toBe(false);
    });

    test('GD03-069 end-turn setActive chains into GD03-098 bounce via reactive continuous effects', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-069_unit_0001',
            cardId: 'GD03-069',
            name: gd03.cards['GD03-069'].name,
            ap: gd03.cards['GD03-069'].ap,
            hp: gd03.cards['GD03-069'].hp,
            traits: gd03.cards['GD03-069'].traits,
            link: gd03.cards['GD03-069'].link,
            cardDataExtras: { effects: gd03.cards['GD03-069'].effects },
            zoneExtras: { isRested: true }
        });
        p1.zones.slot1.pilot = createPilotZoneCard({
            carduid: 'GD03-098_pilot_0001',
            cardId: 'GD03-098',
            name: gd03.cards['GD03-098'].name,
            ap: gd03.cards['GD03-098'].ap,
            hp: gd03.cards['GD03-098'].hp,
            traits: gd03.cards['GD03-098'].traits,
            cardDataExtras: { effects: gd03.cards['GD03-098'].effects }
        });

        p2.zones.slot2.unit = createUnitZoneCard({
            carduid: 'enemy_hp3_unit_0001',
            cardId: 'ST01-001',
            name: 'Enemy HP3',
            ap: 4,
            hp: 3
        });

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        gameEnv.phase = 'END_PHASE';
        gameEnv.processingQueue = [{
            id: 'test_end_turn_event_2',
            type: EventType.TRIGGER_END_OF_TURN_EFFECT,
            status: 'RESOLVING',
            priority: 1,
            timestamp: Date.now(),
            playerId: 'playerId_1',
            data: {
                sourceCarduid: 'GD03-069_unit_0001',
                effect: { effectId: 'noop_end_turn' }
            }
        }];

        const reactiveResult = ContinuousEffectManager.processReactiveContinuousEffects(gameEnv);
        expect(reactiveResult.success).toBe(true);

        expect(p1.zones.slot1.unit.isRested).toBe(false);
        expect(p2.zones.slot2.unit).toBeFalsy();
    });

    test('GD03-069 end-turn reactive effect does not fire when not linked', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-069_unit_0001',
            cardId: 'GD03-069',
            name: gd03.cards['GD03-069'].name,
            ap: gd03.cards['GD03-069'].ap,
            hp: gd03.cards['GD03-069'].hp,
            traits: gd03.cards['GD03-069'].traits,
            link: gd03.cards['GD03-069'].link,
            cardDataExtras: { effects: gd03.cards['GD03-069'].effects },
            zoneExtras: { isRested: true }
        });
        p1.zones.slot1.pilot = createPilotZoneCard({
            carduid: 'wrong_pilot_0001',
            cardId: 'custom-wrong-pilot',
            name: 'Wrong Pilot'
        });

        expect(SlotCardStateUtils.isCardLinked(gameEnv, 'GD03-069_unit_0001')).toBe(false);
        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        gameEnv.phase = 'END_PHASE';
        gameEnv.processingQueue = [{
            id: 'test_end_turn_event_3',
            type: EventType.TRIGGER_END_OF_TURN_EFFECT,
            status: 'RESOLVING',
            priority: 1,
            timestamp: Date.now(),
            playerId: 'playerId_1',
            data: {
                sourceCarduid: 'GD03-069_unit_0001',
                effect: { effectId: 'noop_end_turn' }
            }
        }];

        const reactiveResult = ContinuousEffectManager.processReactiveContinuousEffects(gameEnv);
        expect(reactiveResult.success).toBe(true);
        expect(p1.zones.slot1.unit.isRested).toBe(true);
    });

    test('GD03-062 deploy effect deals 2 damage only when deployed from trash', () => {
        const gd03062 = gd03.cards['GD03-062'];
        expect(gd03062).toBeTruthy();

        const runDeploy = (fromZone) => {
            const gameEnv = new GameEnvironment();
            const p1 = gameEnv.addPlayer('playerId_1', 'P1');
            const p2 = gameEnv.addPlayer('playerId_2', 'P2');
            const sourceCarduid = `GD03-062_source_${fromZone}`;

            p2.zones.slot2.unit = createUnitZoneCard({
                carduid: 'enemy_ap4_target_0001',
                cardId: 'ST01-001',
                name: 'Enemy AP4',
                ap: 4,
                hp: 5
            });

            const result = UnitDeployService.deployUnitCardToSlot(gameEnv, {
                playerId: 'playerId_1',
                destinationSlot: 'slot1',
                carduid: sourceCarduid,
                cardId: 'GD03-062',
                cardData: gd03062,
                fromZone,
                notificationType: 'TEST_DEPLOY'
            });

            expect(result.success).toBe(true);
            expect(p1.zones.slot1.unit).toBeTruthy();
            expect(p1.zones.slot1.unit.deployedFrom).toBe(fromZone.toLowerCase());

            const deployRule = gd03062.effects.rules.find((rule) => rule.effectId === 'deploy_effect');
            expect(deployRule).toBeTruthy();
            const applyResult = EffectExecutor.applyEffectToTargets(
                gameEnv,
                deployRule,
                [],
                'playerId_1',
                sourceCarduid
            );
            expect(applyResult.success).toBe(true);

            return { gameEnv, enemy: p2.zones.slot2.unit };
        };

        const trashDeploy = runDeploy('trash');
        expect(trashDeploy.enemy.damageReceived || 0).toBe(2);

        const handDeploy = runDeploy('hand');
        expect(handDeploy.enemy.damageReceived || 0).toBe(0);
    });

    test('GD02-091 sourceColor condition works with omitted scope via source-scope defaulting', () => {
        const gd02091 = gd02.cards['GD02-091'];
        const pairRule = gd02091.effects.rules.find((rule) => rule.effectId === 'pair_effect');
        const sourceColorCondition = pairRule?.parameters?.steps?.[0]?.parameters?.if?.find((c) => c.type === 'sourceColor');

        expect(sourceColorCondition).toBeTruthy();
        expect(sourceColorCondition.scope).toBeUndefined();

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const positive = EffectConditionEvaluator.validateEffectConditions(
            { conditions: [sourceColorCondition] },
            gameEnv,
            'playerId_1',
            {
                carduid: 'test_source_red_0001',
                cardData: { color: 'Red' }
            }
        );
        const negative = EffectConditionEvaluator.validateEffectConditions(
            { conditions: [sourceColorCondition] },
            gameEnv,
            'playerId_1',
            {
                carduid: 'test_source_blue_0001',
                cardData: { color: 'Blue' }
            }
        );

        expect(positive).toBe(true);
        expect(negative).toBe(false);
    });

    test('GD03-088 sourceTrait conditional remains compatible after source-scope defaulting', () => {
        const gd03088 = gd03.cards['GD03-088'];
        const duringLinkRule = gd03088.effects.rules.find((rule) => rule.effectId === 'during_link_effect');
        const sourceTraitCondition = duringLinkRule?.parameters?.steps?.[0]?.parameters?.if?.find((c) => c.type === 'sourceTrait');

        expect(sourceTraitCondition).toBeTruthy();
        expect(sourceTraitCondition.scope).toBeUndefined();

        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'age_system_unit_0001',
            cardId: 'custom-age-system',
            name: 'AGE Unit',
            traits: ['AGE System'],
            ap: 4,
            hp: 4
        });

        const conditionMet = EffectConditionEvaluator.validateEffectConditions(
            { conditions: [sourceTraitCondition] },
            gameEnv,
            'playerId_1',
            p1.zones.slot1.unit
        );

        expect(conditionMet).toBe(true);
    });
});
