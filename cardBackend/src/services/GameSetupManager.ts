// src/services/GameSetupManager.ts
// Handles game creation, joining, redraw confirmations, and gameplay start setup

import * as fs from 'fs';
import * as path from 'path';
import { GameEnvironment } from '../models/GameEnvironment';
import { GamePhase } from '../models/GameEnums';
import {
    ConfirmRedrawEvent,
    GameplayBeginsEvent,
    JoinGameEvent,
    StartGameEvent
} from './EventQueue/interfaces/GameEvent';
import { ExecutionResult } from './ExecutionResult';
import { PlayerCardManager } from './PlayerCardManager';
import { EnergyManager } from './EnergyManager';
import { ShieldCardManager } from './ShieldCardManager';
import { BaseCardManager } from './BaseCardManager';
import { GameNotificationManager } from './GameNotificationManager';

export class GameSetupManager {
    static handleCreateGame(event: StartGameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Processing CREATE_GAME event for player: ${event.data.playerId}`);

        try {
            gameEnv.playerId_1 = event.data.playerId;
            gameEnv.phase = GamePhase.WAITING_FOR_PLAYERS;
            gameEnv.gameStarted = false;
            gameEnv.playersReady = gameEnv.playersReady || {};
            gameEnv.playersReady[event.data.playerId] = true;

            console.log(`✅ CREATE_GAME event processed - game state initialized for ${event.data.playerId}`);
            return { success: true };
        } catch (error) {
            console.error(`❌ Error in handleCreateGame:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'CREATE_GAME execution failed'
            };
        }
    }

    static handleJoinGame(event: JoinGameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Processing JOIN_GAME event for player: ${event.data.playerId}`);

        try {
            gameEnv.playerId_2 = event.data.playerId;
            gameEnv.phase = GamePhase.REDRAW_PHASE;
            gameEnv.gameStarted = true;
            gameEnv.playersReady[event.data.playerId] = true;

            this.initializeGameWithDecks(gameEnv, event.data.playerId);

            console.log(`✅ JOIN_GAME event processed - second player ${event.data.playerId} added`);
            return { success: true };
        } catch (error) {
            console.error(`❌ Error in handleJoinGame:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'JOIN_GAME execution failed'
            };
        }
    }

    static handleConfirmRedraw(event: ConfirmRedrawEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Processing CONFIRM_REDRAW event for player: ${event.data.playerId}, isRedraw: ${event.data.isRedraw}`);

        try {
            gameEnv.playersReady = gameEnv.playersReady || {};

            if (event.data.isRedraw) {
                console.log(`🔄 Processing redraw for player ${event.data.playerId}`);

                const player = gameEnv.players[event.data.playerId];
                if (player?.deck) {
                    const currentHand = [...player.deck._handUids];
                    player.deck.mainDeck.push(...currentHand);
                    player.deck._handUids = [];

                    console.log(`📤 Returned ${currentHand.length} cards to deck`);

                    player.deck.mainDeck = this.shuffleDeck(player.deck.mainDeck);
                    PlayerCardManager.drawCards(player.deck, 5);

                    console.log(`🔀 Shuffled deck and drew new hand of ${player.deck._handUids.length} cards`);
                }
            }

            gameEnv.playersReady[event.data.playerId] = true;

            const player = gameEnv.players[event.data.playerId];
            if (player) {
                player.isRedraw = event.data.isRedraw;
                player.confirmIsRedraw = true;
                console.log(`✅ Player ${event.data.playerId} confirmed redraw choice: ${event.data.isRedraw}`);
            }

            console.log(`✅ CONFIRM_REDRAW event processed - player ${event.data.playerId} marked as ready`);
            return { success: true };
        } catch (error) {
            console.error(`❌ Error in handleConfirmRedraw:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'CONFIRM_REDRAW execution failed'
            };
        }
    }

    static handleGameplayBegins(event: GameplayBeginsEvent, gameEnv: GameEnvironment): ExecutionResult {
        const { description } = event.data;
        console.log(`🎯 Processing GAME_START state-based action: ${description}`);

        try {
            const firstPlayerId = gameEnv.firstPlayer === 0 ? gameEnv.playerId_1! : gameEnv.playerId_2!;
            const secondPlayerId = gameEnv.firstPlayer === 0 ? gameEnv.playerId_2! : gameEnv.playerId_1!;

            EnergyManager.addExtraEnergy(gameEnv, secondPlayerId);
            EnergyManager.addBasicEnergy(gameEnv, firstPlayerId);

            ShieldCardManager.createShieldCardsFromDeck(gameEnv, firstPlayerId);
            ShieldCardManager.createShieldCardsFromDeck(gameEnv, secondPlayerId);

            BaseCardManager.createBaseCardsFromDeck(gameEnv, firstPlayerId);
            BaseCardManager.createBaseCardsFromDeck(gameEnv, secondPlayerId);

            gameEnv.currentPlayer = firstPlayerId;
            gameEnv.phase = GamePhase.DRAW_PHASE;
            console.log(`📋 Advanced to DRAW_PHASE for first player turn`);

            const firstPlayer = gameEnv.players[firstPlayerId];
            if (firstPlayer?.deck) {
                PlayerCardManager.drawCards(firstPlayer.deck, 1);
                console.log(`🃏 Drew 1 card for first player ${firstPlayerId}`);
            }

            // Placeholder notification support (kept for parity with original implementation)
            new GameNotificationManager(gameEnv);

            console.log(`✅ GAMEPLAY_BEGINS event processed - resources allocated, first player set, card drawn`);
            return { success: true };
        } catch (error) {
            console.error(`❌ Error in handleGameplayBegins:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'GAMEPLAY_BEGINS execution failed'
            };
        }
    }

    private static initializeGameWithDecks(gameEnv: GameEnvironment, joinedPlayerId: string): void {
        console.log('🎮 Initializing game with deck configuration...');

        const deckConfigPath = path.join(__dirname, '../data/gcgdecks.json');
        const deckConfig = JSON.parse(fs.readFileSync(deckConfigPath, 'utf8'));

        const playerId1 = gameEnv.playerId_1!;
        const playerId2 = gameEnv.playerId_2!;

        const deck1Config = deckConfig.playerDecks[playerId1] || deckConfig.playerDecks['playerId_1'];
        const deck2Config = deckConfig.playerDecks[playerId2] || deckConfig.playerDecks['playerId_2'];

        const deck1Cards = deckConfig.decks[deck1Config.activeDeck].cards;
        const deck2Cards = deckConfig.decks[deck2Config.activeDeck].cards;

        const uniqueDeck1Cards = deck1Cards.map((cardId: string) => PlayerCardManager.createUniqueCardId(cardId));
        const uniqueDeck2Cards = deck2Cards.map((cardId: string) => PlayerCardManager.createUniqueCardId(cardId));

        const shuffledDeck1 = this.shuffleDeck([...uniqueDeck1Cards]);
        const shuffledDeck2 = this.shuffleDeck([...uniqueDeck2Cards]);

        console.log(`🎲 Generated ${uniqueDeck1Cards.length} unique cards for player 1`);
        console.log(`🎲 Generated ${uniqueDeck2Cards.length} unique cards for player 2`);

        const firstPlayer = 0;
        gameEnv.firstPlayer = firstPlayer;
        gameEnv.currentPlayer = firstPlayer === 0 ? playerId1 : playerId2;

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

        PlayerCardManager.drawCards(gameEnv.players[playerId1].deck, 5);
        PlayerCardManager.drawCards(gameEnv.players[playerId2].deck, 5);

        console.log(`🎯 Game initialized: First player is ${gameEnv.currentPlayer}, hands drawn, redraw available`);
    }

    private static shuffleDeck(cards: string[]): string[] {
        const shuffled = [...cards];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}
