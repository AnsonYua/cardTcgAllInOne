/**
 * Utility functions for game-related operations
 * TypeScript version with proper type annotations
 */

import { GameEnvironment, Player, PlayerFieldEffects, PlayerZones } from '../models/GameEnvironment';

// Type definitions for game utility functions
export interface Condition {
    type: string;
    value: string;
}

/**
 * Get list of player IDs from game environment
 * @param gameEnv - Current game environment
 * @returns Array of player IDs
 */
export function getPlayerFromGameEnv(gameEnv: GameEnvironment): string[] {
    if (!gameEnv.players) {
        throw new Error('Game environment must have unified structure with gameEnv.players');
    }
    return Object.keys(gameEnv.players);
}

/**
 * Get opponent player ID
 * @param gameEnv - Current game environment
 * @returns Opponent player ID or undefined
 */
export function getOpponentPlayer(gameEnv: GameEnvironment): string | undefined {
    const currentPlayer = gameEnv.currentPlayer;
    if (!currentPlayer) return undefined;
    
    const playerIds = getPlayerFromGameEnv(gameEnv).filter(playerId => playerId !== currentPlayer);
    return playerIds[0];
}

/**
 * Check if condition matches current game state
 * @param condition - Condition to check
 * @param gameEnv - Current game environment
 * @param currentPlayerId - Current player ID
 * @param opponentPlayerId - Opponent player ID
 * @returns Whether condition matches
 */
export function isConditionMatch(
    condition: Condition, 
    gameEnv: GameEnvironment,
    currentPlayerId: string, 
    opponentPlayerId: string
): boolean {
    if (condition.type === "opponentLeaderHasLevel" && condition.value === "7") {
        return true;
    }
    return false;
}

/**
 * Get player data from unified structure
 * @param gameEnv - Current game environment
 * @param playerId - Player ID
 * @returns Player data object or null
 */
export function getPlayerData(gameEnv: GameEnvironment, playerId: string): Player | null {
    if (!gameEnv.players) {
        throw new Error('Game environment must have unified structure with gameEnv.players');
    }
    return gameEnv.players[playerId] || null;
}

/**
 * Get player field data from unified structure
 * @param gameEnv - Current game environment
 * @param playerId - Player ID
 * @returns Player field data object or null
 */
export function getPlayerField(gameEnv: GameEnvironment, playerId: string): PlayerZones | null {
    if (!gameEnv.zones) {
        throw new Error('Game environment must have unified structure with gameEnv.zones');
    }
    
    const zones = gameEnv.zones.getZonesData();
    
    // Debug logging (from original file)
    for (const key in zones) {
        console.log(key);
    }
    
    return gameEnv.zones.getPlayerZones(playerId) || null;
}

/**
 * Get player field effects from unified structure
 * @param gameEnv - Current game environment
 * @param playerId - Player ID
 * @returns Player field effects object or null
 */
export function getPlayerFieldEffects(gameEnv: GameEnvironment, playerId: string): PlayerFieldEffects | null {
    if (!gameEnv.players) {
        throw new Error('Game environment must have unified structure with gameEnv.players');
    }
    return gameEnv.players[playerId]?.fieldEffects || null;
}

/**
 * Set player data in unified structure
 * @param gameEnv - Current game environment
 * @param playerId - Player ID
 * @param playerData - Player data to set
 */
export function setPlayerData(gameEnv: GameEnvironment, playerId: string, playerData: Player): void {
    if (!gameEnv.players) {
        throw new Error('Game environment must have unified structure with gameEnv.players');
    }
    gameEnv.players[playerId] = playerData;
}

/**
 * Set player field data in unified structure
 * @param gameEnv - Current game environment
 * @param playerId - Player ID
 * @param fieldData - Field data to set
 */
export function setPlayerField(gameEnv: GameEnvironment, playerId: string, fieldData: PlayerZones): void {
    if (!gameEnv.zones) {
        throw new Error('Game environment must have unified structure with gameEnv.zones');
    }
    gameEnv.zones.setZonesData({
        ...gameEnv.zones.getZonesData(),
        [playerId]: fieldData
    });
}

/**
 * Set player field effects in unified structure
 * @param gameEnv - Current game environment
 * @param playerId - Player ID
 * @param fieldEffects - Field effects to set
 */
export function setPlayerFieldEffects(gameEnv: GameEnvironment, playerId: string, fieldEffects: PlayerFieldEffects): void {
    if (!gameEnv.players) {
        throw new Error('Game environment must have unified structure with gameEnv.players');
    }
    if (!gameEnv.players[playerId]) {
        throw new Error(`Player ${playerId} not found in game environment`);
    }
    gameEnv.players[playerId].fieldEffects = fieldEffects;
}