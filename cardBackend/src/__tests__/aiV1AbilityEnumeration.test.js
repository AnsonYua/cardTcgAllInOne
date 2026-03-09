const { GamePhase } = require('../models/GameEnums');
const { GameEnvAiContextAdapter } = require('../services/ai/v1/AiV1ContextAdapter');
const { GameEnvAiActionAdapter } = require('../services/ai/v1/AiV1CandidateEnumerator');

function createCommand(carduid, action) {
    return {
        carduid,
        cardData: {
            cardType: 'command',
            name: carduid,
            cost: 1,
            level: 1,
            effectiveCost: 1,
            effectiveLevel: 1,
            effects: {
                rules: [
                    {
                        effectId: `${carduid}_effect`,
                        type: 'play',
                        action,
                        timing: {
                            activationWindows: ['MAIN_PHASE']
                        }
                    }
                ]
            }
        }
    };
}

function createCommandWithTarget(carduid, action, activationWindow = 'MAIN_PHASE') {
    return {
        carduid,
        cardData: {
            cardType: 'command',
            name: carduid,
            cost: 1,
            level: 1,
            effectiveCost: 1,
            effectiveLevel: 1,
            effects: {
                rules: [
                    {
                        effectId: `${carduid}_effect`,
                        type: 'play',
                        action,
                        target: {
                            type: 'unit',
                            scope: 'opponent',
                            count: 1
                        },
                        timing: {
                            activationWindows: [activationWindow]
                        }
                    }
                ]
            }
        }
    };
}

function createBase(carduid, action) {
    return {
        carduid,
        cardId: carduid,
        isRested: false,
        effectUsage: {},
        cardData: {
            cardType: 'base',
            name: carduid,
            hp: 6,
            effects: {
                rules: [
                    {
                        effectId: `${carduid}_effect`,
                        type: 'activated',
                        action,
                        timing: {
                            activationWindows: ['MAIN_PHASE']
                        },
                        cost: {
                            resource: 1
                        }
                    }
                ]
            }
        }
        };
}

function createBaseWithTarget(carduid, action, activationWindow = 'MAIN_PHASE') {
    return {
        carduid,
        cardId: carduid,
        isRested: false,
        effectUsage: {},
        cardData: {
            cardType: 'base',
            name: carduid,
            hp: 6,
            effects: {
                rules: [
                    {
                        effectId: `${carduid}_effect`,
                        type: 'activated',
                        action,
                        target: {
                            type: 'unit',
                            scope: 'opponent',
                            count: 1
                        },
                        timing: {
                            activationWindows: [activationWindow]
                        },
                        cost: {
                            resource: 1
                        },
                        parameters: {
                            value: 2
                        }
                    }
                ]
            }
        }
    };
}

function createUnit(carduid, ap = 2, hp = 3, isRested = true) {
    return {
        carduid,
        cardId: carduid,
        cardData: {
            cardType: 'unit',
            name: carduid,
            ap,
            hp
        },
        originalAP: ap,
        originalHP: hp,
        damageReceived: 0,
        isRested,
        playedThisTurn: false,
        canAttackThisTurn: true,
        canAttackOnPlayTurn: true
    };
}

describe('GameEnvAiActionAdapter ability enumeration', () => {
    test('enumerates multiple command and field ability candidates in one window', () => {
        const aiPlayerId = 'player_ai';
        const opponentId = 'player_op';
        const gameEnvView = {
            phase: GamePhase.MAIN_PHASE,
            currentPlayer: aiPlayerId,
            currentTurn: 4,
            playerId_1: aiPlayerId,
            playerId_2: opponentId,
            notificationQueue: [],
            players: {
                [aiPlayerId]: {
                    deck: {
                        hand: [
                            createCommand('cmd_draw', 'draw'),
                            createCommand('cmd_draw_two', 'draw')
                        ],
                        handCount: 2
                    },
                    zones: {
                        base: [createBase('base_draw', 'draw')],
                        energyArea: [{ isRested: false }, { isRested: false }],
                        shieldArea: [],
                        shieldCount: 2,
                        trashArea: []
                    }
                },
                [opponentId]: {
                    deck: { hand: [], handCount: 0 },
                    zones: {
                        base: [],
                        energyArea: [],
                        shieldArea: [],
                        shieldCount: 2,
                        trashArea: []
                    }
                }
            }
        };

        const context = new GameEnvAiContextAdapter().buildContext(gameEnvView, aiPlayerId);
        const candidates = new GameEnvAiActionAdapter().enumerateCandidates(context);
        const activateCandidates = candidates.filter((candidate) => candidate.kind === 'activate');

        expect(activateCandidates.length).toBeGreaterThanOrEqual(3);
        expect(activateCandidates.some((candidate) => candidate.telemetry.source === 'command_planner' && candidate.telemetry.carduid === 'cmd_draw')).toBe(true);
        expect(activateCandidates.some((candidate) => candidate.telemetry.source === 'command_planner' && candidate.telemetry.carduid === 'cmd_draw_two')).toBe(true);
        expect(activateCandidates.some((candidate) => candidate.telemetry.source === 'field_ability_planner' && candidate.telemetry.carduid === 'base_draw')).toBe(true);
    });

    test('enumerates multiple explicit target lines for target-heavy command effects', () => {
        const aiPlayerId = 'player_ai';
        const opponentId = 'player_op';
        const gameEnvView = {
            phase: GamePhase.MAIN_PHASE,
            currentPlayer: aiPlayerId,
            currentTurn: 4,
            playerId_1: aiPlayerId,
            playerId_2: opponentId,
            notificationQueue: [],
            players: {
                [aiPlayerId]: {
                    deck: {
                        hand: [
                            createCommandWithTarget('cmd_damage', 'damage')
                        ],
                        handCount: 1
                    },
                    zones: {
                        base: [],
                        energyArea: [{ isRested: false }, { isRested: false }],
                        shieldArea: [],
                        shieldCount: 2,
                        trashArea: []
                    }
                },
                [opponentId]: {
                    deck: { hand: [], handCount: 0 },
                    zones: {
                        slot1: { unit: createUnit('enemy_a', 4, 5, true) },
                        slot2: { unit: createUnit('enemy_b', 3, 4, true) },
                        base: [],
                        energyArea: [],
                        shieldArea: [],
                        shieldCount: 2,
                        trashArea: []
                    }
                }
            }
        };

        const context = new GameEnvAiContextAdapter().buildContext(gameEnvView, aiPlayerId);
        const candidates = new GameEnvAiActionAdapter().enumerateCandidates(context);
        const commandLines = candidates.filter(
            (candidate) => candidate.kind === 'activate' && candidate.telemetry.carduid === 'cmd_damage'
        );

        expect(commandLines.length).toBeGreaterThanOrEqual(2);
        expect(commandLines.map((candidate) => candidate.decision.payload.targetCarduid).sort()).toEqual(['enemy_a', 'enemy_b']);
    });

    test('enumerates action-step tricks before battle confirmation', () => {
        const aiPlayerId = 'player_ai';
        const opponentId = 'player_op';
        const gameEnvView = {
            phase: GamePhase.ACTION_STEP_PHASE,
            currentPlayer: aiPlayerId,
            currentTurn: 4,
            playerId_1: aiPlayerId,
            playerId_2: opponentId,
            currentBattle: {
                status: 'ACTION_STEP',
                actionType: 'attackUnit',
                attackingPlayerId: aiPlayerId,
                defendingPlayerId: opponentId,
                attackerCarduid: 'attacker',
                targetCarduid: 'defender',
                confirmations: {
                    [aiPlayerId]: false,
                    [opponentId]: false
                },
                actionTargets: {
                    [aiPlayerId]: [{ carduid: 'cmd_action', location: 'hand', effectIds: ['cmd_action_effect'] }]
                }
            },
            notificationQueue: [],
            players: {
                [aiPlayerId]: {
                    deck: {
                        hand: [
                            createCommandWithTarget('cmd_action', 'damage', 'ACTION_STEP')
                        ],
                        handCount: 1
                    },
                    zones: {
                        slot1: {
                            unit: createUnit('attacker', 4, 4, false),
                            fieldCardValue: { totalAP: 4, totalHP: 4, totalDamageReceived: 0 }
                        },
                        base: [],
                        energyArea: [{ isRested: false }, { isRested: false }],
                        shieldArea: [],
                        shieldCount: 2,
                        trashArea: []
                    }
                },
                [opponentId]: {
                    deck: { hand: [], handCount: 0 },
                    zones: {
                        slot1: {
                            unit: createUnit('defender', 3, 4, false),
                            fieldCardValue: { totalAP: 3, totalHP: 4, totalDamageReceived: 0 }
                        },
                        slot2: { unit: createUnit('enemy_action_target', 5, 5, false) },
                        base: [],
                        energyArea: [],
                        shieldArea: [],
                        shieldCount: 2,
                        trashArea: []
                    }
                }
            }
        };

        const context = new GameEnvAiContextAdapter().buildContext(gameEnvView, aiPlayerId);
        const candidates = new GameEnvAiActionAdapter().enumerateCandidates(context);
        const actionStepAbilities = candidates.filter((candidate) => candidate.kind === 'activate');
        const confirmations = candidates.filter((candidate) => candidate.kind === 'battleConfirm');

        expect(context.windowKind).toBe('ACTION_STEP');
        expect(actionStepAbilities.length).toBeGreaterThan(0);
        expect(confirmations.length).toBe(1);
    });

    test('enumerates multiple target lines for activated abilities during action step', () => {
        const aiPlayerId = 'player_ai';
        const opponentId = 'player_op';
        const gameEnvView = {
            phase: GamePhase.ACTION_STEP_PHASE,
            currentPlayer: aiPlayerId,
            currentTurn: 4,
            playerId_1: aiPlayerId,
            playerId_2: opponentId,
            currentBattle: {
                status: 'ACTION_STEP',
                actionType: 'attackUnit',
                attackingPlayerId: aiPlayerId,
                defendingPlayerId: opponentId,
                attackerCarduid: 'attacker',
                targetCarduid: 'defender',
                confirmations: {
                    [aiPlayerId]: false,
                    [opponentId]: false
                },
                actionTargets: {
                    [aiPlayerId]: [{ carduid: 'base_action', location: 'base', effectIds: ['base_action_effect'] }]
                }
            },
            notificationQueue: [],
            players: {
                [aiPlayerId]: {
                    deck: {
                        hand: [],
                        handCount: 0
                    },
                    zones: {
                        slot1: {
                            unit: createUnit('attacker', 4, 4, false),
                            fieldCardValue: { totalAP: 4, totalHP: 4, totalDamageReceived: 0 }
                        },
                        base: [createBaseWithTarget('base_action', 'damage', 'ACTION_STEP')],
                        energyArea: [{ isRested: false }, { isRested: false }],
                        shieldArea: [],
                        shieldCount: 2,
                        trashArea: []
                    }
                },
                [opponentId]: {
                    deck: { hand: [], handCount: 0 },
                    zones: {
                        slot1: {
                            unit: createUnit('defender', 3, 4, false),
                            fieldCardValue: { totalAP: 3, totalHP: 4, totalDamageReceived: 0 }
                        },
                        slot2: { unit: createUnit('enemy_action_target_a', 5, 5, false) },
                        slot3: { unit: createUnit('enemy_action_target_b', 2, 3, true) },
                        base: [],
                        energyArea: [],
                        shieldArea: [],
                        shieldCount: 2,
                        trashArea: []
                    }
                }
            }
        };

        const context = new GameEnvAiContextAdapter().buildContext(gameEnvView, aiPlayerId);
        const candidates = new GameEnvAiActionAdapter().enumerateCandidates(context);
        const abilityTargets = candidates
            .filter((candidate) => candidate.kind === 'activate' && candidate.telemetry.carduid === 'base_action')
            .map((candidate) => candidate.telemetry.selectedTargets?.[0]?.carduid)
            .filter(Boolean)
            .sort();

        expect(context.windowKind).toBe('ACTION_STEP');
        expect(abilityTargets).toEqual(['defender', 'enemy_action_target_a', 'enemy_action_target_b']);
    });

    test('enumerates multiple prompt target combinations instead of one default selection', () => {
        const aiPlayerId = 'player_ai';
        const opponentId = 'player_op';
        const gameEnvView = {
            phase: GamePhase.MAIN_PHASE,
            currentPlayer: opponentId,
            currentTurn: 4,
            playerId_1: aiPlayerId,
            playerId_2: opponentId,
            notificationQueue: [
                {
                    id: 'multi_target_choice',
                    type: 'TARGET_CHOICE',
                    payload: {
                        playerId: aiPlayerId,
                        isCompleted: false,
                        event: {
                            id: 'multi_target_choice',
                            type: 'TARGET_CHOICE',
                            playerId: aiPlayerId,
                            data: {
                                effect: {
                                    effectId: 'effect_multi_target',
                                    action: 'damage',
                                    optional: false,
                                    target: {
                                        count: 2,
                                        scope: 'opponent'
                                    }
                                },
                                availableTargets: [
                                    { carduid: 'enemy_a', zone: 'slot1', playerId: opponentId, cardData: { ap: 5, hp: 5 } },
                                    { carduid: 'enemy_b', zone: 'slot2', playerId: opponentId, cardData: { ap: 4, hp: 4 } },
                                    { carduid: 'enemy_c', zone: 'slot3', playerId: opponentId, cardData: { ap: 1, hp: 2 } }
                                ]
                            }
                        }
                    }
                }
            ],
            players: {
                [aiPlayerId]: {
                    deck: { hand: [], handCount: 0 },
                    zones: {
                        base: [],
                        energyArea: [],
                        shieldArea: [],
                        shieldCount: 2,
                        trashArea: []
                    }
                },
                [opponentId]: {
                    deck: { hand: [], handCount: 0 },
                    zones: {
                        base: [],
                        energyArea: [],
                        shieldArea: [],
                        shieldCount: 2,
                        trashArea: []
                    }
                }
            }
        };

        const context = new GameEnvAiContextAdapter().buildContext(gameEnvView, aiPlayerId);
        const candidates = new GameEnvAiActionAdapter().enumerateCandidates(context);
        const targetChoiceCandidates = candidates
            .filter((candidate) => candidate.kind === 'prompt' && candidate.decision.kind === 'confirmTargetChoice')
            .map((candidate) => candidate.decision.payload.selectedTargets.map((target) => target.carduid).sort().join('+'))
            .sort();

        expect(context.windowKind).toBe('OWNED_PROMPT');
        expect(targetChoiceCandidates).toEqual(['enemy_a+enemy_b', 'enemy_a+enemy_c', 'enemy_b+enemy_c']);
    });
});
