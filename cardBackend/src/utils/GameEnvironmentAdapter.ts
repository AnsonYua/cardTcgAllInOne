// src/utils/GameEnvironmentAdapter.ts

/**
 * Adapter utilities for transitioning between legacy JSON gameEnv 
 * and new object-oriented GameEnvironment class
 */

import { GameEnvironment, GamePhase, ZoneType, ActionType, EventType, Player } from '../models/GameEnvironment';

export class GameEnvironmentAdapter {
    
    /**
     * Convert legacy gameEnv JSON to GameEnvironment class instance
     */
    public static fromLegacyJSON(legacyGameEnv: any): GameEnvironment {
        return GameEnvironment.fromJSON(legacyGameEnv);
    }
    
    /**
     * Convert GameEnvironment class instance to legacy JSON format
     */
    public static toLegacyJSON(gameEnv: GameEnvironment): any {
        return gameEnv.toJSON();
    }
    
    /**
     * Upgrade legacy gameEnv JSON in-place to ensure compatibility
     */
    public static upgradeLegacyGameEnv(legacyGameEnv: any): any {
        // Ensure all required fields exist
        if (!legacyGameEnv.phase) {
            legacyGameEnv.phase = GamePhase.WAITING_FOR_PLAYERS;
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
    public static createNewGame(player1Id: string): GameEnvironment {
        const gameEnv = new GameEnvironment();
        
        // Add first player
        gameEnv.addPlayer(player1Id);
        
        // Initialize event system
        gameEnv.eventManager.addEvent(EventType.ROOM_CREATED, {
            createdBy: player1Id,
            status: 'WAITING_FOR_PLAYERS',
            timestamp: Date.now()
        });
        
        return gameEnv;
    }
    
    /**
     * Add second player and initialize game data
     */
    public static addSecondPlayer(gameEnv: GameEnvironment, player2Id: string, player1DeckData: any, player2DeckData: any): void {
        // Add second player
        const player2 = gameEnv.addPlayer(player2Id);
        
        // Set deck data for both players
        const player1 = gameEnv.getPlayer(gameEnv.playerId_1!);
        if (player1) {
            player1.deck = player1DeckData;
        }
        player2.deck = player2DeckData;
        
        // Update phase
        gameEnv.updatePhase(GamePhase.BOTH_JOINED);
        
        // Add join event
        gameEnv.eventManager.addEvent(EventType.PLAYER_JOINED, {
            playerId: player2Id,
            roomStatus: 'BOTH_JOINED',
            readyForStart: true
        });
    }
}

export class GameEnvironmentValidator {
    
    /**
     * Validate GameEnvironment instance for consistency
     */
    public static validate(gameEnv: GameEnvironment): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        
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
            for (const zone of Object.values(ZoneType)) {
                const cardInZone = gameEnv.zones.getCardInZone(playerId, zone);
                if (cardInZone) {
                    const player = gameEnv.players[playerId];
                    
                    if (zone === ZoneType.LEADER) {
                        if (!player.deck.leaderMapping[cardInZone]) {
                            errors.push(`Leader ${cardInZone} in zone but not in leader mapping for ${playerId}`);
                        }
                    } else {
                        if (!player.deck.cardMapping[cardInZone]) {
                            errors.push(`Card ${cardInZone} in ${zone} zone but not in card mapping for ${playerId}`);
                        }
                    }
                }
            }
        }
        
        // Check event system consistency
        const events = gameEnv.eventManager.getEvents();
        if (events.length === 0 && gameEnv.phase !== GamePhase.WAITING_FOR_PLAYERS) {
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
    public static validateLegacyJSON(legacyGameEnv: any): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        
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
                const player = playerData as any;
                
                if (!player.id) {
                    errors.push(`Player ${playerId} missing id field`);
                }
                
                if (!player.deck) {
                    errors.push(`Player ${playerId} missing deck`);
                } else {
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

export class GameEnvironmentHelper {
    
    /**
     * Get current turn player ID based on game state
     */
    public static getCurrentPlayer(gameEnv: GameEnvironment): string | null {
        // Implementation would depend on current turn logic
        // This is a placeholder for turn management integration
        return gameEnv.playerId_1; // Simplified
    }
    
    /**
     * Check if game is in a playable state
     */
    public static isGamePlayable(gameEnv: GameEnvironment): boolean {
        return gameEnv.isGameReady() && 
               [GamePhase.MAIN_PHASE, GamePhase.SP_PHASE, GamePhase.DRAW_PHASE].includes(gameEnv.phase);
    }
    
    /**
     * Get game progress summary
     */
    public static getGameSummary(gameEnv: GameEnvironment): any {
        const player1 = gameEnv.getPlayer(gameEnv.playerId_1!);
        const player2 = gameEnv.getPlayer(gameEnv.playerId_2!);
        
        return {
            phase: gameEnv.phase,
            players: {
                [gameEnv.playerId_1!]: {
                    handSize: player1?.getHandSize() || 0,
                    deckSize: player1?.getDeckSize() || 0,
                    currentLeader: player1?.getCurrentLeaderCardId() || null,
                    zonesOccupied: {
                        top: gameEnv.zones.isZoneOccupied(gameEnv.playerId_1!, ZoneType.TOP),
                        left: gameEnv.zones.isZoneOccupied(gameEnv.playerId_1!, ZoneType.LEFT),
                        right: gameEnv.zones.isZoneOccupied(gameEnv.playerId_1!, ZoneType.RIGHT),
                        help: gameEnv.zones.isZoneOccupied(gameEnv.playerId_1!, ZoneType.HELP),
                        sp: gameEnv.zones.isZoneOccupied(gameEnv.playerId_1!, ZoneType.SP)
                    }
                },
                [gameEnv.playerId_2!]: {
                    handSize: player2?.getHandSize() || 0,
                    deckSize: player2?.getDeckSize() || 0,
                    currentLeader: player2?.getCurrentLeaderCardId() || null,
                    zonesOccupied: {
                        top: gameEnv.zones.isZoneOccupied(gameEnv.playerId_2!, ZoneType.TOP),
                        left: gameEnv.zones.isZoneOccupied(gameEnv.playerId_2!, ZoneType.LEFT),
                        right: gameEnv.zones.isZoneOccupied(gameEnv.playerId_2!, ZoneType.RIGHT),
                        help: gameEnv.zones.isZoneOccupied(gameEnv.playerId_2!, ZoneType.HELP),
                        sp: gameEnv.zones.isZoneOccupied(gameEnv.playerId_2!, ZoneType.SP)
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
    public static deepClone(gameEnv: GameEnvironment): GameEnvironment {
        return gameEnv.clone();
    }
    
    /**
     * Compare two GameEnvironment instances for differences
     */
    public static compare(gameEnv1: GameEnvironment, gameEnv2: GameEnvironment): any {
        const json1 = gameEnv1.toJSON();
        const json2 = gameEnv2.toJSON();
        
        const differences: any = {};
        
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

// Export all utilities
export default {
    GameEnvironmentAdapter,
    GameEnvironmentValidator,
    GameEnvironmentHelper
};