const { GameEnvironment } = require('../models/GameEnvironment');
const { GamePhase } = require('../models/GameEnums');
const { BaseAbilityManager } = require('../services/effects/BaseAbilityManager');

function createUnit(carduid, ap = 2, hp = 3, isRested = false) {
    return {
        carduid,
        cardId: carduid,
        placedAt: 0,
        placedBy: 'playerId_1',
        isRested,
        damageReceived: 1,
        continueModifyAP: 0,
        continueModifyHP: 0,
        originalAP: ap,
        originalHP: hp,
        playedThisTurn: false,
        canAttackOnPlayTurn: false,
        canAttackThisTurn: true,
        temporaryEffects: [],
        effectUsage: {},
        cardData: {
            id: carduid,
            name: carduid,
            cardType: 'unit',
            ap,
            hp,
            effects: { description: [], rules: [] }
        }
    };
}

function createPilot(carduid, timingWindows) {
    const timing = timingWindows === null
        ? {}
        : { windows: timingWindows };

    return {
        carduid,
        cardId: carduid,
        placedAt: 0,
        placedBy: 'playerId_1',
        isRested: false,
        isFirstPlay: false,
        originalAP: 1,
        originalHP: 1,
        temporaryEffects: [],
        effectUsage: {},
        cardData: {
            id: carduid,
            name: carduid,
            cardType: 'pilot',
            effects: {
                description: [],
                rules: [
                    {
                        effectId: 'activate_heal',
                        type: 'activated',
                        timing,
                        cost: {
                            oncePerTurn: true
                        },
                        target: {
                            type: 'unit',
                            scope: 'source_paired_unit',
                            count: 1
                        },
                        action: 'heal',
                        parameters: {
                            value: 1
                        }
                    }
                ]
            }
        }
    };
}

function createEnv({ phase = GamePhase.MAIN_PHASE, timingWindows = ['MAIN_PHASE'], actionStep = false } = {}) {
    const gameEnv = new GameEnvironment();
    const p1 = gameEnv.addPlayer('playerId_1', 'P1');
    const p2 = gameEnv.addPlayer('playerId_2', 'P2');

    gameEnv.currentTurn = 1;
    gameEnv.currentPlayer = 'playerId_1';
    gameEnv.phase = phase;

    p1.zones.slot1.unit = createUnit('host_unit_0001', 3, 3, false);
    p1.zones.slot1.pilot = createPilot('pilot_source_0001', timingWindows);
    p2.zones.slot1.unit = createUnit('enemy_unit_0001', 2, 3, false);

    if (actionStep) {
        gameEnv.currentBattle = {
            actionType: 'attackUnit',
            attackingPlayerId: 'playerId_1',
            defendingPlayerId: 'playerId_2',
            attackerCarduid: 'host_unit_0001',
            targetCarduid: 'enemy_unit_0001',
            targetPlayerId: 'playerId_2',
            status: 'ACTION_STEP'
        };
    }

    return { gameEnv, p1 };
}

function activate(gameEnv, effectId = 'activate_heal') {
    return BaseAbilityManager.executeBaseAbility(gameEnv, {
        id: 'player_action_1',
        type: 'PLAYER_ACTION',
        status: 'DECLARED',
        priority: 1,
        playerId: 'playerId_1',
        timestamp: Date.now(),
        data: {
            playerId: 'playerId_1',
            actionType: 'activateCardAbility',
            carduid: 'pilot_source_0001',
            effectId
        }
    });
}

describe('activated ability timing enforcement', () => {
    test('ACTION_STEP-only activated ability is rejected from MAIN_PHASE', () => {
        const { gameEnv, p1 } = createEnv({
            phase: GamePhase.MAIN_PHASE,
            timingWindows: ['ACTION_STEP']
        });

        const result = activate(gameEnv);

        expect(result.success).toBe(false);
        expect(result.error).toContain('ACTION_STEP');
        expect(p1.zones.slot1.unit.damageReceived).toBe(1);
    });

    test('ACTION_STEP-only activated ability is rejected without an active battle window', () => {
        const { gameEnv, p1 } = createEnv({
            phase: GamePhase.ACTION_STEP_PHASE,
            timingWindows: ['ACTION_STEP']
        });

        const result = activate(gameEnv);

        expect(result.success).toBe(false);
        expect(result.error).toContain('ACTION_STEP');
        expect(p1.zones.slot1.unit.damageReceived).toBe(1);
    });

    test('ACTION_STEP-only activated ability succeeds during a real action-step battle', () => {
        const { gameEnv, p1 } = createEnv({
            phase: GamePhase.ACTION_STEP_PHASE,
            timingWindows: ['ACTION_STEP'],
            actionStep: true
        });

        const result = activate(gameEnv);

        expect(result.success).toBe(true);
        expect(p1.zones.slot1.unit.damageReceived).toBe(0);
    });

    test('MAIN_PHASE-only activated ability is rejected during ACTION_STEP', () => {
        const { gameEnv, p1 } = createEnv({
            phase: GamePhase.ACTION_STEP_PHASE,
            timingWindows: ['MAIN_PHASE'],
            actionStep: true
        });

        const result = activate(gameEnv);

        expect(result.success).toBe(false);
        expect(result.error).toContain('ACTION_STEP_PHASE');
        expect(p1.zones.slot1.unit.damageReceived).toBe(1);
    });

    test('missing timing windows still default to MAIN_PHASE', () => {
        const { gameEnv, p1 } = createEnv({
            phase: GamePhase.MAIN_PHASE,
            timingWindows: null
        });

        const result = activate(gameEnv);

        expect(result.success).toBe(true);
        expect(p1.zones.slot1.unit.damageReceived).toBe(0);
    });

    test('dual-window activated ability still works in MAIN_PHASE and ACTION_STEP', () => {
        const mainEnv = createEnv({
            phase: GamePhase.MAIN_PHASE,
            timingWindows: ['MAIN_PHASE', 'ACTION_STEP']
        });
        const mainResult = activate(mainEnv.gameEnv);
        expect(mainResult.success).toBe(true);
        expect(mainEnv.p1.zones.slot1.unit.damageReceived).toBe(0);

        const actionEnv = createEnv({
            phase: GamePhase.ACTION_STEP_PHASE,
            timingWindows: ['MAIN_PHASE', 'ACTION_STEP'],
            actionStep: true
        });
        const actionResult = activate(actionEnv.gameEnv);
        expect(actionResult.success).toBe(true);
        expect(actionEnv.p1.zones.slot1.unit.damageReceived).toBe(0);
    });
});
