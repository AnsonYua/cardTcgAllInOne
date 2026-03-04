const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { EventStatus } = require('../services/EventQueue/interfaces/GameEvent');
const { DeployTargetManager } = require('../services/DeployTargetManager');

describe('TARGET_CHOICE selected target hydration', () => {
    test('hydrates selectedTargets from availableTargets so card identity is preserved in add-to-hand notifications', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const chosenUid = 'GD02-088_trash_p1_0001';
        const otherUid = 'GD02-089_trash_p1_0002';

        player.zones.trashArea.push(
            {
                carduid: chosenUid,
                cardId: 'GD02-088',
                cardData: {
                    id: 'GD02-088',
                    name: 'Flit Asuno',
                    cardType: 'pilot',
                    color: 'Green',
                    level: 3,
                    cost: 1,
                    traits: ['Asuno Family'],
                    effects: { rules: [] },
                },
            },
            {
                carduid: otherUid,
                cardId: 'GD02-089',
                cardData: {
                    id: 'GD02-089',
                    name: 'Lalah Sune',
                    cardType: 'pilot',
                    color: 'Green',
                    level: 4,
                    cost: 1,
                    traits: ['Newtype'],
                    effects: { rules: [] },
                },
            }
        );

        const event = {
            id: 'target_choice_hydration_1',
            type: EventType.TARGET_CHOICE,
            status: EventStatus.RESOLVING,
            priority: 0,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                choiceId: 'target_choice_hydration',
                userDecisionMade: true,
                sourceCarduid: 'GD02-103_shield_p1_0001',
                effect: {
                    effectId: 'burst_step_add_to_hand',
                    type: 'internal',
                    trigger: 'SEQUENCE_STEP',
                    action: 'addToHand',
                    target: {
                        type: 'card',
                        scope: 'self_trash',
                        count: 1,
                        selection: { type: 'player_choice' },
                    },
                    parameters: {
                        from: 'trash',
                    },
                },
                availableTargets: [
                    {
                        carduid: chosenUid,
                        zone: 'trash',
                        playerId: 'playerId_1',
                        cardData: {
                            id: 'GD02-088',
                            name: 'Flit Asuno',
                            cardType: 'pilot',
                            traits: ['Asuno Family'],
                        },
                        tags: ['pilot'],
                        computed: { totalAP: 0, totalHP: 1 },
                    },
                    {
                        carduid: otherUid,
                        zone: 'trash',
                        playerId: 'playerId_1',
                        cardData: {
                            id: 'GD02-089',
                            name: 'Lalah Sune',
                            cardType: 'pilot',
                            traits: ['Newtype'],
                        },
                    },
                ],
                // Frontend payload format: minimal tuple only.
                selectedTargets: [
                    {
                        carduid: chosenUid,
                        zone: 'trash',
                        playerId: 'playerId_1',
                    },
                ],
            },
        };

        const result = DeployTargetManager.executeTargetChoice(event, gameEnv);
        expect(result.success).toBe(true);

        expect(player.deck._handUids.includes(chosenUid)).toBe(true);
        expect(player.zones.trashArea.some((card) => card.carduid === chosenUid)).toBe(false);
        expect(player.zones.trashArea.some((card) => card.carduid === otherUid)).toBe(true);

        const addToHandEvent = (gameEnv.notificationQueue || [])
            .slice()
            .reverse()
            .find((note) => note.type === 'CARD_ADDED_TO_HAND');
        expect(addToHandEvent).toBeTruthy();
        expect(addToHandEvent.payload.cardId).toBe('GD02-088');
        expect(addToHandEvent.payload.cardName).toBe('Flit Asuno');
        expect(addToHandEvent.payload.sourceZone).toBe('trash');
        expect(addToHandEvent.payload.revealToOpponent).toBe(true);
    });
});
