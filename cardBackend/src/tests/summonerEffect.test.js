const { loadTestScenario, injectGameState, performPlayerAction } = require('./testHelpers');

describe('Summoner Effects', () => {
    let gameId;

    beforeEach(() => {
        // Set NODE_ENV to test
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        // Reset NODE_ENV
        process.env.NODE_ENV = 'development';
    });
    
    describe('Opponent Summoner Effect', () => {
        beforeEach(async () => {
            const scenario = await loadTestScenario('summonerEffect');
            const result = await injectGameState(scenario);
            gameId = result.gameId;
        });

        it('should modify native addition when opponent has 顧寧特', async () => {
            // Play a wind monster card
            const result = await performPlayerAction(gameId, 'playerId_1', {
                type: 'PlayCard',
                card_idx: 0,
                field_idx: 0
            });
            console.log("-----------result------------");
            console.log(JSON.stringify(result, null, 2));
            console.log("--------------------------------");

            // Check if the card was played correctly and effect was applied
            expect(result.gameEnv.playerId_1.Field.top[0].card[0]).toBe('s47');
            expect(result.gameEnv.playerId_1.Field.top[0].cardDetails[0].power).toBe(50);
            // Since opponent has 師顧寧特, wind bonus should be 0 instead of 50+60 110
            expect(result.gameEnv.playerId_1.Field.top[0].valueOnField).toBe(50);
        });

    });
    
}); 