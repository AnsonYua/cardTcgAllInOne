const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerActionType } = require('../models/GameEnums');
const { AttackPhaseEffectManager } = require('../services/effects/AttackPhaseEffectManager');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const { GameNotificationManager } = require('../services/GameNotificationManager');
const { processAction } = require('../services/actions/ActionProcessor');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');

const gd03 = require('../data/gd03Card.json');

function createBattleSetup() {
    const gameEnv = new GameEnvironment();
    const p1 = gameEnv.addPlayer('playerId_1', 'P1');
    const p2 = gameEnv.addPlayer('playerId_2', 'P2');
    p1.isReady = true;
    p2.isReady = true;
    gameEnv.gameStarted = true;
    gameEnv.currentTurn = 1;
    gameEnv.currentPlayer = p1.id;

    const card = gd03.cards['GD03-028'];
    const attackerCarduid = 'GD03-028_attacker_0001';
    const defenderCarduid = 'TEST_enemy_defender_0001';

    p1.zones.slot1.unit = createUnitZoneCard({
        carduid: attackerCarduid,
        cardId: card.id,
        name: card.name,
        ap: card.ap,
        hp: card.hp,
        traits: card.traits,
        link: card.link,
        effectsRules: card.effects.rules,
        cardDataExtras: {
            color: card.color,
            level: card.level,
            cost: card.cost,
            zone: card.zone,
            effects: card.effects
        },
        zoneExtras: {
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            isFirstPlay: false
        }
    });

    p2.zones.slot1.unit = createUnitZoneCard({
        carduid: defenderCarduid,
        cardId: 'TEST-DEF-001',
        name: 'Defender',
        ap: 2,
        hp: 6,
        cardDataExtras: { level: 3, color: 'Blue', cost: 2 }
    });

    const notificationManager = new GameNotificationManager(gameEnv);
    const attackNotificationId = notificationManager.addNotificationEvent('UNIT_ATTACK_DECLARED', {
        attackingPlayerId: p1.id,
        defendingPlayerId: p2.id,
        attackerCarduid,
        attackerSlot: 'slot1',
        targetCarduid: defenderCarduid,
        targetSlotName: 'slot1'
    });

    gameEnv.setCurrentBattle({
        actionType: 'attackUnit',
        attackingPlayerId: p1.id,
        defendingPlayerId: p2.id,
        attackerCarduid,
        targetCarduid: defenderCarduid,
        targetPlayerId: p2.id,
        status: 'ACTION_STEP',
        openedAt: Date.now(),
        attackNotificationId
    });

    return { gameEnv, p1, p2, attackerCarduid, defenderCarduid };
}

function runAttackPhase(gameEnv, attackerCarduid, actionType = 'attackUnit') {
    return AttackPhaseEffectManager.processAttackPhaseEffects(gameEnv, {
        playerId: 'playerId_1',
        data: {
            playerId: 'playerId_1',
            actionType,
            attackerCarduid,
            fromBurst: false
        }
    });
}

describe('GD03-028 attack battle duration buff regression', () => {
    test('live attackUnit flow triggers CARD_STAT_MODIFIED before battle opens (no pre-opened currentBattle)', async () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        p1.isReady = true;
        p2.isReady = true;
        gameEnv.gameStarted = true;
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = p1.id;
        gameEnv.phase = 'MAIN_PHASE';

        const attackerCard = gd03.cards['GD03-028'];
        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-028_unit_live_0001',
            cardId: attackerCard.id,
            name: attackerCard.name,
            ap: attackerCard.ap,
            hp: attackerCard.hp,
            traits: attackerCard.traits,
            link: attackerCard.link,
            effectsRules: attackerCard.effects.rules,
            cardDataExtras: {
                color: attackerCard.color,
                level: attackerCard.level,
                cost: attackerCard.cost,
                zone: attackerCard.zone,
                effects: attackerCard.effects
            },
            zoneExtras: {
                playedThisTurn: false,
                canAttackOnPlayTurn: false,
                canAttackThisTurn: true,
                isFirstPlay: false
            }
        });

        p2.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-010_enemy_live_0001',
            cardId: 'GD03-010',
            name: 'Full Armor Unicorn Gundam (Destroy Mode)',
            ap: 6,
            hp: 6,
            cardDataExtras: { level: 8, color: 'Blue', cost: 6 }
        });
        p2.zones.slot1.unit.isRested = true;

        const result = await processAction(gameEnv, {
            type: PlayerActionType.PLAYER_ACTION,
            playerId: 'playerId_1',
            gameId: 'gd03028_live_attack_flow',
            actionType: 'attackUnit',
            attackerCarduid: 'GD03-028_unit_live_0001',
            targetType: 'unit',
            targetUnitUid: 'GD03-010_enemy_live_0001',
            targetPlayerId: 'playerId_2'
        });

        expect(result.success).toBe(true);

        const statModified = (gameEnv.notificationQueue || []).find((e) =>
            e?.type === 'CARD_STAT_MODIFIED' &&
            e?.payload?.carduid === 'GD03-028_unit_live_0001' &&
            e?.payload?.stat === 'modifyAP' &&
            e?.payload?.delta === 2
        );
        expect(statModified).toBeTruthy();

        const battleResolved = (gameEnv.notificationQueue || []).find((e) => e?.type === 'BATTLE_RESOLVED');
        expect(battleResolved).toBeTruthy();
        expect(battleResolved.payload?.battleType).toBe('attackUnit');
        expect(battleResolved.payload?.result?.defenderDamageTaken).toBe(4);
    });

    test('attacking an enemy unit grants AP+2 during battle and expires on end-of-battle cleanup', () => {
        const { gameEnv, attackerCarduid } = createBattleSetup();
        const attacker = gameEnv.players.playerId_1.zones.slot1.unit;

        expect(attacker.modifyAP).toBe(0);
        expect(attacker.temporaryEffects || []).toHaveLength(0);

        const attackEffectResult = runAttackPhase(gameEnv, attackerCarduid, 'attackUnit');
        expect(attackEffectResult.success).toBe(true);

        expect(attacker.modifyAP).toBe(2);
        expect(Array.isArray(attacker.temporaryEffects)).toBe(true);
        expect(attacker.temporaryEffects.length).toBe(1);
        expect(attacker.temporaryEffects[0].duration).toBe('UNTIL_END_OF_BATTLE');
        expect(attacker.temporaryEffects[0].modifyAP).toBe(2);

        const removed = EffectExecutor.cleanupEndOfBattleTemporaryEffects(gameEnv, [attacker.carduid]);
        expect(removed).toBe(1);

        expect(attacker.modifyAP).toBe(0);
        expect(attacker.temporaryEffects || []).toHaveLength(0);
    });

    test('attacking shield area does not grant AP+2 because attackTargetCardType condition fails', () => {
        const { gameEnv, attackerCarduid } = createBattleSetup();
        const attacker = gameEnv.players.playerId_1.zones.slot1.unit;

        const attackEffectResult = runAttackPhase(gameEnv, attackerCarduid, 'attackShieldArea');
        expect(attackEffectResult.success).toBe(true);
        expect(attackEffectResult.effectsProcessed || 0).toBe(0);
        expect(attacker.modifyAP).toBe(0);
        expect(attacker.temporaryEffects || []).toHaveLength(0);
    });
});
