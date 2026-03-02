const { GameEnvironment } = require('../models/GameEnvironment');
const { DeployTargetManager } = require('../services/DeployTargetManager');

describe('GD02-103 burst add-to-hand visibility contract', () => {
    test('burst-origin sequence addToHand emits CARD_ADDED_TO_HAND with reason=burst and card identity', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const targetCarduid = 'GD02-088_trash_p1_0001';
        player.zones.trashArea.push({
            carduid: targetCarduid,
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
        });

        const effect = {
            effectId: 'burst_effect',
            type: 'triggered',
            trigger: 'BURST_CONDITION',
            action: 'sequence',
            parameters: {
                steps: [
                    {
                        action: 'addToHand',
                        target: {
                            type: 'card',
                            scope: 'self_trash',
                            count: 1,
                            selection: { type: 'player_choice' },
                            filters: {
                                cardType: 'pilot',
                                traits: ['Asuno Family'],
                            },
                        },
                        parameters: {
                            from: 'trash',
                            value: 1,
                        },
                    },
                ],
            },
        };

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD02-103_shield_p1_0001',
            effect
        );

        expect(result.success).toBe(true);
        expect(player.deck._handUids.includes(targetCarduid)).toBe(true);
        expect(player.zones.trashArea.some((card) => card.carduid === targetCarduid)).toBe(false);

        const addToHandEvent = (gameEnv.notificationQueue || [])
            .slice()
            .reverse()
            .find((note) => note.type === 'CARD_ADDED_TO_HAND');
        expect(addToHandEvent).toBeTruthy();
        expect(addToHandEvent.payload.reason).toBe('burst');
        expect(addToHandEvent.payload.cardId).toBe('GD02-088');
        expect(addToHandEvent.payload.cardName).toBe('Flit Asuno');
    });
});
