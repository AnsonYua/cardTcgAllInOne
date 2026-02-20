const { findBestCommandAction } = require('../services/ai/AiCommandPlanner');

function createUnit(carduid, ap, hp, damageReceived = 0) {
    return {
        carduid,
        cardData: { cardType: 'unit', ap, hp, level: 1 },
        damageReceived,
        isRested: false,
        canAttackThisTurn: true,
        playedThisTurn: false,
        canAttackOnPlayTurn: true
    };
}

describe('AiCommandPlanner shared slot HP model', () => {
    test('targets by slot remaining HP without subtracting damage twice', () => {
        const aiPlayerId = 'player_ai';
        const opponentId = 'player_op';

        const damageCommand = {
            carduid: 'cmd_damage_1',
            cardData: {
                cardType: 'command',
                cost: 0,
                level: 0,
                effects: {
                    rules: [
                        {
                            effectId: 'main_damage_1',
                            type: 'play',
                            action: 'damage',
                            timing: { windows: ['MAIN_PHASE'] },
                            target: { type: 'unit', scope: 'opponent', count: 1 },
                            parameters: { value: 1 }
                        }
                    ]
                }
            }
        };

        const gameEnvView = {
            phase: 'MAIN_PHASE',
            playerId_1: aiPlayerId,
            playerId_2: opponentId,
            players: {
                [aiPlayerId]: {
                    deck: { hand: [damageCommand] },
                    zones: {
                        energyArea: [{ isRested: false }]
                    }
                },
                [opponentId]: {
                    zones: {
                        slot1: {
                            unit: createUnit('target_a', 1, 4, 2),
                            fieldCardValue: { totalAP: 1, totalHP: 2, totalDamageReceived: 2 }
                        },
                        slot2: {
                            unit: createUnit('target_b', 1, 3, 0),
                            fieldCardValue: { totalAP: 1, totalHP: 3, totalDamageReceived: 0 }
                        }
                    }
                }
            }
        };

        const decision = findBestCommandAction(gameEnvView, aiPlayerId);
        expect(decision).toBeTruthy();
        expect(decision.payload.actionType).toBe('useCommandCard');
        expect(decision.payload.carduid).toBe('cmd_damage_1');
        expect(decision.payload.targetCarduid).toBe('target_b');
    });
});
