const { GamePhase } = require('../models/GameEnums');
const { GameAiService } = require('../services/ai/GameAiService');

function createUnit(carduid, ap, hp, isRested = false) {
    return {
        carduid,
        cardData: {
            cardType: 'unit',
            name: carduid,
            ap,
            hp
        },
        damageReceived: 0,
        isRested,
        playedThisTurn: false,
        canAttackThisTurn: true,
        canAttackOnPlayTurn: true
    };
}

describe('GameAiService v1 HP-aware combat', () => {
    test('prefers the unit attack that kills and survives over weaker trades', async () => {
        const aiPlayerId = 'player_ai';
        const opponentId = 'player_op';
        const gameEnvView = {
            phase: GamePhase.MAIN_PHASE,
            currentPlayer: aiPlayerId,
            currentTurn: 3,
            playerId_1: aiPlayerId,
            playerId_2: opponentId,
            notificationQueue: [],
            players: {
                [aiPlayerId]: {
                    deck: { hand: [], handCount: 0 },
                    zones: {
                        shieldCount: 3,
                        energyArea: [],
                        trashArea: [],
                        base: [],
                        slot1: {
                            unit: createUnit('attacker', 4, 4, false),
                            fieldCardValue: {
                                totalAP: 4,
                                totalHP: 4,
                                totalDamageReceived: 0
                            }
                        }
                    }
                },
                [opponentId]: {
                    deck: { hand: [], handCount: 0 },
                    zones: {
                        shieldCount: 3,
                        energyArea: [],
                        trashArea: [],
                        base: [],
                        slot1: {
                            unit: createUnit('bad_trade', 5, 5, true),
                            fieldCardValue: {
                                totalAP: 5,
                                totalHP: 5,
                                totalDamageReceived: 0
                            }
                        },
                        slot2: {
                            unit: createUnit('good_trade', 2, 4, true),
                            fieldCardValue: {
                                totalAP: 2,
                                totalHP: 4,
                                totalDamageReceived: 0
                            }
                        }
                    }
                }
            }
        };

        const decision = await GameAiService.decide(gameEnvView, aiPlayerId);

        expect(decision.kind).toBe('playerAction');
        expect(decision.payload.actionType).toBe('attackUnit');
        expect(decision.payload.targetUnitUid).toBe('good_trade');
    });
});
