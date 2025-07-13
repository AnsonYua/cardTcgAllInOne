const { loadTestScenario, injectGameState, makePostRequest, performPlayerAction } = require('./testHelpers');

describe('Leader Restrictions', () => {
    let gameId;

    beforeEach(() => {
        // Set NODE_ENV to test
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        // Reset NODE_ENV
        process.env.NODE_ENV = 'development';
    });
    
    describe('Dragon Summon Name Restriction', () => {
        beforeEach(async () => {
            const scenario = await loadTestScenario('summonerRestriction_SummonerName');
            const result = await injectGameState(scenario);
            gameId = result.gameId;
        });

        it('should prevent playing dragon cards when restricted', async () => {
            // Player 1 ready (player 2 is already ready in the scenario)
            await makePostRequest('/player/startReady', {
                playerId: "playerId_1",
                gameId: gameId,
                redraw: false
            });

            // Try to play a dragon card
            const result = await performPlayerAction(gameId, 'playerId_2', {
                type: "PlayCard",
                card_idx: 0,  // d001 is the first card in hand
                field_idx: 0  // top position
            });
           
            console.log("-----------result------------");
            console.log(result);
            console.log("--------------------------------");
            // Should return error
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Cannot summon dragon type monsters due to leader effect');
        });
    });

    
    describe('Dragon Summon Type Restriction', () => {
        beforeEach(async () => {
            const scenario = await loadTestScenario('summonerRestriction_SummonerType');
            const result = await injectGameState(scenario);
            gameId = result.gameId;
        });

        it('should prevent playing dragon cards when restricted', async () => {
            // Player 1 ready (player 2 is already ready in the scenario)
            await makePostRequest('/player/startReady', {
                playerId: "playerId_1",
                gameId: gameId,
                redraw: false
            });

            // Try to play a dragon card
            const result = await performPlayerAction(gameId, 'playerId_2', {
                type: "PlayCard",
                card_idx: 0,  // d001 is the first card in hand
                field_idx: 0  // top position
            });
           
            console.log("-----------result------------");
            console.log(result);
            console.log("--------------------------------");
            // Should return error
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Cannot summon dragon type monsters due to leader effect');
        });
    });

    describe('Dragon Summon Type Restriction', () => {
        beforeEach(async () => {
            const scenario = await loadTestScenario('summonerRestriction_SummonerTypeNativeAddition');
            const result = await injectGameState(scenario);
            gameId = result.gameId;
        });
        //
        //  given S073E, when opponent having mechanic type
        //  S073E will not have nativeAddition
        //  test case : when play monster card when wind type
        //  expect nativeAddition should be 0
        //
        it('should not have any native addition when opponent has mechanic type for S073E', async () => {
            // Player 1 ready (player 2 is already ready in the scenario)
            await makePostRequest('/player/startReady', {
                playerId: "playerId_1",
                gameId: gameId,
                redraw: false
            });

            // Try to play a dragon card
            const result = await performPlayerAction(gameId, 'playerId_2', {
                type: "PlayCard",
                card_idx: 0,  // d001 is the first card in hand
                field_idx: 0  // top position
            });
            expect(result.gameEnv.playerId_2.Field.top[0].card[0]).toBe('s52');
            expect(result.gameEnv.playerId_2.Field.top[0].cardDetails[0].power).toBe(70);
        });
    });
   

    describe('Dragon Summon Type Restriction', () => {
        beforeEach(async () => {
            const scenario = await loadTestScenario('summonerRestriction_SummonerTypeBlockSp');
            const result = await injectGameState(scenario);
            gameId = result.gameId;
        });

        it('should prevent playing dragon cards when restricted', async () => {
            // Player 1 ready (player 2 is already ready in the scenario)
            await makePostRequest('/player/startReady', {
                playerId: "playerId_1",
                gameId: gameId,
                redraw: false
            });

            // Try to play a dragon card
            const result = await performPlayerAction(gameId, 'playerId_2', {
                type: "PlayCard",
                card_idx: 0,  // d001 is the first card in hand
                field_idx: 4  // sp position
            });
           
            console.log("-----------result------------");
            console.log(result);
            console.log("--------------------------------");
            // Should return error
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Cannot summon sp due to leader effect');
        });
    });
    
    describe('Dragon Summon Type Restriction', () => {
        beforeEach(async () => {
            const scenario = await loadTestScenario('summonerRestriction_SummonerTypeBlockTop');
            const result = await injectGameState(scenario);
            gameId = result.gameId;
        });

        it('should prevent playing dragon cards when restricted', async () => {
            // Player 1 ready (player 2 is already ready in the scenario)
            await makePostRequest('/player/startReady', {
                playerId: "playerId_1",
                gameId: gameId,
                redraw: false
            });

            // Try to play a dragon card
            const result = await performPlayerAction(gameId, 'playerId_1', {
                type: "PlayCard",
                card_idx: 0,  // d001 is the first card in hand
                field_idx: 0  // top position
            });
           
            console.log("-----------result------------");
            console.log(result);
            console.log("--------------------------------");
            // Should return error
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Cannot summon beast type monsters due to leader effect type 2');
        });
    });
}); 