const { GamePhase } = require('../models/GameEnums');
const { GameEnvAiContextAdapter } = require('../services/ai/v1/AiV1ContextAdapter');
const { GameEnvAiActionAdapter } = require('../services/ai/v1/AiV1CandidateEnumerator');

function createUnit(carduid, ap = 2, hp = 3, withPilot = false) {
    return {
        unit: {
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
            isRested: false,
            playedThisTurn: false,
            canAttackThisTurn: true,
            canAttackOnPlayTurn: true
        },
        ...(withPilot
            ? {
                pilot: {
                    carduid: `${carduid}_pilot`,
                    cardId: `${carduid}_pilot`,
                    cardData: {
                        cardType: 'pilot',
                        name: `${carduid}_pilot`,
                        ap: 1,
                        hp: 1
                    },
                    originalAP: 1,
                    originalHP: 1,
                    damageReceived: 0,
                    isRested: false
                }
            }
            : {})
    };
}

function createPilotCard(carduid) {
    return {
        carduid,
        cardData: {
            cardType: 'pilot',
            name: carduid,
            cost: 1,
            level: 1,
            effectiveCost: 1,
            effectiveLevel: 1
        }
    };
}

function createUnitCard(carduid) {
    return {
        carduid,
        cardData: {
            cardType: 'unit',
            name: carduid,
            cost: 1,
            level: 1,
            effectiveCost: 1,
            effectiveLevel: 1,
            ap: 2,
            hp: 3
        }
    };
}

describe('GameEnvAiActionAdapter play-card enumeration', () => {
    test('enumerates a pairing candidate for each eligible unpaired unit', () => {
        const aiPlayerId = 'player_ai';
        const opponentId = 'player_op';
        const gameEnvView = {
            phase: GamePhase.MAIN_PHASE,
            currentPlayer: aiPlayerId,
            currentTurn: 5,
            playerId_1: aiPlayerId,
            playerId_2: opponentId,
            notificationQueue: [],
            players: {
                [aiPlayerId]: {
                    deck: {
                        hand: [createPilotCard('pilot_card')],
                        handCount: 1
                    },
                    zones: {
                        slot1: createUnit('unit_1', 2, 3, false),
                        slot2: createUnit('unit_2', 2, 3, false),
                        energyArea: [{ isRested: false }, { isRested: false }],
                        shieldArea: [],
                        shieldCount: 2,
                        trashArea: [],
                        base: []
                    }
                },
                [opponentId]: {
                    deck: { hand: [], handCount: 0 },
                    zones: {
                        energyArea: [],
                        shieldArea: [],
                        shieldCount: 2,
                        trashArea: [],
                        base: []
                    }
                }
            }
        };

        const context = new GameEnvAiContextAdapter().buildContext(gameEnvView, aiPlayerId);
        const candidates = new GameEnvAiActionAdapter().enumerateCandidates(context);
        const pairCandidates = candidates.filter(
            (candidate) => candidate.kind === 'playCard' && candidate.telemetry.playAs === 'pilot'
        );

        expect(pairCandidates).toHaveLength(2);
        expect(pairCandidates.map((candidate) => candidate.telemetry.targetUnit).sort()).toEqual(['unit_1', 'unit_2']);
    });

    test('enumerates replacement candidates for each occupied slot on a full board', () => {
        const aiPlayerId = 'player_ai';
        const opponentId = 'player_op';
        const aiZones = {
            energyArea: [{ isRested: false }, { isRested: false }],
            shieldArea: [],
            shieldCount: 2,
            trashArea: [],
            base: []
        };

        ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'].forEach((slotName, index) => {
            aiZones[slotName] = createUnit(`board_unit_${index + 1}`, 2 + index, 3 + index, false);
        });

        const gameEnvView = {
            phase: GamePhase.MAIN_PHASE,
            currentPlayer: aiPlayerId,
            currentTurn: 5,
            playerId_1: aiPlayerId,
            playerId_2: opponentId,
            notificationQueue: [],
            players: {
                [aiPlayerId]: {
                    deck: {
                        hand: [createUnitCard('new_unit')],
                        handCount: 1
                    },
                    zones: aiZones
                },
                [opponentId]: {
                    deck: { hand: [], handCount: 0 },
                    zones: {
                        energyArea: [],
                        shieldArea: [],
                        shieldCount: 2,
                        trashArea: [],
                        base: []
                    }
                }
            }
        };

        const context = new GameEnvAiContextAdapter().buildContext(gameEnvView, aiPlayerId);
        const candidates = new GameEnvAiActionAdapter().enumerateCandidates(context);
        const replacementCandidates = candidates.filter(
            (candidate) => candidate.kind === 'playCard' && candidate.telemetry.isReplacement === true
        );

        expect(replacementCandidates).toHaveLength(6);
        expect(replacementCandidates.map((candidate) => candidate.telemetry.destinationSlot).sort()).toEqual([
            'slot1',
            'slot2',
            'slot3',
            'slot4',
            'slot5',
            'slot6'
        ]);
    });
});
