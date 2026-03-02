const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType, GamePhase } = require('../models/GameEnums');
const { CardDatabaseManager, createZoneCard } = require('../models/CardSystem');
const { EventFactory } = require('../services/EventQueue/EventFactory');
const { StateBasedActionEngine } = require('../services/EventQueue/StateBasedActionEngine');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const { resolveScenarioFilePath, loadJson } = require('../tests/testScenarioUtils');

const GD02085_SCENARIO_PATH =
    'GD02/GD02-085/burst_add_to_hand_then_during_link_once_per_turn_draw_on_self_heal_if_hand_le_4_manual_flow.json';

function buildGd02085EndTurnReadyEnv() {
    const scenario = loadJson(resolveScenarioFilePath(GD02085_SCENARIO_PATH));
    const gameEnv = GameEnvironment.fromJSON(scenario.initialGameEnv);

    const player = gameEnv.getPlayer('playerId_2');
    const slot1 = player?.zones?.slot1;
    if (!player || !slot1 || !slot1.unit) {
        throw new Error('Scenario setup missing playerId_2 slot1 unit');
    }

    gameEnv.currentPlayer = 'playerId_2';
    gameEnv.currentTurn = 2;
    gameEnv.phase = GamePhase.MAIN_PHASE;
    gameEnv.processingQueue = [];
    gameEnv.pendingPhaseTransition = null;

    player.zones.repairAbilitiesCheckedThisCycle = false;
    player.zones.endTurnEffectsCheckedThisCycle = false;

    const psychoData = CardDatabaseManager.getCardDetails('GD02-007');
    const fourData = CardDatabaseManager.getCardDetails('GD02-085');
    if (!psychoData || !fourData) {
        throw new Error('Missing card data for GD02-007 or GD02-085');
    }

    slot1.unit.cardData = psychoData;
    slot1.unit.originalAP = psychoData.ap;
    slot1.unit.originalHP = psychoData.hp;
    slot1.unit.damageReceived = 2;
    slot1.unit.isRested = false;

    slot1.pilot = createZoneCard(
        'GD02-085_shield_p2_0001',
        'GD02-085',
        fourData,
        'playerId_2',
        'pilot'
    );
    slot1.pilot.isRested = false;

    player.deck.hand = [];
    player.deck.handUids = [];

    ContinuousEffectManager.processAllContinuousEffects(gameEnv);

    return gameEnv;
}

describe('GD02-085 END_PHASE ordering stability', () => {
    test('END_PHASE with repair available queues TRIGGER_HEALING and defers NEXT_PLAYER_TURN', () => {
        const gameEnv = buildGd02085EndTurnReadyEnv();
        gameEnv.phase = GamePhase.END_PHASE;

        const stateEngine = new StateBasedActionEngine(gameEnv);
        const actions = stateEngine.checkForStateBasedActions();
        const actionTypes = actions.map((action) => action.type);

        expect(actionTypes).toContain(EventType.TRIGGER_HEALING);
        expect(actionTypes).not.toContain(EventType.NEXT_PLAYER_TURN);
    });

    test('END_PHASE with no pending end-turn effects can queue NEXT_PLAYER_TURN', () => {
        const gameEnv = buildGd02085EndTurnReadyEnv();
        gameEnv.phase = GamePhase.END_PHASE;
        gameEnv.players.playerId_2.zones.slot1.unit.damageReceived = 0;
        gameEnv.players.playerId_2.zones.repairAbilitiesCheckedThisCycle = false;
        gameEnv.players.playerId_2.zones.endTurnEffectsCheckedThisCycle = false;

        const stateEngine = new StateBasedActionEngine(gameEnv);
        const actions = stateEngine.checkForStateBasedActions();
        const actionTypes = actions.map((action) => action.type);

        expect(actionTypes).toContain(EventType.NEXT_PLAYER_TURN);
        expect(actionTypes).not.toContain(EventType.TRIGGER_HEALING);
    });

    test('GD02-085 draw on self-heal resolves before next-player phase transition across repeated runs', () => {
        const runs = 12;
        for (let i = 0; i < runs; i++) {
            const gameEnv = buildGd02085EndTurnReadyEnv();
            const endTurnEvent = EventFactory.createEndTurnEvent('playerId_2', gameEnv.currentTurn);
            gameEnv.enqueueForProcessing(endTurnEvent);

            const result = gameEnv.processEvents();
            expect(result.success).toBe(true);

            const notifications = Array.isArray(gameEnv.notificationQueue) ? gameEnv.notificationQueue : [];

            const healedIndex = notifications.findIndex(
                (note) =>
                    note?.type === 'CARD_HEALED' &&
                    note?.payload?.playerId === 'playerId_2' &&
                    note?.payload?.carduid === 'GD02-007_unit_p2_0001'
            );
            const drawnP2Indices = notifications
                .map((note, idx) => ({ note, idx }))
                .filter((entry) => entry.note?.type === 'CARD_DRAWN' && entry.note?.payload?.playerId === 'playerId_2')
                .map((entry) => entry.idx);
            const phaseToP1DrawIndex = notifications.findIndex(
                (note) =>
                    note?.type === 'PHASE_CHANGED' &&
                    note?.payload?.playerId === 'playerId_1' &&
                    note?.payload?.nextPhase === 'DRAW_PHASE'
            );

            expect(healedIndex).toBeGreaterThan(-1);
            expect(drawnP2Indices.length).toBe(1);
            expect(drawnP2Indices[0]).toBeGreaterThan(healedIndex);

            if (phaseToP1DrawIndex >= 0) {
                expect(healedIndex).toBeLessThan(phaseToP1DrawIndex);
                expect(drawnP2Indices[0]).toBeLessThan(phaseToP1DrawIndex);
            }
        }
    });

    test('non-regression: end turn still advances promptly when no repair is pending', () => {
        const gameEnv = buildGd02085EndTurnReadyEnv();
        gameEnv.players.playerId_2.zones.slot1.unit.damageReceived = 0;

        const endTurnEvent = EventFactory.createEndTurnEvent('playerId_2', gameEnv.currentTurn);
        gameEnv.enqueueForProcessing(endTurnEvent);
        const result = gameEnv.processEvents();

        expect(result.success).toBe(true);
        expect(gameEnv.currentPlayer).toBe('playerId_1');
        expect(gameEnv.phase).toBe(GamePhase.MAIN_PHASE);
    });
});
