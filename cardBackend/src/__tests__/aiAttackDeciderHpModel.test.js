const { findBestUnitAttack } = require('../services/ai/AiAttackDecider');

function createUnit(carduid, ap, hp, damageReceived = 0, isRested = false) {
    return {
        carduid,
        cardData: { cardType: 'unit', ap, hp, level: 1 },
        damageReceived,
        isRested,
        canAttackThisTurn: true,
        playedThisTurn: false,
        canAttackOnPlayTurn: true
    };
}

describe('AiAttackDecider shared slot HP model', () => {
    test('uses slot field totalHP directly and does not double-subtract damage', () => {
        const aiPlayerId = 'player_ai';
        const opponentId = 'player_op';

        const gameEnvView = {
            playerId_1: aiPlayerId,
            playerId_2: opponentId,
            players: {
                [aiPlayerId]: {
                    zones: {
                        slot1: {
                            unit: createUnit('atk_unit', 1, 10, 0, false),
                            fieldCardValue: { totalAP: 1, totalHP: 10 }
                        }
                    }
                },
                [opponentId]: {
                    zones: {
                        slot1: {
                            unit: createUnit('target_a', 6, 4, 2, true),
                            fieldCardValue: { totalAP: 6, totalHP: 2, totalDamageReceived: 2 }
                        },
                        slot2: {
                            unit: createUnit('target_b', 6, 3, 0, true),
                            fieldCardValue: { totalAP: 6, totalHP: 3, totalDamageReceived: 0 }
                        }
                    }
                }
            }
        };

        const decision = findBestUnitAttack(gameEnvView, aiPlayerId, opponentId);
        expect(decision).toBeTruthy();
        expect(decision.payload.actionType).toBe('attackUnit');
        expect(decision.payload.targetUnitUid).toBe('target_b');
    });
});
