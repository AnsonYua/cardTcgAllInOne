const { GameEnvironment } = require('../models/GameEnvironment');
const { CardDatabaseManager, createZoneCard } = require('../models/CardSystem');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const { BurstEffectManager } = require('../services/BurstEffectManager');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { AttackPhaseEffectManager } = require('../services/effects/AttackPhaseEffectManager');
const { PairingEffectManager } = require('../services/PairingEffectManager');
const { EventType } = require('../models/GameEnums');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');
const gd01 = require('../data/gd01Card.json');
const gd02 = require('../data/gd02Card.json');
const st03 = require('../data/st03Card.json');

function runDeployDamageRule({ cardSet, cardId, effectId, setup }) {
    const gameEnv = new GameEnvironment();
    gameEnv.addPlayer('playerId_1', 'P1');
    const opponent = gameEnv.addPlayer('playerId_2', 'P2');
    setup(opponent);

    const effect = cardSet.cards[cardId].effects.rules.find((rule) => rule.effectId === effectId);
    expect(effect).toBeTruthy();

    const result = DeployTargetManager.processEffectWithTargetChoice(
        gameEnv,
        'playerId_1',
        `${cardId}_src_0001`,
        effect
    );
    expect(result.success).toBe(true);
    expect(result.requiresSelection).not.toBe(true);

    return { gameEnv, opponent };
}

describe('Targeted 16-card audit coverage', () => {
    test('GD01-008 deploy damages only rested enemy units', () => {
        const { opponent } = runDeployDamageRule({
            cardSet: gd01,
            cardId: 'GD01-008',
            effectId: 'deploy_damage_1',
            setup: (enemy) => {
                enemy.zones.slot1.unit = createUnitZoneCard({
                    carduid: 'enemy_active_0001',
                    cardId: 'ENEMY-ACTIVE-1',
                    ap: 3,
                    hp: 4
                });
                enemy.zones.slot2.unit = {
                    ...createUnitZoneCard({
                        carduid: 'enemy_rested_0001',
                        cardId: 'ENEMY-RESTED-1',
                        ap: 3,
                        hp: 4
                    }),
                    isRested: true
                };
            }
        });

        expect(opponent.zones.slot1.unit.damageReceived || 0).toBe(0);
        expect(opponent.zones.slot2.unit.damageReceived || 0).toBe(1);
    });

    test('GD01-020 deploy damages only rested enemy units', () => {
        const { opponent } = runDeployDamageRule({
            cardSet: gd01,
            cardId: 'GD01-020',
            effectId: 'deploy_damage_1',
            setup: (enemy) => {
                enemy.zones.slot1.unit = createUnitZoneCard({
                    carduid: 'enemy_active_0002',
                    cardId: 'ENEMY-ACTIVE-2',
                    ap: 2,
                    hp: 3
                });
                enemy.zones.slot2.unit = {
                    ...createUnitZoneCard({
                        carduid: 'enemy_rested_0002',
                        cardId: 'ENEMY-RESTED-2',
                        ap: 2,
                        hp: 3
                    }),
                    isRested: true
                };
            }
        });

        expect(opponent.zones.slot1.unit.damageReceived || 0).toBe(0);
        expect(opponent.zones.slot2.unit.damageReceived || 0).toBe(1);
    });

    test('GD01-052 deploy damages any enemy unit (no rested requirement)', () => {
        const { opponent } = runDeployDamageRule({
            cardSet: gd01,
            cardId: 'GD01-052',
            effectId: 'deploy_damage_1',
            setup: (enemy) => {
                enemy.zones.slot1.unit = createUnitZoneCard({
                    carduid: 'enemy_any_0001',
                    cardId: 'ENEMY-ANY-1',
                    ap: 2,
                    hp: 3
                });
            }
        });

        expect(opponent.zones.slot1.unit.damageReceived || 0).toBe(1);
    });

    test('GD02-046 deploy targets Token-color enemy units only', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const opponent = gameEnv.addPlayer('playerId_2', 'P2');

        opponent.zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_token_0001',
            cardId: 'T-001',
            ap: 1,
            hp: 2,
            cardDataExtras: { color: 'Token' }
        });
        opponent.zones.slot2.unit = createUnitZoneCard({
            carduid: 'enemy_non_token_0001',
            cardId: 'GD01-001',
            ap: 2,
            hp: 3,
            cardDataExtras: { color: 'Blue' }
        });

        const effect = gd02.cards['GD02-046'].effects.rules.find((rule) => rule.effectId === 'deploy_effect');
        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD02-046_src_0001',
            effect
        );
        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);
        expect(opponent.zones.slot1.unit).toBeFalsy();
        expect(opponent.zones.trashArea.some((card) => card.carduid === 'enemy_token_0001')).toBe(true);
        expect(opponent.zones.slot2.unit.damageReceived || 0).toBe(0);
    });

    test('GD01-003 attack cost + sequence sets self active and grants First Strike', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const attackerUid = 'GD01-003_unit_test_0001';
        const pilotUid = 'GD01-093_pilot_test_0001';
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: attackerUid,
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            playAs: 'pilot',
            targetUnit: attackerUid
        }).success).toBe(true);

        const owner = gameEnv.getPlayer('playerId_1');
        for (let i = 0; i < 12; i++) {
            owner.zones.trashArea.push(createZoneCard(
                `GD01-001_trash_${String(i).padStart(4, '0')}`,
                'GD01-001',
                CardDatabaseManager.getCardDetails('GD01-001'),
                owner.id
            ));
        }

        const slot = owner.zones.slot1;
        slot.unit.isRested = true;

        const result = AttackPhaseEffectManager.processAttackPhaseEffects(gameEnv, {
            playerId: 'playerId_1',
            data: {
                playerId: 'playerId_1',
                actionType: 'attackShieldArea',
                attackerCarduid: attackerUid
            }
        });

        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const costChoice = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(costChoice).toBeTruthy();
        costChoice.status = 'RESOLVING';
        costChoice.data.selectedTargets = [...costChoice.data.availableTargets];
        costChoice.data.userDecisionMade = true;
        const choiceResult = DeployTargetManager.executeTargetChoice(costChoice, gameEnv);
        expect(choiceResult.success).toBe(true);

        expect(slot.unit.isRested).toBe(false);
        const hasFirstStrike = Array.isArray(slot.unit.temporaryEffects)
            && slot.unit.temporaryEffects.some((effect) =>
                Array.isArray(effect?.grantedKeywords) && effect.grantedKeywords.includes('First Strike')
            );
        expect(hasFirstStrike).toBe(true);
    });

    test('GD02-036 attack effect damages only damaged enemy units when paired with Neo Zeon pilot', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const enemy = gameEnv.addPlayer('playerId_2', 'P2');

        const attackerUid = 'GD02-036_unit_test_0001';
        const neoZeonPilotUid = 'GD01-093_pilot_test_0001';
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: attackerUid,
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: neoZeonPilotUid,
            playAs: 'pilot',
            targetUnit: attackerUid
        }).success).toBe(true);

        enemy.zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_damaged_0001',
            cardId: 'ENEMY-DAMAGED-1',
            ap: 2,
            hp: 4
        });
        enemy.zones.slot1.unit.damageReceived = 1;
        enemy.zones.slot2.unit = createUnitZoneCard({
            carduid: 'enemy_healthy_0001',
            cardId: 'ENEMY-HEALTHY-1',
            ap: 2,
            hp: 4
        });

        const result = AttackPhaseEffectManager.processAttackPhaseEffects(gameEnv, {
            playerId: 'playerId_1',
            data: {
                playerId: 'playerId_1',
                actionType: 'attackShieldArea',
                attackerCarduid: attackerUid
            }
        });

        expect(result.success).toBe(true);
        expect(enemy.zones.slot1.unit.damageReceived).toBe(3);
        expect(enemy.zones.slot2.unit.damageReceived || 0).toBe(0);
    });

    test('GD01-044 pairing effect produces TARGET_CHOICE with 1..2 selection count', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const enemy = gameEnv.addPlayer('playerId_2', 'P2');

        const unitUid = 'GD01-044_unit_test_0001';
        const pilotUid = 'GD01-093_pilot_test_0002';
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: unitUid,
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            playAs: 'pilot',
            targetUnit: unitUid
        }).success).toBe(true);

        enemy.zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_pair_target_0001',
            cardId: 'ENEMY-PAIR-1',
            ap: 2,
            hp: 3
        });
        enemy.zones.slot2.unit = createUnitZoneCard({
            carduid: 'enemy_pair_target_0002',
            cardId: 'ENEMY-PAIR-2',
            ap: 2,
            hp: 3
        });

        const pairingEvent = PairingEffectManager.checkForPairingEffectsEvent(
            { playerId: 'playerId_1', carduid: pilotUid, playAs: 'pilot', targetUnit: unitUid },
            gameEnv,
            'playerId_1'
        );
        expect(pairingEvent).toBeTruthy();

        const result = PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', pairingEvent.data);
        expect(result.success).toBe(true);

        const targetChoice = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(targetChoice).toBeTruthy();
        expect(targetChoice.data.effect.target.count).toEqual({ min: 1, max: 2 });
    });

    test('ST03-013 burst activate-main executes main_action_damage', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const enemy = gameEnv.addPlayer('playerId_2', 'P2');

        enemy.zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_st03013_target_0001',
            cardId: 'ENEMY-ST03-013',
            ap: 2,
            hp: 4
        });

        const cardData = CardDatabaseManager.getCardDetails('ST03-013');
        const burst = BurstEffectManager.findBurstEffects(cardData).find((effect) => effect.type === 'activate_ability');
        expect(burst).toBeTruthy();

        const result = BurstEffectManager.executeBurstEffect(
            gameEnv,
            'playerId_1',
            'ST03-013_shield_0001',
            cardData,
            burst
        );

        expect(result.success).toBe(true);
        expect(enemy.zones.slot1.unit.damageReceived || 0).toBe(2);
    });

    test('GD01-128 burst deploy enqueues burst PLAY_CARD and deploy effect adds shield to hand', () => {
        const gameEnv = new GameEnvironment();
        const owner = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const cardData = CardDatabaseManager.getCardDetails('GD01-128');
        const burst = BurstEffectManager.findBurstEffects(cardData).find((effect) => effect.type === 'deploy');
        expect(burst).toBeTruthy();

        owner.zones.shieldArea.push({
            carduid: 'GD01-128_shield_0001',
            cardId: 'GD01-128',
            cardData
        });

        const burstResult = BurstEffectManager.executeBurstEffect(
            gameEnv,
            owner.id,
            'GD01-128_shield_0001',
            cardData,
            burst
        );
        expect(burstResult.success).toBe(true);

        const burstDeployEvent = gameEnv.processingQueue.find((event) =>
            event.type === EventType.PLAY_CARD && event.data && event.data.fromBurst === true
        );
        expect(burstDeployEvent).toBeTruthy();

        owner.zones.shieldArea.push({
            carduid: 'GD01-001_shield_pick_0001',
            cardId: 'GD01-001',
            cardData: CardDatabaseManager.getCardDetails('GD01-001')
        });
        const deployEffect = gd01.cards['GD01-128'].effects.rules.find((rule) => rule.effectId === 'deploy_effect');
        const deployResult = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            owner.id,
            'GD01-128_src_0001',
            deployEffect
        );
        expect(deployResult.success).toBe(true);
        expect(owner.deck.handUids).toContain('GD01-001_shield_pick_0001');
    });

    test('ST03-015 deploy sequence resolves shield add then <=5 AP damage', () => {
        const gameEnv = new GameEnvironment();
        const owner = gameEnv.addPlayer('playerId_1', 'P1');
        const enemy = gameEnv.addPlayer('playerId_2', 'P2');

        owner.zones.shieldArea.push({
            carduid: 'ST03-001_shield_0001',
            cardId: 'ST03-001',
            cardData: CardDatabaseManager.getCardDetails('ST03-001')
        });

        enemy.zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_ap5_0001',
            cardId: 'ENEMY-AP5',
            ap: 5,
            hp: 3
        });
        enemy.zones.slot2.unit = createUnitZoneCard({
            carduid: 'enemy_ap6_0001',
            cardId: 'ENEMY-AP6',
            ap: 6,
            hp: 3
        });

        const effect = st03.cards['ST03-015'].effects.rules.find((rule) => rule.effectId === 'deploy_shield_then_damage_low_ap');
        const result = SequenceEffectManager.processSequenceEffect(gameEnv, owner.id, 'ST03-015_src_0001', effect);

        expect(result.success).toBe(true);
        expect(owner.deck.handUids).toContain('ST03-001_shield_0001');
        expect(enemy.zones.slot1.unit.damageReceived || 0).toBe(1);
        expect(enemy.zones.slot2.unit.damageReceived || 0).toBe(0);
    });
});
