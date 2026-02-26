const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerActionType } = require('../models/GameEnums');
const { processAction } = require('../services/actions/ActionProcessor');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const { EventConditionEvaluator } = require('../services/conditions/EventConditionEvaluator');
const { createUnitZoneCard, createPilotZoneCard } = require('./helpers/zoneCardFactory');

const gd03 = require('../data/gd03Card.json');
const st07 = require('../data/st07Card.json');
const st08 = require('../data/st08Card.json');

function placeCardUnit(slot, card, carduid, zoneExtras = {}) {
    slot.unit = createUnitZoneCard({
        carduid,
        cardId: card.id,
        name: card.name,
        ap: card.ap,
        hp: card.hp,
        traits: card.traits,
        link: card.link,
        effectsRules: card.effects?.rules || [],
        cardDataExtras: {
            color: card.color,
            level: card.level,
            cost: card.cost,
            zone: card.zone,
            effects: card.effects
        },
        zoneExtras
    });
    return slot.unit;
}

function placeCardPilot(slot, card, carduid, zoneExtras = {}) {
    slot.pilot = createPilotZoneCard({
        carduid,
        cardId: card.id,
        name: card.name,
        traits: card.traits,
        ap: card.ap,
        hp: card.hp,
        cardDataExtras: {
            color: card.color,
            level: card.level,
            cost: card.cost,
            zone: card.zone,
            effects: card.effects
        },
        zoneExtras
    });
    return slot.pilot;
}

function latestNotification(gameEnv, type) {
    const events = (gameEnv.notificationQueue || []).filter((event) => event?.type === type);
    return events[events.length - 1] || null;
}

describe('GD03-022 + ST07-012 battle destroy and prevention regression', () => {
    test('linked Kyrios prevents low-AP battle damage and triggers post-battle AOE on destroy', async () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        p1.isReady = true;
        p2.isReady = true;
        gameEnv.gameStarted = true;
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = p1.id;
        gameEnv.phase = 'MAIN_PHASE';

        const kyrios = gd03.cards['GD03-022'];
        const allelujah = st07.cards['ST07-012'];
        const messerF01 = st08.cards['ST08-004'];
        const messerF02 = st08.cards['ST08-005'];
        const nt1 = gd03.cards['GD03-001'];

        placeCardUnit(p1.zones.slot1, kyrios, 'GD03-022_unit_0001', {
            playedThisTurn: true,
            canAttackOnPlayTurn: true,
            canAttackThisTurn: true,
            isFirstPlay: false,
            isRested: false
        });
        placeCardPilot(p1.zones.slot1, allelujah, 'ST07-012_pilot_0001');

        placeCardUnit(p2.zones.slot1, messerF01, 'ST08-004_unit_0001', {
            isRested: true,
            playedThisTurn: false,
            canAttackThisTurn: false,
            isFirstPlay: false
        });
        placeCardUnit(p2.zones.slot2, messerF02, 'ST08-005_unit_0001', {
            isRested: true,
            playedThisTurn: false,
            canAttackThisTurn: false,
            isFirstPlay: false
        });
        placeCardUnit(p2.zones.slot3, nt1, 'GD03-001_unit_0001', {
            isRested: true,
            playedThisTurn: false,
            canAttackThisTurn: false,
            isFirstPlay: false
        });

        const registryResult = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        expect(registryResult.success).toBe(true);
        expect(p1.effectRegistry['prevent_battle_damage_from_enemy_ap_le_3_if_cb_link_unit_in_play_ST07-012_pilot_0001']).toBeTruthy();

        const actionResult = await processAction(gameEnv, {
            type: PlayerActionType.PLAYER_ACTION,
            playerId: p1.id,
            gameId: 'gd03022_st07012_regression',
            actionType: 'attackUnit',
            attackerCarduid: 'GD03-022_unit_0001',
            targetUnitUid: 'ST08-004_unit_0001',
            targetPlayerId: p2.id
        });
        expect(actionResult.success).toBe(true);

        const preventionGranted = latestNotification(gameEnv, 'BATTLE_DAMAGE_PREVENTION_GRANTED');
        expect(preventionGranted).toBeTruthy();
        expect(preventionGranted.payload?.sourceCarduid).toBe('ST07-012_pilot_0001');

        const battleResolved = latestNotification(gameEnv, 'BATTLE_RESOLVED');
        expect(battleResolved).toBeTruthy();
        expect(battleResolved.payload?.result?.targetType).toBe('unit');
        expect(battleResolved.payload?.result?.defenderDestroyed).toBe(true);
        expect(battleResolved.payload?.result?.attackerDamagePrevented).toBe(true);
        expect(battleResolved.payload?.result?.attackerDamageTaken).toBe(0);

        expect(p1.zones.slot1.unit.damageReceived || 0).toBe(0);
        expect(p2.zones.slot1.unit).toBeFalsy();
        expect((p2.zones.trashArea || []).some((card) => card.carduid === 'ST08-004_unit_0001')).toBe(true);

        expect(p2.zones.slot2.unit).toBeTruthy();
        expect(p2.zones.slot2.unit.damageReceived || 0).toBe(1);

        expect(p2.zones.slot3.unit).toBeTruthy();
        expect(p2.zones.slot3.unit.damageReceived || 0).toBe(0);
    });

    test('linked Kyrios still triggers AOE on mutual destruction if defender is destroyed', async () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        p1.isReady = true;
        p2.isReady = true;
        gameEnv.gameStarted = true;
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = p1.id;
        gameEnv.phase = 'MAIN_PHASE';

        const kyrios = gd03.cards['GD03-022'];
        const allelujah = st07.cards['ST07-012'];
        const messerF02 = st08.cards['ST08-005']; // Lv3 AOE target
        const nt1 = gd03.cards['GD03-001']; // AP4/HP4 causes mutual destroy vs Kyrios 5/3

        placeCardUnit(p1.zones.slot1, kyrios, 'GD03-022_unit_0001', {
            playedThisTurn: true,
            canAttackOnPlayTurn: true,
            canAttackThisTurn: true,
            isFirstPlay: false,
            isRested: false
        });
        placeCardPilot(p1.zones.slot1, allelujah, 'ST07-012_pilot_0001');

        placeCardUnit(p2.zones.slot2, messerF02, 'ST08-005_unit_0001', {
            isRested: true,
            playedThisTurn: false,
            canAttackThisTurn: false,
            isFirstPlay: false
        });
        placeCardUnit(p2.zones.slot3, nt1, 'GD03-001_unit_0001', {
            isRested: true,
            playedThisTurn: false,
            canAttackThisTurn: false,
            isFirstPlay: false
        });

        const registryResult = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        expect(registryResult.success).toBe(true);

        const actionResult = await processAction(gameEnv, {
            type: PlayerActionType.PLAYER_ACTION,
            playerId: p1.id,
            gameId: 'gd03022_mutual_destroy_triggers_aoe',
            actionType: 'attackUnit',
            attackerCarduid: 'GD03-022_unit_0001',
            targetUnitUid: 'GD03-001_unit_0001',
            targetPlayerId: p2.id
        });
        expect(actionResult.success).toBe(true);

        const battleResolved = latestNotification(gameEnv, 'BATTLE_RESOLVED');
        expect(battleResolved).toBeTruthy();
        expect(battleResolved.payload?.result?.attackerDestroyed).toBe(true);
        expect(battleResolved.payload?.result?.defenderDestroyed).toBe(true);

        expect((p1.zones.trashArea || []).some((card) => card.carduid === 'GD03-022_unit_0001')).toBe(true);
        expect((p2.zones.trashArea || []).some((card) => card.carduid === 'GD03-001_unit_0001')).toBe(true);

        expect(p2.zones.slot2.unit).toBeTruthy();
        expect(p2.zones.slot2.unit.damageReceived || 0).toBe(1);
    });
});

describe('EventConditionEvaluator BATTLE_RESOLVED payload guardrails', () => {
    test('eventAttacker=self resolves from nested BATTLE_RESOLVED payload attacker.unit.carduid', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.notificationQueue = [{
            type: 'BATTLE_RESOLVED',
            payload: {
                attacker: { unit: { carduid: 'GD03-022_unit_0001' } },
                target: { unit: { carduid: 'ST08-004_unit_0001' } },
                result: { targetType: 'unit', defenderDestroyed: true, attackerDestroyed: false }
            }
        }];
        gameEnv.processingQueue = [{
            type: 'PLAYER_ACTION',
            data: { actionType: 'attackUnit' }
        }];

        const matches = EventConditionEvaluator.eventAttackerMatches(
            gameEnv,
            { carduid: 'GD03-022_unit_0001', cardData: { cardType: 'unit' } },
            { value: 'self' }
        );
        expect(matches).toBe(true);
    });

    test('BATTLE_DESTROY condition is false for battle resolved without unit destruction', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.notificationQueue = [{
            type: 'BATTLE_RESOLVED',
            payload: {
                result: { targetType: 'unit', defenderDestroyed: false, attackerDestroyed: false }
            }
        }];

        const matches = EventConditionEvaluator.eventTypeMatches(gameEnv, { value: 'BATTLE_DESTROY' });
        expect(matches).toBe(false);
    });

    test('BATTLE_DESTROY condition is true for battle resolved with unit destruction', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.notificationQueue = [{
            type: 'BATTLE_RESOLVED',
            payload: {
                result: { targetType: 'unit', defenderDestroyed: true, attackerDestroyed: false }
            }
        }];

        const matches = EventConditionEvaluator.eventTypeMatches(gameEnv, { value: 'BATTLE_DESTROY' });
        expect(matches).toBe(true);
    });

    test('eventDefenderDestroyed is false when only attacker was destroyed', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.notificationQueue = [{
            type: 'BATTLE_RESOLVED',
            payload: {
                result: { targetType: 'unit', defenderDestroyed: false, attackerDestroyed: true }
            }
        }];

        expect(EventConditionEvaluator.eventTypeMatches(gameEnv, { value: 'BATTLE_DESTROY' })).toBe(true);
        expect(EventConditionEvaluator.eventDefenderDestroyed(gameEnv, { value: true })).toBe(false);
    });

    test('eventDefenderDestroyed is true when defender was destroyed', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.notificationQueue = [{
            type: 'BATTLE_RESOLVED',
            payload: {
                result: { targetType: 'unit', defenderDestroyed: true, attackerDestroyed: false }
            }
        }];

        expect(EventConditionEvaluator.eventDefenderDestroyed(gameEnv, { value: true })).toBe(true);
    });
});
