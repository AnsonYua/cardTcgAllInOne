const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { EndTurnTriggeredEffectManager } = require('../services/effects/EndTurnTriggeredEffectManager');

function setupBaseEnv() {
    const gameEnv = new GameEnvironment();
    gameEnv.addPlayer('playerId_1', 'P1');
    gameEnv.addPlayer('playerId_2', 'P2');
    gameEnv.currentTurn = 1;
    gameEnv.currentPlayer = 'playerId_1';
    gameEnv.phase = 'END_PHASE';

    const placeResult = PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
        carduid: 'ST07-001_unit_test_0001',
        playAs: 'unit'
    });
    expect(placeResult.success).toBe(true);

    const player = gameEnv.getPlayer('playerId_1');
    expect(player).toBeTruthy();

    player.zones.trashArea = [];
    for (let i = 0; i < 7; i += 1) {
        player.zones.trashArea.push({
            carduid: `ST07-001_trash_cb_${i + 1}`,
            cardId: 'ST07-001'
        });
    }

    return { gameEnv, player };
}

describe('ST07-001 end-turn setActive resource selection', () => {
    test('auto-applies when multiple rested non-EX resources are valid', () => {
        const { gameEnv, player } = setupBaseEnv();
        player.zones.energyArea = [
            { carduid: 'energy_a', cardId: 'energy_basic', isRested: true, isExtraEnergy: false, placedAt: 0, placedBy: 'playerId_1' },
            { carduid: 'energy_b', cardId: 'energy_basic', isRested: true, isExtraEnergy: false, placedAt: 0, placedBy: 'playerId_1' },
            { carduid: 'energy_c', cardId: 'energy_basic', isRested: false, isExtraEnergy: false, placedAt: 0, placedBy: 'playerId_1' }
        ];

        const actions = EndTurnTriggeredEffectManager.checkEndTurnTriggeredEffects(gameEnv, 'playerId_1');
        expect(actions).toHaveLength(1);

        const executeResult = EndTurnTriggeredEffectManager.executeEndTurnTriggeredEffect({
            id: 'st07_001_end_turn_evt_0001',
            type: EventType.TRIGGER_END_OF_TURN_EFFECT,
            playerId: 'playerId_1',
            status: 'RESOLVING',
            data: actions[0].data
        }, gameEnv);

        expect(executeResult.success).toBe(true);
        expect(gameEnv.processingQueue.filter((event) => event.type === EventType.TARGET_CHOICE)).toHaveLength(0);
        expect(player.zones.energyArea.find((energy) => energy.carduid === 'energy_a').isRested).toBe(false);
        expect(player.zones.energyArea.find((energy) => energy.carduid === 'energy_b').isRested).toBe(true);
    });

    test('auto-applies when exactly one rested non-EX resource is valid', () => {
        const { gameEnv, player } = setupBaseEnv();
        player.zones.energyArea = [
            { carduid: 'energy_a', cardId: 'energy_basic', isRested: true, isExtraEnergy: false, placedAt: 0, placedBy: 'playerId_1' },
            { carduid: 'energy_b', cardId: 'energy_basic', isRested: false, isExtraEnergy: false, placedAt: 0, placedBy: 'playerId_1' },
            { carduid: 'energy_ex', cardId: 'energy_basic', isRested: true, isExtraEnergy: true, placedAt: 0, placedBy: 'playerId_1' }
        ];

        const actions = EndTurnTriggeredEffectManager.checkEndTurnTriggeredEffects(gameEnv, 'playerId_1');
        expect(actions).toHaveLength(1);

        const executeResult = EndTurnTriggeredEffectManager.executeEndTurnTriggeredEffect({
            id: 'st07_001_end_turn_evt_0002',
            type: EventType.TRIGGER_END_OF_TURN_EFFECT,
            playerId: 'playerId_1',
            status: 'RESOLVING',
            data: actions[0].data
        }, gameEnv);

        expect(executeResult.success).toBe(true);
        expect(gameEnv.processingQueue.filter((event) => event.type === EventType.TARGET_CHOICE)).toHaveLength(0);
        expect(player.zones.energyArea.find((energy) => energy.carduid === 'energy_a').isRested).toBe(false);
        expect(player.zones.energyArea.find((energy) => energy.carduid === 'energy_b').isRested).toBe(false);
        expect(player.zones.energyArea.find((energy) => energy.carduid === 'energy_ex').isRested).toBe(true);
    });
});
