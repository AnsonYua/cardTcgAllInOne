const gd03 = require('../data/gd03Card.json');
const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { PairingEffectManager } = require('../services/PairingEffectManager');
const { AllowAttackTargetPermissionResolver } = require('../services/attack/AllowAttackTargetPermissionResolver');
const { BaseAbilityManager } = require('../services/effects/BaseAbilityManager');
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
            effectsRules: [activateEffect]
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
            effectsRules: [activateEffect]
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
});
