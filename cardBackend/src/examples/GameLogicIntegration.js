"use strict";
// src/examples/GameLogicIntegration.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.demonstrateIntegration = exports.GameLogicMigrationHelper = exports.GameLogicWithClassSupport = void 0;
/**
 * Example showing how to integrate GameEnvironment class with existing GameLogic
 * This demonstrates the migration path from legacy JSON to object-oriented approach
 */
const GameEnvironment_1 = require("../models/GameEnvironment");
const GameEnvironmentAdapter_1 = require("../utils/GameEnvironmentAdapter");
class GameLogicWithClassSupport {
    /**
     * Enhanced createNewGame method using GameEnvironment class
     */
    createNewGameWithClass(playerId) {
        // Create new game using class-based approach
        const gameEnvClass = new GameEnvironment_1.GameEnvironment();
        // Add first player
        gameEnvClass.addPlayer(playerId);
        // Add room created event
        gameEnvClass.eventManager.addEvent('ROOM_CREATED', {
            createdBy: playerId,
            status: 'WAITING_FOR_PLAYERS',
            timestamp: Date.now()
        });
        // Convert to legacy format for existing code compatibility
        const legacyGameEnv = GameEnvironmentAdapter_1.GameEnvironmentAdapter.toLegacyJSON(gameEnvClass);
        return {
            gameId: this.generateGameId(),
            gameEnv: legacyGameEnv
        };
    }
    /**
     * Enhanced joinRoom method using GameEnvironment class
     */
    joinRoomWithClass(gameId, playerId, playerDeckData) {
        // Simulate loading existing game data
        const existingGameData = this.loadGameData(gameId);
        // Convert legacy gameEnv to class
        const gameEnvClass = GameEnvironmentAdapter_1.GameEnvironmentAdapter.fromLegacyJSON(existingGameData.gameEnv);
        // Validate current state
        const validation = GameEnvironmentAdapter_1.GameEnvironmentValidator.validate(gameEnvClass);
        if (!validation.isValid) {
            throw new Error(`Game state validation failed: ${validation.errors.join(', ')}`);
        }
        // Add second player using class methods
        const player2 = gameEnvClass.addPlayer(playerId);
        player2.deck = playerDeckData;
        // Update phase using class method
        gameEnvClass.updatePhase(GameEnvironment_1.GamePhase.BOTH_JOINED);
        // Add join event using class method
        gameEnvClass.eventManager.addEvent('PLAYER_JOINED', {
            playerId: playerId,
            roomStatus: 'BOTH_JOINED',
            readyForStart: true
        });
        // Convert back to legacy format
        const updatedLegacyGameEnv = GameEnvironmentAdapter_1.GameEnvironmentAdapter.toLegacyJSON(gameEnvClass);
        return {
            gameId,
            gameEnv: updatedLegacyGameEnv
        };
    }
    /**
     * Enhanced processPlayerAction using GameEnvironment class
     */
    processPlayerActionWithClass(gameId, playerId, action) {
        // Load existing game data
        const gameData = this.loadGameData(gameId);
        // Convert to class for manipulation
        const gameEnvClass = GameEnvironmentAdapter_1.GameEnvironmentAdapter.fromLegacyJSON(gameData.gameEnv);
        // Process action using class methods
        try {
            switch (action.type) {
                case 'PlayCard':
                    this.handlePlayCardWithClass(gameEnvClass, playerId, action);
                    break;
                case 'PlayCardBack':
                    this.handlePlayCardBackWithClass(gameEnvClass, playerId, action);
                    break;
                case 'DrawCard':
                    this.handleDrawCardWithClass(gameEnvClass, playerId);
                    break;
                default:
                    throw new Error(`Unknown action type: ${action.type}`);
            }
            // Validate after action
            const validation = GameEnvironmentAdapter_1.GameEnvironmentValidator.validate(gameEnvClass);
            if (!validation.isValid) {
                throw new Error(`Post-action validation failed: ${validation.errors.join(', ')}`);
            }
            // Convert back to legacy format
            const updatedLegacyGameEnv = GameEnvironmentAdapter_1.GameEnvironmentAdapter.toLegacyJSON(gameEnvClass);
            // Save and return
            this.saveGameData(gameId, { gameId, gameEnv: updatedLegacyGameEnv });
            return { gameId, gameEnv: updatedLegacyGameEnv };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Add error event using class method
            gameEnvClass.eventManager.addEvent('ERROR_OCCURRED', {
                error: errorMessage,
                playerId,
                action: action.type,
                timestamp: Date.now()
            });
            // Return error state
            const errorGameEnv = GameEnvironmentAdapter_1.GameEnvironmentAdapter.toLegacyJSON(gameEnvClass);
            return { gameId, gameEnv: errorGameEnv, error: errorMessage };
        }
    }
    /**
     * Handle PlayCard action using class methods
     */
    handlePlayCardWithClass(gameEnvClass, playerId, action) {
        const { card_idx, field_idx } = action;
        // Get player
        const player = gameEnvClass.getPlayer(playerId);
        if (!player) {
            throw new Error(`Player ${playerId} not found`);
        }
        // Get card from hand
        if (card_idx >= player.deck.hand.length) {
            throw new Error(`Invalid card index: ${card_idx}`);
        }
        const cardUid = player.deck.hand[card_idx];
        const zone = this.convertFieldIndexToZone(field_idx);
        // Check if zone is already occupied
        if (gameEnvClass.zones.isZoneOccupied(playerId, zone)) {
            throw new Error(`Zone ${zone} is already occupied`);
        }
        // Play card using class method
        const success = gameEnvClass.playCard(playerId, cardUid, zone, false);
        if (!success) {
            throw new Error(`Failed to play card ${cardUid} in zone ${zone}`);
        }
        console.log(`Player ${playerId} played card ${cardUid} in zone ${zone}`);
    }
    /**
     * Handle PlayCardBack action using class methods
     */
    handlePlayCardBackWithClass(gameEnvClass, playerId, action) {
        const { card_idx, field_idx } = action;
        // Get player
        const player = gameEnvClass.getPlayer(playerId);
        if (!player) {
            throw new Error(`Player ${playerId} not found`);
        }
        // Get card from hand
        if (card_idx >= player.deck.hand.length) {
            throw new Error(`Invalid card index: ${card_idx}`);
        }
        const cardUid = player.deck.hand[card_idx];
        const zone = this.convertFieldIndexToZone(field_idx);
        // Check if zone is already occupied
        if (gameEnvClass.zones.isZoneOccupied(playerId, zone)) {
            throw new Error(`Zone ${zone} is already occupied`);
        }
        // Play card face-down using class method
        const success = gameEnvClass.playCard(playerId, cardUid, zone, true);
        if (!success) {
            throw new Error(`Failed to play card ${cardUid} face-down in zone ${zone}`);
        }
        console.log(`Player ${playerId} played card ${cardUid} face-down in zone ${zone}`);
    }
    /**
     * Handle DrawCard action using class methods
     */
    handleDrawCardWithClass(gameEnvClass, playerId) {
        const player = gameEnvClass.getPlayer(playerId);
        if (!player) {
            throw new Error(`Player ${playerId} not found`);
        }
        const drawnCard = player.drawCard();
        if (!drawnCard) {
            throw new Error(`No cards available to draw for player ${playerId}`);
        }
        // Add card drawn event
        gameEnvClass.eventManager.addEvent('CARD_DRAWN', {
            playerId,
            cardUid: drawnCard,
            handSize: player.getHandSize()
        });
        console.log(`Player ${playerId} drew card ${drawnCard}`);
    }
    /**
     * Convert field index to zone type
     */
    convertFieldIndexToZone(fieldIdx) {
        switch (fieldIdx) {
            case 0: return GameEnvironment_1.ZoneType.TOP;
            case 1: return GameEnvironment_1.ZoneType.LEFT;
            case 2: return GameEnvironment_1.ZoneType.RIGHT;
            case 3: return GameEnvironment_1.ZoneType.HELP;
            case 4: return GameEnvironment_1.ZoneType.SP;
            default: throw new Error(`Invalid field index: ${fieldIdx}`);
        }
    }
    /**
     * Utility method to generate game ID
     */
    generateGameId() {
        return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Mock method to simulate loading game data
     */
    loadGameData(gameId) {
        // In real implementation, this would load from file system
        return {
            gameId,
            gameEnv: {
                phase: 'WAITING_FOR_PLAYERS',
                playerId_1: 'player_1',
                playerId_2: null,
                gameStarted: false,
                players: {
                    player_1: {
                        id: 'player_1',
                        name: 'Player 1',
                        deck: {
                            currentLeaderIdx: 0,
                            leader: [],
                            hand: [],
                            mainDeck: [],
                            leaderMapping: {},
                            cardMapping: {}
                        },
                        redraw: 0
                    }
                },
                zones: { player_1: {} },
                gameEvents: [],
                playSequence: { globalSequence: 0, plays: [] },
                fieldEffects: {},
                neutralizationHistory: []
            }
        };
    }
    /**
     * Mock method to simulate saving game data
     */
    saveGameData(gameId, gameData) {
        // In real implementation, this would save to file system
        console.log(`Saving game data for ${gameId}`);
    }
}
exports.GameLogicWithClassSupport = GameLogicWithClassSupport;
// ============ MIGRATION STRATEGY ============
class GameLogicMigrationHelper {
    /**
     * Gradual migration strategy from legacy JSON to class-based approach
     */
    static getMigrationPlan() {
        return [
            '1. Phase 1: Add GameEnvironment class alongside existing JSON structure',
            '2. Phase 2: Create adapter utilities for conversion between formats',
            '3. Phase 3: Start using class methods for new features',
            '4. Phase 4: Gradually replace JSON manipulation with class methods',
            '5. Phase 5: Add validation and type safety throughout',
            '6. Phase 6: Remove legacy JSON manipulation code',
            '7. Phase 7: Use GameEnvironment class as single source of truth'
        ];
    }
    /**
     * Identify areas of existing code that would benefit from class-based approach
     */
    static getRefactoringPriorities() {
        return [
            'High Priority:',
            '- Zone management operations (card placement, validation)',
            '- Player deck operations (draw, hand management)',
            '- Event system (add, acknowledge, cleanup)',
            '- Play sequence tracking',
            '',
            'Medium Priority:',
            '- Field effects management',
            '- Game state validation',
            '- Turn management',
            '- Phase transitions',
            '',
            'Low Priority:',
            '- Serialization/deserialization',
            '- Utility methods',
            '- Legacy compatibility layers'
        ];
    }
    /**
     * Benefits of migrating to class-based approach
     */
    static getBenefits() {
        return [
            'Type Safety: Compile-time error checking and IntelliSense support',
            'Encapsulation: Methods grouped with related data',
            'Validation: Built-in validation methods and error checking',
            'Maintainability: Easier to understand and modify code structure',
            'Testing: Easier to unit test individual methods',
            'Documentation: Self-documenting code with clear interfaces',
            'Refactoring: IDE support for safe refactoring operations',
            'Performance: Potential for optimization through method caching'
        ];
    }
}
exports.GameLogicMigrationHelper = GameLogicMigrationHelper;
// ============ USAGE EXAMPLE ============
function demonstrateIntegration() {
    var _a;
    console.log('🔄 GameLogic Integration Example\\n');
    const gameLogic = new GameLogicWithClassSupport();
    try {
        // 1. Create new game
        console.log('1. Creating new game...');
        const newGame = gameLogic.createNewGameWithClass('player_1');
        console.log('   Game created:', newGame.gameId);
        console.log('   Phase:', newGame.gameEnv.phase);
        // 2. Join room (simulate)
        console.log('\\n2. Player 2 joining...');
        const mockDeckData = {
            currentLeaderIdx: 0,
            leader: ['s-1_uid'],
            hand: ['c-1_uid', 'c-2_uid', 'c-3_uid'],
            mainDeck: ['c-4_uid', 'c-5_uid'],
            leaderMapping: { 's-1_uid': 's-1' },
            cardMapping: { 'c-1_uid': 'c-1', 'c-2_uid': 'c-2' }
        };
        const joinedGame = gameLogic.joinRoomWithClass(newGame.gameId, 'player_2', mockDeckData);
        console.log('   Player 2 joined');
        console.log('   Phase:', joinedGame.gameEnv.phase);
        console.log('   Players:', Object.keys(joinedGame.gameEnv.players));
        // 3. Process player action (simulate)
        console.log('\\n3. Processing player action...');
        const action = { type: 'PlayCard', card_idx: 0, field_idx: 1 }; // Play first card in LEFT zone
        try {
            const result = gameLogic.processPlayerActionWithClass(newGame.gameId, 'player_2', action);
            console.log('   Action processed successfully');
            console.log('   Events:', ((_a = result.gameEnv.gameEvents) === null || _a === void 0 ? void 0 : _a.length) || 0);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log('   Action failed (expected):', errorMessage);
        }
        console.log('\\n✅ Integration demonstration completed!');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Integration demonstration failed:', errorMessage);
    }
    // Show migration information
    console.log('\\n📋 Migration Plan:');
    GameLogicMigrationHelper.getMigrationPlan().forEach(step => console.log('   ' + step));
    console.log('\\n🎯 Refactoring Priorities:');
    GameLogicMigrationHelper.getRefactoringPriorities().forEach(item => console.log('   ' + item));
    console.log('\\n💡 Benefits:');
    GameLogicMigrationHelper.getBenefits().forEach(benefit => console.log('   ✓ ' + benefit));
}
exports.demonstrateIntegration = demonstrateIntegration;
// Export for use
exports.default = {
    GameLogicWithClassSupport,
    GameLogicMigrationHelper,
    demonstrateIntegration
};
// Run demonstration if this file is executed directly
if (require.main === module) {
    demonstrateIntegration();
}
