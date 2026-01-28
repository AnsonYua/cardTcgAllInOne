// src/services/GameLogic.ts
// PLACEHOLDER - Custom Trading Card Game Logic

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// Import core models
import { GameEnvironment } from '../models/GameEnvironment';
import { PlayerActionType, EventType } from '../models/GameEnums';
import { EventFactory, EventStatus } from './EventQueue/index';
import { BurstEffectChoiceEvent, BlockerChoiceEvent, TargetReference } from './EventQueue/interfaces/GameEvent';
import { PlayerAction } from '../models/EventInterfaces';
import { StaticEventProcessor } from './StaticEventProcessor';
import { GameNotificationManager } from './GameNotificationManager';
import { ChoiceNotificationEmitter } from './notifications/ChoiceNotificationEmitter';
import { processAction } from './actions/ActionProcessor';
import { ChoiceConfirmationService } from './choices/ChoiceConfirmationService';
import { CardDatabaseManager } from '../models/CardSystem';

// ============ TYPE DEFINITIONS ============

export interface GameLogicResult {
    success: boolean;
    gameId?: string;
    gameEnv?: GameEnvironment;
    error?: string;
    requiresCardSelection?: boolean;
    acknowledgedCount?: number;
    result?: string;
}

export interface CardPlayResult {
    success: boolean;
    error?: string;
    gameState?: GameEnvironment;
    requiresCardSelection?: boolean;
    processingTime?: number;
}

export interface PlayerActionResult {
    success: boolean;
    gameId?: string;
    error?: string;
    gameEnv?: GameEnvironment;
    requiresCardSelection?: boolean;
    cardSelectionId?: string;
}

// ============ PLACEHOLDER GAME LOGIC CLASS ============

export class GameLogic {
    private baseDataPath: string;
    private static cardDataById: Record<string, any> | null = null;
    private static readonly CARD_DATA_FILES: readonly string[] = [
        'gd01Card.json',
        'gd02Card.json',
        'gd03Card.json',
        'st01Card.json',
        'st02Card.json',
        'st03Card.json',
        'st04Card.json',
        'st05Card.json',
        'st06Card.json',
        'st07Card.json',
        'st08Card.json'
    ];

    constructor() {
        this.baseDataPath = path.join(__dirname, '../gameData');
        GameLogic.ensureCardDataLoaded();
        console.log('🎮 Custom Trading Card Game Logic initialized with nodemon config');
    }

    private static ensureCardDataLoaded(): void {
        if (GameLogic.cardDataById) {
            return;
        }

        // Prefer the existing global card DB, but also fulfill the requirement to read from src/data on server start.
        // This is resilient for both ts-node dev runs and compiled dist runs (as long as src/data exists in the runtime cwd).
        const merged: Record<string, any> = {};

        try {
            const dataDirCandidates = [
                path.join(process.cwd(), 'src', 'data'),
                path.join(__dirname, '../data')
            ];
            const dataDir = dataDirCandidates.find(candidate => fs.existsSync(candidate));

            if (!dataDir) {
                console.warn('⚠️ Card data directory not found; falling back to CardDatabaseManager');
                Object.assign(merged, CardDatabaseManager.getAllCards());
                GameLogic.cardDataById = merged;
                return;
            }

            for (const filename of GameLogic.CARD_DATA_FILES) {
                const filePath = path.join(dataDir, filename);
                if (!fs.existsSync(filePath)) {
                    console.warn(`⚠️ Card data file missing: ${filePath}`);
                    continue;
                }

                const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const cards = raw?.cards ?? raw;

                if (Array.isArray(cards)) {
                    for (const entry of cards) {
                        const cardId = entry?.cardId || entry?.id;
                        if (typeof cardId === 'string' && entry && typeof entry === 'object') {
                            merged[cardId] = entry;
                        }
                    }
                    continue;
                }

                if (cards && typeof cards === 'object') {
                    for (const [cardId, entry] of Object.entries(cards)) {
                        if (entry && typeof entry === 'object') {
                            merged[cardId] = entry;
                        }
                    }
                }
            }

            if (Object.keys(merged).length === 0) {
                Object.assign(merged, CardDatabaseManager.getAllCards());
            }

            GameLogic.cardDataById = merged;
            console.log(`📚 GameLogic card data cache ready (${Object.keys(merged).length} cards)`);
        } catch (error) {
            console.error('❌ Failed to build GameLogic card data cache:', error);
            GameLogic.cardDataById = CardDatabaseManager.getAllCards() || {};
        }
    }

    private static getCardData(cardId: string | undefined | null): any | null {
        if (!cardId) {
            return null;
        }
        GameLogic.ensureCardDataLoaded();
        return GameLogic.cardDataById?.[cardId] ?? null;
    }

    private hydrateGameEnvCardData(gameEnv: GameEnvironment): void {
        GameLogic.ensureCardDataLoaded();

        for (const player of Object.values(gameEnv.players || {})) {
            // Normalize legacy saved state: deck.hand sometimes gets persisted instead of deck.handUids.
            const deckAny = (player as any)?.deck;
            if (deckAny && Array.isArray(deckAny._handUids) && deckAny._handUids.some((v: any) => typeof v !== 'string')) {
                deckAny._handUids = deckAny._handUids
                    .map((v: any) => (typeof v === 'string' ? v : v?.carduid))
                    .filter((v: any) => typeof v === 'string');
            }

            const zones: any = (player as any)?.zones;
            if (!zones) {
                continue;
            }

            const hydrateCard = (card: any): void => {
                if (!card || typeof card !== 'object') {
                    return;
                }
                const cardId = card.cardId;
                const cardData = GameLogic.getCardData(cardId);
                if (cardData) {
                    card.cardData = cardData;
                }
            };

            const slotNames = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];
            for (const slotName of slotNames) {
                const slot = zones[slotName];
                hydrateCard(slot?.unit);
                hydrateCard(slot?.pilot);
            }

            const arrayZones = ['base', 'shieldArea', 'energyArea', 'trashArea'];
            for (const zoneName of arrayZones) {
                const list = zones[zoneName];
                if (!Array.isArray(list)) {
                    continue;
                }
                for (const card of list) {
                    hydrateCard(card);
                }
            }
        }
    }

    public async processAction(gameEnv: GameEnvironment, action: PlayerAction): Promise<any> {
        return processAction(gameEnv, action);
    }

    async createGame(playerId: string): Promise<GameLogicResult> {
        try {
            console.log(`🎮 Creating new custom trading card game for player: ${playerId}`);
            
            const gameId = uuidv4();
            const gameEnv = new GameEnvironment();
            
            const startAction: PlayerAction = {
                type: PlayerActionType.CREATE_GAME,
                playerId,
                gameId
            };
            
            const actionResult = await processAction(gameEnv, startAction);
            console.log('🎮 CREATE_GAME processed:', actionResult);
            // Save game to file system
            await this.saveGameToFile(gameId, gameEnv);
            console.log(`✅ Custom trading card game created successfully: ${gameId}`);
            return {
                success: true,
                gameId: gameId,
                gameEnv: gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error creating game:', error);
            return {
                success: false,
                error: `Failed to create game: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async joinGame(gameId: string, playerId: string): Promise<GameLogicResult> {
        try {
            console.log(`🎮 Player ${playerId} joining custom trading card game: ${gameId}`);
            
            // Load existing game
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            
            // Process JOIN_GAME through centralized action processing (validation will happen in event queue)
            const joinAction: PlayerAction = {
                type: PlayerActionType.JOIN_GAME,
                playerId,
                gameId
            };
            
            const actionResult = await processAction(gameEnv, joinAction);
            console.log('🎮 JOIN_GAME processed:', actionResult);
            
            if (!actionResult.success) {
                return {
                    success: false,
                    error: actionResult.error || 'Join game failed'
                };
            }
            
            console.log(`✅ Player ${playerId} joined custom trading card game ${gameId}`);
            
            // Save updated game
            await this.saveGameToFile(gameId, gameEnv);
            
            return {
                success: true,
                gameId: gameId,
                gameEnv: gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error joining game:', error);
            return {
                success: false,
                error: `Failed to join game: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async chooseFirstPlayer(gameId: string, playerId: string, chosenFirstPlayerId: string): Promise<GameLogicResult> {
        try {
            console.log(`🎮 Player ${playerId} choosing first player for game: ${gameId}`);

            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }

            const chooseFirstPlayerAction: PlayerAction = {
                type: PlayerActionType.CHOOSE_FIRST_PLAYER,
                playerId,
                gameId,
                chosenFirstPlayerId
            };

            const actionResult = await processAction(gameEnv, chooseFirstPlayerAction);
            console.log('🎮 CHOOSE_FIRST_PLAYER processed:', actionResult);

            if (!actionResult.success) {
                return {
                    success: false,
                    error: actionResult.error || 'Choose first player failed'
                };
            }

            await this.saveGameToFile(gameId, gameEnv);

            return {
                success: true,
                gameId,
                gameEnv
            };
        } catch (error) {
            console.error('❌ Error choosing first player:', error);
            return {
                success: false,
                error: `Failed to choose first player: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

  

    /**
     * Start ready phase for a player
     * @param gameId - Game ID
     * @param playerId - Player ID
     * @returns Promise<GameLogicResult>
     */
    async startReady(gameId: string, playerId: string, isRedraw: boolean = false): Promise<GameLogicResult> {
        try {
            console.log(`🎮 Player ${playerId} starting ready phase for game: ${gameId}`);
            
            // Load existing game
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            
            // Process CONFIRM_REDRAW through centralized action processing
            const startReadyAction: PlayerAction = {
                type: PlayerActionType.CONFIRM_REDRAW,
                playerId,
                gameId,
                isRedraw
            };
            
            const actionResult = await processAction(gameEnv, startReadyAction);
            console.log('🎮 CONFIRM_REDRAW processed:', actionResult);
            
            if (!actionResult.success) {
                return {
                    success: false,
                    error: actionResult.error || 'Start ready failed'
                };
            }
            
            // Save updated game
            await this.saveGameToFile(gameId, gameEnv);
            
            console.log(`✅ Player ${playerId} ready phase started for game ${gameId}`);
            
            return {
                success: true,
                gameId: gameId,
                gameEnv: gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error starting ready phase:', error);
            return {
                success: false,
                error: `Failed to start ready: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Get game state for a player
     * @param gameId - Game ID
     * @param playerId - Player ID
     * @returns Promise<GameLogicResult>
     */
    async getPlayerGameState(gameId: string, _playerId: string): Promise<GameLogicResult> {
        try {
            // Load game from file
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            /**
             * when start /restart server , read 
             * cardBackend/src/data/gd01Card.json cardBackend/src/data/gd02Card.json cardBackend/src/data/gd03Card.json cardBackend/src/data/st01Card.json cardBackend/src/data/st02Card.json cardBackend/src/data/st03Card.json cardBackend/src/data/st04Card.json cardBackend/src/data/st05Card.json cardBackend/src/data/st06Card.json cardBackend/src/data/st07Card.json cardBackend/src/data/st08Card.json
             * and store them in a variable.
             * 
             * 
             * after get the gameEnv,for each card in gameEnv, no matter in base/shield/unit/pilot/hand
             * use cardId to look for the cardData in above variable and add/update cardData to the card
             * 
             */
            this.hydrateGameEnvCardData(gameEnv);
            // TODO: Add custom game state validation for your trading card game
            // - Check player exists
            // - Apply game-specific state filters
            // - Calculate current game status
            
            return {
                success: true,
                gameId: gameId,
                gameEnv: gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error getting game state:', error);
            return {
                success: false,
                error: `Failed to get game state: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // ============ FILE OPERATIONS ============

    /**
     * Save game environment to file
     * @param gameId - Game ID
     * @param gameEnv - Game environment to save
     * @returns Promise<void>
     */
    public async saveGameToFile(gameId: string, gameEnv: GameEnvironment): Promise<void> {
        const filePath = path.join(this.baseDataPath, `${gameId}.json`);
        
        // Ensure directory exists
        await fs.promises.mkdir(this.baseDataPath, { recursive: true });

        let existingGameData: any | null = null;
        if (fs.existsSync(filePath)) {
            try {
                const fileContent = await fs.promises.readFile(filePath, 'utf8');
                existingGameData = JSON.parse(fileContent);
            } catch (error) {
                console.warn(`⚠️ Failed to parse existing game file (${filePath}): ${error instanceof Error ? error.message : 'unknown error'}`);
            }
        }

        const snapshot = gameEnv.toJSON();
        const normalizedNewState = this.normalizeStateForComparison(snapshot);
        const existingVersion = typeof existingGameData?.version === 'number' ? existingGameData.version : 0;
        let shouldBumpVersion = true;

        if (existingGameData) {
            const normalizedExistingState = this.normalizeStateForComparison(existingGameData);
            shouldBumpVersion = normalizedExistingState !== normalizedNewState;
        }

        if (shouldBumpVersion) {
            gameEnv.version = Math.max(existingVersion, gameEnv.version) + 1;
        } else {
            gameEnv.version = Math.max(existingVersion, gameEnv.version);
        }

        const gameData = gameEnv.toJSON();

        // Save to file
        await fs.promises.writeFile(filePath, JSON.stringify(gameData, null, 2));
        console.log(`💾 Custom trading card game ${gameId} saved to file (version ${gameEnv.version})`);
    }

    private normalizeStateForComparison(state: any): string {
        const cloned = this.deepCloneAndStripVersion(state);
        const sorted = this.deepSortObject(cloned);
        return JSON.stringify(sorted);
    }

    private deepCloneAndStripVersion(value: any): any {
        if (Array.isArray(value)) {
            return value.map(item => this.deepCloneAndStripVersion(item));
        }
        if (value && typeof value === 'object') {
            const clone: any = {};
            for (const [key, entry] of Object.entries(value)) {
                if (key === 'version') {
                    continue;
                }
                clone[key] = this.deepCloneAndStripVersion(entry);
            }
            return clone;
        }
        return value;
    }

    private deepSortObject(value: any): any {
        if (Array.isArray(value)) {
            return value.map(item => this.deepSortObject(item));
        }
        if (value && typeof value === 'object') {
            const sorted: any = {};
            Object.keys(value).sort().forEach(key => {
                sorted[key] = this.deepSortObject(value[key]);
            });
            return sorted;
        }
        return value;
    }

    /**
     * Load game environment from file
     * @param gameId - Game ID
     * @returns Promise<GameEnvironment | null>
     */
    public async loadGameFromFile(gameId: string): Promise<GameEnvironment | null> {
        try {
            const filePath = path.join(this.baseDataPath, `${gameId}.json`);
            
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                console.log(`⚠️ Custom trading card game file not found: ${gameId}`);
                return null;
            }
            
            // Read and parse file
            const fileContent = await fs.promises.readFile(filePath, 'utf8');
            const gameData = JSON.parse(fileContent);
            
            // Convert to GameEnvironment class
            const gameEnv = GameEnvironment.fromJSON(gameData);

            // Ensure cardData is present for any persisted cards so effect engines (continuous/triggered)
            // can read card definitions after a server restart.
            this.hydrateGameEnvCardData(gameEnv);
            
            console.log(`📂 Custom trading card game ${gameId} loaded from file`);
            return gameEnv;
            
        } catch (error) {
            console.error(`❌ Error loading custom trading card game ${gameId}:`, error);
            return null;
        }
    }

    /**
     * Get test scenario data for frontend testing
     * @param req - Request object with scenarioPath query parameter
     * @returns GameEnvironment data for the specified test scenario
     */
    async getTestScenario(req: any): Promise<any> {
        const scenarioPath = req.query?.scenarioPath;
        
        if (!scenarioPath) {
            throw new Error('scenarioPath query parameter is required');
        }
        
        // Handle hardcoded simple_test scenario
        if (scenarioPath === 'simple_test' || scenarioPath === 'simple_test.json') {
            return this.getSimpleTestGameEnv();
        }
        
        // Handle file-based scenarios
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            // Add .json extension if not present
            const filename = scenarioPath.endsWith('.json') ? scenarioPath : `${scenarioPath}.json`;
            const scenarioFilePath = path.join(__dirname, '../gameData', filename);
            
            const scenarioContent = await fs.readFile(scenarioFilePath, 'utf8');
            const scenario = JSON.parse(scenarioContent);
            
            // Return gameEnv directly (not wrapped in scenario object)
            if (scenario.initialGameEnv) {
                return scenario.initialGameEnv;
            } else if (scenario.gameEnv) {
                return scenario.gameEnv;
            } else {
                // Backward compatibility - return the whole object if it looks like gameEnv
                if (scenario.phase && scenario.players && scenario.zones) {
                    return scenario;
                }
                throw new Error('Scenario file does not contain valid gameEnv data');
            }
            
        } catch (error) {
            if ((error as any).code === 'ENOENT') {
                throw new Error(`Scenario not found: ${scenarioPath}`);
            }
            throw error;
        }
    }
    
    /**
     * Get hardcoded simple test game environment
     * @returns Complete gameEnv for simple_test scenario
     */
    getSimpleTestGameEnv(): any {
        return {
            phase: 'MAIN_PHASE',
            round: 1,
            gameStarted: true,
            currentPlayer: 'playerId_1',
            currentTurn: 1,
            firstPlayer: 0,
            players: {
                playerId_1: {
                    id: 'playerId_1',
                    name: 'Player 1',
                    deck: {
                        hand: ['c-1', 'h-1', 'c-2', 'c-3', 'c-4'],
                        mainDeck: ['c-5', 'c-6', 'c-7', 'c-8', 'c-9', 'c-10'],
                        leader: ['s-1', 's-2', 's-3', 's-4'],
                        currentLeaderIdx: 0
                    },
                    isReady: true,
                    redraw: 1,
                    playerPoint: 0,
                    // fieldEffects removed - not currently implemented
                },
                playerId_2: {
                    id: 'playerId_2',
                    name: 'Player 2',
                    deck: {
                        hand: ['h-2', 'c-17', 'c-18', 'c-19', 'c-20'],
                        mainDeck: ['c-21', 'c-22', 'c-23', 'c-24', 'c-25'],
                        leader: ['s-2', 's-3', 's-4', 's-5'],
                        currentLeaderIdx: 0
                    },
                    isReady: true,
                    redraw: 1,
                    playerPoint: 0,
                    // fieldEffects removed - not currently implemented
                }
            },
            zones: {
                playerId_1: {
                    leader: {
                        id: 's-1',
                        name: '特朗普',
                        zoneCompatibility: {
                            top: ['右翼', '自由', '經濟'],
                            left: ['右翼', '自由', '愛國者'],
                            right: ['右翼', '愛國者', '經濟']
                        },
                        effects: {
                            rules: [
                                {
                                    id: 'trump_rightWing_patriot_boost',
                                    effect: { type: 'powerBoost', value: 45 }
                                },
                                {
                                    id: 'trump_vs_powell_economy_nerf',
                                    effect: { type: 'conditional' }
                                }
                            ]
                        }
                    },
                    top: [],
                    left: [],
                    right: [],
                    help: [],
                    sp: []
                },
                playerId_2: {
                    leader: {
                        id: 's-2',
                        name: '拜登',
                        zoneCompatibility: {
                            top: ['左翼', '自由', '經濟', '右翼', '愛國者'],
                            left: ['左翼', '自由', '經濟', '右翼', '愛國者'],
                            right: ['左翼', '自由', '經濟', '右翼', '愛國者']
                        },
                        effects: {
                            rules: [
                                {
                                    id: 'biden_all_boost',
                                    effect: { type: 'powerBoost', value: 40 }
                                }
                            ]
                        }
                    },
                    top: [],
                    left: [],
                    right: [],
                    help: [],
                    sp: []
                }
            },
            notificationQueue: [],
            lastEventId: 0,
            playSequence: {
                globalSequence: 2,
                plays: [
                    {
                        sequenceId: 1,
                        playerId: 'playerId_1',
                        carduid: 's-1',
                        action: 'PLAY_LEADER',
                        zone: 'leader'
                    },
                    {
                        sequenceId: 2,
                        playerId: 'playerId_2',
                        carduid: 's-2',
                        action: 'PLAY_LEADER',
                        zone: 'leader'
                    }
                ]
            }
        };
    }



    /**
     * Inject a complete game state for testing purposes
     * @param gameId - Game ID to inject state into
     * @param gameEnv - Complete game environment to inject
     * @returns Promise<GameLogicResult>
     */
    async injectGameState(gameId: string, gameEnv: any): Promise<GameLogicResult> {
        try {
            console.log(`🧪 Injecting game state for testing: ${gameId}`);
            
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'No game environment provided for injection'
                };
            }
            
            // Convert plain object to GameEnvironment instance if needed
            let gameEnvironment: GameEnvironment;
            if (gameEnv instanceof GameEnvironment) {
                gameEnvironment = gameEnv;
            } else {
                // Create GameEnvironment from JSON data
                gameEnvironment = GameEnvironment.fromJSON(gameEnv);
            }
            
            // Save the injected game state
            await this.saveGameToFile(gameId, gameEnvironment);
            
            console.log(`✅ Game state injected successfully: ${gameId}`);
            
            return {
                success: true,
                gameId: gameId,
                gameEnv: gameEnvironment
            };
            
        } catch (error) {
            console.error('❌ Error injecting game state:', error);
            return {
                success: false,
                error: `Failed to inject game state: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Streamlined card play method - passes action directly to minimize conversions
     * @param gameId - Game ID
     * @param playerId - Player ID
     * @param action - Complete action object from API
     * @returns Promise<GameLogicResult>
     */
    async playCardWithAction(gameId: string, playerId: string, action: any): Promise<GameLogicResult> {
        try {
            console.log(`🎯 playCardWithAction: gameId=${gameId}, playerId=${playerId}`, action);
            
            // Validate inputs
            if (!gameId || !playerId || !action?.carduid) {
                return {
                    success: false,
                    error: 'gameId, playerId, and action.carduid are required'
                };
            }
            
            // Load game state
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            
            const playCardEvent = EventFactory.createPlayCardEvent(
                playerId,
                gameId,
                action.carduid,
                action.playAs || 'unit',
                action.targetUnit,
                {
                    fromBurst: action.fromBurst,
                    cardId: action.cardId,
                    slotName: action.slotName
                }
            );

            const processingResult = await StaticEventProcessor.processEvent(gameEnv, playCardEvent);
            console.log('🎮 PLAY_CARD processed:', processingResult);

            if (!processingResult.success) {
                return {
                    success: false,
                    error: processingResult.error || 'Failed to process player action'
                };
            }
            
            // Save updated game state
            await this.saveGameToFile(gameId, gameEnv);
            
            return {
                success: true,
                gameId,
                gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error in playCardWithAction:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to play card'
            };
        }
    }

    /**
     * Execute player action (attacks, abilities, etc.) with minimal object conversion
     * @param gameId - Game ID
     * @param playerId - Player ID
     * @param actionData - Complete action object from API (includes actionType and all action parameters)
     * @returns Promise<GameLogicResult>
     */
    async playerActionWithAction(gameId: string, playerId: string, actionData: any): Promise<GameLogicResult> {
        try {
            console.log(`🗡️ playerActionWithAction: gameId=${gameId}, playerId=${playerId}`, actionData);
            
            // Validate inputs
            if (!gameId || !playerId || !actionData?.actionType) {
                return {
                    success: false,
                    error: 'gameId, playerId, and actionData.actionType are required'
                };
            }
            
            // Load game state
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            
            // Create PlayerAction directly from API actionData - minimal conversion
            const playerActionEvent: PlayerAction = {
                type: PlayerActionType.PLAYER_ACTION,
                playerId,
                gameId,
                ...actionData // Spread all action data to avoid object conversion
            };
            
            const actionResult = await processAction(gameEnv, playerActionEvent);
            console.log('🎮 PLAYER_ACTION processed:', actionResult);
            
            if (!actionResult.success) {
                return {
                    success: false,
                    error: actionResult.error || 'Failed to process player action'
                };
            }
            
            // Save updated game state
            await this.saveGameToFile(gameId, gameEnv);
            
            return {
                success: true,
                gameId,
                gameEnv,
                result: actionResult.result || 'Action completed successfully'
            };
            
        } catch (error) {
            console.error('❌ Error in playerActionWithAction:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to execute player action'
            };
        }
    }

    /**
     * Process player action with card auto-discovery from zones
     * @param gameId - Game ID
     * @param playerId - Player ID  
     * @param carduid - Card UID to find and act upon
     * @param playAs - How the card should be played (unit/command/pilot/base)
     * @param targetUnit - For pilot cards, the unit to attach to
     * @returns Promise<GameLogicResult>
     */
    async playCard(gameId: string, playerId: string, carduid: string, playAs?: string, targetUnit?: string): Promise<GameLogicResult> {
        try {
            console.log(`🎯 playCard: gameId=${gameId}, playerId=${playerId}, carduid=${carduid}, playAs=${playAs || 'default'}, targetUnit=${targetUnit || 'none'}`);
            
            // Validate inputs
            if (!gameId || !playerId || !carduid) {
                return {
                    success: false,
                    error: 'gameId, playerId, and carduid are required'
                };
            }
            
            // Load game state
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            
            // Create and process PLAY_CARD event
            const playCardEvent: PlayerAction = {
                type: PlayerActionType.PLAY_CARD,
                playerId,
                gameId,
                carduid,
                playAs,
                targetUnit
            };
            
            const actionResult = await processAction(gameEnv, playCardEvent);
            console.log('🎮 PLAY_CARD processed:', actionResult);
            
            if (!actionResult.success) {
                return {
                    success: false,
                    error: actionResult.error || 'Failed to process player action'
                };
            }
            
            // Save updated game state
            await this.saveGameToFile(gameId, gameEnv);
            
            return {
                success: true,
                gameId,
                gameEnv
            };
            
        } catch (error) {
            console.error(`❌ Error in playCard:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'playCard failed'
            };
        }
    }

    /**
     * Acknowledge events for a player
     * @param gameId - Game ID
     * @param playerId - Player ID
     * @param eventIds - Array of event IDs to acknowledge
     * @returns Promise<GameLogicResult>
     */
    async acknowledgeEvents(gameId: string, playerId: string, eventIds: string[]): Promise<GameLogicResult> {
        try {
            console.log(`📨 acknowledgeEvents: gameId=${gameId}, playerId=${playerId}`);
            
            // Validate inputs
            if (!gameId || !playerId) {
                return {
                    success: false,
                    error: 'gameId and playerId are required'
                };
            }
            
            if (!eventIds || !Array.isArray(eventIds)) {
                return {
                    success: false,
                    error: 'eventIds array is required'
                };
            }
            
            // Load game state
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            
            console.log("AcknowledgeEvents before processing:", JSON.stringify(gameEnv?.notificationQueue));
            
            const acknowledgeEvent = EventFactory.createAcknowledgeEventsEvent(
                playerId,
                eventIds
            );

            const processingResult = await StaticEventProcessor.processEvent(gameEnv, acknowledgeEvent);
            console.log('🎮 ACKNOWLEDGE_EVENTS processed:', processingResult);

            if (!processingResult.success) {
                return {
                    success: false,
                    error: processingResult.error || 'Failed to acknowledge events'
                };
            }

            // Save updated game state
            await this.saveGameToFile(gameId, gameEnv);

            console.log("AcknowledgeEvents after processing:", JSON.stringify(gameEnv?.notificationQueue));

            return {
                success: true,
                acknowledgedCount: acknowledgeEvent.data.acknowledgedCount ?? 0,
                gameEnv: gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error in acknowledgeEvents:', error);
            return {
                success: false,
                error: `Failed to acknowledge events: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Confirm or decline a burst effect choice
     * @param gameId Game ID
     * @param playerId Player ID making the choice
     * @param eventId Event ID to confirm/decline
     * @param confirmed Whether the player confirmed (true) or declined (false)
     */
    async confirmBurstChoice(gameId: string, playerId: string, eventId: string, confirmed: boolean): Promise<GameLogicResult> {
        try {
            console.log(`💥 Processing burst choice confirmation: ${eventId} by player ${playerId} (${confirmed ? 'confirmed' : 'declined'})`);
            
            // Load game environment
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            
            // Find the event in processing queue
            const event = gameEnv.findEventById(eventId) as BurstEffectChoiceEvent | undefined;
            if (!event) {
                return {
                    success: false,
                    error: 'Event not found in processing queue'
                };
            }
            
            // Validate event type
            if (event.type !== EventType.BURST_EFFECT_CHOICE) {
                return {
                    success: false,
                    error: 'Event is not a burst effect choice'
                };
            }
            
            // Validate player ownership
            if (event.playerId !== playerId) {
                return {
                    success: false,
                    error: 'Player is not authorized to resolve this event'
                };
            }
            
            // Update event with user choice (don't change status - let processing loop handle it)
            event.data.userDecisionMade = true;
            event.data.userDecision = confirmed ? 'ACTIVATE' : 'DECLINE';
            (event.data as Record<string, unknown>)['confirmedAt'] = Date.now();
            
            console.log(`🎯 Event ${eventId} updated with user choice: ${confirmed ? 'ACTIVATE' : 'DECLINE'}`);
            console.log('📋 Queue before burst reorder:', gameEnv.processingQueue.map(evt => evt.id));
            
            // Ensure the burst event is processed next by moving it to the front of the queue
            const removed = gameEnv.dequeueFromProcessing(event);
            if (removed) {
                gameEnv.processingQueue.unshift(event);
            }
            console.log('📋 Queue after burst reorder:', gameEnv.processingQueue.map(evt => evt.id));
            
            // Process events - the RESOLVING event will be handled by GameEngine
            const processingResult = await gameEnv.processEvents();
            
            if (!processingResult.success) {
                return {
                    success: false,
                    error: processingResult.error || 'Failed to process burst choice'
                };
            }
            
            // Save updated game state
            await this.saveGameToFile(gameId, gameEnv);
            
            console.log(`✅ Burst choice ${confirmed ? 'confirmed' : 'declined'} and processed successfully`);
            
            return {
                success: true,
                gameId,
                gameEnv: gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error in confirmBurstChoice:', error);
            return {
                success: false,
                error: `Failed to confirm burst choice: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Confirm target choice (array-only TARGET_CHOICE API)
     * @param gameId Game ID
     * @param playerId Player ID making the choice
     * @param eventId Event ID to confirm
     * @param selectedTargets Array of selected target objects with carduid, zone, playerId
     */
    async confirmTargetChoice(gameId: string, playerId: string, eventId: string, selectedTargets: any[]): Promise<GameLogicResult> {
        return ChoiceConfirmationService.confirmTargetChoice(
            {
                loadGameFromFile: this.loadGameFromFile.bind(this),
                saveGameToFile: this.saveGameToFile.bind(this)
            },
            gameId,
            playerId,
            eventId,
            selectedTargets
        );
    }

    /**
     * Confirm token choice (choose_one_then_deploy_token)
     * @param gameId Game ID
     * @param playerId Player ID making the choice
     * @param eventId Event ID to confirm
     * @param selectedChoiceIndex Index of the selected token choice
     */
    async confirmTokenChoice(gameId: string, playerId: string, eventId: string, selectedChoiceIndex: number): Promise<GameLogicResult> {
        return ChoiceConfirmationService.confirmTokenChoice(
            {
                loadGameFromFile: this.loadGameFromFile.bind(this),
                saveGameToFile: this.saveGameToFile.bind(this)
            },
            gameId,
            playerId,
            eventId,
            selectedChoiceIndex
        );
    }

    async confirmOptionChoice(gameId: string, playerId: string, eventId: string, selectedOptionIndex: number): Promise<GameLogicResult> {
        return ChoiceConfirmationService.confirmOptionChoice(
            {
                loadGameFromFile: this.loadGameFromFile.bind(this),
                saveGameToFile: this.saveGameToFile.bind(this)
            },
            gameId,
            playerId,
            eventId,
            selectedOptionIndex
        );
    }

    async confirmBlockerChoice(gameId: string, playerId: string, eventId: string, selectedTargets: TargetReference[], notificationId?: string): Promise<GameLogicResult> {
        try {
            console.log(`🛡️ Processing blocker choice confirmation: ${eventId} by player ${playerId}`);
            console.log('Selected blocker target(s):', selectedTargets);

            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }

            const event = gameEnv.processingQueue.find(e => e.id === eventId) as BlockerChoiceEvent | undefined;
            if (!event) {
                return {
                    success: false,
                    error: 'Blocker choice event not found'
                };
            }

            if (event.type !== EventType.BLOCKER_CHOICE) {
                return {
                    success: false,
                    error: 'Event is not a blocker choice'
                };
            }

            if (event.playerId && event.playerId !== playerId && event.data.blockingPlayerId !== playerId) {
                return {
                    success: false,
                    error: 'Player not authorized to resolve this blocker choice'
                };
            }

            const availableTargets = event.data.availableTargets || [];

            let resolvedTarget = undefined;
            if (Array.isArray(selectedTargets) && selectedTargets.length > 0) {
                const chosen = selectedTargets[0];
                const isValidTarget = availableTargets.some(target =>
                    target.carduid === chosen.carduid &&
                    target.zone === chosen.zone &&
                    target.playerId === chosen.playerId
                );

                if (!isValidTarget) {
                    return {
                        success: false,
                        error: `Selected blocker ${chosen.carduid} in ${chosen.zone} is not available`
                    };
                }

                resolvedTarget = {
                    carduid: chosen.carduid,
                    zone: chosen.zone,
                    playerId: chosen.playerId
                };
            }

            event.data.selectedTarget = resolvedTarget;
            event.data.userDecisionMade = true;
            event.data.userDecision = resolvedTarget ? 'BLOCK' : 'DECLINE';
            ChoiceNotificationEmitter.emitBlockerChoiceResolved(gameEnv, event, event.data.userDecision);
            event.status = EventStatus.DECLARED;
            console.log('📋 Queue before blocker reorder:', gameEnv.processingQueue.map(evt => evt.id));

            // Ensure the blocker event is processed next by moving it to the front of the queue
            const removed = gameEnv.dequeueFromProcessing(event);
            if (removed) {
                gameEnv.processingQueue.unshift(event);
            }
            console.log('📋 Queue after blocker reorder:', gameEnv.processingQueue.map(evt => evt.id));
            console.log('❓ needsPlayerInput immediately before processing:', gameEnv.needsPlayerInput(), 'front:', gameEnv.processingQueue[0]?.id);

            const rawNotificationId = (typeof notificationId === 'string' && notificationId.length > 0)
                ? notificationId
                : event.data.originalAttackEvent?.data?.attackNotificationId;

            const attackNotificationId = typeof rawNotificationId === 'string' && rawNotificationId.length > 0
                ? rawNotificationId
                : undefined;

            if (attackNotificationId && resolvedTarget) {
                const notificationManager = new GameNotificationManager(gameEnv);
                const attackNotification = gameEnv.notificationQueue?.find(evt => evt.id === attackNotificationId);
                const attackPayload = attackNotification?.payload || {};
                const refreshPayload = {
                    attackingPlayerId: attackPayload.attackingPlayerId,
                    defendingPlayerId: attackPayload.defendingPlayerId,
                    attackerCarduid: attackPayload.attackerCarduid,
                    attackerSlot: attackPayload.attackerSlot,
                    forcedTargetCarduid: resolvedTarget.carduid,
                    forcedTargetZone: resolvedTarget.zone,
                    forcedTargetPlayerId: resolvedTarget.playerId,
                    sourceNotificationId: attackNotificationId
                };

                notificationManager.addNotificationEvent(
                    'REFRESH_TARGET',
                    refreshPayload,
                    'normal'
                );
            }
            const processingResult = await gameEnv.processEvents();
            if (!processingResult.success) {
                return {
                    success: false,
                    error: processingResult.error || 'Failed to process blocker choice'
                };
            }

            await this.saveGameToFile(gameId, gameEnv);
            console.log('✅ Blocker choice processed successfully');
            
            return {
                success: true,
                gameId,
                gameEnv
            };

        } catch (error) {
            console.error('❌ Error in confirmBlockerChoice:', error);
            return {
                success: false,
                error: `Failed to confirm blocker choice: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}

// ============ EXPORT SINGLETON ============

// Create singleton instance for your custom trading card game
export const gameLogic = new GameLogic();
export default gameLogic;
