// src/controllers/gameController.ts
// PLACEHOLDER - Custom Trading Card Game Controller

import { Request, Response } from 'express';
import { gameLogic, GameLogic } from '../services/GameLogic';
import { PlayerActionType, CardPlayType } from '../models/GameEnums';
import type { GameEnvironment } from '../models/GameEnvironment';
import { PlayerAction } from '../models/EventInterfaces';
import { lobbyManager } from '../services/LobbyManager';
import { GCG_DECKS_PATH, resolveDataPath } from '../config/dataPaths';
import { listAvailableCardSets, parseSetId, getCardSetFileName, resolveCardSetPath } from '../services/cards/CardSetService';
import { CardDatabaseManager } from '../models/CardSystem';
import * as fs from 'fs';
import * as path from 'path';
import { json } from 'stream/consumers';
import { signResourceBundleToken, verifyResourceBundleToken } from '../utils/ResourceBundleToken';
import crypto from 'crypto';
import { GameEnvViewBuilder } from '../services/views/GameEnvViewBuilder';
import { AiAutoplayCoordinator } from '../services/ai/AiAutoplayCoordinator';
import { GameAiService } from '../services/ai/GameAiService';
import { sessionManager } from '../services/SessionManager';
import { SessionAuthedRequest } from '../middleware/sessionAuth';
import { v4 as uuidv4 } from 'uuid';
import { deckSubmissionService } from '../services/DeckSubmissionService';
import { deckResourceService } from '../services/DeckResourceService';
import { collectTokenCardIdsFromCardData } from '../services/cards/TokenCardDiscovery';
import { loadTopDecksFromFile } from '../services/TopDeckService';
import { ErrorCodes } from '../constants/ErrorCodes';
import { mapJoinFailure, mapJoinTokenFailureReason } from '../services/session/JoinRoomErrorMapper';
import {
    buildTestSessions,
    normalizePlayerSeatSelector,
    resolvePlayerIdForSelector
} from '../services/SeatSessionService';

// ============ TYPE DEFINITIONS ============

export interface GameRequest extends Request {
    body: {
        playerId?: string;
        playerName?: string;
        gameId?: string;
        joinToken?: string;
        ai?: boolean | string;
        aimode?: boolean | string;
        aiPlayerId?: string;
        action?: any;
        [key: string]: any;
    };
}

export interface ErrorResponse {
    error: string;
    stack?: string;
    timestamp: string;
    context?: string;
}

// ============ CUSTOM TRADING CARD GAME CONTROLLER ============

export class GameController {
    private gameLogic: GameLogic;
    private static resourceBundleSecret: string | null = null;
    private readonly aiCoordinator: AiAutoplayCoordinator;

    constructor() {
        this.gameLogic = gameLogic;
        this.aiCoordinator = new AiAutoplayCoordinator(this.gameLogic);
        console.log('🎮 Custom Trading Card Game Controller initialized');
    }

    private static createPlayerId(): string {
        return `player_${uuidv4()}`;
    }

    private async applyAiAutoplayOrRespond(
        res: Response,
        gameId: string,
        playerId: string,
        gameEnv: GameEnvironment,
        context: string
    ): Promise<GameEnvironment | null> {
        const autoResult = await this.aiCoordinator.maybeRunAiAfterHuman(gameId, playerId, gameEnv);
        if (!autoResult.success || !autoResult.gameEnv) {
            res.status(400).json({
                error: autoResult.error || 'AI autoplay failed',
                timestamp: new Date().toISOString(),
                context
            });
            return null;
        }
        return autoResult.gameEnv;
    }

    private static getResourceBundleSecret(): string {
        const envSecret = (process.env.RESOURCE_BUNDLE_SECRET || '').trim();
        if (envSecret) {
            GameController.resourceBundleSecret = envSecret;
            return envSecret;
        }
        if (GameController.resourceBundleSecret) {
            return GameController.resourceBundleSecret;
        }
        // Dev-friendly default: generate an ephemeral secret per process so tokens work without .env.
        // For production, always set RESOURCE_BUNDLE_SECRET to a stable, long random value.
        GameController.resourceBundleSecret = crypto.randomBytes(32).toString('hex');
        return GameController.resourceBundleSecret;
    }

    private static resolvePathCaseInsensitive(rootDir: string, relativePath: string): string | null {
        const segments = relativePath
            .split('/')
            .map((s) => s.trim())
            .filter(Boolean);

        let currentDir = rootDir;
        for (const segment of segments) {
            let entries: string[];
            try {
                entries = fs.readdirSync(currentDir);
            } catch {
                return null;
            }

            const exact = entries.find((e) => e === segment);
            const matched = exact ?? entries.find((e) => e.toLowerCase() === segment.toLowerCase());
            if (!matched) {
                return null;
            }
            currentDir = path.join(currentDir, matched);
        }

        return currentDir;
    }

    private static resolveImageFilePath(
        sanitizedImagePath: string,
        variant: 'full' | 'thumb' = 'full',
    ): string | null {
        const imageRootDir = variant === 'thumb' ? resolveDataPath('image', 'thumb') : resolveDataPath('image');
        if (!fs.existsSync(imageRootDir) || !fs.statSync(imageRootDir).isDirectory()) {
            return null;
        }

        const normalizedPath = sanitizedImagePath.replace(/^\//, '');
        const directPath =
            variant === 'thumb'
                ? resolveDataPath('image', 'thumb', normalizedPath)
                : resolveDataPath('image', normalizedPath);
        if (fs.existsSync(directPath)) {
            return directPath;
        }

        const caseInsensitivePath = GameController.resolvePathCaseInsensitive(imageRootDir, normalizedPath);
        if (caseInsensitivePath && fs.existsSync(caseInsensitivePath)) {
            return caseInsensitivePath;
        }

        return null;
    }

    private static resolveDownloadFilePath(sanitizedFilePath: string): string | null {
        const fileRootDir = resolveDataPath('file');
        if (!fs.existsSync(fileRootDir) || !fs.statSync(fileRootDir).isDirectory()) {
            return null;
        }

        const filePath = path.resolve(fileRootDir, sanitizedFilePath);
        const fileRootResolved = path.resolve(fileRootDir);
        if (!filePath.startsWith(fileRootResolved + path.sep)) {
            return null;
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            return filePath;
        }

        const caseInsensitivePath = GameController.resolvePathCaseInsensitive(fileRootDir, sanitizedFilePath);
        if (caseInsensitivePath && fs.existsSync(caseInsensitivePath) && fs.statSync(caseInsensitivePath).isFile()) {
            return caseInsensitivePath;
        }

        return null;
    }

    private static findNearestPackageRoot(startDir: string): string | null {
        let currentDir = path.resolve(startDir);
        // Walk up until filesystem root
        while (true) {
            const packageJsonPath = path.join(currentDir, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                return currentDir;
            }

            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                return null;
            }
            currentDir = parentDir;
        }
    }

    private static toSetFolderFromCardId(cardId: string): string | null {
        if (typeof cardId !== 'string' || cardId.length === 0) {
            return null;
        }

        const match = cardId.match(/^(ST|GD)(\d{2})-/i);
        if (match) {
            const prefix = match[1].toUpperCase();
            if (prefix === 'ST') {
                return `ST${match[2]}`;
            }
            return `gd${match[2]}`;
        }

        return null;
    }

    private static toCardResourcePath(cardId: string, folderHint?: string): string | null {
        if (typeof cardId !== 'string' || cardId.length === 0) {
            return null;
        }

        // Example: ST03-003 -> st03/ST03-003
        const folder = GameController.toSetFolderFromCardId(cardId);
        if (folder) {
            return `${folder}/${cardId}`;
        }

        // Tokens must follow the set folder of the card that references/created them.
        if (/^T-\d+$/i.test(cardId)) {
            if (typeof folderHint === 'string' && folderHint.length > 0) {
                return `${folderHint}/${cardId}`;
            }
            const inferredFolder = CardDatabaseManager.getSetFolderForCardId(cardId);
            if (inferredFolder) {
                return `${inferredFolder}/${cardId}`;
            }
            return null;
        }

        return null;
    }

    private async buildCombinedDeckResources(gameId: string): Promise<{ resources: string[]; pending: boolean; missingPlayers: string[] }> {
        const gameEnv = await this.gameLogic.loadGameFromFile(gameId);
        if (!gameEnv) {
            const err: any = new Error('Game not found');
            err.statusCode = 404;
            throw err;
        }
        const playerIds = [gameEnv.playerId_1, gameEnv.playerId_2].filter((id): id is string => typeof id === 'string' && id.length > 0);
        const aiPlayerIds = Array.isArray((gameEnv as any).aiPlayerIds) ? (gameEnv as any).aiPlayerIds as string[] : [];
        return deckResourceService.buildCombinedDeckResources({
            gameId,
            playerIds,
            aiPlayerIds,
            toCardResourcePath: (cardId, folderHint) => GameController.toCardResourcePath(cardId, folderHint),
        });
    }

    private static buildResourcesFromFullGameEnv(gameEnv: any): string[] {
        const allCardIds = GameController.collectCardIdsFromGameEnv(gameEnv);
        const tokenIdsInPlay = GameController.collectTokenUnitCardIdsFromGameEnv(gameEnv);
        for (const tokenId of tokenIdsInPlay) {
            allCardIds.add(tokenId);
        }

        const resources = new Set<string>();
        const tokenIdsFromEffects = new Set<string>();

        for (const cardId of allCardIds) {
            if (/^T-\d+$/i.test(cardId)) {
                continue;
            }
            const resourcePath = GameController.toCardResourcePath(cardId);
            if (resourcePath) {
                resources.add(resourcePath);
            }
            const cardData = CardDatabaseManager.getCardDetails(cardId);
            if (!cardData) {
                continue;
            }
            const discoveredTokenIds = collectTokenCardIdsFromCardData(cardData);
            for (const tokenId of discoveredTokenIds) {
                tokenIdsFromEffects.add(tokenId);
            }
        }

        const tokenCandidates = new Set<string>();
        for (const cardId of allCardIds) {
            if (/^T-\d+$/i.test(cardId)) {
                tokenCandidates.add(cardId.toUpperCase());
            }
        }
        for (const tokenId of tokenIdsFromEffects) {
            tokenCandidates.add(tokenId.toUpperCase());
        }

        const existingResourcePaths = Array.from(resources);
        for (const tokenId of tokenCandidates) {
            const folderHint =
                GameController.findTokenFolderInDeckLists(tokenId, existingResourcePaths) ||
                CardDatabaseManager.getSetFolderForCardId(tokenId) ||
                undefined;
            const resourcePath = GameController.toCardResourcePath(tokenId, folderHint);
            if (resourcePath) {
                resources.add(resourcePath);
            }
        }

        return Array.from(resources);
    }

    private static findTokenFolderInDeckLists(tokenId: string, resourcePaths: string[]): string | null {
        for (const entry of resourcePaths) {
            if (typeof entry !== 'string') {
                continue;
            }
            if (entry.endsWith(`/${tokenId}`)) {
                const folder = entry.split('/')[0];
                return folder || null;
            }
        }
        return null;
    }

    private static collectCardIdsFromGameEnv(gameEnv: any): Set<string> {
        const result = new Set<string>();
        const visited = new Set<any>();
        const isSupportedCardId = (cardId: string): boolean =>
            /^(ST|GD)\d{2}-\d{3}$/i.test(cardId) || /^T-\d+$/i.test(cardId);

        const visit = (value: any): void => {
            if (!value) {
                return;
            }

            if (typeof value === 'string') {
                // Handle carduid strings found in deck lists (e.g., mainDeck/handUids).
                const candidate = value.includes('_') ? value.split('_')[0] : value;
                if (isSupportedCardId(candidate)) {
                    result.add(candidate);
                }
                return;
            }

            if (typeof value !== 'object') {
                return;
            }

            if (visited.has(value)) {
                return;
            }
            visited.add(value);

            // Only treat objects with both carduid and cardId as "cards in the game".
            if (typeof value.carduid === 'string' && typeof value.cardId === 'string') {
                if (isSupportedCardId(value.cardId)) {
                    result.add(value.cardId);
                }
            }

            if (Array.isArray(value)) {
                value.forEach(visit);
                return;
            }

            for (const child of Object.values(value)) {
                visit(child);
            }
        };

        visit(gameEnv);
        return result;
    }

    private static collectTokenUnitCardIdsFromGameEnv(gameEnv: any): Set<string> {
        const result = new Set<string>();
        if (!gameEnv || typeof gameEnv !== 'object') {
            return result;
        }

        const players = gameEnv.players && typeof gameEnv.players === 'object'
            ? Object.values(gameEnv.players)
            : [];

        for (const player of players as any[]) {
            const zones = player?.zones;
            if (!zones || typeof zones !== 'object') {
                continue;
            }

            for (let i = 1; i <= 6; i++) {
                const slot = (zones as any)[`slot${i}`];
                const unit = slot?.unit;
                const cardId = unit?.cardId;
                if (typeof cardId === 'string' && /^T-\d+$/i.test(cardId)) {
                    result.add(cardId);
                }
            }
        }

        return result;
    }


    // ============ CORE GAME ENDPOINTS ============

    /**
     * Start a new custom trading card game
     * POST /api/game/start
     */
    async startGame(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🎮 Starting new custom trading card game');
            
            const playerId = GameController.createPlayerId();
            const aiEnabled = AiAutoplayCoordinator.normalizeAiFlag(req.body.ai) ||
                AiAutoplayCoordinator.normalizeAiFlag(req.body.aimode);
            const requestedAiPlayerId = typeof req.body.aiPlayerId === 'string' && req.body.aiPlayerId.trim().length > 0
                ? req.body.aiPlayerId.trim()
                : null;
            
            const gameState = await this.gameLogic.createGame(playerId);
            
            if (gameState.success && gameState.gameEnv) {
                // TODO: Initialize event queue system for this game
                // gameState.gameEnv.initializeEventProcessor();
                // console.log('🎮 Event queue system initialized for game:', gameState.gameId);
                if (aiEnabled && gameState.gameId) {
                    const aiPlayerId = requestedAiPlayerId || (playerId === 'ai_player_1' ? 'ai_player_2' : 'ai_player_1');
                    const joinState = await this.gameLogic.joinGame(gameState.gameId, aiPlayerId);
                    if (!joinState.success || !joinState.gameEnv) {
                        res.status(400).json({
                            errorCode: ErrorCodes.INTERNAL_ERROR,
                            error: joinState.error || 'Failed to add AI opponent',
                            timestamp: new Date().toISOString(),
                            context: 'startGame endpoint - ai join'
                        });
                        return;
                    }

                    await this.aiCoordinator.saveAiPlayerIds(gameState.gameId, [aiPlayerId]);
                    const autoEnv = await this.applyAiAutoplayOrRespond(
                        res,
                        gameState.gameId,
                        playerId,
                        joinState.gameEnv,
                        'startGame endpoint - ai autoplay'
                    );
                    if (!autoEnv) {
                        return;
                    }

                    const session = sessionManager.createSession(gameState.gameId, playerId);
                    res.json({
                        success: true,
                        gameId: gameState.gameId,
                        playerId,
                        sessionToken: session.token,
                        sessionExpiresAt: session.expiresAt,
                        joinToken: null,
                        gameEnv: GameEnvViewBuilder.toPlayerView(autoEnv, playerId)
                    });
                    return;
                }

            const session = sessionManager.createSession(gameState.gameId as string, playerId);
            const joinTokenRecord = sessionManager.createJoinToken(gameState.gameId as string, 'seat2');
            try {
                await lobbyManager.addRoom(gameState.gameId as string, { joinToken: joinTokenRecord.token });
            } catch (lobbyError) {
                console.error('❌ Failed to add lobby room:', lobbyError);
            }
            res.json({
                success: true,
                gameId: gameState.gameId,
                playerId,
                sessionToken: session.token,
                sessionExpiresAt: session.expiresAt,
                joinToken: joinTokenRecord.token,
                gameEnv: GameEnvViewBuilder.toPlayerView(gameState.gameEnv, playerId)
            });
            } else {
                res.status(400).json({
                    errorCode: ErrorCodes.INTERNAL_ERROR,
                    error: gameState.error || 'Failed to create game',
                    timestamp: new Date().toISOString(),
                    context: 'startGame endpoint'
                });
            }
            
        } catch (error) {
            console.error('❌ Error in startGame:', error);
            res.status(500).json({
                errorCode: ErrorCodes.INTERNAL_ERROR,
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'startGame endpoint'
            });
        }
    }

    /**
     * Join an existing custom trading card game
     * POST /api/game/join
     */
    async joinRoom(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🔍 joinRoom called with body:', req.body);
            
            const { gameId, joinToken } = req.body;
            
            if (!gameId) {
                res.status(400).json({
                    errorCode: ErrorCodes.ROOM_NOT_FOUND,
                    error: 'gameId is required',
                    timestamp: new Date().toISOString(),
                    context: 'joinRoom endpoint'
                });
                return;
            }

            if (!joinToken || typeof joinToken !== 'string' || joinToken.trim().length === 0) {
                res.status(400).json({
                    errorCode: ErrorCodes.JOIN_TOKEN_REQUIRED,
                    error: 'joinToken is required',
                    timestamp: new Date().toISOString(),
                    context: 'joinRoom endpoint'
                });
                return;
            }

            const joinTokenValidation = sessionManager.validateJoinToken(gameId, joinToken.trim());
            if (!joinTokenValidation.ok) {
                res.status(403).json({
                    errorCode: mapJoinTokenFailureReason(joinTokenValidation.reason),
                    error: joinTokenValidation.reason === 'expired' ? 'Join token has expired' : 'Invalid join token',
                    timestamp: new Date().toISOString(),
                    context: 'joinRoom endpoint'
                });
                return;
            }
            if (joinTokenValidation.record.seat !== 'seat2') {
                res.status(403).json({
                    errorCode: ErrorCodes.JOIN_TOKEN_INVALID,
                    error: 'Join token is not valid for this seat',
                    timestamp: new Date().toISOString(),
                    context: 'joinRoom endpoint'
                });
                return;
            }

            const playerId = GameController.createPlayerId();
            
            const gameState = await this.gameLogic.joinGame(gameId, playerId);
            
            if (gameState.success && gameState.gameEnv) {
                // TODO: Initialize event queue when second player joins  
                // if (gameState.gameEnv.playerId_2) {
                //     gameState.gameEnv.initializeEventProcessor();
                //     await this.gameLogic.registerCardTriggersForGame(gameState.gameEnv);
                //     console.log('🎮 Event queue system activated with card triggers for full game:', gameId);
                // }
                const session = sessionManager.createSession(gameId, playerId);
                sessionManager.consumeJoinToken(gameId, joinToken.trim());
                sessionManager.invalidateJoinTokensForGame(gameId);
                res.json({
                    success: true,
                    gameId: gameState.gameId,
                    playerId,
                    sessionToken: session.token,
                    sessionExpiresAt: session.expiresAt,
                    gameEnv: GameEnvViewBuilder.toPlayerView(gameState.gameEnv, playerId)
                });
            } else {
                const mapped = mapJoinFailure(gameState.error || 'Failed to join game');
                res.status(mapped.status).json({
                    errorCode: mapped.errorCode,
                    error: mapped.error,
                    timestamp: new Date().toISOString(),
                    context: 'joinRoom endpoint'
                });
            }
            
        } catch (error) {
            console.error('❌ Error in joinRoom:', error);
            res.status(500).json({
                errorCode: ErrorCodes.INTERNAL_ERROR,
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'joinRoom endpoint'
            });
        }
    }

    /**
     * List available lobby rooms and prune expired rooms
     * GET /api/game/lobbylist
     */
    async getLobbyList(_req: Request, res: Response): Promise<void> {
        try {
            const rooms = await lobbyManager.pruneExpiredRooms();
            const sortedRooms = rooms.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            res.json({
                success: true,
                rooms: sortedRooms,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Error in getLobbyList:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'getLobbyList endpoint'
            });
        }
    }

    /**
     * Choose which player goes first
     * POST /api/game/player/chooseFirstPlayer
     */
    async chooseFirstPlayer(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🔍 chooseFirstPlayer called with body:', req.body);

            const { gameId, playerId, chosenFirstPlayerId } = req.body;

            if (!gameId || !playerId || !chosenFirstPlayerId) {
                res.status(400).json({
                    error: 'gameId, playerId, and chosenFirstPlayerId are required',
                    timestamp: new Date().toISOString(),
                    context: 'chooseFirstPlayer endpoint'
                });
                return;
            }

            const currentEnv = await this.gameLogic.loadGameFromFile(gameId);
            if (!currentEnv) {
                res.status(404).json({
                    error: 'Game not found',
                    timestamp: new Date().toISOString(),
                    context: 'chooseFirstPlayer endpoint',
                });
                return;
            }
            const expectedPlayers = [currentEnv.playerId_1, currentEnv.playerId_2]
                .filter((id): id is string => typeof id === 'string' && id.length > 0);
            const aiPlayerIds = Array.isArray((currentEnv as any).aiPlayerIds) ? (currentEnv as any).aiPlayerIds as string[] : [];
            const requiredPlayers = expectedPlayers.filter((id) => !aiPlayerIds.includes(id));
            const missingPlayers = deckSubmissionService.getMissingPlayers(gameId, requiredPlayers);
            if (missingPlayers.length > 0) {
                res.status(400).json({
                    error: 'Both players must submit deck before choosing first player',
                    missingPlayers,
                    timestamp: new Date().toISOString(),
                    context: 'chooseFirstPlayer endpoint',
                });
                return;
            }

            const gameState = await this.gameLogic.chooseFirstPlayer(gameId, playerId, chosenFirstPlayerId);

            if (gameState.success && gameState.gameEnv) {
                const finalEnv = await this.applyAiAutoplayOrRespond(
                    res,
                    gameId,
                    playerId,
                    gameState.gameEnv,
                    'chooseFirstPlayer endpoint'
                );
                if (!finalEnv) {
                    return;
                }

                res.json({
                    success: true,
                    gameId: gameState.gameId,
                    gameEnv: GameEnvViewBuilder.toPlayerView(finalEnv, playerId)
                });
            } else {
                res.status(400).json({
                    error: gameState.error || 'Failed to choose first player',
                    timestamp: new Date().toISOString(),
                    context: 'chooseFirstPlayer endpoint'
                });
            }
        } catch (error) {
            console.error('❌ Error in chooseFirstPlayer:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'chooseFirstPlayer endpoint'
            });
        }
    }

    /**
     * Start ready phase for a player
     * POST /api/game/player/startReady
     */
    async startReady(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🔍 startReady called with body:', req.body);
            
            const { gameId, playerId, isRedraw } = req.body;
            
            if (!gameId || !playerId) {
                res.status(400).json({
                    error: 'gameId and playerId are required',
                    timestamp: new Date().toISOString(),
                    context: 'startReady endpoint'
                });
                return;
            }
            
            const gameState = await this.gameLogic.startReady(gameId, playerId, isRedraw || false);
            
            if (gameState.success && gameState.gameEnv) {
                const finalEnv = await this.applyAiAutoplayOrRespond(
                    res,
                    gameId,
                    playerId,
                    gameState.gameEnv,
                    'startReady endpoint'
                );
                if (!finalEnv) {
                    return;
                }

                res.json({
                    success: true,
                    gameId: gameState.gameId,
                    gameEnv: GameEnvViewBuilder.toPlayerView(finalEnv, playerId)
                });
            } else {
                res.status(400).json({
                    error: gameState.error || 'Failed to start ready phase',
                    timestamp: new Date().toISOString(),
                    context: 'startReady endpoint'
                });
            }
            
        } catch (error) {
            console.error('❌ Error in startReady:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'startReady endpoint'
            });
        }
    }

    /**
     * Submit deck data for the current player
     * POST /api/game/player/submitDeck
     */
    async submitDeck(req: SessionAuthedRequest, res: Response): Promise<void> {
        try {
            const { gameId, playerId, deck, topDeck } = req.body || {};
            console.log('🧩 submitDeck called', {
                gameId,
                playerId,
                deckCount: Array.isArray(deck) ? deck.length : 0,
                topDeck: typeof topDeck === 'string' ? topDeck : undefined,
            });
            if (!gameId || !playerId) {
                res.status(400).json({
                    error: 'gameId and playerId are required',
                    timestamp: new Date().toISOString(),
                    context: 'submitDeck endpoint',
                });
                return;
            }

            let normalized = deckSubmissionService.normalizeDeckEntries(deck);
            const topDeckName = typeof topDeck === 'string' ? topDeck.trim() : '';
            if (topDeckName.length > 0) {
                const decks = await loadTopDecksFromFile();
                const needle = topDeckName.toLowerCase();
                const matches = decks.filter((candidate) => candidate?.name?.trim?.().toLowerCase() === needle);
                if (matches.length === 0) {
                    res.status(400).json({
                        error: `Unknown top deck: ${topDeckName}`,
                        timestamp: new Date().toISOString(),
                        context: 'submitDeck endpoint',
                    });
                    return;
                }
                if (matches.length > 1) {
                    res.status(400).json({
                        error: `Ambiguous top deck name: ${topDeckName}`,
                        timestamp: new Date().toISOString(),
                        context: 'submitDeck endpoint',
                    });
                    return;
                }
                normalized = deckSubmissionService.normalizeDeckEntries(matches[0].entries);
            }
            if (normalized.length === 0) {
                res.status(400).json({
                    error: 'Deck is empty',
                    timestamp: new Date().toISOString(),
                    context: 'submitDeck endpoint',
                });
                return;
            }

            deckSubmissionService.submitDeck(gameId, playerId, normalized);

            const hashPayload = normalized
                .map((entry) => `${entry.id}:${entry.qty}`)
                .sort()
                .join('|');
            const deckHash = crypto.createHash('sha1').update(hashPayload).digest('hex');
            const deckCount = normalized.reduce((sum, entry) => sum + entry.qty, 0);

            res.json({
                success: true,
                deckHash,
                deckCount,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('❌ Error in submitDeck:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'submitDeck endpoint',
            });
        }
    }

    /**
     * Heartbeat to keep session alive
     * POST /api/game/player/heartbeat
     */
    async heartbeat(req: Request, res: Response): Promise<void> {
        try {
            const session = (req as SessionAuthedRequest).session;
            if (!session) {
                res.status(401).json({
                    errorCode: ErrorCodes.SESSION_MISSING,
                    error: 'Missing session context',
                    timestamp: new Date().toISOString(),
                    context: 'heartbeat endpoint'
                });
                return;
            }

            const refreshed = sessionManager.touchSession(session.token);
            if (!refreshed) {
                res.status(401).json({
                    errorCode: ErrorCodes.SESSION_EXPIRED,
                    error: 'Invalid or expired session token',
                    timestamp: new Date().toISOString(),
                    context: 'heartbeat endpoint'
                });
                return;
            }

            res.json({
                success: true,
                gameId: refreshed.gameId,
                playerId: refreshed.playerId,
                sessionExpiresAt: refreshed.expiresAt,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Error in heartbeat:', error);
            res.status(500).json({
                errorCode: ErrorCodes.INTERNAL_ERROR,
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'heartbeat endpoint'
            });
        }
    }

    /**
     * Get player game data
     * GET /api/game/player/:playerId?gameId=...
     */
    async getPlayerData(req: GameRequest, res: Response): Promise<void> {
        try {
            const { playerId } = req.params;
            const { gameId } = req.query;
            
            if (!gameId || !playerId) {
                res.status(400).json({
                    error: 'gameId and playerId are required',
                    timestamp: new Date().toISOString(),
                    context: 'getPlayerData endpoint'
                });
                return;
            }
            
            console.log('🔍 getPlayerData called for playerId:', playerId, 'gameId:', gameId);
            
            const gameState = await this.gameLogic.getPlayerGameState(gameId as string, playerId);
            
            if (gameState.success && gameState.gameEnv) {
                let finalEnv = gameState.gameEnv;
                if (!this.aiCoordinator.isAiPlayer(gameState.gameEnv, playerId) &&
                    this.aiCoordinator.getAiPlayerIds(gameState.gameEnv).length > 0) {
                    const autoEnv = await this.applyAiAutoplayOrRespond(
                        res,
                        gameId as string,
                        playerId,
                        gameState.gameEnv,
                        'getPlayerData endpoint'
                    );
                    if (!autoEnv) {
                        return;
                    }
                    finalEnv = autoEnv;
                }

                const secret = GameController.getResourceBundleSecret();
                const resourceBundleToken = signResourceBundleToken(
                    { gameId: String(gameId), playerId, exp: Math.floor(Date.now() / 1000) + 10 * 60 },
                    secret,
                );
                res.json({
                    success: true,
                    gameId: gameState.gameId,
                    gameEnv: GameEnvViewBuilder.toPlayerView(finalEnv, playerId),
                    resourceBundleToken,
                });
            } else {
                res.status(400).json({
                    error: gameState.error || 'Failed to get player data',
                    timestamp: new Date().toISOString(),
                    context: 'getPlayerData endpoint'
                });
            }
            
        } catch (error) {
            console.error('❌ Error in getPlayerData:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'getPlayerData endpoint'
            });
        }
    }

    /**
     * Process player action with card auto-discovery from zones
     * POST /api/game/player/playCard
     * Body: { gameId, playerId, carduid } or { gameId, playerId, action }
     */
    async playCard(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🎮 Processing player action:', req.body);
            
            const { gameId, playerId, action } = req.body;
            
            if (!gameId || !playerId) {
                res.status(400).json({
                    error: 'gameId and playerId are required',
                    timestamp: new Date().toISOString(),
                    context: 'playCard endpoint'
                });
                return;
            }
            
            // Handle structured actions only  
            if (action) {
                console.log('🎯 Processing structured action:', action);
                
                // Handle PlayCard actions with playAs specification
                if (action.type === 'PlayCard' && action.carduid && action.playAs) {
                    const carduid = action.carduid;
                    const playAs = action.playAs;
                    const targetUnit = action.targetUnit; // Extract targetUnit if provided
                    
                    // Validate playAs value using enum
                    const validPlayAsValues = Object.values(CardPlayType);
                    if (!validPlayAsValues.includes(playAs as CardPlayType)) {
                        res.status(400).json({
                            error: `Invalid playAs value: ${playAs}. Must be one of: ${validPlayAsValues.join(', ')}`,
                            timestamp: new Date().toISOString(),
                            context: 'playCard endpoint - playAs validation'
                        });
                        return;
                    }
                    
                    // Validate targetUnit requirement for pilot cards
                    if (playAs === CardPlayType.PILOT && !targetUnit) {
                        res.status(400).json({
                            error: 'targetUnit is required when playing a card as pilot',
                            message: 'Pilot cards must specify which unit they are being attached to via the targetUnit parameter',
                            timestamp: new Date().toISOString(),
                            context: 'playCard endpoint - pilot targetUnit validation'
                        });
                        return;
                    }
                    
                    console.log(`🎯 Playing card ${carduid} as ${playAs}${targetUnit ? ` targeting ${targetUnit}` : ''}`);
                    
                    // Pass action object directly to avoid parameter unpacking/repacking
                    const result = await this.gameLogic.playCardWithAction(gameId, playerId, action);
                    
                    if (result.success && result.gameEnv) {
                        const finalEnv = await this.applyAiAutoplayOrRespond(
                            res,
                            gameId,
                            playerId,
                            result.gameEnv,
                            'playCard endpoint'
                        );
                        if (!finalEnv) {
                            return;
                        }

                        res.json({
                            success: true,
                            gameId: result.gameId,
                            gameEnv: GameEnvViewBuilder.toPlayerView(finalEnv, playerId)
                        });
                    } else {
                        res.status(400).json({
                            error: result.error,
                            timestamp: new Date().toISOString(),
                            context: 'playCard endpoint'
                        });
                    }
                    return;
                }
                
                // Handle missing required fields for PlayCard action
                if (action.type === 'PlayCard') {
                    const missingFields = [];
                    if (!action.carduid) missingFields.push('carduid');
                    if (!action.playAs) missingFields.push('playAs');
                    
                    res.status(400).json({
                        error: `PlayCard action missing required fields: ${missingFields.join(', ')}`,
                        message: 'PlayCard action requires both carduid and playAs parameters',
                        timestamp: new Date().toISOString(),
                        context: 'playCard endpoint - PlayCard validation'
                    });
                    return;
                }
                
                // Handle other structured actions (card selection, effects, etc.)
                res.status(501).json({
                    error: 'Structured action type not yet implemented: ' + action.type,
                    message: 'Currently supports PlayCard actions. Other action types coming soon.',
                    timestamp: new Date().toISOString(),
                    context: 'playCard endpoint'
                });
                return;
            }
            
            // No action provided
            res.status(400).json({
                error: 'Action parameter is required',
                timestamp: new Date().toISOString(),
                context: 'playCard endpoint'
            });
            
        } catch (error) {
            console.error('❌ Error in playCard:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'playCard endpoint'
            });
        }
    }

    /**
     * Execute player action (attacks, abilities, etc.)
     * POST /api/game/player/playerAction
     * Body: { playerId, gameId, actionType, ...actionData }
     */
    async playerAction(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🗡️ playerAction called with body:', req.body);
            
            const { playerId, gameId, actionType, ...requestActionData } = req.body;
            
            if (!playerId || !gameId || !actionType) {
                res.status(400).json({
                    error: 'playerId, gameId, and actionType are required',
                    timestamp: new Date().toISOString(),
                    context: 'playerAction endpoint'
                });
                return;
            }
            
            // Validate actionType
            const validActionTypes = [
                'attackUnit',
                'attackShieldArea',
                'useCommandCard',
                'activateCardAbility',
                'resolveBattle',
                'confirmBattle'
            ];
            if (!validActionTypes.includes(actionType)) {
                res.status(400).json({
                    error: `Invalid actionType: ${actionType}. Must be one of: ${validActionTypes.join(', ')}`,
                    timestamp: new Date().toISOString(),
                    context: 'playerAction endpoint - actionType validation'
                });
                return;
            }
            
            
            // Pass complete action data to GameLogic service - minimal object conversion
            const actionData = {
                actionType,
                ...requestActionData // Spread all action parameters to avoid conversion
            };

            console.log(`🎯 Processing1122 ${JSON.stringify(actionData)}`);

            const result = await this.gameLogic.playerActionWithAction(gameId, playerId, actionData);
            
            if (result.success && result.gameEnv) {
                const finalEnv = await this.applyAiAutoplayOrRespond(
                    res,
                    gameId,
                    playerId,
                    result.gameEnv,
                    'playerAction endpoint'
                );
                if (!finalEnv) {
                    return;
                }

                res.json({
                    success: true,
                    gameId: result.gameId,
                    gameEnv: GameEnvViewBuilder.toPlayerView(finalEnv, playerId),
                    actionType: actionType,
                    result: result.result || 'Action completed successfully'
                });
            } else {
                res.status(400).json({
                    error: result.error,
                    errorCode: (result as any).errorCode,
                    timestamp: new Date().toISOString(),
                    context: 'playerAction endpoint'
                });
            }
            
        } catch (error) {
            console.error('❌ Error in playerAction:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'playerAction endpoint'
            });
        }
    }

    /**
     * Execute one AI decision step using hidden-information player view
     * POST /api/game/player/playerAiAction
     * Body: { gameId, playerId }
     */
    async playerAiAction(req: GameRequest, res: Response): Promise<void> {
        try {
            const { gameId, playerId } = req.body;
            if (!gameId || !playerId) {
                res.status(400).json({
                    error: 'gameId and playerId are required',
                    timestamp: new Date().toISOString(),
                    context: 'playerAiAction endpoint'
                });
                return;
            }

            const gameState = await this.gameLogic.getPlayerGameState(gameId, playerId);
            if (!gameState.success || !gameState.gameEnv) {
                res.status(400).json({
                    error: gameState.error || 'Failed to load game state',
                    timestamp: new Date().toISOString(),
                    context: 'playerAiAction endpoint'
                });
                return;
            }

            const aiView = GameEnvViewBuilder.toPlayerView(gameState.gameEnv, playerId);
            const decision = await GameAiService.decide(aiView, playerId, { rawGameEnv: gameState.gameEnv });

            if (decision.kind === 'wait') {
                res.json({
                    success: true,
                    gameId,
                    gameEnv: aiView,
                    aiDecision: decision,
                    result: 'AI waiting'
                });
                return;
            }

            const result = await this.aiCoordinator.executeAiDecisionExclusive(gameId, playerId, decision);

            if (!result?.success || !result?.gameEnv) {
                res.status(400).json({
                    error: result?.error || 'AI action failed',
                    timestamp: new Date().toISOString(),
                    context: 'playerAiAction endpoint',
                    aiDecision: decision
                });
                return;
            }

            res.json({
                success: true,
                gameId: result.gameId || gameId,
                gameEnv: GameEnvViewBuilder.toPlayerView(result.gameEnv, playerId),
                aiDecision: decision,
                result: 'AI action completed'
            });
        } catch (error) {
            console.error('❌ Error in playerAiAction:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'playerAiAction endpoint'
            });
        }
    }

    /**
     * End current player's turn and advance game state
     * POST /api/game/player/endTurn
     */
    async endTurn(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🏁 endTurn called with body:', req.body);
            
            const { gameId, playerId } = req.body;
            
            if (!gameId || !playerId) {
                res.status(400).json({
                    error: 'gameId and playerId are required',
                    timestamp: new Date().toISOString(),
                    context: 'endTurn endpoint'
                });
                return;
            }
            
            // Load game state
            const gameEnv = await this.gameLogic.loadGameFromFile(gameId);
            if (!gameEnv) {
                res.status(404).json({
                    error: 'Game not found',
                    gameId,
                    timestamp: new Date().toISOString(),
                    context: 'endTurn endpoint'
                });
                return;
            }
            
            // Validate it's the player's turn
            if (gameEnv.currentPlayer !== playerId) {
                res.status(400).json({
                    error: `Not your turn. Current player is: ${gameEnv.currentPlayer}`,
                    timestamp: new Date().toISOString(),
                    context: 'endTurn endpoint'
                });
                return;
            }
            
            console.log(`🎯 Processing end turn for player: ${playerId}, current turn: ${gameEnv.currentTurn}`);
            
            // Process END_TURN through centralized action processing
            const endTurnAction: PlayerAction = {
                type: PlayerActionType.END_TURN,
                playerId,
                gameId,
                currentTurn: gameEnv.currentTurn
            };
            
            const actionResult = await this.gameLogic.processAction(gameEnv, endTurnAction);
            console.log('🎮 END_TURN processed:', actionResult);
            
            if (!actionResult.success) {
                res.status(400).json({
                    error: actionResult.error || 'Failed to end turn',
                    timestamp: new Date().toISOString(),
                    context: 'endTurn endpoint'
                });
                return;
            }
            
            // Save updated game state
            await this.gameLogic.saveGameToFile(gameId, gameEnv);

            const finalEnv = await this.applyAiAutoplayOrRespond(
                res,
                gameId,
                playerId,
                gameEnv,
                'endTurn endpoint'
            );
            if (!finalEnv) {
                return;
            }
            
            console.log(`✅ End turn processed successfully for ${playerId}`);
            res.json({
                success: true,
                gameEnv: GameEnvViewBuilder.toPlayerView(finalEnv, playerId),
                message: `Turn ended for ${playerId}`,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error in endTurn:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'endTurn endpoint'
            });
        }
    }

    private async buildGameResourceData(gameId?: string): Promise<any> {
        // Read and parse the gcgdecks.json file
        const deckDataContent = await fs.promises.readFile(GCG_DECKS_PATH, 'utf8');
        const deckData = JSON.parse(deckDataContent);

        /**
         * read the gameEnv using the gameId, extra all card in the gameEnv, if the card doesnt existing deck001 and extraCard, add it into extraCard
         * forexamaple
         * if u see ST03-003 in gameEnv, make it st03/ST03-003 and add it to extra card array.
         */
        if (gameId) {
            const gameEnv = await this.gameLogic.loadGameFromFile(gameId);
            if (!gameEnv) {
                const err: any = new Error('Game not found');
                err.statusCode = 404;
                throw err;
            }

            if (!deckData.decks || typeof deckData.decks !== 'object') {
                deckData.decks = {};
            }
            if (!deckData.decks.deck001 || typeof deckData.decks.deck001 !== 'object') {
                deckData.decks.deck001 = { cards: [] };
            }
            if (!deckData.decks.extraCard || typeof deckData.decks.extraCard !== 'object') {
                deckData.decks.extraCard = { cards: [] };
            }

            const deck001Cards: string[] = Array.isArray(deckData.decks.deck001.cards) ? deckData.decks.deck001.cards : [];
            const extraCards: string[] = Array.isArray(deckData.decks.extraCard.cards) ? deckData.decks.extraCard.cards : [];

            const deck001Set = new Set(deck001Cards.filter((c) => typeof c === 'string'));
            const extraSet = new Set(extraCards.filter((c) => typeof c === 'string'));

            const cardIds = GameController.collectCardIdsFromGameEnv(gameEnv);
            for (const cardId of cardIds) {
                const resourcePath = GameController.toCardResourcePath(cardId);
                if (!resourcePath) {
                    // If this is a token, try to infer folder from existing decks rather than hardcoding st01.
                    if (/^T-\d+$/i.test(cardId)) {
                        const allExisting = [...deck001Cards, ...extraCards].filter((c) => typeof c === 'string') as string[];
                        const existingFolder = GameController.findTokenFolderInDeckLists(cardId, allExisting);
                        const tokenPath = existingFolder
                            ? GameController.toCardResourcePath(cardId, existingFolder)
                            : null;
                        if (tokenPath && !deck001Set.has(tokenPath) && !extraSet.has(tokenPath)) {
                            extraCards.push(tokenPath);
                            extraSet.add(tokenPath);
                        }
                    }
                    continue;
                }
                if (!deck001Set.has(resourcePath) && !extraSet.has(resourcePath)) {
                    extraCards.push(resourcePath);
                    extraSet.add(resourcePath);
                }
            }

            /*
            after updating the deckData, look at all card effect, see if it has some rules that will use token, if yes, add the token cardid into the extra card.
            dont add it if it is already there
            */
            const tokenIds = new Set<string>();
            for (const setKey of Object.keys(deckData?.decks ?? {})) {
                const deck = deckData.decks[setKey];
                const cards: string[] = Array.isArray(deck?.cards) ? deck.cards : [];
                for (const entry of cards) {
                    const id = typeof entry === 'string' ? entry.split('/').pop() : null;
                    if (id && /^(ST|GD)\d{2}-\d{3}$/i.test(id)) {
                        try {
                            const folder = entry.split('/')[0];
                            const cardDataPath = resolveDataPath(`${folder}Card.json`);
                            if (fs.existsSync(cardDataPath)) {
                                const content = await fs.promises.readFile(cardDataPath, 'utf8');
                                const data = JSON.parse(content);
                                const card = data?.cards?.find?.((c: any) => c?.cardId === id);
                                const tokens = collectTokenCardIdsFromCardData(card);
                                for (const t of tokens) tokenIds.add(t);
                            }
                        } catch {
                            // Ignore token discovery errors; resources are best-effort.
                        }
                    }
                }
            }

            const allExistingResourcePaths = [...deck001Set, ...extraSet];
            const tokenResourcePaths: string[] = [];
            for (const tokenId of tokenIds) {
                let folderHint: string | undefined =
                    GameController.findTokenFolderInDeckLists(tokenId, allExistingResourcePaths) || undefined;
                if (!folderHint) {
                    const setFolder = CardDatabaseManager.getSetFolderForCardId(tokenId);
                    if (setFolder) {
                        folderHint = setFolder;
                    }
                }
                const tokenPath = GameController.toCardResourcePath(tokenId, folderHint);
                if (tokenPath) {
                    tokenResourcePaths.push(tokenPath);
                }
            }

            for (const tokenResourcePath of tokenResourcePaths) {
                if (deck001Set.has(tokenResourcePath) || extraSet.has(tokenResourcePath)) {
                    continue;
                }
                extraCards.push(tokenResourcePath);
                extraSet.add(tokenResourcePath);
            }

            deckData.decks.extraCard.cards = extraCards;
        }

        return deckData;
    }

    // ============ CARD DATA ENDPOINTS ============

    /**
     * Get custom card data (set-based, defaults to st01)
     * GET /api/game/cards?set=st02
     */
    async getCardData(req: Request, res: Response): Promise<void> {
        try {
            const rawSet = typeof (req.query as any)?.set === 'string' ? String((req.query as any).set) : '';
            const requested = rawSet && rawSet.trim().length > 0 ? rawSet : 'st01';
            const setId = parseSetId(requested);

            if (!setId) {
                res.status(400).json({
                    error: `Invalid set '${rawSet}'. Expected gd01/gd02/gd03 or st01..st08.`,
                    timestamp: new Date().toISOString(),
                    context: 'getCardData endpoint'
                });
                return;
            }

            const fileName = getCardSetFileName(setId);
            console.log(`📋 Getting custom card data (${fileName})`);

            const cardDataPath = resolveCardSetPath(setId);

            if (!fs.existsSync(cardDataPath)) {
                res.status(404).json({
                    error: `Custom card data file not found (${fileName})`,
                    timestamp: new Date().toISOString(),
                    context: 'getCardData endpoint'
                });
                return;
            }

            const cardDataContent = await fs.promises.readFile(cardDataPath, 'utf8');
            const cardData = JSON.parse(cardDataContent);

            console.log('✅ Custom card data loaded successfully');
            res.json(cardData);
        } catch (error) {
            console.error('❌ Error in getCardData:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'getCardData endpoint'
            });
        }
    }

    /**
     * List available card sets based on *Card.json files in the data folder.
     * GET /api/game/cardSets
     */
    async getCardSets(_req: Request, res: Response): Promise<void> {
        try {
            const sets = await listAvailableCardSets();
            res.json({
                success: true,
                sets,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('❌ Error in getCardSets:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'getCardSets endpoint'
            });
        }
    }

    /**
     * List top deck pick list parsed from src/data/topDeck.md
     * GET /api/game/topDecks
     */
    async getTopDecks(_req: Request, res: Response): Promise<void> {
        try {
            const decks = await loadTopDecksFromFile();
            res.json({
                success: true,
                decks,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('❌ Error in getTopDecks:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'getTopDecks endpoint'
            });
        }
    }

    /**
     * Get game resource data (deck data for frontend card preloading)
     * GET /api/game/player/gameResource
     */
    async getGameResource(req: Request, res: Response): Promise<void> {
        try {
            console.log('📦 Getting game resource data (deck data)');
            
            // Check if file exists
            if (!fs.existsSync(GCG_DECKS_PATH)) {
                res.status(404).json({
                    error: 'Deck data file not found (gcgdecks.json)',
                    timestamp: new Date().toISOString(),
                    context: 'getGameResource endpoint'
                });
                return;
            }

            const gameId = typeof req.query?.gameId === 'string' ? req.query.gameId : undefined;
            const includeBothDecks =
                typeof (req.query as any)?.includeBothDecks === 'string'
                    ? String((req.query as any).includeBothDecks).toLowerCase() === 'true'
                    : false;
            if (gameId) {
                const authHeader = String(req.headers['authorization'] || '');
                const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
                if (!bearer) {
                    res.status(401).json({
                        error: 'Missing Authorization bearer token',
                        timestamp: new Date().toISOString(),
                        context: 'getGameResource endpoint',
                    });
                    return;
                }

                const secret = GameController.getResourceBundleSecret();
                const payload = verifyResourceBundleToken(bearer, secret);
                if (!payload || payload.gameId !== gameId) {
                    res.status(401).json({
                        error: 'Invalid or expired resource bundle token',
                        timestamp: new Date().toISOString(),
                        context: 'getGameResource endpoint',
                    });
                    return;
                }

                if (includeBothDecks) {
                    const combined = await this.buildCombinedDeckResources(gameId);
                    if (combined.pending) {
                        res.json({
                            success: true,
                            gameId,
                            playerId: payload.playerId,
                            resources: [],
                            source: 'bothDecks',
                            pending: true,
                            missingPlayers: combined.missingPlayers,
                        });
                        return;
                    }
                    res.json({
                        success: true,
                        gameId,
                        playerId: payload.playerId,
                        resources: combined.resources,
                        source: 'bothDecks',
                    });
                    return;
                }

                const playerId = payload.playerId;
                const gameEnv = await this.gameLogic.loadGameFromFile(gameId);
                if (!gameEnv) {
                    res.status(404).json({
                        error: 'Game not found',
                        timestamp: new Date().toISOString(),
                        context: 'getGameResource endpoint',
                    });
                    return;
                }

                const viewerEnv = GameEnvViewBuilder.toPlayerView(gameEnv as any, playerId);
                const visibleCardIds = GameController.collectCardIdsFromGameEnv(viewerEnv);
                const resources: string[] = [];
                for (const cardId of visibleCardIds) {
                    const resourcePath = GameController.toCardResourcePath(cardId);
                    if (resourcePath) {
                        resources.push(resourcePath);
                    }
                }

                res.json({
                    success: true,
                    gameId,
                    playerId,
                    resources
                });
                return;
            }

            const deckData = await this.buildGameResourceData(undefined);
            console.log('✅ Game resource data loaded successfully');
            res.json(deckData);
            
        } catch (error) {
            console.error('❌ Error in getGameResource:', error);
            const statusCode = (error as any)?.statusCode;
            res.status(statusCode && typeof statusCode === 'number' ? statusCode : 500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'getGameResource endpoint'
            });
        }
    }

    /**
     * Get game resource bundle as a single request (multipart/mixed).
     * Preferred: `Authorization: Bearer <resourceBundleToken>` from `getPlayerData`.
     * Fallback: POST body can include `gameId`/`playerId`.
     *
     * POST /api/game/player/gameResourceBundle
     */
    async getGameResourceBundle(req: GameRequest, res: Response): Promise<void> {
        try {
            if (!fs.existsSync(GCG_DECKS_PATH)) {
                res.status(404).json({
                    error: 'Deck data file not found (gcgdecks.json)',
                    timestamp: new Date().toISOString(),
                    context: 'getGameResourceBundle endpoint',
                });
                return;
            }

            const authHeader = String(req.headers['authorization'] || '');
            const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
            const secret = GameController.getResourceBundleSecret();

            let gameId: string | undefined;
            let playerId: string | undefined;

            if (bearer) {
                const payload = verifyResourceBundleToken(bearer, secret);
                if (!payload) {
                    res.status(401).json({
                        error: 'Invalid or expired resource bundle token',
                        timestamp: new Date().toISOString(),
                        context: 'getGameResourceBundle endpoint',
                    });
                    return;
                }
                gameId = payload.gameId;
                playerId = payload.playerId;
            } else {
                res.status(401).json({
                    error: 'Missing Authorization bearer token',
                    timestamp: new Date().toISOString(),
                    context: 'getGameResourceBundle endpoint',
                });
                return;
            }

            if (!gameId || !playerId) {
                res.status(400).json({
                    error: 'Missing gameId/playerId in token payload',
                    timestamp: new Date().toISOString(),
                    context: 'getGameResourceBundle endpoint',
                });
                return;
            }

            const includeThumbs = req.body?.includeThumbs !== false;
            const includeBothDecks = req.body?.includeBothDecks === true;
            const allowEnvScanFallback = req.body?.allowEnvScanFallback === true;

            const gameEnv = await this.gameLogic.loadGameFromFile(gameId);
            if (!gameEnv) {
                res.status(404).json({
                    error: 'Game not found',
                    timestamp: new Date().toISOString(),
                    context: 'getGameResourceBundle endpoint',
                });
                return;
            }

            let uniqueResources: string[] = [];
            if (includeBothDecks) {
                const combined = await this.buildCombinedDeckResources(gameId);
                if (combined.pending) {
                    if (!allowEnvScanFallback) {
                        res.status(409).json({
                            error: 'Deck data incomplete',
                            pending: true,
                            missingPlayers: combined.missingPlayers,
                            timestamp: new Date().toISOString(),
                            context: 'getGameResourceBundle endpoint',
                        });
                        return;
                    }
                    uniqueResources = GameController.buildResourcesFromFullGameEnv(gameEnv);
                } else {
                    const envResources = GameController.buildResourcesFromFullGameEnv(gameEnv);
                    uniqueResources = Array.from(new Set<string>([...combined.resources, ...envResources]));
                }
            } else {
                const viewerEnv = GameEnvViewBuilder.toPlayerView(gameEnv as any, playerId);
                const visibleCardIds = GameController.collectCardIdsFromGameEnv(viewerEnv);
                const seen = new Set<string>();
                for (const cardId of visibleCardIds) {
                    const resourcePath = GameController.toCardResourcePath(cardId);
                    if (!resourcePath) continue;
                    if (seen.has(resourcePath)) continue;
                    seen.add(resourcePath);
                    uniqueResources.push(resourcePath);
                }
            }

            const images: Array<{
                key: string;
                contentType: string;
                bytes: number;
                thumb: boolean;
            }> = [];
            const parts: Array<{
                key: string;
                contentType: string;
                filename: string;
                data: Buffer;
                thumb: boolean;
            }> = [];
            const missing: Array<{ key: string }> = [];

            const sanitizeResource = (resourcePath: string): string =>
                resourcePath
                    .replace(/\.\./g, '')
                    .replace(/[\\]/g, '/')
                    .replace(/\/+/g, '/')
                    .replace(/^\//, '');

            const contentTypeForExt = (ext: string): string => {
                switch (ext) {
                    case '.png':
                        return 'image/png';
                    case '.jpg':
                    case '.jpeg':
                        return 'image/jpeg';
                    case '.webp':
                        return 'image/webp';
                    case '.gif':
                        return 'image/gif';
                    case '.svg':
                        return 'image/svg+xml';
                    default:
                        return 'application/octet-stream';
                }
            };

            const resolveExistingImage = (
                resourcePath: string,
                variant: 'full' | 'thumb' = 'full',
            ): { filePath: string; ext: string } | null => {
                const sanitized = sanitizeResource(resourcePath);
                const hasExt = /\.(png|jpe?g|webp|gif|svg)$/i.test(sanitized);
                const candidates = hasExt
                    ? [sanitized]
                    : [`${sanitized}.jpeg`, `${sanitized}.jpg`, `${sanitized}.png`, `${sanitized}.webp`];
                for (const candidate of candidates) {
                    const resolved = GameController.resolveImageFilePath(candidate, variant);
                    if (resolved) {
                        return { filePath: resolved, ext: path.extname(candidate).toLowerCase() };
                    }
                }
                return null;
            };

            for (const resourcePath of uniqueResources) {
                const filenameBase = resourcePath.split('/').pop() || resourcePath;
                const baseKey = filenameBase.replace(/\.(png|jpe?g|webp|gif|svg)$/i, '');

                let thumbResolved = resolveExistingImage(resourcePath, 'thumb');
                let fullResolved = resolveExistingImage(resourcePath, 'full');
                if (!thumbResolved && /^T-\d+$/i.test(baseKey)) {
                    // Token fallback: if set-scoped token art is missing, try the global token folder.
                    thumbResolved = resolveExistingImage(`T/${baseKey}`, 'thumb');
                    if (!fullResolved) {
                        fullResolved = resolveExistingImage(`T/${baseKey}`, 'full');
                    }
                }
                if (!thumbResolved && !fullResolved) {
                    missing.push({ key: baseKey });
                    continue;
                }

                const fullImage = fullResolved || thumbResolved;
                const thumbImage = thumbResolved || fullResolved;
                if (!fullImage || !thumbImage) {
                    missing.push({ key: baseKey });
                    continue;
                }

                const fullData = await fs.promises.readFile(fullImage.filePath);
                const fullContentType = contentTypeForExt(fullImage.ext);
                const fullFilename = `${baseKey}${fullImage.ext || '.bin'}`;

                parts.push({ key: baseKey, contentType: fullContentType, filename: fullFilename, data: fullData, thumb: false });
                images.push({ key: baseKey, contentType: fullContentType, bytes: fullData.length, thumb: false });

                if (includeThumbs) {
                    const thumbKey = `${baseKey}-thumb`;
                    const thumbData = await fs.promises.readFile(thumbImage.filePath);
                    const thumbContentType = contentTypeForExt(thumbImage.ext);
                    const thumbFilename = `${thumbKey}${thumbImage.ext || '.bin'}`;
                    parts.push({
                        key: thumbKey,
                        contentType: thumbContentType,
                        filename: thumbFilename,
                        data: thumbData,
                        thumb: true,
                    });
                    images.push({ key: thumbKey, contentType: thumbContentType, bytes: thumbData.length, thumb: true });
                }
            }

            const boundary = `gcg_bundle_${Date.now()}_${Math.random().toString(16).slice(2)}`;
            const CRLF = '\r\n';
            const chunks: Buffer[] = [];
            const pushString = (value: string) => chunks.push(Buffer.from(value, 'utf8'));
            const pushBuffer = (value: Buffer) => chunks.push(value);

            const manifest = {
                version: 1,
                generatedAt: new Date().toISOString(),
                gameId: gameId || null,
                playerId: playerId || null,
                images,
                missing,
            };

            pushString(`--${boundary}${CRLF}`);
            pushString(`Content-Type: application/json${CRLF}`);
            pushString(`Content-Disposition: inline; name="manifest"${CRLF}${CRLF}`);
            pushBuffer(Buffer.from(JSON.stringify(manifest), 'utf8'));
            pushString(CRLF);

            for (const part of parts) {
                pushString(`--${boundary}${CRLF}`);
                pushString(`Content-Type: ${part.contentType}${CRLF}`);
                pushString(`Content-Disposition: attachment; name="image"; filename="${part.filename}"${CRLF}`);
                pushString(`X-Texture-Key: ${part.key}${CRLF}`);
                pushString(`X-Thumb: ${part.thumb ? '1' : '0'}${CRLF}${CRLF}`);
                pushBuffer(part.data);
                pushString(CRLF);
            }

            pushString(`--${boundary}--${CRLF}`);

            res.status(200);
            res.setHeader('Content-Type', `multipart/mixed; boundary=${boundary}`);
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('X-Resource-Count', String(parts.length));
            res.setHeader('X-Missing-Count', String(missing.length));
            res.send(Buffer.concat(chunks));
        } catch (error) {
            console.error('❌ Error in getGameResourceBundle:', error);
            const statusCode = (error as any)?.statusCode;
            res.status(statusCode && typeof statusCode === 'number' ? statusCode : 500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'getGameResourceBundle endpoint',
            });
        }
    }

    // ============ IMAGE SERVING ENDPOINTS ============

    /**
     * Serve images from data/image folder.
     * `/api/game/image/*` returns full-size images,
     * `/api/game/image/thumb/*` returns thumbnails.
     * GET /api/game/image/*
     */
    async serveImage(req: Request, res: Response): Promise<void> {
        try {
            // Get the full path from the wildcard route
            const imagePath_requested = req.params[0];
            
            if (!imagePath_requested) {
                res.status(400).json({
                    error: 'Image path is required',
                    timestamp: new Date().toISOString(),
                    context: 'serveImage endpoint'
                });
                return;
            }
            
            console.log(`🖼️ Serving image: ${imagePath_requested}`);
            
            // Sanitize the path to prevent directory traversal attacks
            const sanitizedImagePath = imagePath_requested
                .replace(/\.\./g, '')  // Remove ..
                .replace(/[\\]/g, '/') // Normalize path separators
                .replace(/\/+/g, '/'); // Remove double slashes

            const isThumbRequest = /^thumb\//i.test(sanitizedImagePath);
            const normalizedImagePath = isThumbRequest
                ? sanitizedImagePath.replace(/^thumb\//i, '')
                : sanitizedImagePath;
            const imagePath = GameController.resolveImageFilePath(
                normalizedImagePath,
                isThumbRequest ? 'thumb' : 'full'
            );
            if (!imagePath) {
                res.status(404).json({
                    error: `Image not found: ${sanitizedImagePath}`,
                    timestamp: new Date().toISOString(),
                    context: 'serveImage endpoint'
                });
                return;
            }
            
            // Get file extension to set proper Content-Type
            const ext = path.extname(normalizedImagePath).toLowerCase();
            let contentType = 'application/octet-stream';
            
            switch (ext) {
                case '.png':
                    contentType = 'image/png';
                    break;
                case '.jpg':
                case '.jpeg':
                    contentType = 'image/jpeg';
                    break;
                case '.gif':
                    contentType = 'image/gif';
                    break;
                case '.webp':
                    contentType = 'image/webp';
                    break;
                case '.svg':
                    contentType = 'image/svg+xml';
                    break;
            }
            
            // Set appropriate headers for image serving
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
            
            // Serve the image file
            res.sendFile(imagePath, (err) => {
                if (err) {
                    console.error('❌ Error serving image:', err);
                    if (!res.headersSent) {
                        res.status(500).json({
                            error: 'Failed to serve image',
                            timestamp: new Date().toISOString(),
                            context: 'serveImage endpoint'
                        });
                    }
                } else {
                    console.log(`✅ Image served successfully: ${sanitizedImagePath}`);
                }
            });
            
        } catch (error) {
            console.error('❌ Error in serveImage:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'serveImage endpoint'
            });
        }
    }

    /**
     * Download files from data/file folder
     * GET /api/game/file/*
     */
    async downloadFile(req: Request, res: Response): Promise<void> {
        try {
            const requestedFilePath = req.params[0];

            if (!requestedFilePath) {
                res.status(400).json({
                    error: 'File path is required',
                    timestamp: new Date().toISOString(),
                    context: 'downloadFile endpoint'
                });
                return;
            }

            const sanitizedFilePath = requestedFilePath
                .replace(/\.\./g, '')
                .replace(/[\\]/g, '/')
                .replace(/^\/+/g, '')
                .replace(/\/+/g, '/');

            if (!sanitizedFilePath) {
                res.status(400).json({
                    error: 'Invalid file path',
                    timestamp: new Date().toISOString(),
                    context: 'downloadFile endpoint'
                });
                return;
            }

            const filePath = GameController.resolveDownloadFilePath(sanitizedFilePath);
            if (!filePath) {
                res.status(404).json({
                    error: `File not found: ${sanitizedFilePath}`,
                    timestamp: new Date().toISOString(),
                    context: 'downloadFile endpoint'
                });
                return;
            }

            const downloadName = path.basename(filePath).replace(/"/g, '');
            console.log(`📦 Downloading file: ${sanitizedFilePath}`);

            res.setHeader('Cache-Control', 'no-store');
            res.download(filePath, downloadName, (err) => {
                if (err) {
                    console.error('❌ Error downloading file:', err);
                    if (!res.headersSent) {
                        const status = (err as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 500;
                        res.status(status).json({
                            error: status === 404 ? 'File not found' : 'Failed to download file',
                            timestamp: new Date().toISOString(),
                            context: 'downloadFile endpoint'
                        });
                    }
                } else {
                    console.log(`✅ File downloaded successfully: ${sanitizedFilePath}`);
                }
            });
        } catch (error) {
            console.error('❌ Error in downloadFile:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'downloadFile endpoint'
            });
        }
    }

    // ============ EVENT QUEUE ENDPOINTS ============

    /**
     * Test event queue functionality
     * POST /api/game/test-events
     */
    async testEventQueue(req: GameRequest, res: Response): Promise<void> {
        try {
            const { gameId } = req.body;
            
            if (!gameId) {
                res.status(400).json({
                    error: 'gameId is required',
                    timestamp: new Date().toISOString(),
                    context: 'testEventQueue endpoint'
                });
                return;
            }
            
            // TODO: Load game and test event queue
            // const gameEnv = await this.gameLogic.loadGameFromFile(gameId);
            // if (!gameEnv) {
            //     res.status(404).json({ error: 'Game not found' });
            //     return;
            // }
            // 
            // gameEnv.initializeEventProcessor();
            // const processor = gameEnv.getEventProcessor();
            // const queueStatus = processor?.getQueueStatus();
            // 
            // res.json({
            //     success: true,
            //     gameId,
            //     eventQueueStatus: queueStatus,
            //     message: 'Event queue system tested successfully'
            // });
            
            res.json({
                success: true,
                gameId,
                message: 'Event queue test endpoint - implementation needed'
            });
            
        } catch (error) {
            console.error('❌ Error testing event queue:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'testEventQueue endpoint'
            });
        }
    }

    // ============ HEALTH CHECK ENDPOINTS ============

    /**
     * Health check endpoint
     * GET /api/game/health
     */
    async healthCheck(_req: Request, res: Response): Promise<void> {
        try {
            const status = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                services: {
                    gameLogic: 'available',
                    customTradingCardGame: 'ready for development'
                },
                message: 'Custom Trading Card Game API is ready'
            };
            
            res.json(status);
            
        } catch (error) {
            console.error('❌ Error in health check:', error);
            res.status(500).json({
                status: 'unhealthy',
                error: (error as Error).message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    // ============ TEST ENDPOINTS ============

    /**
     * Get test scenario for testing
     * GET /api/game/test/getTestScenario?scenarioPath=...
     */
    async getTestScenario(req: Request, res: Response): Promise<void> {
        try {
            const { scenarioPath } = req.query;
            
            if (!scenarioPath || typeof scenarioPath !== 'string') {
                res.status(400).json({
                    error: 'Missing required parameter: scenarioPath',
                    timestamp: new Date().toISOString(),
                    context: 'getTestScenario endpoint'
                });
                return;
            }
            
         
            const backendRoot =
                GameController.findNearestPackageRoot(__dirname) ??
                GameController.findNearestPackageRoot(process.cwd()) ??
                process.cwd();

            const scenarioBaseDir = path.join(backendRoot, 'shared/testScenarios/gameStates');
            const scenarioFilename = scenarioPath.endsWith('.json') ? scenarioPath : `${scenarioPath}.json`;
            const scenarioFilePath = path.resolve(scenarioBaseDir, scenarioFilename);
            //console.log(`📋 Loading test scenario: ${scenarioFilePath}`);
            console.log(`📋 Loading test scenario11111: ${scenarioFilePath}`);
            
            
            // Prevent path traversal via scenarioPath (e.g. ../../../secrets)
            const scenarioBaseResolved = path.resolve(scenarioBaseDir);
            if (!scenarioFilePath.startsWith(scenarioBaseResolved + path.sep)) {
                res.status(400).json({
                    error: 'Invalid scenarioPath',
                    timestamp: new Date().toISOString(),
                    context: 'getTestScenario endpoint'
                });
                return;
            }
            
            // Check if file exists
            if (!fs.existsSync(scenarioFilePath)) {
                res.status(404).json({
                    error: `Test scenario not found: ${scenarioPath}`,
                    timestamp: new Date().toISOString(),
                    context: 'getTestScenario endpoint'
                });
                return;
            }
            
            // Read and parse the scenario file
            const scenarioContent = await fs.promises.readFile(scenarioFilePath, 'utf8');
            const scenario = JSON.parse(scenarioContent);
            
            console.log(`✅ Test scenario loaded successfully: ${scenarioPath}`);
            
            res.json({
                success: true,
                scenarioPath: scenarioPath,
                scenario: scenario,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error in getTestScenario:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'getTestScenario endpoint'
            });
        }
    }


    /**
     * Inject game state for testing
     * POST /api/game/test/injectGameState
     */
    async injectGameState(req: Request, res: Response): Promise<void> {
        try {
            const { gameId, gameEnv } = req.body;
            const requestedPlayerSelector = normalizePlayerSeatSelector(
                typeof req.body?.player === 'string' ? req.body.player.trim().toLowerCase() : ''
            );
            
            if (!gameId || !gameEnv) {
                res.status(400).json({
                    error: 'Missing required parameters: gameId and gameEnv',
                    timestamp: new Date().toISOString(),
                    context: 'injectGameState endpoint'
                });
                return;
            }
            
            console.log(`🧪 Injecting game state for testing: ${gameId}`);
            
            // Use GameLogic service method for business logic
            const result = await this.gameLogic.injectGameState(gameId, gameEnv);
            
            if (!result.success) {
                res.status(400).json({
                    error: result.error || 'Failed to inject game state',
                    timestamp: new Date().toISOString(),
                    context: 'injectGameState endpoint'
                });
                return;
            }

            const injectedEnv = result.gameEnv as any;
            const resolvedPlayerId = resolvePlayerIdForSelector(injectedEnv, requestedPlayerSelector);
            const testSessions = buildTestSessions(gameId, injectedEnv);
            
            console.log(`✅ Game state injected successfully: ${gameId}`);
            
            res.json({
                success: true,
                gameId: result.gameId,
                message: 'Game state injected successfully',
                requestedPlayerSelector,
                resolvedPlayerId,
                resolvedSession: resolvedPlayerId
                    ? testSessions.find((entry) => entry.playerId === resolvedPlayerId) || null
                    : null,
                testSessions,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error in injectGameState:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'injectGameState endpoint'
            });
        }
    }

    /**
     * Resolve or create test session for an existing game using seat selector.
     * POST /api/game/test/resolveSeatSession
     */
    async resolveSeatSession(req: Request, res: Response): Promise<void> {
        try {
            const { gameId } = req.body ?? {};
            const requestedPlayerSelector = normalizePlayerSeatSelector(
                typeof req.body?.player === 'string' ? req.body.player.trim().toLowerCase() : ''
            );

            if (!gameId || typeof gameId !== 'string') {
                res.status(400).json({
                    error: 'Missing required parameter: gameId',
                    timestamp: new Date().toISOString(),
                    context: 'resolveSeatSession endpoint'
                });
                return;
            }

            const gameEnv = await this.gameLogic.loadGameFromFile(gameId);
            if (!gameEnv) {
                res.status(404).json({
                    error: 'Game not found',
                    timestamp: new Date().toISOString(),
                    context: 'resolveSeatSession endpoint'
                });
                return;
            }

            const resolvedPlayerId = resolvePlayerIdForSelector(gameEnv as any, requestedPlayerSelector);
            if (!resolvedPlayerId) {
                res.status(400).json({
                    error: 'Unable to resolve player seat from game state',
                    timestamp: new Date().toISOString(),
                    context: 'resolveSeatSession endpoint'
                });
                return;
            }

            const session = sessionManager.createSession(gameId, resolvedPlayerId);
            res.json({
                success: true,
                gameId,
                requestedPlayerSelector,
                resolvedPlayerId,
                sessionToken: session.token,
                sessionExpiresAt: session.expiresAt,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Error in resolveSeatSession:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'resolveSeatSession endpoint'
            });
        }
    }

    /**
     * Save current game env as exception scenario
     * POST /api/game/test/saveExceptionScenario
     */
    async saveExceptionScenario(req: Request, res: Response): Promise<void> {
        try {
            const {
                gameId,
                name,
                description,
                tags,
                category,
                testType
            } = req.body ?? {};

            if (!gameId || typeof gameId !== 'string') {
                res.status(400).json({
                    error: 'Missing required parameter: gameId',
                    timestamp: new Date().toISOString(),
                    context: 'saveExceptionScenario endpoint'
                });
                return;
            }

            const env = await this.gameLogic.loadGameFromFile(gameId);
            if (!env) {
                res.status(404).json({
                    error: 'Game not found',
                    timestamp: new Date().toISOString(),
                    context: 'saveExceptionScenario endpoint'
                });
                return;
            }

            const initialGameEnv = env.toJSON();
            const now = Date.now();
            const safeGameId = gameId.replace(/[^A-Za-z0-9._-]/g, '_');
            const defaultName = `capture_${safeGameId}_${now}`;
            const rawName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : defaultName;
            const sanitizedBase = rawName.replace(/[^A-Za-z0-9._-]/g, '_');
            const filename = sanitizedBase.endsWith('.json') ? sanitizedBase : `${sanitizedBase}.json`;

            const scenario = {
                description: typeof description === 'string' && description.trim().length > 0
                    ? description.trim()
                    : `capture_${gameId}_${now}`,
                gameId,
                testType: typeof testType === 'string' && testType.trim().length > 0 ? testType.trim() : 'exception',
                category: typeof category === 'string' && category.trim().length > 0 ? category.trim() : 'Exception',
                tags: Array.isArray(tags) ? tags : ['Exception', 'Captured'],
                initialGameEnv
            };

            const backendRoot =
                GameController.findNearestPackageRoot(__dirname) ??
                GameController.findNearestPackageRoot(process.cwd()) ??
                process.cwd();

            const scenarioBaseDir = path.join(backendRoot, 'shared/testScenarios/gameStates');
            const exceptionDir = path.join(scenarioBaseDir, 'Exception');
            await fs.promises.mkdir(exceptionDir, { recursive: true });

            const scenarioFilePath = path.resolve(exceptionDir, filename);
            const exceptionBaseResolved = path.resolve(exceptionDir);
            if (!scenarioFilePath.startsWith(exceptionBaseResolved + path.sep)) {
                res.status(400).json({
                    error: 'Invalid scenario file name',
                    timestamp: new Date().toISOString(),
                    context: 'saveExceptionScenario endpoint'
                });
                return;
            }

            await fs.promises.writeFile(scenarioFilePath, JSON.stringify(scenario, null, 2), 'utf8');

            res.json({
                success: true,
                scenarioPath: `Exception/${filename}`,
                filePath: scenarioFilePath,
                scenario,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Error in saveExceptionScenario:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'saveExceptionScenario endpoint'
            });
        }
    }

    /**
     * Confirm or decline a burst effect choice
     * POST /api/game/player/confirmBurstChoice
     * Body: { gameId, playerId, eventId, confirmed }
     */
    async confirmBurstChoice(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('💥 Processing burst choice confirmation:', req.body);
            
            const { gameId, playerId, eventId, confirmed } = req.body;
            
            if (!gameId || !playerId || !eventId || typeof confirmed !== 'boolean') {
                res.status(400).json({
                    error: 'gameId, playerId, eventId, and confirmed (boolean) are required',
                    timestamp: new Date().toISOString(),
                    context: 'confirmBurstChoice endpoint'
                });
                return;
            }
            
            console.log(`🎯 Player ${playerId} ${confirmed ? 'confirmed' : 'declined'} burst choice: ${eventId}`);
            
            // Use GameLogic service method for business logic
            const result = await this.gameLogic.confirmBurstChoice(gameId, playerId, eventId, confirmed);
            
            if (result.success && result.gameEnv) {
                const finalEnv = await this.applyAiAutoplayOrRespond(
                    res,
                    gameId,
                    playerId,
                    result.gameEnv,
                    'confirmBurstChoice endpoint'
                );
                if (!finalEnv) {
                    return;
                }

                res.json({
                    success: true,
                    gameId: result.gameId,
                    gameEnv: GameEnvViewBuilder.toPlayerView(finalEnv, playerId),
                    message: `Burst effect ${confirmed ? 'confirmed' : 'declined'} successfully`
                });
            } else {
                res.status(400).json({
                    error: result.error || 'Failed to process burst choice',
                    timestamp: new Date().toISOString(),
                    context: 'confirmBurstChoice endpoint'
                });
            }
            
        } catch (error) {
            console.error('❌ Error in confirmBurstChoice:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'confirmBurstChoice endpoint'
            });
        }
    }

    /**
     * Confirm target choice (array-only TARGET_CHOICE API)
     * POST /api/game/player/confirmTargetChoice
     * Body: { gameId, playerId, eventId, selectedTargets } - Array format required
     */
    async confirmTargetChoice(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🎯 Processing target choice confirmation:', req.body);
            
            const { gameId, playerId, eventId, selectedTargets } = req.body;
            
            if (!gameId || !playerId || !eventId) {
                res.status(400).json({
                    error: 'gameId, playerId, and eventId are required',
                    timestamp: new Date().toISOString(),
                    context: 'confirmTargetChoice endpoint'
                });
                return;
            }

            if (!selectedTargets || !Array.isArray(selectedTargets)) {
                res.status(400).json({
                    error: 'selectedTargets array is required',
                    timestamp: new Date().toISOString(),
                    context: 'confirmTargetChoice endpoint'
                });
                return;
            }

            // Validate each target structure
            if (selectedTargets.length > 0) {
                for (const target of selectedTargets) {
                    if (!target.carduid || !target.zone || !target.playerId) {
                        res.status(400).json({
                            error: 'Each target must include carduid, zone, and playerId',
                            timestamp: new Date().toISOString(),
                            context: 'confirmTargetChoice endpoint'
                        });
                        return;
                    }
                }
            }
            
            console.log(`🚀 Player ${playerId} selected ${selectedTargets.length} target(s):`, selectedTargets.map(t => `${t.carduid} in ${t.zone}`));
            
            // Use GameLogic service method for business logic
            const result = await this.gameLogic.confirmTargetChoice(gameId, playerId, eventId, selectedTargets);
            
            if (result.success && result.gameEnv) {
                const finalEnv = await this.applyAiAutoplayOrRespond(
                    res,
                    gameId,
                    playerId,
                    result.gameEnv,
                    'confirmTargetChoice endpoint'
                );
                if (!finalEnv) {
                    return;
                }

                res.json({
                    success: true,
                    gameId: result.gameId,
                    gameEnv: GameEnvViewBuilder.toPlayerView(finalEnv, playerId),
                    message: `Target selection successful (${selectedTargets.length} target${selectedTargets.length > 1 ? 's' : ''})`
                });
            } else {
                res.status(400).json({
                    error: result.error || 'Failed to process target choice',
                    timestamp: new Date().toISOString(),
                    context: 'confirmTargetChoice endpoint'
                });
            }
            
        } catch (error) {
            console.error('❌ Error in confirmTargetChoice:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'confirmTargetChoice endpoint'
            });
        }
    }

    /**
     * Confirm token choice (choose_one_then_deploy_token)
     * POST /api/game/player/confirmTokenChoice
     * Body: { gameId, playerId, eventId, selectedChoiceIndex }
     */
    async confirmTokenChoice(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🎯 Processing token choice confirmation:', req.body);

            const { gameId, playerId, eventId, selectedChoiceIndex } = req.body;

            if (!gameId || !playerId || !eventId) {
                res.status(400).json({
                    error: 'gameId, playerId, and eventId are required',
                    timestamp: new Date().toISOString(),
                    context: 'confirmTokenChoice endpoint'
                });
                return;
            }

            if (typeof selectedChoiceIndex !== 'number') {
                res.status(400).json({
                    error: 'selectedChoiceIndex must be a number',
                    timestamp: new Date().toISOString(),
                    context: 'confirmTokenChoice endpoint'
                });
                return;
            }

            const result = await this.gameLogic.confirmTokenChoice(gameId, playerId, eventId, selectedChoiceIndex);

            if (result.success && result.gameEnv) {
                const finalEnv = await this.applyAiAutoplayOrRespond(
                    res,
                    gameId,
                    playerId,
                    result.gameEnv,
                    'confirmTokenChoice endpoint'
                );
                if (!finalEnv) {
                    return;
                }

                res.json({
                    success: true,
                    gameId: result.gameId,
                    gameEnv: GameEnvViewBuilder.toPlayerView(finalEnv, playerId),
                    message: `Token choice successful (index ${selectedChoiceIndex})`
                });
            } else {
                res.status(400).json({
                    error: result.error || 'Failed to process token choice',
                    timestamp: new Date().toISOString(),
                    context: 'confirmTokenChoice endpoint'
                });
            }

        } catch (error) {
            console.error('❌ Error in confirmTokenChoice:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'confirmTokenChoice endpoint'
            });
        }
    }

    /**
     * Confirm generic option choice (OPTION_CHOICE)
     * POST /api/game/player/confirmOptionChoice
     * Body: { gameId, playerId, eventId, selectedOptionIndex }
     */
    async confirmOptionChoice(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🎯 Processing option choice confirmation:', req.body);

            const { gameId, playerId, eventId, selectedOptionIndex } = req.body;

            if (!gameId || !playerId || !eventId) {
                res.status(400).json({
                    error: 'gameId, playerId, and eventId are required',
                    timestamp: new Date().toISOString(),
                    context: 'confirmOptionChoice endpoint'
                });
                return;
            }

            if (typeof selectedOptionIndex !== 'number') {
                res.status(400).json({
                    error: 'selectedOptionIndex must be a number',
                    timestamp: new Date().toISOString(),
                    context: 'confirmOptionChoice endpoint'
                });
                return;
            }

            const result = await this.gameLogic.confirmOptionChoice(gameId, playerId, eventId, selectedOptionIndex);

            if (result.success && result.gameEnv) {
                const finalEnv = await this.applyAiAutoplayOrRespond(
                    res,
                    gameId,
                    playerId,
                    result.gameEnv,
                    'confirmOptionChoice endpoint'
                );
                if (!finalEnv) {
                    return;
                }

                res.json({
                    success: true,
                    gameId: result.gameId,
                    gameEnv: GameEnvViewBuilder.toPlayerView(finalEnv, playerId),
                    message: `Option choice successful (index ${selectedOptionIndex})`
                });
            } else {
                res.status(400).json({
                    error: result.error || 'Failed to process option choice',
                    timestamp: new Date().toISOString(),
                    context: 'confirmOptionChoice endpoint'
                });
            }
        } catch (error) {
            console.error('❌ Error in confirmOptionChoice:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'confirmOptionChoice endpoint'
            });
        }
    }


    /**
     * Confirm blocker choice decision (BLOCKER_CHOICE events)
     * POST /api/game/player/confirmBlockerChoice
     * Body: { gameId, playerId, eventId, selectedTarget | null }
     */
    async confirmBlockerChoice(req: GameRequest, res: Response): Promise<void> {
        try {
            console.log('🛡️ Processing blocker choice confirmation:', req.body);

            const { gameId, playerId, eventId, selectedTargets, notificationId } = req.body;

            if (!gameId || !playerId || !eventId) {
                res.status(400).json({
                    error: 'gameId, playerId, and eventId are required',
                    timestamp: new Date().toISOString(),
                    context: 'confirmBlockerChoice endpoint'
                });
                return;
            }

            const targetsArray = Array.isArray(selectedTargets) ? selectedTargets : [];

            if (targetsArray.length > 1) {
                res.status(400).json({
                    error: 'Only one blocker target can be selected',
                    timestamp: new Date().toISOString(),
                    context: 'confirmBlockerChoice endpoint'
                });
                return;
            }

            if (targetsArray.length === 1) {
                const target = targetsArray[0];
                if (!target?.carduid || !target?.zone || !target?.playerId) {
                    res.status(400).json({
                        error: 'Selected blocker must include carduid, zone, and playerId',
                        timestamp: new Date().toISOString(),
                        context: 'confirmBlockerChoice endpoint'
                    });
                    return;
                }
            }

            const result = await this.gameLogic.confirmBlockerChoice(gameId, playerId, eventId, targetsArray, notificationId);

            if (result.success && result.gameEnv) {
                const finalEnv = await this.applyAiAutoplayOrRespond(
                    res,
                    gameId,
                    playerId,
                    result.gameEnv,
                    'confirmBlockerChoice endpoint'
                );
                if (!finalEnv) {
                    return;
                }

                res.json({
                    success: true,
                    gameId: result.gameId,
                    gameEnv: GameEnvViewBuilder.toPlayerView(finalEnv, playerId),
                    message: targetsArray.length > 0 ? 'Blocker assigned successfully' : 'Blocker choice declined'
                });
            } else {
                res.status(400).json({
                    error: result.error || 'Failed to process blocker choice',
                    timestamp: new Date().toISOString(),
                    context: 'confirmBlockerChoice endpoint'
                });
            }

        } catch (error) {
            console.error('❌ Error in confirmBlockerChoice:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'confirmBlockerChoice endpoint'
            });
        }
    }

}

// ============ EXPORT SINGLETON ============

// Create singleton instance for your custom trading card game
export const gameController = new GameController();
export default gameController;
