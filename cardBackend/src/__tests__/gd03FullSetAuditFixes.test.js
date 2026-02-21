const gd03 = require('../data/gd03Card.json');
const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { PairingEffectManager } = require('../services/PairingEffectManager');
const { AllowAttackTargetPermissionResolver } = require('../services/attack/AllowAttackTargetPermissionResolver');
const { BaseAbilityManager } = require('../services/effects/BaseAbilityManager');

function findUnit(gameEnv, playerId, carduid) {
    const player = gameEnv.getPlayer(playerId);
    for (let i = 1; i <= 6; i++) {
        const slot = player?.zones?.[`slot${i}`];
        if (slot?.unit?.carduid === carduid) {
            return slot.unit;
        }
    }
    return null;
}

describe('GD03 full-set audit fixes', () => {
    test('card data contains fixed rules for GD03-017/053/073/097', () => {
        const gd03017 = gd03.cards['GD03-017'];
        const pairedRule = gd03017.effects.rules.find((rule) => rule.effectId === 'paired_cyclops_allow_attack_target_active_enemy_ap_le_5');
        expect(pairedRule).toBeTruthy();
        expect(pairedRule.trigger).toBe('PAIRING_COMPLETE');
        expect(pairedRule.action).toBe('sequence');
        expect(pairedRule.conditions).toEqual(expect.arrayContaining([{ type: 'pairedPilotTrait', scope: 'source', value: 'Cyclops Team' }]));

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

        p1.zones.slot1.unit = {
            carduid: 'GD03-073_source_0001',
            cardId: 'GD03-073',
            isRested: false,
            damageReceived: 0,
            modifyAP: 0,
            modifyHP: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            temporaryEffects: [],
            effectUsage: {},
            cardData: {
                id: 'GD03-073',
                name: 'Graze Ein',
                cardType: 'unit',
                traits: ['Gjallarhorn'],
                link: ['Ein Dalton'],
                ap: 6,
                hp: 4,
                effects: { description: [], rules: [activateEffect] }
            }
        };

        p2.zones.slot1.unit = {
            carduid: 'enemy_battle_unit_0001',
            cardId: 'ST01-001',
            isRested: false,
            damageReceived: 0,
            modifyAP: 0,
            modifyHP: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            temporaryEffects: [],
            effectUsage: {},
            cardData: { id: 'ST01-001', name: 'Enemy', cardType: 'unit', ap: 3, hp: 3, effects: { description: [], rules: [] } }
        };

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

        p1.zones.slot1.pilot = {
            carduid: 'pilot_ein_dalton_0001',
            cardId: 'custom-ein-dalton',
            playedAs: 'pilot',
            isRested: false,
            damageReceived: 0,
            modifyAP: 0,
            modifyHP: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            temporaryEffects: [],
            effectUsage: {},
            cardData: {
                id: 'custom-ein-dalton',
                name: 'Ein Dalton',
                cardType: 'pilot',
                traits: [],
                ap: 1,
                hp: 1,
                effects: { description: [], rules: [] }
            }
        };

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
});
