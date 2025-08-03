/**
 * Adapter utilities for transitioning between legacy JSON gameEnv
 * and new object-oriented GameEnvironment class
 */
import { GameEnvironment } from '../models/GameEnvironment';
export declare class GameEnvironmentAdapter {
    /**
     * Convert legacy gameEnv JSON to GameEnvironment class instance
     */
    static fromLegacyJSON(legacyGameEnv: any): GameEnvironment;
    /**
     * Convert GameEnvironment class instance to legacy JSON format
     */
    static toLegacyJSON(gameEnv: GameEnvironment): any;
    /**
     * Upgrade legacy gameEnv JSON in-place to ensure compatibility
     */
    static upgradeLegacyGameEnv(legacyGameEnv: any): any;
    /**
     * Create a new GameEnvironment instance with proper initialization
     */
    static createNewGame(player1Id: string): GameEnvironment;
    /**
     * Add second player and initialize game data
     */
    static addSecondPlayer(gameEnv: GameEnvironment, player2Id: string, player1DeckData: any, player2DeckData: any): void;
}
export declare class GameEnvironmentValidator {
    /**
     * Validate GameEnvironment instance for consistency
     */
    static validate(gameEnv: GameEnvironment): {
        isValid: boolean;
        errors: string[];
    };
    /**
     * Validate legacy JSON format before conversion
     */
    static validateLegacyJSON(legacyGameEnv: any): {
        isValid: boolean;
        errors: string[];
    };
}
export declare class GameEnvironmentHelper {
    /**
     * Get current turn player ID based on game state
     */
    static getCurrentPlayer(gameEnv: GameEnvironment): string | null;
    /**
     * Check if game is in a playable state
     */
    static isGamePlayable(gameEnv: GameEnvironment): boolean;
    /**
     * Get game progress summary
     */
    static getGameSummary(gameEnv: GameEnvironment): any;
    /**
     * Deep clone a GameEnvironment instance
     */
    static deepClone(gameEnv: GameEnvironment): GameEnvironment;
    /**
     * Compare two GameEnvironment instances for differences
     */
    static compare(gameEnv1: GameEnvironment, gameEnv2: GameEnvironment): any;
}
declare const _default: {
    GameEnvironmentAdapter: typeof GameEnvironmentAdapter;
    GameEnvironmentValidator: typeof GameEnvironmentValidator;
    GameEnvironmentHelper: typeof GameEnvironmentHelper;
};
export default _default;
//# sourceMappingURL=GameEnvironmentAdapter.d.ts.map