"use strict";
// src/utils/GameEnvironmentAdapter.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEnvironmentHelper = exports.GameEnvironmentValidator = exports.GameEnvironmentAdapter = void 0;
/**
 * Adapter utilities for transitioning between legacy JSON gameEnv
 * and new object-oriented GameEnvironment class
 */
const GameEnvironment_1 = require("../models/GameEnvironment");
// Import CardInfoUtils with proper path resolution for compiled code
const path = require('path');
const isCompiled = __dirname.includes('dist');
const cardInfoUtilsPath = isCompiled
    ? path.join(__dirname, '../../../src/services/CardInfoUtils.js')
    : path.join(__dirname, '../services/CardInfoUtils.js');
const CardInfoUtils = require(cardInfoUtilsPath);
class GameEnvironmentAdapter {
    /**
     * Convert legacy gameEnv JSON to GameEnvironment class instance
     */
    static fromLegacyJSON(legacyGameEnv) {
        return GameEnvironment_1.GameEnvironment.fromJSON(legacyGameEnv);
    }
    /**
     * Convert GameEnvironment class instance to legacy JSON format
     */
    static toLegacyJSON(gameEnv) {
        return gameEnv.toJSON();
    }
    /**
     * Upgrade legacy gameEnv JSON in-place to ensure compatibility
     */
    static upgradeLegacyGameEnv(legacyGameEnv) {
        // Ensure all required fields exist
        if (!legacyGameEnv.phase) {
            legacyGameEnv.phase = GameEnvironment_1.GamePhase.WAITING_FOR_PLAYERS;
        }
        if (!legacyGameEnv.players) {
            legacyGameEnv.players = {};
        }
        if (!legacyGameEnv.zones) {
            legacyGameEnv.zones = {};
        }
        if (!legacyGameEnv.gameEvents) {
            legacyGameEnv.gameEvents = [];
        }
        if (!legacyGameEnv.playSequence) {
            legacyGameEnv.playSequence = {
                globalSequence: 0,
                plays: []
            };
        }
        if (!legacyGameEnv.fieldEffects) {
            legacyGameEnv.fieldEffects = {};
        }
        if (!legacyGameEnv.neutralizationHistory) {
            legacyGameEnv.neutralizationHistory = [];
        }
        // Ensure numeric fields
        if (typeof legacyGameEnv.firstPlayer !== 'number') {
            legacyGameEnv.firstPlayer = 0;
        }
        if (typeof legacyGameEnv.lastEventId !== 'number') {
            legacyGameEnv.lastEventId = legacyGameEnv.gameEvents.length;
        }
        return legacyGameEnv;
    }
    /**
     * Create a new GameEnvironment instance with proper initialization
     */
    static createNewGame(player1Id) {
        const gameEnv = new GameEnvironment_1.GameEnvironment();
        // Add first player
        gameEnv.addPlayer(player1Id);
        // Initialize event system
        gameEnv.eventManager.addEvent(GameEnvironment_1.EventType.ROOM_CREATED, {
            createdBy: player1Id,
            status: GameEnvironment_1.GamePhase.WAITING_FOR_PLAYERS,
            timestamp: Date.now()
        });
        return gameEnv;
    }
    /**
     * Add second player and initialize game data
     */
    static addSecondPlayer(gameEnv, player2Id, player1DeckData, player2DeckData) {
        // Add second player
        const player2 = gameEnv.addPlayer(player2Id);
        // Set deck data for both players (now using PlayerDeckDataResp class instances)
        const player1 = gameEnv.getPlayer(gameEnv.playerId_1);
        if (player1) {
            player1.deck = player1DeckData;
        }
        player2.deck = player2DeckData;
        // Update phase
        gameEnv.updatePhase(GameEnvironment_1.GamePhase.BOTH_JOINED);
        // Add join event
        gameEnv.eventManager.addEvent(GameEnvironment_1.EventType.PLAYER_JOINED, {
            playerId: player2Id,
            roomStatus: GameEnvironment_1.GamePhase.BOTH_JOINED,
            readyForStart: true
        });
    }
    /**
     * Initialize game environment after both players have joined
     * Replaces mozGamePlay.updateInitialGameEnvironment functionality
     */
    static initializeGameEnvironment(gameEnv) {
        // Get both players
        const player1 = gameEnv.getPlayer(gameEnv.playerId_1);
        const player2 = gameEnv.getPlayer(gameEnv.playerId_2);
        if (!player1 || !player2) {
            throw new Error('Both players must exist before initializing game environment');
        }
        // Get leader cards for first player determination
        const leader1 = player1.getCurrentLeaderCardId();
        const leader2 = player2.getCurrentLeaderCardId();
        if (!leader1 || !leader2) {
            throw new Error('Both players must have current leaders before initialization');
        }
        // Use imported CardInfoUtils directly
        const leader1Details = CardInfoUtils.getLeaderCards(leader1);
        const leader2Details = CardInfoUtils.getLeaderCards(leader2);
        if (!leader1Details || !leader2Details) {
            throw new Error('Unable to retrieve leader card details');
        }
        // Determine first player based on leader initial points
        let firstPlayer = 0;
        console.log("debug leader1Details", JSON.stringify(leader1Details));
        console.log("debug leader2Details", JSON.stringify(leader2Details));
        if (leader2Details.initialPoint > leader1Details.initialPoint) {
            firstPlayer = 1;
        }
        else if (leader2Details.initialPoint === leader1Details.initialPoint) {
            firstPlayer = Math.floor(Math.random() * 2);
        }
        // For consistency with existing logic, set to 0
        //firstPlayer = 0;
        gameEnv.firstPlayer = firstPlayer;
        // Update phase to REDRAW_PHASE
        gameEnv.updatePhase(GameEnvironment_1.GamePhase.REDRAW_PHASE); // Using READY_PHASE instead of START_REDRAW
        // Initialize player redraw counts
        player1.redraw = 0;
        player2.redraw = 0;
        // Place leader cards in leader zones with complete data
        const leader1ZoneData = {
            id: leader1,
            name: leader1Details.name,
            cardType: leader1Details.cardType,
            gameType: leader1Details.gameType,
            initialPoint: leader1Details.initialPoint,
            level: leader1Details.level,
            rarity: leader1Details.rarity,
            zoneCompatibility: leader1Details.zoneCompatibility,
            effects: leader1Details.effects
        };
        const leader2ZoneData = {
            id: leader2,
            name: leader2Details.name,
            cardType: leader2Details.cardType,
            gameType: leader2Details.gameType,
            initialPoint: leader2Details.initialPoint,
            level: leader2Details.level,
            rarity: leader2Details.rarity,
            zoneCompatibility: leader2Details.zoneCompatibility,
            effects: leader2Details.effects
        };
        gameEnv.zones.setLeaderInZone(gameEnv.playerId_1, leader1ZoneData);
        gameEnv.zones.setLeaderInZone(gameEnv.playerId_2, leader2ZoneData);
        // Prepare leader revealed data for events
        const leaderRevealed = {
            [gameEnv.playerId_1]: {
                cardId: leader1Details.id,
                name: leader1Details.name,
                initialPoint: leader1Details.initialPoint
            },
            [gameEnv.playerId_2]: {
                cardId: leader2Details.id,
                name: leader2Details.name,
                initialPoint: leader2Details.initialPoint
            }
        };
        // Add game started event
        gameEnv.eventManager.addEvent(GameEnvironment_1.EventType.GAME_STARTED, {
            players: [gameEnv.playerId_1, gameEnv.playerId_2],
            firstPlayer: [gameEnv.playerId_1, gameEnv.playerId_2][firstPlayer],
            leaderRevealed: leaderRevealed
        });
        // Add initial hand dealt events for each player
        gameEnv.eventManager.addEvent(GameEnvironment_1.EventType.INITIAL_HAND_DEALT, {
            playerId: gameEnv.playerId_1,
            handSize: player1.getHandSize()
        });
        gameEnv.eventManager.addEvent(GameEnvironment_1.EventType.INITIAL_HAND_DEALT, {
            playerId: gameEnv.playerId_2,
            handSize: player2.getHandSize()
        });
    }
}
exports.GameEnvironmentAdapter = GameEnvironmentAdapter;
class GameEnvironmentValidator {
    /**
     * Validate GameEnvironment instance for consistency
     */
    static validate(gameEnv) {
        const errors = [];
        // Check player consistency
        if (gameEnv.playerId_1 && !gameEnv.players[gameEnv.playerId_1]) {
            errors.push('Player 1 ID exists but player object missing');
        }
        if (gameEnv.playerId_2 && !gameEnv.players[gameEnv.playerId_2]) {
            errors.push('Player 2 ID exists but player object missing');
        }
        // Check zone consistency
        for (const playerId of Object.keys(gameEnv.players)) {
            const playerZones = gameEnv.zones.getPlayerZones(playerId);
            // Validate zone cards exist in appropriate mappings
            for (const zone of Object.values(GameEnvironment_1.ZoneType)) {
                const cardInZone = gameEnv.zones.getCardInZone(playerId, zone);
                if (cardInZone) {
                    const player = gameEnv.players[playerId];
                    if (zone === GameEnvironment_1.ZoneType.LEADER) {
                        if (!player.deck.leaderMapping[cardInZone]) {
                            errors.push(`Leader ${cardInZone} in zone but not in leader mapping for ${playerId}`);
                        }
                    }
                    else {
                        if (!player.deck.cardMapping[cardInZone]) {
                            errors.push(`Card ${cardInZone} in ${zone} zone but not in card mapping for ${playerId}`);
                        }
                    }
                }
            }
        }
        // Check event system consistency
        const events = gameEnv.eventManager.getEvents();
        if (events.length === 0 && gameEnv.phase !== GameEnvironment_1.GamePhase.WAITING_FOR_PLAYERS) {
            errors.push('No events recorded but game has progressed beyond initial phase');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Validate legacy JSON format before conversion
     */
    static validateLegacyJSON(legacyGameEnv) {
        const errors = [];
        if (!legacyGameEnv) {
            errors.push('GameEnv is null or undefined');
            return { isValid: false, errors };
        }
        // Check required top-level fields
        if (!legacyGameEnv.phase) {
            errors.push('Missing phase field');
        }
        if (typeof legacyGameEnv.players !== 'object') {
            errors.push('Missing or invalid players object');
        }
        if (typeof legacyGameEnv.zones !== 'object') {
            errors.push('Missing or invalid zones object');
        }
        // Check player structure
        if (legacyGameEnv.players) {
            for (const [playerId, playerData] of Object.entries(legacyGameEnv.players)) {
                const player = playerData;
                if (!player.id) {
                    errors.push(`Player ${playerId} missing id field`);
                }
                if (!player.deck) {
                    errors.push(`Player ${playerId} missing deck`);
                }
                else {
                    if (!Array.isArray(player.deck.hand)) {
                        errors.push(`Player ${playerId} deck.hand is not an array`);
                    }
                    if (!Array.isArray(player.deck.mainDeck)) {
                        errors.push(`Player ${playerId} deck.mainDeck is not an array`);
                    }
                    if (!Array.isArray(player.deck.leader)) {
                        errors.push(`Player ${playerId} deck.leader is not an array`);
                    }
                }
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
exports.GameEnvironmentValidator = GameEnvironmentValidator;
class GameEnvironmentHelper {
    /**
     * Get current turn player ID based on game state
     */
    static getCurrentPlayer(gameEnv) {
        // Implementation would depend on current turn logic
        // This is a placeholder for turn management integration
        return gameEnv.playerId_1; // Simplified
    }
    /**
     * Check if game is in a playable state
     */
    static isGamePlayable(gameEnv) {
        return gameEnv.isGameReady() &&
            [GameEnvironment_1.GamePhase.MAIN_PHASE, GameEnvironment_1.GamePhase.SP_PHASE, GameEnvironment_1.GamePhase.DRAW_PHASE].includes(gameEnv.phase);
    }
    /**
     * Get game progress summary
     */
    static getGameSummary(gameEnv) {
        const player1 = gameEnv.getPlayer(gameEnv.playerId_1);
        const player2 = gameEnv.getPlayer(gameEnv.playerId_2);
        return {
            phase: gameEnv.phase,
            players: {
                [gameEnv.playerId_1]: {
                    handSize: player1?.getHandSize() || 0,
                    deckSize: player1?.getDeckSize() || 0,
                    currentLeader: player1?.getCurrentLeaderCardId() || null,
                    zonesOccupied: {
                        top: gameEnv.zones.isZoneOccupied(gameEnv.playerId_1, GameEnvironment_1.ZoneType.TOP),
                        left: gameEnv.zones.isZoneOccupied(gameEnv.playerId_1, GameEnvironment_1.ZoneType.LEFT),
                        right: gameEnv.zones.isZoneOccupied(gameEnv.playerId_1, GameEnvironment_1.ZoneType.RIGHT),
                        help: gameEnv.zones.isZoneOccupied(gameEnv.playerId_1, GameEnvironment_1.ZoneType.HELP),
                        sp: gameEnv.zones.isZoneOccupied(gameEnv.playerId_1, GameEnvironment_1.ZoneType.SP)
                    }
                },
                [gameEnv.playerId_2]: {
                    handSize: player2?.getHandSize() || 0,
                    deckSize: player2?.getDeckSize() || 0,
                    currentLeader: player2?.getCurrentLeaderCardId() || null,
                    zonesOccupied: {
                        top: gameEnv.zones.isZoneOccupied(gameEnv.playerId_2, GameEnvironment_1.ZoneType.TOP),
                        left: gameEnv.zones.isZoneOccupied(gameEnv.playerId_2, GameEnvironment_1.ZoneType.LEFT),
                        right: gameEnv.zones.isZoneOccupied(gameEnv.playerId_2, GameEnvironment_1.ZoneType.RIGHT),
                        help: gameEnv.zones.isZoneOccupied(gameEnv.playerId_2, GameEnvironment_1.ZoneType.HELP),
                        sp: gameEnv.zones.isZoneOccupied(gameEnv.playerId_2, GameEnvironment_1.ZoneType.SP)
                    }
                }
            },
            gameProgress: {
                allMainZonesFilled: gameEnv.areAllMainZonesFilled(),
                allSpZonesFilled: gameEnv.areAllSpZonesFilled(),
                totalEvents: gameEnv.eventManager.getEvents().length,
                totalPlays: gameEnv.playSequenceManager.getPlays().length
            }
        };
    }
    /**
     * Deep clone a GameEnvironment instance
     */
    static deepClone(gameEnv) {
        return gameEnv.clone();
    }
    /**
     * Compare two GameEnvironment instances for differences
     */
    static compare(gameEnv1, gameEnv2) {
        const json1 = gameEnv1.toJSON();
        const json2 = gameEnv2.toJSON();
        const differences = {};
        // Basic field comparison
        const basicFields = ['phase', 'playerId_1', 'playerId_2', 'gameStarted', 'firstPlayer'];
        for (const field of basicFields) {
            if (json1[field] !== json2[field]) {
                differences[field] = { from: json1[field], to: json2[field] };
            }
        }
        // Event count comparison
        if (json1.gameEvents?.length !== json2.gameEvents?.length) {
            differences.eventCount = { from: json1.gameEvents?.length || 0, to: json2.gameEvents?.length || 0 };
        }
        // Play sequence comparison
        if (json1.playSequence?.globalSequence !== json2.playSequence?.globalSequence) {
            differences.playSequence = {
                from: json1.playSequence?.globalSequence || 0,
                to: json2.playSequence?.globalSequence || 0
            };
        }
        return differences;
    }
}
exports.GameEnvironmentHelper = GameEnvironmentHelper;
// Export all utilities
exports.default = {
    GameEnvironmentAdapter,
    GameEnvironmentValidator,
    GameEnvironmentHelper
};
//# sourceMappingURL=GameEnvironmentAdapter.js.map