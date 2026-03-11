const { GameEnvironment } = require('../models/GameEnvironment');
const { GamePhase, PlayerActionType } = require('../models/GameEnums');
const { processAction } = require('../services/actions/ActionProcessor');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { EnergyManager } = require('../services/EnergyManager');
const { CardDatabaseManager } = require('../models/CardSystem');

function createCommandUseEnv({ phase = GamePhase.MAIN_PHASE, actionStep = false } = {}) {
    const gameEnv = new GameEnvironment();
    gameEnv.addPlayer('playerId_1', 'P1');
    gameEnv.addPlayer('playerId_2', 'P2');
    gameEnv.gameStarted = true;
    gameEnv.currentPlayer = 'playerId_1';
    gameEnv.currentTurn = 1;
    gameEnv.phase = phase;

    const p1 = gameEnv.getPlayer('playerId_1');
    const p2 = gameEnv.getPlayer('playerId_2');
    p1.isReady = true;
    p2.isReady = true;

    const friendlyUid = 'GD01-001_friendly_mainphase_0001';
    const enemyUid = 'GD01-047_enemy_mainphase_0001';

    expect(
        PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: friendlyUid,
            playAs: 'unit'
        }).success
    ).toBe(true);
    expect(
        PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
            carduid: enemyUid,
            playAs: 'unit'
        }).success
    ).toBe(true);

    p2.zones.slot1.unit.isRested = true;

    if (actionStep) {
        gameEnv.currentBattle = {
            actionType: 'attackUnit',
            attackingPlayerId: 'playerId_1',
            defendingPlayerId: 'playerId_2',
            attackerCarduid: friendlyUid,
            targetCarduid: enemyUid,
            targetPlayerId: 'playerId_2',
            status: 'ACTION_STEP',
            openedAt: Date.now()
        };
    }

    expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1')).toBe(true);
    expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1')).toBe(true);
    expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1')).toBe(true);
    expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1')).toBe(true);
    expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1')).toBe(true);

    return { gameEnv, p1, p2, friendlyUid, enemyUid };
}

async function useCommandCard(gameEnv, { carduid, effectId, targetCarduid, fromBurst = false }) {
    return processAction(gameEnv, {
        type: PlayerActionType.PLAYER_ACTION,
        playerId: 'playerId_1',
        gameId: 'timing_enforcement_test',
        actionType: 'useCommandCard',
        carduid,
        effectId,
        targetCarduid,
        fromBurst
    });
}

describe('MainPhaseAbilityManager timing enforcement', () => {
    test('ACTION_STEP-only command effect is rejected from MAIN_PHASE on direct useCommandCard', async () => {
        const { gameEnv, p1, friendlyUid } = createCommandUseEnv({ phase: GamePhase.MAIN_PHASE });
        const commandUid = 'ST03-014_hand_action_only_0001';
        p1.deck._handUids = [commandUid];

        const result = await useCommandCard(gameEnv, {
            carduid: commandUid,
            effectId: 'action_prevent_battle_damage_low_ap',
            targetCarduid: friendlyUid
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('ACTION_STEP');
        expect(p1.deck.handUids).toContain(commandUid);
    });

    test('ACTION_STEP-only command effect succeeds during a valid ACTION_STEP battle', async () => {
        const { gameEnv, p1, friendlyUid } = createCommandUseEnv({
            phase: GamePhase.ACTION_STEP_PHASE,
            actionStep: true
        });
        const commandUid = 'ST03-014_hand_action_only_0002';
        p1.deck._handUids = [commandUid];

        const result = await useCommandCard(gameEnv, {
            carduid: commandUid,
            effectId: 'action_prevent_battle_damage_low_ap',
            targetCarduid: friendlyUid
        });

        expect(result.success).toBe(true);
        expect(p1.deck.handUids).not.toContain(commandUid);
    });

    test('MAIN_PHASE-only command effect is rejected during ACTION_STEP', async () => {
        const { gameEnv, p1, enemyUid } = createCommandUseEnv({
            phase: GamePhase.ACTION_STEP_PHASE,
            actionStep: true
        });
        const commandUid = 'ST01-012_hand_main_only_0001';
        p1.deck._handUids = [commandUid];

        const result = await useCommandCard(gameEnv, {
            carduid: commandUid,
            effectId: 'main_damage_rested',
            targetCarduid: enemyUid
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('MAIN_PHASE');
        expect(p1.deck.handUids).toContain(commandUid);
    });

    test('legacy command effect without timing windows still defaults to MAIN_PHASE on direct useCommandCard', async () => {
        const cardData = CardDatabaseManager.getCardDetails('ST01-012');
        const playRule = (cardData?.effects?.rules || []).find((rule) => rule?.effectId === 'main_damage_rested');
        expect(playRule).toBeTruthy();
        const originalTiming = playRule?.timing ? { ...playRule.timing } : undefined;
        const originalCompiledTiming = playRule?.compiledTiming ? { ...playRule.compiledTiming } : undefined;
        if (!playRule.timing || typeof playRule.timing !== 'object') {
            playRule.timing = {};
        }
        delete playRule.timing.activationWindows;
        delete playRule.timing.windows;
        if (playRule.compiledTiming && typeof playRule.compiledTiming === 'object') {
            delete playRule.compiledTiming.activationWindows;
        }

        try {
            const { gameEnv, p1, enemyUid } = createCommandUseEnv({ phase: GamePhase.MAIN_PHASE });
            const commandUid = 'ST01-012_hand_main_only_legacy_0001';
            p1.deck._handUids = [commandUid];

            const result = await useCommandCard(gameEnv, {
                carduid: commandUid,
                effectId: 'main_damage_rested',
                targetCarduid: enemyUid
            });

            expect(result.success).toBe(true);
            expect(p1.deck.handUids).not.toContain(commandUid);
        } finally {
            if (originalTiming) {
                playRule.timing = originalTiming;
            } else {
                delete playRule.timing;
            }
            if (originalCompiledTiming) {
                playRule.compiledTiming = originalCompiledTiming;
            } else {
                delete playRule.compiledTiming;
            }
        }
    });

    test('dual-window command effect still works in MAIN_PHASE and ACTION_STEP', async () => {
        const mainEnv = createCommandUseEnv({ phase: GamePhase.MAIN_PHASE });
        const mainCommandUid = 'ST01-014_hand_dual_0001';
        mainEnv.p1.deck._handUids = [mainCommandUid];

        const mainResult = await useCommandCard(mainEnv.gameEnv, {
            carduid: mainCommandUid,
            effectId: 'main_action_ap_reduction',
            targetCarduid: mainEnv.enemyUid
        });

        expect(mainResult.success).toBe(true);
        expect(mainEnv.p1.deck.handUids).not.toContain(mainCommandUid);

        const actionEnv = createCommandUseEnv({
            phase: GamePhase.ACTION_STEP_PHASE,
            actionStep: true
        });
        const actionCommandUid = 'ST01-014_hand_dual_0002';
        actionEnv.p1.deck._handUids = [actionCommandUid];

        const actionResult = await useCommandCard(actionEnv.gameEnv, {
            carduid: actionCommandUid,
            effectId: 'main_action_ap_reduction',
            targetCarduid: actionEnv.enemyUid
        });

        expect(actionResult.success).toBe(true);
        expect(actionEnv.p1.deck.handUids).not.toContain(actionCommandUid);
    });
});
