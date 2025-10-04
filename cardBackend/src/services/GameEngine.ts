// src/services/GameEngine.ts
// Game execution engine - handles all game state modifications

import { GameEvent, AcknowledgeEventsEvent, PlayCardEvent, PlayCardEventData, 
    EventFactory, EventStatus,
     EventPriority, DeployEffectEvent,DeployEffectEventData, TargetChoiceEvent, PairingEffectEvent,
     ConfirmRedrawEvent, GameplayBeginsEvent, ErrorOccurredEvent, BurstEffectChoiceEvent, ShieldCardAttackedEvent,
     StartGameEvent, JoinGameEvent, NextPlayerTurnEvent, EndTurnEvent, PlayerActionEvent, RepairEffectEvent, BlockerChoiceEvent } from './EventQueue/interfaces/GameEvent';
import { GameEnvironment } from '../models/GameEnvironment';
import { GamePhase, EventType } from '../models/GameEnums';
import { EnergyManager } from './EnergyManager';
import { ShieldCardManager } from './ShieldCardManager';
import { BaseCardManager } from './BaseCardManager';
import { GameNotificationManager } from './GameNotificationManager';
import { PlayerCardManager } from './PlayerCardManager';
import { DeployEffectManager } from './DeployEffectManager';
import { PairingEffectManager } from './PairingEffectManager';
import { DeployTargetManager } from './DeployTargetManager';
import { PhaseTransitionManager } from './effects/PhaseTransitionManager';
import { UnitZoneCard, PilotZoneCard, CardDatabaseManager } from '../models/CardSystem';
import { ContinuousEffectManager } from './ContinuousEffectManager';
import { RepairEffectManager } from './effects/RepairEffectManager';
import { BlockerEffectManager } from './effects/BlockerEffectManager';
import { BlockerChoiceManager, BlockerChoiceResult } from './BlockerChoiceManager';
import * as fs from 'fs';
import * as path from 'path';
import { getCardIdFromUid } from '../utils/CardUtils';
import { PlayCardPreparationManager, PlayCardPreparationSuccess } from './PlayCardPreparationManager';
import { GameActionValidator } from './GameActionValidator';
import { AttackPreparationManager } from './AttackPreparationManager';
import { BurstEffectManager } from './BurstEffectManager';
import { ExecutionResult } from './ExecutionResult';
import { AttackPhaseEffectManager } from './effects/AttackPhaseEffectManager';
import { MainPhaseAbilityManager } from './effects/MainPhaseAbilityManager';
import { BattlePhaseManager } from './BattlePhaseManager';

export class GameEngine {
    // ============ MAIN EXECUTION INTERFACE ============

    /**
     * Get or create notification manager for this game (static version)
     */
    private static getNotificationManager(gameEnv: GameEnvironment): GameNotificationManager {
        return new GameNotificationManager(gameEnv);
    }

    static execute(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🔥 Executing event: ${event.type}`);

        try {
            switch (event.type) {
                case EventType.CREATE_GAME:
                    return GameEngine.executeStartGame(event as StartGameEvent, gameEnv);

                case EventType.JOIN_GAME:
                    return GameEngine.executeJoinGame(event as JoinGameEvent, gameEnv);

                case EventType.CONFIRM_REDRAW:
                    return GameEngine.executeStartReady(event as ConfirmRedrawEvent, gameEnv);

                case EventType.GAMEPLAY_BEGINS:
                    return GameEngine.executeGameStart(event as GameplayBeginsEvent, gameEnv);

                case EventType.ERROR_OCCURRED:
                    return GameEngine.executeErrorEvent(event as ErrorOccurredEvent, gameEnv);

                case EventType.ACKNOWLEDGE_EVENTS:
                    return GameEngine.executeAcknowledgeEvents(event as AcknowledgeEventsEvent, gameEnv);

                case EventType.PHASE_ADVANCE:
                    return PhaseTransitionManager.executePhaseAdvance(event, gameEnv);

                case EventType.END_TURN:
                    return GameEngine.executeEndTurn(event as EndTurnEvent, gameEnv);

                case EventType.NEXT_PLAYER_TURN:
                    return GameEngine.executeNextPlayerTurn(event as NextPlayerTurnEvent, gameEnv);

                case EventType.PLAY_CARD:
                    return GameEngine.executePlayCard(event as PlayCardEvent, gameEnv);

                case EventType.PLAYER_ACTION:
                    return GameEngine.executePlayerAction(event as PlayerActionEvent, gameEnv);

                case EventType.SHIELD_CARD_ATTACKED:
                    return BurstEffectManager.processShieldCardAttack(event as ShieldCardAttackedEvent, gameEnv);

                case EventType.BURST_EFFECT_CHOICE:
                    return BurstEffectManager.processBurstEffectChoice(event as BurstEffectChoiceEvent, gameEnv);

                case EventType.DEPLOY_EFFECT_TRIGGERED:
                    return DeployEffectManager.executeDeployEffect(event as DeployEffectEvent, gameEnv);

                case EventType.TARGET_CHOICE:
                    return DeployTargetManager.executeTargetChoice(event as TargetChoiceEvent, gameEnv);

                case EventType.BLOCKER_CHOICE:
                    return BlockerChoiceManager.executeBlockerChoice(event as BlockerChoiceEvent, gameEnv);

                case EventType.PAIRING_EFFECT_TRIGGERED:
                    return GameEngine.executePairingEffect(event as PairingEffectEvent, gameEnv);

                case EventType.TRIGGER_HEALING:
                    return GameEngine.executeHealingEffect(event as RepairEffectEvent, gameEnv);

                default:
                    console.log(`🎯 Processing ${event.type} event - delegating to existing game logic`);
                    return { success: true };
            }
        } catch (error) {
            console.error(`❌ Error executing event ${event.type}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown execution error'
            };
        }
    }

    // ============ EVENT-SPECIFIC EXECUTION METHODS ============

    private static executeStartGame(event: StartGameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Processing CREATE_GAME event for player: ${event.data.playerId}`);

        try {
            // Initialize basic game state
            gameEnv.playerId_1 = event.data.playerId;
            gameEnv.phase = GamePhase.WAITING_FOR_PLAYERS;
            gameEnv.gameStarted = false;
            gameEnv.playersReady = gameEnv.playersReady || {};
            gameEnv.playersReady[event.data.playerId] = true;

            console.log(`✅ CREATE_GAME event processed - game state initialized for ${event.data.playerId}`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error in executeStartGame:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'CREATE_GAME execution failed'
            };
        }
    }

    private static executeJoinGame(event: JoinGameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Processing JOIN_GAME event for player: ${event.data.playerId}`);

        try {
            // Add second player and update phase
            gameEnv.playerId_2 = event.data.playerId;
            gameEnv.phase = GamePhase.REDRAW_PHASE;
            gameEnv.gameStarted = true;
            gameEnv.playersReady[event.data.playerId] = true;

            // Load deck configuration and set up game
            GameEngine.initializeGameWithDecks(gameEnv, event.data.playerId);

            console.log(`✅ JOIN_GAME event processed - second player ${event.data.playerId} added`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error in executeJoinGame:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'JOIN_GAME execution failed'
            };
        }
    }

    private static executeStartReady(event: ConfirmRedrawEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Processing CONFIRM_REDRAW event for player: ${event.data.playerId}, isRedraw: ${event.data.isRedraw}`);

        try {
            // Initialize playersReady if not exists
            gameEnv.playersReady = gameEnv.playersReady || {};

            // Handle redraw logic
            if (event.data.isRedraw) {
                console.log(`🔄 Processing redraw for player ${event.data.playerId}`);

                const player = gameEnv.players[event.data.playerId];
                if (player?.deck) {
                    // Put current hand back to deck, shuffle, and draw new hand
                    const currentHand = [...player.deck._handUids];
                    player.deck.mainDeck.push(...currentHand);
                    player.deck._handUids = [];
                    
                    console.log(`📤 Returned ${currentHand.length} cards to deck`);
                    
                    player.deck.mainDeck = GameEngine.shuffleDeck(player.deck.mainDeck);
                    PlayerCardManager.drawCards(player.deck, 5);
                    
                    console.log(`🔀 Shuffled deck and drew new hand of ${player.deck._handUids.length} cards`);
                }
            }

            // Mark player as ready and set redraw choice
            gameEnv.playersReady[event.data.playerId] = true;
            
            const player = gameEnv.players[event.data.playerId];
            if (player) {
                player.isRedraw = event.data.isRedraw;
                player.confirmIsRedraw = true;
                console.log(`✅ Player ${event.data.playerId} confirmed redraw choice: ${event.data.isRedraw}`);
            }

            // Notify redraw event if needed
            if (event.data.isRedraw) {
                GameEngine.getNotificationManager(gameEnv).notifyRedrawEvent(event.data.playerId);
            }

            console.log(`✅ CONFIRM_REDRAW event processed - player ${event.data.playerId} marked as ready`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error in executeStartReady:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'CONFIRM_REDRAW execution failed'
            };
        }
    }


    private static executeErrorEvent(event: ErrorOccurredEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`💥 Processing error: ${event.data.errorType} - ${event.data.errorReason}`);

        try {
            GameEngine.getNotificationManager(gameEnv).notifyError(
                event.data.errorType, 
                event.data.errorReason, 
                event.data.playerId, 
                event.data.originalEventType
            );

            console.log(`📨 Error event added: ${event.data.errorReason}`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error in executeErrorEvent:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'ERROR_OCCURRED execution failed'
            };
        }
    }

    private static executeAcknowledgeEvents(event: AcknowledgeEventsEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Processing ACKNOWLEDGE_EVENTS for ${event.data.eventIds.length} events`);

        try {
            const acknowledgedCount = GameEngine.getNotificationManager(gameEnv)
                .acknowledgeEvents(event.data.eventIds);

            event.data.acknowledgedCount = acknowledgedCount;
            console.log(`✅ ACKNOWLEDGE_EVENTS processed - ${acknowledgedCount} events acknowledged`);
            return { success: true, acknowledgedCount };

        } catch (error) {
            console.error(`❌ Error in executeAcknowledgeEvents:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'ACKNOWLEDGE_EVENTS execution failed'
            };
        }
    }

    // ============ GAME SETUP HELPERS ============

    private static initializeGameWithDecks(gameEnv: GameEnvironment, joinedPlayerId: string): void {
        try {
            console.log('🎮 Initializing game with deck configuration...');

            // Load deck configuration
            const deckConfigPath = path.join(__dirname, '../data/gcgdecks.json');
            const deckConfig = JSON.parse(fs.readFileSync(deckConfigPath, 'utf8'));

            // Card data is now available via CardDatabaseManager
            // No need to reload - already loaded in CardSystem

            // Get player IDs
            const playerId1 = gameEnv.playerId_1!;
            const playerId2 = gameEnv.playerId_2!;

            // Assign decks to players
            const deck1Config = deckConfig.playerDecks[playerId1] || deckConfig.playerDecks['playerId_1'];
            const deck2Config = deckConfig.playerDecks[playerId2] || deckConfig.playerDecks['playerId_2'];

            const deck1Cards = deckConfig.decks[deck1Config.activeDeck].cards;
            const deck2Cards = deckConfig.decks[deck2Config.activeDeck].cards;

            // Transform card IDs to unique instances with UUIDs
            const uniqueDeck1Cards = deck1Cards.map((cardId: string) => PlayerCardManager.createUniqueCardId(cardId));
            const uniqueDeck2Cards = deck2Cards.map((cardId: string) => PlayerCardManager.createUniqueCardId(cardId));

            // Create and shuffle decks with unique card instances
            const shuffledDeck1 = GameEngine.shuffleDeck([...uniqueDeck1Cards]);
            const shuffledDeck2 = GameEngine.shuffleDeck([...uniqueDeck2Cards]);

            console.log(`🎲 Generated ${uniqueDeck1Cards.length} unique cards for player 1`);
            console.log(`🎲 Generated ${uniqueDeck2Cards.length} unique cards for player 2`);

            // Random first player selection
            //const firstPlayer = Math.floor(Math.random() * 2); // 0 or 1
            const firstPlayer = 0
            gameEnv.firstPlayer = firstPlayer;
            gameEnv.currentPlayer = firstPlayer === 0 ? playerId1 : playerId2;

            // Initialize players with decks using proper PlayerDeck structure
            if (!gameEnv.players[playerId1]) {
                gameEnv.addPlayer(playerId1, 'Player 1');
            }
            const player1 = gameEnv.players[playerId1];
            player1.deck._handUids = [];
            player1.deck.mainDeck = shuffledDeck1;

            if (!gameEnv.players[playerId2]) {
                gameEnv.addPlayer(playerId2, 'Player 2');
            }
            const player2 = gameEnv.players[playerId2];
            player2.deck._handUids = [];
            player2.deck.mainDeck = shuffledDeck2;

            // Draw initial hands (5 cards each)
            PlayerCardManager.drawCards(gameEnv.players[playerId1].deck, 5);
            PlayerCardManager.drawCards(gameEnv.players[playerId2].deck, 5);

            console.log(`🎯 Game initialized: First player is ${gameEnv.currentPlayer}, hands drawn, redraw available`);

        } catch (error) {
            console.error('❌ Error initializing game with decks:', error);
            throw error;
        }
    }

    private static shuffleDeck(cards: string[]): string[] {
        const shuffled = [...cards];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    private static executeGameStart(event: GameplayBeginsEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { actionId, description, affectedPlayers } = event.data;

        console.log(`🎯 Processing GAME_START state-based action: ${description}`);

        try {
            // Determine first and second players based on gameEnv.firstPlayer
            const firstPlayerId = gameEnv.firstPlayer === 0 ? gameEnv.playerId_1! : gameEnv.playerId_2!;
            const secondPlayerId = gameEnv.firstPlayer === 0 ? gameEnv.playerId_2! : gameEnv.playerId_1!;


            // Allocate starting resources using EnergyManager
            EnergyManager.addExtraEnergy(gameEnv, secondPlayerId);
            EnergyManager.addBasicEnergy(gameEnv, firstPlayerId);

            // Create shield cards for both players using ShieldCardManager
            ShieldCardManager.createShieldCardsFromDeck(gameEnv, firstPlayerId);
            ShieldCardManager.createShieldCardsFromDeck(gameEnv, secondPlayerId);

            // Create base cards for both players using BaseCardManager
            BaseCardManager.createBaseCardsFromDeck(gameEnv, firstPlayerId);
            BaseCardManager.createBaseCardsFromDeck(gameEnv, secondPlayerId);

            // Set currentPlayer to firstPlayer
            gameEnv.currentPlayer = firstPlayerId;
            console.log(`🎯 Set current player to first player: ${firstPlayerId}`);

            // Advance to DRAW_PHASE (for firstPlayer)
            gameEnv.phase = GamePhase.DRAW_PHASE;
            console.log(`📋 Advanced to DRAW_PHASE for first player turn`);

            // Draw 1 card from deck to first player hand
            const firstPlayer = gameEnv.players[firstPlayerId];
            if (firstPlayer && firstPlayer.deck) {
                PlayerCardManager.drawCards(firstPlayer.deck, 1);
                console.log(`🃏 Drew 1 card for first player ${firstPlayerId}`);
            }

            // Create game events using GameNotificationManager
            const notificationManager = GameEngine.getNotificationManager(gameEnv);

            // Notify about card drawn (requires acknowledgment)
            const drawnCards = firstPlayer?.deck.handUids.slice(-1) || []; // Get last drawn card UID
            notificationManager.notifyCardDrawn(
                firstPlayerId,
                drawnCards,
                firstPlayer?.deck.getHandSize() || 0
            );

            console.log(`📨 Created GAMEPLAY_BEGINS and CARD_DRAWN events via GameNotificationManager`);

            console.log(`✅ GAMEPLAY_BEGINS event processed - resources allocated, first player set, card drawn, events created`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error in executeGameStart:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'GAMEPLAY_BEGINS execution failed'
            };
        }
    }



    // ============ END TURN SYSTEM ============

    private static executeEndTurn(event: EndTurnEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { playerId, currentTurnNumber } = event.data;
        const fromBurst = event.data.fromBurst || false;

        console.log(`🏁 Processing END_TURN event for player: ${playerId}, turn: ${currentTurnNumber}, fromBurst: ${fromBurst}`);

        try {
            // Check if event.fromBurst - can be empty/undefined (defaults to false)
            if (fromBurst) {
                console.log(`💥 End turn triggered by burst effect - special handling may apply`);
            }

            // Validate it's the player's turn
            if (gameEnv.currentPlayer !== playerId) {
                return {
                    success: false,
                    error: `Not your turn. Current player: ${gameEnv.currentPlayer}`
                };
            }

            // Clean up temporary effects before ending turn
            DeployTargetManager.cleanupExpiredTemporaryEffects(gameEnv, playerId);

            // Simply set phase to END_TURN - let state-based actions handle the transition
            gameEnv.phase = GamePhase.END_PHASE;
            console.log(`🏁 Phase set to END_PHASE - state-based actions will handle next player transition`);

            return { success: true };

        } catch (error) {
            console.error(`❌ Error in executeEndTurn:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'END_TURN execution failed'
            };
        }
    }

    private static executeNextPlayerTurn(event: NextPlayerTurnEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { currentPlayer, nextPlayer, currentTurn } = event.data;
        console.log("current event in nextplayer 111", JSON.stringify(event))
        console.log(`🔄 Processing NEXT_PLAYER_TURN event: ${currentPlayer} → ${nextPlayer}, turn: ${currentTurn} → ${currentTurn + 1}`);

        try {
            // Update game state for next player
            gameEnv.currentPlayer = nextPlayer;
            gameEnv.currentTurn = currentTurn + 1;
            gameEnv.phase = GamePhase.DRAW_PHASE;

            // Reset repair abilities flag for the new player's turn
            const newPlayer = gameEnv.players[nextPlayer];
            if (newPlayer?.zones) {
                newPlayer.zones.repairAbilitiesCheckedThisCycle = false;
                console.log(`🔄 Reset repair abilities flag for new player: ${nextPlayer}`);
            }

            // Repair abilities now managed by RepairEffectManager with turn-based tracking

            // Unrest current player's cards (via EnergyManager)
            const unrestResult = EnergyManager.untapAllEnergy(gameEnv, nextPlayer);

            // Add 1 more energy to current player
            const addEnergyResult = EnergyManager.addBasicEnergy(gameEnv, nextPlayer);

            console.log(`✅ Next player turn: ${currentPlayer} → ${nextPlayer}, turn: ${currentTurn} → ${currentTurn + 1}`);
            console.log(`✅ Energy untapped: ${unrestResult} and energy added: ${addEnergyResult}`);
            // Draw 1 card from deck to first player hand
            const firstPlayer = gameEnv.players[nextPlayer];
            if (firstPlayer && firstPlayer.deck) {
                PlayerCardManager.drawCards(firstPlayer.deck, 1);
                console.log(`🃏 Drew 1 card for first player ${nextPlayer}`);
            }

            // Process continuous effects when turn changes (timing updates)
            console.log(`🔄 Turn changed - processing continuous effects for timing updates`);
            try {
                const result = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
                console.log(`✅ Continuous effects processed: ${result.effectsProcessed} processed, ${result.effectsActivated} activated, ${result.effectsDeactivated} deactivated`);
            } catch (error) {
                console.error(`❌ Error processing continuous effects on turn change:`, error);
            }

            // Create game events using GameNotificationManager
            const notificationManager = GameEngine.getNotificationManager(gameEnv);

            // Notify about card drawn (requires acknowledgment)
            const drawnCards = firstPlayer?.deck.handUids.slice(-1) || []; // Get last drawn card UID
            notificationManager.notifyCardDrawn(
                nextPlayer,
                drawnCards,
                firstPlayer?.deck.getHandSize() || 0
            );
            return { success: true };

        } catch (error) {
            console.error(`❌ Error in executeNextPlayerTurn:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'NEXT_PLAYER_TURN execution failed'
            };
        }
    }


    /**
     * Execute PLAY_CARD event - handles card placement with validation and effects
     * 
     * Sample PLAY_CARD event scheme (from GameLogic.ts):
     * {
     *   "id": "play_card_1234567890_0.123456",
     *   "type": "PLAY_CARD",
     *   "status": "DECLARED",
     *   "priority": 1,
     *   "timestamp": 1234567890,
     *   "playerId": "playerId_1",
     *   "data": {
     *     "playerId": "playerId_1",
     *     "gameId": "game_abc123",
     *     "carduid": "ST01-001_a5fcfa44-d212-4400-8c12-9a58fdbcac84",
     *     "playAs": "unit",
     *     "targetUnit": "??"
     *   }
     * }
     * 
     * Additional burst deploy event data includes:
     * - fromBurst: true (indicates burst deployment)
     * - slotName: target slot for deployment
     */
    private static executePlayCard(event: PlayCardEvent, gameEnv: GameEnvironment): ExecutionResult {
        const playerId = event.playerId;
        const eventData: PlayCardEventData = event.data;
        const fromBurst = eventData.fromBurst || false;

        if (!playerId) {
            return {
                success: false,
                error: 'No playerId found in event'
            };
        }

        console.log(`🎯 Processing PLAY_CARD event for player: ${playerId}, carduid: ${eventData.carduid}, playAs: ${eventData.playAs}, fromBurst: ${fromBurst}, targetUnit: ${eventData.targetUnit || 'none'}`);

        try {
            const preparationResult = PlayCardPreparationManager.prepare(gameEnv, playerId, eventData, fromBurst);
            if (!preparationResult.success) {
                return {
                    success: false,
                    error: preparationResult.error
                };
            }

            const {
                tappedEnergy,
                rollback
            } = preparationResult as PlayCardPreparationSuccess;

            const placementResult = PlayerCardManager.placeCardWithEventData(gameEnv, playerId, eventData);

            if (!placementResult.success) {
                rollback();
                return {
                    success: false,
                    error: placementResult.error
                };
            }

            if (tappedEnergy.length > 0) {
                eventData.payEnergyCards = tappedEnergy.map(card => card.carduid);
            }

            // ✅ Card placement successful - Check for Deploy effects (ENTERS_PLAY triggers)
            console.log(`✅ Card ${eventData.carduid} successfully placed for player ${playerId}`);
            // ✅ IMPROVED: Single-step deploy effect processing (consolidated from two-step legacy approach)
            const deployResult = DeployEffectManager.checkAndQueueDeployEffects(eventData,playerId, gameEnv);
            if (!deployResult.success) {
                console.log(`⚠️ Deploy effect processing error: ${deployResult.error}`);
                // Continue with execution - deploy effect failure shouldn't block card placement
            } else if (deployResult.effectsFound > 0) {
                console.log(`✅ Deploy effects processed: ${deployResult.effectsFound} effects queued`);
            }

            // ✅ IMPROVED: Check for Pairing effects and get event directly (consolidated)
            if (placementResult.isOnPair) {
                console.log(`🤝 Pairing detected - checking for pairing effects`);
                const pairingEvent = PairingEffectManager.checkForPairingEffectsEvent(eventData, gameEnv, playerId);
                if (pairingEvent) {
                    gameEnv.processingQueue.push(pairingEvent);
                    console.log(`📋 Pairing event queued: ${pairingEvent.id}`);
                }
            }

            // Handle link formation - set linked unit's isFirstPlay to false
            if (placementResult.isOnLink) {
                console.log(`🔗 Link detected - updating linked unit's isFirstPlay status`);
                PlayerCardManager.handleLinkFormation(gameEnv, playerId, eventData.carduid);
            }


            // Process continuous effects after card placement (always)
            console.log(`🔄 Processing continuous effects after card placement${placementResult.isOnPair ? ` (${placementResult.isOnLink ? 'Link' : 'Pair'} created)` : ''}`);
            try {
                const result = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
                console.log(`✅ Continuous effects processed: ${result.effectsProcessed} processed, ${result.effectsActivated} activated, ${result.effectsDeactivated} deactivated`);
            } catch (error) {
                console.error(`❌ Error processing continuous effects after card placement:`, error);
            }

            return { success: true };

        } catch (error) {
            console.error(`❌ Error in executePlayCard:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'PLAY_CARD execution failed'
            };
        }
    }



    private static checkAndExecuteBlockerAction(event: PlayerActionEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🛡️ Checking for blocker opportunities: ${event.playerId} → ${gameEnv.getOpponentId(event.playerId)}`);
        const attackingPlayerId = event.playerId;
        const eventData = event.data || {};
        const defendingPlayerId = gameEnv.getOpponentId(attackingPlayerId);

        if (!defendingPlayerId) {
            console.error(`❌ No opponent found for attacking player ${attackingPlayerId}`);
            return { success: false, error: 'No opponent found' };
        }

        const attackEffectResult = AttackPhaseEffectManager.processAttackPhaseEffects(gameEnv, event);

        if (!attackEffectResult.success) {
            return {
                success: false,
                error: attackEffectResult.error
            };
        }

        // Use BlockerChoiceManager following DeployTargetManager pattern
        const blockerResult: BlockerChoiceResult = BlockerChoiceManager.processAttackWithBlockerChoice(
            gameEnv, 
            event, 
            defendingPlayerId
        );

        if (!blockerResult.success) {
            return { success: false, error: blockerResult.error };
        }

        if (blockerResult.requiresSelection) {
            return { success: true, requiresSelection: true };
        } else if (blockerResult.autoBlocked) {
            return { success: true }; // Attack redirected automatically
        } else if (blockerResult.normalAttack) {
            // No blockers available, execute normal attack
            return this.executeNormalAttackFlow(event, gameEnv);
        }

        return { success: false, error: 'Unexpected blocker result state' };
    }

    /**
     * Execute normal attack flow when no blockers interfere
     */
    private static executeNormalAttackFlow(event: PlayerActionEvent, gameEnv: GameEnvironment): ExecutionResult {
        return BattlePhaseManager.startBattle(gameEnv, event);
    }

    private static executePlayerAction(event: PlayerActionEvent, gameEnv: GameEnvironment): ExecutionResult {
        const eventData = event.data;
        const fromBurst = eventData.fromBurst || false;

        console.log(`🗡️ Processing PLAYER_ACTION event for player: ${eventData.playerId}, actionType: ${eventData.actionType}, fromBurst: ${fromBurst}`);

        try {
            switch (eventData.actionType) {
                case 'attackUnit':
                case 'attackShieldArea': {
                    const turnCheck = GameActionValidator.ensureTurn(gameEnv, eventData.playerId, fromBurst);
                    if (!turnCheck.success) {
                        return {
                            success: false,
                            error: turnCheck.error
                        };
                    }

                    return GameEngine.checkAndExecuteBlockerAction(event, gameEnv);
                }

                case 'useCommandCard':
                    return MainPhaseAbilityManager.executeMainPhaseAbility(gameEnv, event);

                case 'resolveBattle':
                    return BattlePhaseManager.resolveBattle(gameEnv, event.playerId);

                default:
                    return {
                        success: false,
                        error: `Unknown actionType: ${eventData.actionType}`
                    };
            }

        } catch (error) {
            console.error(`❌ Error in executePlayerAction:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'PLAYER_ACTION execution failed'
            };
        }
    }


    /*
    sample request
    {
        "type": "PLAYER_ACTION",
        "playerId": "playerId_2",
        "actionType": "attackUnit",
        "attackerCarduid": "ST01-001_a5fcfa44-d212-4400-8c12-9a58fdbcac84",
        "targetUnitUid": "ST01-005_be13f9a5-9fc9-4e3b-a9b2-fdf999d9f63d",
        "targetPlayerId": "playerId_1",
        "targetPilotUid": "ST01-013_20d620d9-242e-4aa8-b1b6-6847dff89461"
    }
    */
    private static executeShieldCardAttacked(event: ShieldCardAttackedEvent, gameEnv: GameEnvironment): ExecutionResult {
        return BurstEffectManager.processShieldCardAttack(event, gameEnv);
    }

    private static executeBurstEffectChoice(event: BurstEffectChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        return BurstEffectManager.processBurstEffectChoice(event, gameEnv);
    }

    /**
     * Execute Pairing effect triggered by unit+pilot pairing
     */
    private static executePairingEffect(event: PairingEffectEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🤝 Executing PAIRING_EFFECT_TRIGGERED event: ${event.id}`);

        try {
            // Use PairingEffectManager to process the pairing effects
            const result = PairingEffectManager.processPairingEffect(gameEnv, event.playerId, event.data);

            if (!result.success) {
                console.log(`❌ Pairing effect processing failed: ${result.error}`);
                return {
                    success: false,
                    error: result.error
                };
            }

            console.log(`✅ Pairing effects processed successfully: ${result.message}`);
            return {
                success: true
            };

        } catch (error) {
            console.error(`❌ Error in executePairingEffect:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Pairing effect execution failed'
            };
        }
    }


    /**
     * Execute healing effects directly using RepairEffectManager
     */
    public static executeHealingEffect(event: RepairEffectEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🩹 Executing healing effect: ${event.id}`);
        
        // Call RepairEffectManager directly with properly typed event
        return RepairEffectManager.executeRepairEffect(event, gameEnv);
    }

    /**
     * Find burst effects on a card that should trigger on BURST_CONDITION
     * @param cardData - The card data to search for burst effects
     * @returns Array of burst effects with BURST_CONDITION trigger
     */
    /**
     * Create a human-readable description of a burst effect
     * @param effect - The effect definition
     * @param cardData - The card data
     * @returns Human-readable description string
     */
    /**
     * Execute burst effect for confirmed choice
     * @param gameEnv - Current game environment
     * @param playerId - Player who owns the burst card
     * @param carduid - Unique ID of the burst card
     * @param cardId - Card ID for reference
     * @param cardData - Full card data
     * @param burstEffect - Burst effect configuration
     */





    /**
     * Handle unit damage, HP updates, and destruction logic
     * @param gameEnv - Game environment
     * @param playerId - Player who owns the unit
     * @param slotName - The slot containing the unit
     * @param unit - The unit to process
     * @param unitLabel - Label for logging (e.g., 'Attacker', 'Defender')
     * @param unitRemainingHP - The unit's remaining HP after damage
     * @param incomingDamage - The damage being dealt to this unit's pilot
     * @returns boolean - true if unit was destroyed, false if it survived
     */
    private static handleUnitDamageAndDestruction(
        gameEnv: GameEnvironment,
        playerId: string,
        slotName: string,
        unit: UnitZoneCard,
        unitLabel: string,
        unitRemainingHP: number,
        incomingDamage: number
    ): boolean {
        const player = gameEnv.getPlayer(playerId);
        if (!player) {
            console.error(`❌ Could not find player ${playerId}`);
            return false;
        }

        if (unitRemainingHP <= 0) {
            // Unit is destroyed
            console.log(`💀 ${unitLabel} destroyed! Moving to trash...`);
            PlayerCardManager.moveCardToTrashFromSlot(gameEnv, playerId, slotName, unit, 'unit');

            // Also move pilot to trash if present
            const pilot = (player.zones as any)[slotName]?.pilot;
            if (pilot) {
                PlayerCardManager.moveCardToTrashFromSlot(gameEnv, playerId, slotName, pilot, 'pilot');
            }

            return true; // Unit destroyed
        } else {
            PlayerCardManager.updateUnitDamage(unit,incomingDamage);
            return false; // Unit survived
        }
    }




}
