const { loadTestScenario, injectGameState, performPlayerAction } = require('./testHelpers');

describe('Card Effects', () => {
    let gameId;

    beforeEach(() => {
        // Set NODE_ENV to test
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        // Reset NODE_ENV
        process.env.NODE_ENV = 'development';
    });

    describe('Wind Effect', () => {
        beforeEach(async () => {
            const scenario = await loadTestScenario('windEffect');
            const result = await injectGameState(scenario);
            gameId = result.gameId;
        });

        it('should apply wind effect correctly', async () => {
            // Play a wind monster card (天馬)
            const result = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,
                field_idx: 0
            });

            // Check if the card was played correctly
            expect(result.gameEnv.playerId_1.Field.top[0].card[0]).toBe('s47');
            expect(result.gameEnv.playerId_1.Field.top[0].cardDetails[0].power).toBe(50);
        });
    });

    describe('All Attribute Effect', () => {
        beforeEach(async () => {
            const scenario = await loadTestScenario('allAttributeEffect');
            const result = await injectGameState(scenario);
            gameId = result.gameId;
        });

        it('should apply all attribute effect correctly', async () => {
            // Play a card with all attribute
            const result = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,
                field_idx: 0
            });
            // Check if the card was played correctly
            expect(result.gameEnv.playerId_1.Field.top[0].card[0]).toBe('s109');
            expect(result.gameEnv.playerId_1.Field.top[0].cardDetails[0].power).toBe(60);
            expect(result.gameEnv.playerId_1.Field.top[0].valueOnField).toBe(130);
        });
    });

    
}); 