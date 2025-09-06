// src/services/GameLogic.ts
// PLACEHOLDER - Custom Trading Card Game Logic

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { Request, Response } from 'express';

// Import core models
import { GameEnvironment } from '../models/GameEnvironment';
import { GamePhase, ZoneType, PlayerActionType, EventType } from '../models/GameEnums';
import { EventManager, PlayerAction, EventFactory, GameEvent, EventStatus, EventPriority } from './EventQueue/index';

// ============ TYPE DEFINITIONS ============

export interface GameLogicResult {
    success: boolean;
    gameId?: string;
    gameEnv?: GameEnvironment;
    error?: string;
    requiresCardSelection?: boolean;
    acknowledgedCount?: number;
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

    constructor() {
        this.baseDataPath = path.join(__dirname, '../gameData');
        console.log('🎮 Custom Trading Card Game Logic initialized with nodemon config');
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
            
            const actionResult = await this.processAction(gameEnv, startAction);
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
            
            const actionResult = await this.processAction(gameEnv, joinAction);
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

    /**
     * Play a card in your custom trading card game (Legacy zone-based method)
     * @param gameId - Game ID
     * @param playerId - Player ID
     * @param cardUID - Card UID to play
     * @param zone - Zone to place card (slot1-slot6, base)
     * @param faceDown - Whether to play face down
     * @returns Promise<PlayerActionResult>
     */
    async playCardLegacy(gameId: string, playerId: string, cardUID: string, zone: string, faceDown: boolean = false): Promise<PlayerActionResult> {
        try {
            console.log(`🎮 Playing custom trading card ${cardUID} in ${zone} for player ${playerId}`);
            
            // Load game environment
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            
            //     
            //     if (eventResult.needsPlayerInput) {
            //         return {
            //             success: true,
            //             gameId,
            //             gameEnv,
            //             requiresCardSelection: true,
            //             cardSelectionId: eventResult.waitingForChoice
            //         };
            //     }
            // } else {
            //     console.log('⚠️ Event processor not initialized, using direct placement');
            // }
           
            console.log('🚧 [PLACEHOLDER] Custom card play logic not implemented');
            console.log('🚧 [PLACEHOLDER] Add your custom card placement and effect processing here');
            
            // Save updated game state
            await this.saveGameToFile(gameId, gameEnv);
            
            console.log(`✅ Custom trading card ${cardUID} played successfully`);
            
            return {
                success: true,
                gameId: gameId,
                gameEnv: gameEnv,
                requiresCardSelection: false
            };
            
        } catch (error) {
            console.error('❌ Error playing card:', error);
            return {
                success: false,
                error: `Failed to play card: ${error instanceof Error ? error.message : 'Unknown error'}`
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
            
            const actionResult = await this.processAction(gameEnv, startReadyAction);
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
    async getPlayerGameState(gameId: string, playerId: string): Promise<GameLogicResult> {
        try {
            // Load game from file
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }
            
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
        const gameData = gameEnv.toJSON();
        
        // Ensure directory exists
        await fs.promises.mkdir(this.baseDataPath, { recursive: true });
        
        // Save to file
        await fs.promises.writeFile(filePath, JSON.stringify(gameData, null, 2));
        console.log(`💾 Custom trading card game ${gameId} saved to file`);
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
            
            console.log(`📂 Custom trading card game ${gameId} loaded from file`);
            return gameEnv;
            
        } catch (error) {
            console.error(`❌ Error loading custom trading card game ${gameId}:`, error);
            return null;
        }
    }

    // TODO: Add event processors that will be called by the event queue system
    // These should be registered with the global event queue to handle specific event types
    
    /**
     * Event processor for CREATE_GAME events
     * This will be called by the event queue when processing CREATE_GAME events
     */
    static async handleStartGameEvent(event: any): Promise<void> {
        try {
            // TODO: Process CREATE_GAME event
            // - Load game from file using event.gameId
            // - Initialize event processor for the specific game
            // - Register card triggers from st01Card.json
            // - Set up initial game state for event-driven processing
            
            console.log('📝 TODO: handleStartGameEvent - Implementation needed for queue processing');
            console.log('📋 Event data:', event);
            
        } catch (error) {
            console.error('❌ Error handling CREATE_GAME event:', error);
        }
    }

    /**
     * Event processor for JOIN_GAME events
     * This will be called by the event queue when processing JOIN_GAME events
     */
    static async handleJoinGameEvent(event: any): Promise<void> {
        try {
            // TODO: Process JOIN_GAME event
            // - Load game from file using event.gameId
            // - Activate event processing for both players
            // - Initialize trigger engine with card abilities
            // - Set up event-driven game flow
            
            console.log('📝 TODO: handleJoinGameEvent - Implementation needed for queue processing');
            console.log('📋 Event data:', event);
            
        } catch (error) {
            console.error('❌ Error handling JOIN_GAME event:', error);
        }
    }
    
    // ============ EVENT CREATION HELPERS ============
    
    /**
     * Convert player action to game event - centralized in GameLogic for cleaner flow
     */
    private createEventFromAction(action: PlayerAction): GameEvent | null {
        switch (action.type) {
            case PlayerActionType.CREATE_GAME:
                return {
                    id: action.type.toLowerCase()+`_${Date.now()}_${Math.random()}`,
                    type: EventType.CREATE_GAME,
                    status: EventStatus.DECLARED,
                    priority: EventPriority.HIGH,
                    timestamp: Date.now(),
                    playerId: action.playerId,
                    data: {
                        playerId: action.playerId,
                        gameId: action.gameId
                    }
                };
            
            case PlayerActionType.JOIN_GAME:
                return {
                    id: action.type.toLowerCase()+`_${Date.now()}_${Math.random()}`,
                    type: EventType.JOIN_GAME,
                    status: EventStatus.DECLARED,
                    priority: EventPriority.HIGH,
                    timestamp: Date.now(),
                    playerId: action.playerId,
                    data: {
                        playerId: action.playerId,
                        gameId: action.gameId
                    }
                };
            
            case PlayerActionType.CONFIRM_REDRAW:
                return {
                    id: `start_ready_${Date.now()}_${Math.random()}`,
                    type: EventType.CONFIRM_REDRAW,
                    status: EventStatus.DECLARED,
                    priority: EventPriority.NORMAL,
                    timestamp: Date.now(),
                    playerId: action.playerId,
                    data: {
                        playerId: action.playerId,
                        gameId: action.gameId,
                        isRedraw: action.isRedraw || false
                    }
                };
                
            case PlayerActionType.END_TURN:
                return EventFactory.createEndTurnEvent(
                    action.playerId,
                    action.currentTurn || 0
                );
                
            case PlayerActionType.ACKNOWLEDGE_EVENTS:
                return EventFactory.createAcknowledgeEventsEvent(
                    action.playerId,
                    action.eventIds || []
                );
                
            case PlayerActionType.PLAYER_ACTION:
                return {
                    id: `player_action_${Date.now()}_${Math.random()}`,
                    type: EventType.PLAYER_ACTION,
                    status: EventStatus.DECLARED,
                    priority: EventPriority.NORMAL,
                    timestamp: Date.now(),
                    playerId: action.playerId,
                    data: {
                        playerId: action.playerId,
                        gameId: action.gameId,
                        cardUID: action.cardUID,
                        playAs: action.playAs
                    }
                };
                
            default:
                console.warn(`⚠️ Unknown action type: ${action.type}`);
                return null;
        }
    }
    
    /**
     * Process action through event queue - create event then use centralized processor
     */
    async processAction(gameEnv: GameEnvironment, action: PlayerAction): Promise<any> {
        if (!gameEnv.eventManager) {
            gameEnv.initializeEventManager();
        }
        
        if (gameEnv.eventManager) {
            // Create event in GameLogic
            const event = this.createEventFromAction(action);
            if (event) {
                // Use centralized processEvent for direct event processing
                const result = await gameEnv.eventManager.processEvent(event);
                
                // Check if there were validation errors in the event queue
                if (!result.success) {
                    return { success: false, error: result.error || 'Event validation failed' };
                }
                
                return result;
            }
        }
        
        return { success: false, error: 'Event creation failed' };
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
                    fieldEffects: {
                        zoneRestrictions: {
                            TOP: ['右翼', '自由', '經濟'],
                            LEFT: ['右翼', '自由', '愛國者'],
                            RIGHT: ['右翼', '愛國者', '經濟'],
                            HELP: 'ALL',
                            SP: 'ALL'
                        },
                        activeEffects: [
                            {
                                effectId: 's-1_trump_rightWing_patriot_boost',
                                source: 's-1',
                                type: 'powerBoost',
                                target: { scope: 'SELF', gameTypes: ['右翼', '愛國者'] },
                                value: 45
                            }
                        ],
                        disabledCards: [],
                        victoryPointModifiers: 0
                    }
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
                    fieldEffects: {
                        zoneRestrictions: {
                            TOP: ['左翼', '自由', '經濟', '右翼', '愛國者'],
                            LEFT: ['左翼', '自由', '經濟', '右翼', '愛國者'],
                            RIGHT: ['左翼', '自由', '經濟', '右翼', '愛國者'],
                            HELP: 'ALL',
                            SP: 'ALL'
                        },
                        activeEffects: [
                            {
                                effectId: 's-2_biden_all_boost',
                                source: 's-2',
                                type: 'powerBoost',
                                target: { scope: 'SELF', gameTypes: 'ALL' },
                                value: 40
                            }
                        ],
                        disabledCards: [],
                        victoryPointModifiers: 0
                    }
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
            gameEvents: [],
            lastEventId: 0,
            pendingCardSelections: {},
            playSequence: {
                globalSequence: 2,
                plays: [
                    {
                        sequenceId: 1,
                        playerId: 'playerId_1',
                        cardUid: 's-1',
                        action: 'PLAY_LEADER',
                        zone: 'leader'
                    },
                    {
                        sequenceId: 2,
                        playerId: 'playerId_2',
                        cardUid: 's-2',
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
     * Process player action with card auto-discovery from zones
     * @param gameId - Game ID
     * @param playerId - Player ID  
     * @param cardUID - Card UID to find and act upon
     * @param playAs - How the card should be played (unit/command/pilot/base)
     * @returns Promise<GameLogicResult>
     */
    async playCard(gameId: string, playerId: string, cardUID: string, playAs?: string): Promise<GameLogicResult> {
        try {
            console.log(`🎯 playCard: gameId=${gameId}, playerId=${playerId}, cardUID=${cardUID}, playAs=${playAs || 'default'}`);
            
            // Validate inputs
            if (!gameId || !playerId || !cardUID) {
                return {
                    success: false,
                    error: 'gameId, playerId, and cardUID are required'
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
            
            // Create and process PLAYER_ACTION event
            const playerActionEvent: PlayerAction = {
                type: PlayerActionType.PLAYER_ACTION,
                playerId,
                gameId,
                cardUID,
                playAs
            };
            
            const actionResult = await this.processAction(gameEnv, playerActionEvent);
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
            
            console.log("AcknowledgeEvents before processing:", JSON.stringify(gameEnv?.gameEvents));
            
            // Process ACKNOWLEDGE_EVENTS through centralized action processing
            const acknowledgeAction: PlayerAction = {
                type: PlayerActionType.ACKNOWLEDGE_EVENTS,
                playerId,
                gameId,
                eventIds
            };
            
            const actionResult = await this.processAction(gameEnv, acknowledgeAction);
            console.log('🎮 ACKNOWLEDGE_EVENTS processed:', actionResult);
            
            if (!actionResult.success) {
                return {
                    success: false,
                    error: actionResult.error || 'Failed to acknowledge events'
                };
            }
            
            // Save updated game state
            await this.saveGameToFile(gameId, gameEnv);
            
            console.log("AcknowledgeEvents after processing:", JSON.stringify(gameEnv?.gameEvents));
            
            return {
                success: true,
                acknowledgedCount: eventIds.length,
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
}

// ============ EXPORT SINGLETON ============

// Create singleton instance for your custom trading card game
export const gameLogic = new GameLogic();
export default gameLogic;