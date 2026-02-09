const { GameEnvironment } = require('../models/GameEnvironment');
const { BaseAbilityManager } = require('../services/effects/BaseAbilityManager');

describe('exileFromTrash cost (activated abilities)', () => {
    test('auto-exiles exactly N matching trash cards and emits notification', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        // Exactly 3 matching Titans cards in trash.
        p1.zones.trashArea = [
            {
                carduid: 'GD03-014_trash_0001',
                cardId: 'GD03-014',
                cardData: { id: 'GD03-014', cardType: 'unit', traits: ['Titans'] },
                originalAP: 0,
                originalHP: 0
            },
            {
                carduid: 'GD03-014_trash_0002',
                cardId: 'GD03-014',
                cardData: { id: 'GD03-014', cardType: 'unit', traits: ['Titans'] },
                originalAP: 0,
                originalHP: 0
            },
            {
                carduid: 'GD03-014_trash_0003',
                cardId: 'GD03-014',
                cardData: { id: 'GD03-014', cardType: 'unit', traits: ['Titans'] },
                originalAP: 0,
                originalHP: 0
            }
        ];

        // Unit with activated ability costing exileFromTrash then granting breach.
        p1.zones.slot1.unit = {
            carduid: 'GD03-015_unit_0001',
            cardId: 'GD03-015',
            placedAt: 0,
            placedBy: 'playerId_1',
            isRested: false,
            damageReceived: 0,
            modifyAP: 0,
            modifyHP: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            originalAP: 4,
            originalHP: 5,
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            isFirstPlay: false,
            temporaryEffects: [],
            effectUsage: {},
            cardData: {
                id: 'GD03-015',
                name: 'Baund Doc',
                cardType: 'unit',
                traits: ['Titans'],
                ap: 4,
                hp: 5,
                effects: {
                    description: [],
                    rules: [
                        {
                            effectId: 'activate_effect',
                            type: 'activated',
                            timing: { windows: ['MAIN_PHASE'], duration: 'UNTIL_END_OF_TURN' },
                            cost: {
                                oncePerTurn: true,
                                exileFromTrash: {
                                    scope: 'self_trash',
                                    traitsAny: ['Titans'],
                                    count: 3
                                }
                            },
                            action: 'grant_breach',
                            target: { type: 'unit', scope: 'self', count: 1 },
                            parameters: { value: 4 }
                        }
                    ]
                }
            }
        };

        const result = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'player_action_1',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: 'GD03-015_unit_0001',
                effectId: 'activate_effect'
            }
        });

        expect(result.success).toBe(true);
        expect(Array.isArray(p1.zones.trashArea)).toBe(true);
        expect(p1.zones.trashArea.length).toBe(0);

        const types = (gameEnv.notificationQueue || []).map((notification) => notification.type);
        expect(types).toContain('CARDS_EXILED_FROM_TRASH');
        expect(types).toContain('KEYWORD_GRANTED');
    });
});

