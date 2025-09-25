// src/services/GameLogic.ts
// PLACEHOLDER - Custom Trading Card Game Logic

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { Request, Response } from 'express';

// Import core models
import { GameEnvironment } from '../models/GameEnvironment';
import { GamePhase, ZoneType, PlayerActionType, EventType } from '../models/GameEnums';
import { EventFactory, GameEvent, EventStatus, EventPriority } from './EventQueue/index';
import { BurstEffectChoiceEvent, TargetChoiceEvent } from './EventQueue/interfaces/GameEvent';
import { PlayerAction } from '../models/EventInterfaces';
import { StaticEventProcessor } from './StaticEventProcessor';

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
        console.log("action ",JSON.stringify(action))
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
                
            case PlayerActionType.PLAY_CARD:
                if (!action.gameId || !action.carduid) {
                    console.warn('⚠️ PLAY_CARD action missing required identifiers', action);
                    return null;
                }

                return EventFactory.createPlayCardEvent(
                    action.playerId,
                    action.gameId,
                    action.carduid,
                    action.playAs || 'unit',
                    action.targetUnit,
                    {
                        fromBurst: action.fromBurst,
                        cardId: action.cardId,
                        slotName: action.slotName
                    }
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
                        ...action // Spread all action data including playerId, gameId, actionType and other parameters
                    }
                };
                
            default:
                console.warn(`⚠️ Unknown action type: ${action.type}`);
                return null;
        }
    }
    
    /**
     * Process action through event queue - create event then use direct GameEnvironment processing
     */
    async processAction(gameEnv: GameEnvironment, action: PlayerAction): Promise<any> {
        // Create event in GameLogic
        const event = this.createEventFromAction(action);
        console.log("event structure 1111", JSON.stringify(event))
        if (event) {
            // Add event to GameEnvironment queue
            gameEnv.enqueueForProcessing(event);
            
            // Process events using direct GameEnvironment method
            const result = gameEnv.processEvents();
            
            // Check if there were validation errors
            if (!result.success) {
                return { success: false, error: result.error || 'Event validation failed' };
            }
            
            return result;
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
            
            const actionResult = await this.processAction(gameEnv, playCardEvent);
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
        try {
            console.log(`🎯 Processing target choice confirmation: ${eventId} by player ${playerId}`);
            console.log(`Selected targets:`, selectedTargets);
            
            // Load game environment
            const gameEnv = await this.loadGameFromFile(gameId);
            if (!gameEnv) {
                return {
                    success: false,
                    error: 'Game not found'
                };
            }

            // Find the target choice event
            const event = gameEnv.processingQueue.find(e => e.id === eventId) as TargetChoiceEvent | undefined;
            if (!event) {
                return {
                    success: false,
                    error: 'Target choice event not found'
                };
            }

            if (event.type !== EventType.TARGET_CHOICE) {
                return {
                    success: false,
                    error: 'Event is not a target choice'
                };
            }

            // Validate that all selected targets are in the available targets
            const availableTargets = event.data.availableTargets || [];
            for (const selectedTarget of selectedTargets) {
                const isValidTarget = availableTargets.some((target: any) => 
                    target.carduid === selectedTarget.carduid && 
                    target.zone === selectedTarget.zone && 
                    target.playerId === selectedTarget.playerId
                );
                if (!isValidTarget) {
                    return {
                        success: false,
                        error: `Selected target ${selectedTarget.carduid} in ${selectedTarget.zone} is not in available targets list`
                    };
                }
            }

            // Update event with user selection
            event.data.selectedTargets = selectedTargets;
            event.data.userDecisionMade = true;
            
            console.log(`🎯 Event ${eventId} updated with ${selectedTargets.length} selected target(s):`, 
                       selectedTargets.map(t => `${t.carduid} in ${t.zone}`));
            
            const processingResult = await gameEnv.processEvents();
            if (!processingResult.success) {
                return {
                    success: false,
                    error: processingResult.error || 'Failed to process target choice'
                };
            }

            // Save game state
            await this.saveGameToFile(gameId, gameEnv);
            
            console.log(`✅ Target choice confirmed and processed successfully (${selectedTargets.length} target${selectedTargets.length > 1 ? 's' : ''})`);
            
            return {
                success: true,
                gameId: gameId,
                gameEnv: gameEnv
            };
            
        } catch (error) {
            console.error('❌ Error in confirmTargetChoice:', error);
            return {
                success: false,
                error: `Failed to confirm target choice: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}

// ============ EXPORT SINGLETON ============

// Create singleton instance for your custom trading card game
export const gameLogic = new GameLogic();
export default gameLogic;
