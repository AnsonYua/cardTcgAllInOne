// src/controllers/choiceController.ts
// Centralizes choice-related endpoints to keep GameController smaller.

import { Request, Response } from 'express';
import { gameLogic, GameLogic } from '../services/GameLogic';
import { GameEnvViewBuilder } from '../services/views/GameEnvViewBuilder';

export interface ChoiceRequest extends Request {
    body: {
        gameId?: string;
        playerId?: string;
        eventId?: string;
        [key: string]: any;
    };
}

export class ChoiceController {
    private gameLogic: GameLogic;

    constructor() {
        this.gameLogic = gameLogic;
        console.log('🎯 ChoiceController initialized');
    }

    /**
     * Cancel (decline) a pending choice event when the frontend closes the dialog.
     * POST /api/game/player/cancelChoice
     * Body: { gameId, playerId, eventId }
     */
    async cancelChoice(req: ChoiceRequest, res: Response): Promise<void> {
        try {
            console.log('🚫 Processing choice cancellation:', req.body);

            const { gameId, playerId, eventId } = req.body;

            if (!gameId || !playerId || !eventId) {
                res.status(400).json({
                    error: 'gameId, playerId, and eventId are required',
                    timestamp: new Date().toISOString(),
                    context: 'cancelChoice endpoint'
                });
                return;
            }

            const result = await this.gameLogic.cancelChoice(gameId, playerId, eventId);

            if (result.success && result.gameEnv) {
                res.json({
                    success: true,
                    gameId: result.gameId,
                    gameEnv: GameEnvViewBuilder.toPlayerView(result.gameEnv, playerId),
                    message: 'Choice cancelled successfully'
                });
            } else {
                res.status(400).json({
                    error: result.error || 'Failed to cancel choice',
                    timestamp: new Date().toISOString(),
                    context: 'cancelChoice endpoint'
                });
            }
        } catch (error) {
            console.error('❌ Error in cancelChoice:', error);
            res.status(500).json({
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
                context: 'cancelChoice endpoint'
            });
        }
    }
}

export const choiceController = new ChoiceController();
export default choiceController;
