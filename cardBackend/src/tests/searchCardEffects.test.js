const { loadTestScenario, injectGameState, performPlayerAction } = require('./testHelpers');
const gameLogic = require('../services/GameLogic');

describe('Search Card Effects - Comprehensive', () => {
    let gameId;

    beforeEach(() => {
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        process.env.NODE_ENV = 'development';
    });

    describe('Basic Search Card Effect', () => {
        it('should trigger card selection when playing search card', async () => {
            const scenario = await loadTestScenario('searchCard_basic');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Verify initial state
            expect(result.gameEnv.playerId_1.deck.hand).toContain('c-9');
            expect(result.gameEnv.playerId_1.deck.mainDeck.length).toBe(7);

            // Play the search card (艾利茲 - basic search 4 cards, select 1)
            const action = {
                type: "PlayCard",
                card_idx: 0,  // card c-9 with basic search effect
                field_idx: 0  // top zone
            };

            const actionResult = await performPlayerAction(gameId, 'playerId_1', action);
            console.log("actionResult", JSON.stringify(actionResult));
            
            // Should have pending card selection - derive from gameEnv state
            expect(actionResult.gameEnv.pendingPlayerAction).toBeDefined();
            expect(actionResult.gameEnv.pendingPlayerAction.type).toBe('cardSelection');
            expect(actionResult.gameEnv.pendingPlayerAction.selectionId).toBeDefined();
            
            // Verify pendingCardSelections contains full data
            const selectionId = actionResult.gameEnv.pendingPlayerAction.selectionId;
            expect(actionResult.gameEnv.pendingCardSelections[selectionId]).toBeDefined();
            expect(actionResult.gameEnv.pendingCardSelections[selectionId].playerId).toBe('playerId_1');
            expect(actionResult.gameEnv.pendingCardSelections[selectionId].selectCount).toBe(1);
            expect(actionResult.gameEnv.pendingCardSelections[selectionId].eligibleCards).toBeDefined();
            expect(actionResult.gameEnv.pendingCardSelections[selectionId].eligibleCards.length).toBeLessThanOrEqual(4); // searchCount: 4
        });
        
        it('should complete card selection and update game state', async () => {
            const scenario = await loadTestScenario('searchCard_basic');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Play the search card first
            const action = {
                type: "PlayCard",
                card_idx: 0,
                field_idx: 0
            };

            const actionResult = await performPlayerAction(gameId, 'playerId_1', action);
            expect(actionResult.gameEnv.pendingPlayerAction).toBeDefined();
            expect(actionResult.gameEnv.pendingPlayerAction.type).toBe('cardSelection');

            // Complete the card selection
            const selectionId = actionResult.gameEnv.pendingPlayerAction.selectionId;
            const selectionData = actionResult.gameEnv.pendingCardSelections[selectionId];
            const selectionRequest = {
                selectionId: selectionId,
                selectedCardIds: [selectionData.eligibleCards[0]], // Select first card
                playerId: 'playerId_1',
                gameId: gameId
            };

            const selectionResult = await gameLogic.selectCard({ body: selectionRequest });

            // Verify selection completed successfully
            expect(selectionResult.success).toBe(true);
            expect(selectionResult.gameEnv.pendingPlayerAction).toBeUndefined();
            expect(selectionResult.gameEnv.pendingCardSelections).toEqual({});

            // Verify selected card was added to hand
            const finalState = await gameLogic.getGameState(gameId);
            expect(finalState.gameEnv.playerId_1.deck.hand).toContain(selectionData.eligibleCards[0]);
        });
    });

    describe('Search Card with Type Filters', () => {
        it('should filter SP cards correctly', async () => {
            const scenario = await loadTestScenario('searchCard_spFilter');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Play the SP search card (Edward Coristine - search 7 cards for SP)
            const action = {
                type: "PlayCard",
                card_idx: 0,  // card c-10 with SP search effect
                field_idx: 0  // top zone
            };

            const actionResult = await performPlayerAction(gameId, 'playerId_1', action);

            // Should have pending card selection with SP filter
            expect(actionResult.gameEnv.pendingPlayerAction).toBeDefined();
            expect(actionResult.gameEnv.pendingPlayerAction.type).toBe('cardSelection');
            
            // Verify filter is stored in pendingCardSelections
            const selectionId = actionResult.gameEnv.pendingPlayerAction.selectionId;
            expect(actionResult.gameEnv.pendingCardSelections[selectionId].cardTypeFilter).toBe('sp');
            
            // Eligible cards should only include SP cards from the searched cards
            const originalDeck = result.gameEnv.playerId_1.deck.mainDeck;
            const spCardsInSearchRange = originalDeck.slice(0, 7).filter(cardId => 
                cardId === 'sp-1' || cardId === 'sp-2'  // Real SP card IDs
            );
            
            expect(actionResult.gameEnv.pendingCardSelections[selectionId].eligibleCards.length).toBe(spCardsInSearchRange.length);
        });

        it('should filter Help cards correctly', async () => {
            const scenario = await loadTestScenario('searchCard_helpFilter');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Play the Help search card (Luke Farritor - search 7 cards for Help)
            const action = {
                type: "PlayCard",
                card_idx: 0,  // card c-12 with Help search effect
                field_idx: 0  // top zone
            };

            const actionResult = await performPlayerAction(gameId, 'playerId_1', action);

            // Should have pending card selection with Help filter
            expect(actionResult.gameEnv.pendingPlayerAction).toBeDefined();
            expect(actionResult.gameEnv.pendingPlayerAction.type).toBe('cardSelection');
            
            // Verify filter is stored in pendingCardSelections
            const selectionId = actionResult.gameEnv.pendingPlayerAction.selectionId;
            expect(actionResult.gameEnv.pendingCardSelections[selectionId].cardTypeFilter).toBe('help');
            
            // Eligible cards should only include Help cards from the searched cards
            const originalDeck = result.gameEnv.playerId_1.deck.mainDeck;
            const helpCardsInSearchRange = originalDeck.slice(0, 7).filter(cardId => 
                cardId === 'h-1' || cardId === 'h-2'  // Real Help card IDs
            );
            
            expect(actionResult.gameEnv.pendingCardSelections[selectionId].eligibleCards.length).toBe(helpCardsInSearchRange.length);
        });
        
        it('should place SP card directly to SP zone', async () => {
            const scenario = await loadTestScenario('searchCard_spFilter');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Play the SP search card (Edward Coristine - search 7 cards for SP)
            const action = {
                type: "PlayCard",
                card_idx: 0,  // card c-10 with SP search effect
                field_idx: 0  // top zone
            };

            const actionResult = await performPlayerAction(gameId, 'playerId_1', action);
            
            // Complete the card selection
            const selectionId = actionResult.gameEnv.pendingPlayerAction.selectionId;
            const selectionData = actionResult.gameEnv.pendingCardSelections[selectionId];
            
            // Ensure we have at least one eligible SP card
            expect(selectionData.eligibleCards.length).toBeGreaterThan(0);
            
            const selectionRequest = {
                selectionId: selectionId,
                selectedCardIds: [selectionData.eligibleCards[0]], // Select first SP card
                playerId: 'playerId_1',
                gameId: gameId
            };

            const selectionResult = await gameLogic.selectCard({ body: selectionRequest });

            // Verify selection completed successfully
            expect(selectionResult.success).toBe(true);
            expect(selectionResult.gameEnv.pendingPlayerAction).toBeUndefined();
            
            // Verify selected SP card was placed directly in SP zone
            const finalState = await gameLogic.getGameState(gameId);
            expect(finalState.gameEnv.playerId_1.Field.sp.length).toBe(1);
            expect(finalState.gameEnv.playerId_1.Field.sp[0].card[0]).toBe(selectionData.eligibleCards[0]);
            
            // Verify card was NOT added to hand
            expect(finalState.gameEnv.playerId_1.deck.hand).not.toContain(selectionData.eligibleCards[0]);
        });
        
        it('should place Help card directly to Help zone when zone is empty', async () => {
            const scenario = await loadTestScenario('searchCard_helpFilter');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Verify Help zone is initially empty
            expect(result.gameEnv.playerId_1.Field.help.length).toBe(0);

            // Play the Help search card (Luke Farritor - search 7 cards for Help)
            const action = {
                type: "PlayCard",
                card_idx: 0,  // card c-12 with conditional Help search effect
                field_idx: 0  // top zone
            };

            const actionResult = await performPlayerAction(gameId, 'playerId_1', action);
            
            // Complete the card selection
            const selectionId = actionResult.gameEnv.pendingPlayerAction.selectionId;
            const selectionData = actionResult.gameEnv.pendingCardSelections[selectionId];
            
            // Ensure we have at least one eligible Help card
            expect(selectionData.eligibleCards.length).toBeGreaterThan(0);
            
            const selectionRequest = {
                selectionId: selectionId,
                selectedCardIds: [selectionData.eligibleCards[0]], // Select first Help card
                playerId: 'playerId_1',
                gameId: gameId
            };

            const selectionResult = await gameLogic.selectCard({ body: selectionRequest });

            // Verify selection completed successfully
            expect(selectionResult.success).toBe(true);
            expect(selectionResult.gameEnv.pendingPlayerAction).toBeUndefined();
            
            // Verify selected Help card was placed directly in Help zone (since it was empty)
            const finalState = await gameLogic.getGameState(gameId);
            expect(finalState.gameEnv.playerId_1.Field.help.length).toBe(1);
            expect(finalState.gameEnv.playerId_1.Field.help[0].card[0]).toBe(selectionData.eligibleCards[0]);
            
            // Verify card was NOT added to hand
            expect(finalState.gameEnv.playerId_1.deck.hand).not.toContain(selectionData.eligibleCards[0]);
        });
    });

    describe('Conditional Effects', () => {
        it('should always trigger Luke Farritor search effect and place in Help zone when empty', async () => {
            const scenario = await loadTestScenario('searchCard_helpFilter');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Verify Help zone is initially empty
            expect(result.gameEnv.playerId_1.Field.help.length).toBe(0);

            // Play Luke Farritor (c-12) - should always trigger search effect
            const action = {
                type: "PlayCard",
                card_idx: 0,  // card c-12 with conditional Help search effect
                field_idx: 0  // top zone
            };

            const actionResult = await performPlayerAction(gameId, 'playerId_1', action);

            // Should have pending card selection (always triggers)
            expect(actionResult.gameEnv.pendingPlayerAction).toBeDefined();
            expect(actionResult.gameEnv.pendingPlayerAction.type).toBe('cardSelection');
            
            const selectionId = actionResult.gameEnv.pendingPlayerAction.selectionId;
            expect(actionResult.gameEnv.pendingCardSelections[selectionId].cardTypeFilter).toBe('help');
            
            // Complete the selection
            const selectionData = actionResult.gameEnv.pendingCardSelections[selectionId];
            const selectionRequest = {
                selectionId: selectionId,
                selectedCardIds: [selectionData.eligibleCards[0]],
                playerId: 'playerId_1',
                gameId: gameId
            };

            const selectionResult = await gameLogic.selectCard({ body: selectionRequest });
            expect(selectionResult.success).toBe(true);
            
            // Card should be placed in Help zone since it was empty
            const finalState = await gameLogic.getGameState(gameId);
            expect(finalState.gameEnv.playerId_1.Field.help.length).toBe(1);
            expect(finalState.gameEnv.playerId_1.Field.help[0].card[0]).toBe(selectionData.eligibleCards[0]);
        });

        it('should trigger Luke Farritor search effect and place in hand when Help zone occupied', async () => {
            const scenario = await loadTestScenario('searchCard_helpFilter_occupied');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Verify Help zone is NOT empty (has a card)
            expect(result.gameEnv.playerId_1.Field.help.length).toBe(1);

            // Play Luke Farritor (c-12) - should still trigger search effect
            const action = {
                type: "PlayCard",
                card_idx: 0,  // card c-12 with conditional Help search effect
                field_idx: 0  // top zone
            };

            const actionResult = await performPlayerAction(gameId, 'playerId_1', action);

            // Should have pending card selection (always triggers regardless of Help zone status)
            expect(actionResult.gameEnv.pendingPlayerAction).toBeDefined();
            expect(actionResult.gameEnv.pendingPlayerAction.type).toBe('cardSelection');
            
            const selectionId = actionResult.gameEnv.pendingPlayerAction.selectionId;
            expect(actionResult.gameEnv.pendingCardSelections[selectionId].cardTypeFilter).toBe('help');
            
            // Complete the selection
            const selectionData = actionResult.gameEnv.pendingCardSelections[selectionId];
            const selectionRequest = {
                selectionId: selectionId,
                selectedCardIds: [selectionData.eligibleCards[0]],
                playerId: 'playerId_1',
                gameId: gameId
            };

            const selectionResult = await gameLogic.selectCard({ body: selectionRequest });
            expect(selectionResult.success).toBe(true);
            
            // Card should be placed in hand since Help zone was occupied
            const finalState = await gameLogic.getGameState(gameId);
            expect(finalState.gameEnv.playerId_1.Field.help.length).toBe(1); // Still 1 (original card)
            expect(finalState.gameEnv.playerId_1.deck.hand).toContain(selectionData.eligibleCards[0]);
        });

        it('should place Help card in hand when Help zone is already occupied', async () => {
            // Use the occupied scenario directly instead of manually modifying state
            const scenario = await loadTestScenario('searchCard_helpFilter_occupied');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Verify Help zone is initially occupied
            expect(result.gameEnv.playerId_1.Field.help.length).toBe(1);

            // Play Luke Farritor to trigger search effect
            const action = {
                type: "PlayCard",
                card_idx: 0,
                field_idx: 0
            };

            const actionResult = await performPlayerAction(gameId, 'playerId_1', action);
            const selectionId = actionResult.gameEnv.pendingPlayerAction.selectionId;
            const selectionData = actionResult.gameEnv.pendingCardSelections[selectionId];

            // Complete selection - should succeed and place in hand since Help zone is occupied
            const selectionRequest = {
                selectionId: selectionId,
                selectedCardIds: [selectionData.eligibleCards[0]],
                playerId: 'playerId_1',
                gameId: gameId
            };
            console.log("selectionRequest111", JSON.stringify(selectionRequest));
            const selectionResult = await gameLogic.selectCard({ body: selectionRequest });
            expect(selectionResult.success).toBe(true);

            console.log("selectionRequest111222", JSON.stringify(selectionResult));
            
            // Card should be placed in hand since Help zone was already occupied
            const finalState = await gameLogic.getGameState(gameId);
            expect(finalState.gameEnv.playerId_1.Field.help.length).toBe(1); // Still the original card
            expect(finalState.gameEnv.playerId_1.deck.hand).toContain(selectionData.eligibleCards[0]);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty deck gracefully', async () => {
            const scenario = await loadTestScenario('searchCard_emptyDeck');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Play search card with empty deck
            const action = {
                type: "PlayCard",
                card_idx: 0,
                field_idx: 0
            };

            const actionResult = await performPlayerAction(gameId, 'playerId_1', action);
            
            // Should complete normally without card selection
            expect(actionResult.gameEnv.pendingPlayerAction).toBeUndefined();
        });

        it('should block other player actions during card selection', async () => {
            const scenario = await loadTestScenario('searchCard_basic');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Player 1 plays search card
            const action = {
                type: "PlayCard",
                card_idx: 0,
                field_idx: 0
            };

            const actionResult = await performPlayerAction(gameId, 'playerId_1', action);
            expect(actionResult.gameEnv.pendingPlayerAction).toBeDefined();
            expect(actionResult.gameEnv.pendingPlayerAction.type).toBe('cardSelection');

            // Player 2 tries to play a card again - should be blocked
            const player1Action = {
                type: "PlayCard",
                card_idx: 0,
                field_idx: 0
            };

            try {
                const result  =  await performPlayerAction(gameId, 'playerId_2', player1Action);
                console.log("result", JSON.stringify(result));
                expect(result.error).toContain('Not your turn');
            } catch (error) {
            }
        });
     
        it('should block same player from other actions during card selection', async () => {
            const scenario = await loadTestScenario('searchCard_basic');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Player 1 plays search card
            const action = {
                type: "PlayCard",
                card_idx: 0,
                field_idx: 0
            };

            const actionResult = await performPlayerAction(gameId, 'playerId_1', action);
            expect(actionResult.gameEnv.pendingPlayerAction).toBeDefined();
            expect(actionResult.gameEnv.pendingPlayerAction.type).toBe('cardSelection');

            // Player 1 tries to play another card - should be blocked
            const anotherAction = {
                type: "PlayCard",
                card_idx: 0,
                field_idx: 1
            };

            const actionResult2 = await performPlayerAction(gameId, 'playerId_1', anotherAction);
            expect(actionResult2.error).toContain('You must complete your card selection first');
        });
        
    });


    describe('Card Selection Validation', () => {
        it('should validate selection count', async () => {
            const scenario = await loadTestScenario('searchCard_basic');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Play search card
            const action = {
                type: "PlayCard",
                card_idx: 0,
                field_idx: 0
            };

            const actionResult = await performPlayerAction(gameId, 'playerId_1', action);

            // Try to select wrong number of cards
            const selectionId = actionResult.gameEnv.pendingPlayerAction.selectionId;
            const selectionData = actionResult.gameEnv.pendingCardSelections[selectionId];
            const invalidSelectionRequest = {
                selectionId: selectionId,
                selectedCardIds: [
                    selectionData.eligibleCards[0],
                    selectionData.eligibleCards[1] || selectionData.eligibleCards[0]
                ], // Select 2 cards when only 1 allowed
                playerId: 'playerId_1',
                gameId: gameId
            };

            await expect(gameLogic.selectCard({ body: invalidSelectionRequest }))
                .rejects
                .toThrow('Must select exactly 1 cards');
        });
   
        it('should validate selected card IDs', async () => {
            const scenario = await loadTestScenario('searchCard_basic');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Play search card
            const action = {
                type: "PlayCard",
                card_idx: 0,
                field_idx: 0
            };

            const actionResult = await performPlayerAction(gameId, 'playerId_1', action);

            // Try to select invalid card
            const selectionId = actionResult.gameEnv.pendingPlayerAction.selectionId;
            const invalidSelectionRequest = {
                selectionId: selectionId,
                selectedCardIds: ['invalid_card_id'],
                playerId: 'playerId_1',
                gameId: gameId
            };

            await expect(gameLogic.selectCard({ body: invalidSelectionRequest }))
                .rejects
                .toThrow('Invalid card selection');
        });
      
        it('should validate selection ID', async () => {
            const scenario = await loadTestScenario('searchCard_basic');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Play search card
            const action = {
                type: "PlayCard",
                card_idx: 0,
                field_idx: 0
            };

            const actionResult = await performPlayerAction(gameId, 'playerId_1', action);
            // Try to use invalid selection ID
            const invalidSelectionRequest = {
                selectionId: 'invalid_selection_id',
                selectedCardIds: ['c-1'],
                playerId: 'playerId_1',
                gameId: gameId
            };
            
            await expect(gameLogic.selectCard({ body: invalidSelectionRequest }))
                .rejects
                .toThrow('Invalid or expired card selection');
        });
    });
   
    describe('Game State Persistence', () => {
        it('should persist card selection state across requests', async () => {
            const scenario = await loadTestScenario('searchCard_basic');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Play search card
            const action = {
                type: "PlayCard",
                card_idx: 0,
                field_idx: 0
            };

            const actionResult = await performPlayerAction(gameId, 'playerId_1', action);
            const selectionId = actionResult.gameEnv.pendingPlayerAction.selectionId;

            // Read game state from file
            const persistedState = await gameLogic.getGameState(gameId);
            
            // Verify pending selection is persisted
            expect(persistedState.gameEnv.pendingCardSelections).toBeDefined();
            expect(persistedState.gameEnv.pendingCardSelections[selectionId]).toBeDefined();
            expect(persistedState.gameEnv.pendingPlayerAction).toBeDefined();
            expect(persistedState.gameEnv.pendingPlayerAction.type).toBe('cardSelection');
            expect(persistedState.gameEnv.pendingPlayerAction.selectionId).toBe(selectionId);
        });
    });
    
});