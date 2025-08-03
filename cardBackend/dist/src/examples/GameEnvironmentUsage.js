"use strict";
// src/examples/GameEnvironmentUsage.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.exampleCreateNewGame = exampleCreateNewGame;
exports.exampleConvertLegacyJSON = exampleConvertLegacyJSON;
exports.exampleGameOperations = exampleGameOperations;
exports.exampleSerializationAndValidation = exampleSerializationAndValidation;
exports.exampleIntegrationWithExistingCode = exampleIntegrationWithExistingCode;
exports.runAllExamples = runAllExamples;
/**
 * Example usage of the new GameEnvironment class system
 * Demonstrates how to migrate from legacy JSON gameEnv to object-oriented approach
 */
const GameEnvironment_1 = require("../models/GameEnvironment");
const GameEnvironmentAdapter_1 = require("../utils/GameEnvironmentAdapter");
const PlayerDeckDataResp_1 = require("../models/PlayerDeckDataResp");
// ============ EXAMPLE 1: Creating a New Game ============
function exampleCreateNewGame() {
    console.log('=== Example 1: Creating a New Game ===');
    // Create new game environment
    const gameEnv = (0, GameEnvironment_1.createGameEnvironment)();
    // Add first player
    const player1 = gameEnv.addPlayer('player_1', 'Alice');
    console.log('Added player 1:', player1.id);
    // Add second player
    const player2 = gameEnv.addPlayer('player_2', 'Bob');
    console.log('Added player 2:', player2.id);
    // Set up sample deck data for both players using PlayerDeckDataResp class
    player1.deck = new PlayerDeckDataResp_1.PlayerDeckDataResp(0, // currentLeaderIdx
    ['s-1_uid_1', 's-2_uid_2', 's-3_uid_3', 's-4_uid_4'], // leader
    ['c-1_uid_1', 'c-2_uid_2', 'c-3_uid_3'], // hand
    ['c-4_uid_4', 'c-5_uid_5', 'c-6_uid_6'], // mainDeck
    { 's-1_uid_1': 's-1', 's-2_uid_2': 's-2' }, // leaderMapping
    { 'c-1_uid_1': 'c-1', 'c-2_uid_2': 'c-2' } // cardMapping
    );
    player2.deck = new PlayerDeckDataResp_1.PlayerDeckDataResp(0, // currentLeaderIdx
    ['s-5_uid_5', 's-6_uid_6', 's-7_uid_7', 's-8_uid_8'], // leader
    ['c-7_uid_7', 'c-8_uid_8', 'c-9_uid_9'], // hand
    ['c-10_uid_10', 'c-11_uid_11', 'c-12_uid_12'], // mainDeck
    { 's-5_uid_5': 's-5', 's-6_uid_6': 's-6' }, // leaderMapping
    { 'c-7_uid_7': 'c-7', 'c-8_uid_8': 'c-8' } // cardMapping
    );
    // Update game phase
    gameEnv.updatePhase(GameEnvironment_1.GamePhase.READY_PHASE);
    console.log('Game created with phase:', gameEnv.phase);
    console.log('Game summary:', GameEnvironmentAdapter_1.GameEnvironmentHelper.getGameSummary(gameEnv));
    return gameEnv;
}
// ============ EXAMPLE 2: Converting Legacy JSON ============
function exampleConvertLegacyJSON() {
    console.log('\\n=== Example 2: Converting Legacy JSON ===');
    // Sample legacy gameEnv JSON (simplified)
    const legacyGameEnv = {
        phase: 'MAIN_PHASE',
        playerId_1: 'legacy_player_1',
        playerId_2: 'legacy_player_2',
        gameStarted: true,
        firstPlayer: 0,
        players: {
            legacy_player_1: {
                id: 'legacy_player_1',
                name: 'Legacy Player 1',
                deck: {
                    currentLeaderIdx: 0,
                    leader: ['s-1_legacy'],
                    hand: ['c-1_legacy', 'c-2_legacy'],
                    mainDeck: ['c-3_legacy'],
                    leaderMapping: { 's-1_legacy': 's-1' },
                    cardMapping: { 'c-1_legacy': 'c-1', 'c-2_legacy': 'c-2' }
                },
                redraw: 0
            },
            legacy_player_2: {
                id: 'legacy_player_2',
                name: 'Legacy Player 2',
                deck: {
                    currentLeaderIdx: 0,
                    leader: ['s-2_legacy'],
                    hand: ['c-4_legacy', 'c-5_legacy'],
                    mainDeck: ['c-6_legacy'],
                    leaderMapping: { 's-2_legacy': 's-2' },
                    cardMapping: { 'c-4_legacy': 'c-4', 'c-5_legacy': 'c-5' }
                },
                redraw: 0
            }
        },
        zones: {
            legacy_player_1: {
                leader: { id: 's-1_legacy' },
                top: { card: ['c-1_legacy'] }
            },
            legacy_player_2: {
                leader: { id: 's-2_legacy' }
            }
        },
        gameEvents: [],
        playSequence: { globalSequence: 2, plays: [] },
        fieldEffects: {},
        neutralizationHistory: []
    };
    // Validate legacy JSON
    const validation = GameEnvironmentAdapter_1.GameEnvironmentValidator.validateLegacyJSON(legacyGameEnv);
    if (!validation.isValid) {
        console.error('Legacy JSON validation failed:', validation.errors);
        return (0, GameEnvironment_1.createGameEnvironment)();
    }
    // Convert to GameEnvironment class
    const gameEnv = GameEnvironmentAdapter_1.GameEnvironmentAdapter.fromLegacyJSON(legacyGameEnv);
    console.log('Converted legacy JSON to GameEnvironment');
    console.log('Phase:', gameEnv.phase);
    console.log('Players:', Object.keys(gameEnv.players));
    console.log('Player 1 hand size:', gameEnv.getPlayer('legacy_player_1')?.getHandSize());
    console.log('Zone occupied (legacy_player_1, TOP):', gameEnv.zones.isZoneOccupied('legacy_player_1', GameEnvironment_1.ZoneType.TOP));
    return gameEnv;
}
// ============ EXAMPLE 3: Game Operations ============
function exampleGameOperations() {
    console.log('\\n=== Example 3: Game Operations ===');
    const gameEnv = exampleCreateNewGame();
    // Set leaders for both players
    gameEnv.setLeader('player_1', 's-1_uid_1');
    gameEnv.setLeader('player_2', 's-5_uid_5');
    console.log('Set leaders for both players');
    // Play some cards
    const player1 = gameEnv.getPlayer('player_1');
    const player2 = gameEnv.getPlayer('player_2');
    // Player 1 plays a card in TOP zone
    gameEnv.playCard('player_1', 'c-1_uid_1', GameEnvironment_1.ZoneType.TOP);
    console.log('Player 1 played card in TOP zone');
    console.log('Player 1 hand size after play:', player1.getHandSize());
    // Player 2 plays a card face-down in HELP zone
    gameEnv.playCard('player_2', 'c-7_uid_7', GameEnvironment_1.ZoneType.HELP, true);
    console.log('Player 2 played card face-down in HELP zone');
    // Check zone status
    console.log('\\nZone Status:');
    console.log('Player 1 TOP occupied:', gameEnv.zones.isZoneOccupied('player_1', GameEnvironment_1.ZoneType.TOP));
    console.log('Player 1 LEFT occupied:', gameEnv.zones.isZoneOccupied('player_1', GameEnvironment_1.ZoneType.LEFT));
    console.log('Player 2 HELP occupied:', gameEnv.zones.isZoneOccupied('player_2', GameEnvironment_1.ZoneType.HELP));
    // Get recent events
    const events = gameEnv.eventManager.getEvents();
    console.log('\\nTotal events:', events.length);
    console.log('Recent event types:', events.slice(-3).map(e => e.type));
    // Get play sequence
    const plays = gameEnv.playSequenceManager.getPlays();
    console.log('\\nTotal plays:', plays.length);
    console.log('Recent plays:', plays.slice(-2).map(p => `${p.action} by ${p.playerId}`));
}
// ============ EXAMPLE 4: Serialization and Validation ============
function exampleSerializationAndValidation() {
    console.log('\\n=== Example 4: Serialization and Validation ===');
    const gameEnv = exampleCreateNewGame();
    // Make some modifications
    gameEnv.setLeader('player_1', 's-1_uid_1');
    gameEnv.playCard('player_1', 'c-1_uid_1', GameEnvironment_1.ZoneType.TOP);
    // Validate the game environment
    const validation = GameEnvironmentAdapter_1.GameEnvironmentValidator.validate(gameEnv);
    console.log('Validation result:', validation.isValid);
    if (!validation.isValid) {
        console.log('Validation errors:', validation.errors);
    }
    // Convert to JSON (legacy format)
    const legacyJSON = GameEnvironmentAdapter_1.GameEnvironmentAdapter.toLegacyJSON(gameEnv);
    console.log('Converted to legacy JSON format');
    console.log('JSON phase:', legacyJSON.phase);
    console.log('JSON players:', Object.keys(legacyJSON.players));
    // Convert back to GameEnvironment
    const gameEnv2 = GameEnvironmentAdapter_1.GameEnvironmentAdapter.fromLegacyJSON(legacyJSON);
    console.log('Converted back to GameEnvironment');
    // Compare the two instances
    const differences = GameEnvironmentAdapter_1.GameEnvironmentHelper.compare(gameEnv, gameEnv2);
    console.log('Differences after round-trip conversion:', Object.keys(differences).length === 0 ? 'None' : differences);
    // Clone the game environment
    const clonedGameEnv = GameEnvironmentAdapter_1.GameEnvironmentHelper.deepClone(gameEnv);
    console.log('Created deep clone');
    // Modify clone and compare
    clonedGameEnv.playCard('player_2', 'c-7_uid_7', GameEnvironment_1.ZoneType.LEFT);
    const cloneDifferences = GameEnvironmentAdapter_1.GameEnvironmentHelper.compare(gameEnv, clonedGameEnv);
    console.log('Differences after modifying clone:', cloneDifferences);
}
// ============ EXAMPLE 5: Integration with Existing Code ============
function exampleIntegrationWithExistingCode() {
    console.log('\\n=== Example 5: Integration with Existing Code ===');
    // Simulate receiving legacy gameEnv from existing code
    const legacyGameEnv = {
        phase: 'MAIN_PHASE',
        playerId_1: 'existing_player_1',
        playerId_2: 'existing_player_2',
        gameStarted: true,
        players: {
            existing_player_1: {
                id: 'existing_player_1',
                name: 'Existing Player 1',
                deck: {
                    currentLeaderIdx: 0,
                    leader: ['s-1_existing'],
                    hand: ['c-1_existing'],
                    mainDeck: ['c-2_existing'],
                    leaderMapping: { 's-1_existing': 's-1' },
                    cardMapping: { 'c-1_existing': 'c-1' }
                },
                redraw: 0
            }
        },
        zones: {},
        gameEvents: [],
        playSequence: { globalSequence: 0, plays: [] },
        fieldEffects: {},
        neutralizationHistory: []
    };
    console.log('Received legacy gameEnv from existing code');
    // Convert to class-based structure for manipulation
    const gameEnv = GameEnvironmentAdapter_1.GameEnvironmentAdapter.fromLegacyJSON(legacyGameEnv);
    console.log('Converted to GameEnvironment class');
    // Perform operations using class methods
    const player1 = gameEnv.getPlayer('existing_player_1');
    if (player1) {
        console.log('Player 1 current leader:', player1.getCurrentLeaderCardId());
        console.log('Player 1 hand size:', player1.getHandSize());
        // Draw a card
        const drawnCard = player1.drawCard();
        console.log('Drew card:', drawnCard);
        console.log('New hand size:', player1.getHandSize());
    }
    // Convert back to legacy format for existing code
    const updatedLegacyGameEnv = GameEnvironmentAdapter_1.GameEnvironmentAdapter.toLegacyJSON(gameEnv);
    console.log('Converted back to legacy format for existing code');
    console.log('Updated legacy gameEnv ready for existing code');
    // Show the integration pattern
    console.log('\\n=== Integration Pattern ===');
    console.log('1. Receive legacy gameEnv from existing code');
    console.log('2. Convert to GameEnvironment class using GameEnvironmentAdapter.fromLegacyJSON()');
    console.log('3. Use object-oriented methods for operations');
    console.log('4. Convert back to legacy format using GameEnvironmentAdapter.toLegacyJSON()');
    console.log('5. Pass updated legacy gameEnv back to existing code');
}
// ============ RUN ALL EXAMPLES ============
function runAllExamples() {
    console.log('🎮 GameEnvironment Class System Examples\\n');
    try {
        exampleCreateNewGame();
        exampleConvertLegacyJSON();
        exampleGameOperations();
        exampleSerializationAndValidation();
        exampleIntegrationWithExistingCode();
        console.log('\\n✅ All examples completed successfully!');
        console.log('\\n📝 Next Steps:');
        console.log('1. Gradually integrate GameEnvironment class into existing services');
        console.log('2. Use GameEnvironmentAdapter for backward compatibility');
        console.log('3. Replace legacy JSON manipulation with class methods');
        console.log('4. Add type safety and validation throughout codebase');
    }
    catch (error) {
        console.error('❌ Example execution failed:', error);
    }
}
// Export for testing
exports.default = {
    exampleCreateNewGame,
    exampleConvertLegacyJSON,
    exampleGameOperations,
    exampleSerializationAndValidation,
    exampleIntegrationWithExistingCode,
    runAllExamples
};
// Run examples if this file is executed directly
if (require.main === module) {
    runAllExamples();
}
//# sourceMappingURL=GameEnvironmentUsage.js.map