const { EventPriority, EventStatus } = require('../services/EventQueue/interfaces/GameEvent');
const { EventType, GamePhase } = require('../models/GameEnums');
const { GameEnvironment } = require('../models/GameEnvironment');
const { GameEnvViewBuilder } = require('../services/views/GameEnvViewBuilder');
const { GameEnvAiContextAdapter } = require('../services/ai/v1/AiV1ContextAdapter');

function createUnit(carduid, ap, hp, damageReceived = 0) {
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
        damageReceived,
        isRested: false,
        playedThisTurn: false,
        canAttackThisTurn: true,
        canAttackOnPlayTurn: true
    };
}

describe('GameEnvAiContextAdapter', () => {
    test('builds notification-first owned prompt context with HP snapshots', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.phase = GamePhase.MAIN_PHASE;
        gameEnv.currentPlayer = 'playerId_2';

        gameEnv.players.playerId_2.zones.slot1.unit = createUnit('ai_unit', 3, 5, 2);
        gameEnv.players.playerId_2.zones.slot1.fieldCardValue = {
            totalAP: 3,
            totalHP: 3,
            totalDamageReceived: 2
        };

        const targetChoiceEvent = {
            id: 'target_choice_test',
            type: EventType.TARGET_CHOICE,
            status: EventStatus.DECLARED,
            priority: EventPriority.IMMEDIATE,
            playerId: 'playerId_2',
            timestamp: Date.now(),
            data: {
                choiceId: 'choice_target_choice_test',
                userDecisionMade: false,
                sourceCarduid: 'ai_unit',
                effect: {
                    effectId: 'effect_1',
                    action: 'damage',
                    optional: false,
                    target: {
                        count: 1,
                        scope: 'opponent'
                    }
                },
                availableTargets: []
            }
        };

        gameEnv.processingQueue = [targetChoiceEvent];
        gameEnv.notificationQueue = [
            {
                id: 'target_choice_test',
                type: 'TARGET_CHOICE',
                metadata: {
                    timestamp: Date.now(),
                    expiresAt: Number.MAX_SAFE_INTEGER,
                    requiresAcknowledgment: true,
                    priority: 'high'
                },
                payload: {
                    playerId: 'playerId_2',
                    isCompleted: false,
                    event: targetChoiceEvent
                }
            }
        ];

        const view = GameEnvViewBuilder.toPlayerView(gameEnv, 'playerId_2');
        const context = new GameEnvAiContextAdapter().buildContext(view, 'playerId_2', gameEnv);

        expect(context.windowKind).toBe('OWNED_PROMPT');
        expect(context.activePrompt).toBeTruthy();
        expect(context.activePrompt.eventId).toBe('target_choice_test');
        expect(context.self.units).toHaveLength(1);
        expect(context.self.units[0].hp.totalHp).toBe(3);
        expect(context.self.units[0].hp.damageReceived).toBe(2);
        expect(context.self.units[0].hp.remainingHp).toBe(3);
    });
});
