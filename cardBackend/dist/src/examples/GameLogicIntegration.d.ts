export declare class GameLogicWithClassSupport {
    /**
     * Enhanced createNewGame method using GameEnvironment class
     */
    createNewGameWithClass(playerId: string): {
        gameId: string;
        gameEnv: any;
    };
    /**
     * Enhanced joinRoom method using GameEnvironment class
     */
    joinRoomWithClass(gameId: string, playerId: string, playerDeckData: any): any;
    /**
     * Enhanced processPlayerAction using GameEnvironment class
     */
    processPlayerActionWithClass(gameId: string, playerId: string, action: any): any;
    /**
     * Handle PlayCard action using class methods
     */
    private handlePlayCardWithClass;
    /**
     * Handle PlayCardBack action using class methods
     */
    private handlePlayCardBackWithClass;
    /**
     * Handle DrawCard action using class methods
     */
    private handleDrawCardWithClass;
    /**
     * Convert field index to zone type
     */
    private convertFieldIndexToZone;
    /**
     * Utility method to generate game ID
     */
    private generateGameId;
    /**
     * Mock method to simulate loading game data
     */
    private loadGameData;
    /**
     * Mock method to simulate saving game data
     */
    private saveGameData;
}
export declare class GameLogicMigrationHelper {
    /**
     * Gradual migration strategy from legacy JSON to class-based approach
     */
    static getMigrationPlan(): string[];
    /**
     * Identify areas of existing code that would benefit from class-based approach
     */
    static getRefactoringPriorities(): string[];
    /**
     * Benefits of migrating to class-based approach
     */
    static getBenefits(): string[];
}
export declare function demonstrateIntegration(): void;
declare const _default: {
    GameLogicWithClassSupport: typeof GameLogicWithClassSupport;
    GameLogicMigrationHelper: typeof GameLogicMigrationHelper;
    demonstrateIntegration: typeof demonstrateIntegration;
};
export default _default;
//# sourceMappingURL=GameLogicIntegration.d.ts.map