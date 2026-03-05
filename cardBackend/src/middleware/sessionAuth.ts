// src/middleware/sessionAuth.ts

import { Request, Response, NextFunction } from 'express';
import { sessionManager, SessionRecord } from '../services/SessionManager';
import { ErrorCodes } from '../constants/ErrorCodes';

export interface SessionAuthedRequest extends Request {
    session?: SessionRecord;
}

const getTokenFromHeader = (req: Request): string | null => {
    const authHeader = String(req.headers['authorization'] || '');
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();
        return token || null;
    }
    const fallback = String(req.headers['x-session-token'] || '').trim();
    return fallback || null;
};

const normalizeQueryValue = (value: any): string | undefined => {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
    }
    return undefined;
};

const mismatchResponse = (res: Response, context: string): void => {
    res.status(403).json({
        errorCode: ErrorCodes.SESSION_MISMATCH,
        error: 'Session token does not match requested player or game',
        timestamp: new Date().toISOString(),
        context
    });
};

export const requirePlayerSession = (req: Request, res: Response, next: NextFunction): void => {
    const token = getTokenFromHeader(req);
    if (!token) {
        res.status(401).json({
            errorCode: ErrorCodes.SESSION_MISSING,
            error: 'Missing session token',
            timestamp: new Date().toISOString(),
            context: 'session auth'
        });
        return;
    }

    const session = sessionManager.validateSession(token);
    if (!session) {
        res.status(401).json({
            errorCode: ErrorCodes.SESSION_EXPIRED,
            error: 'Invalid or expired session token',
            timestamp: new Date().toISOString(),
            context: 'session auth'
        });
        return;
    }

    const bodyPlayerId = typeof req.body?.playerId === 'string' ? req.body.playerId : undefined;
    const bodyGameId = typeof req.body?.gameId === 'string' ? req.body.gameId : undefined;
    const paramPlayerId = typeof req.params?.playerId === 'string' ? req.params.playerId : undefined;
    const paramGameId = typeof req.params?.gameId === 'string' ? req.params.gameId : undefined;
    const queryPlayerId = normalizeQueryValue((req.query as any)?.playerId);
    const queryGameId = normalizeQueryValue((req.query as any)?.gameId);

    const providedPlayerId = bodyPlayerId || paramPlayerId || queryPlayerId;
    const providedGameId = bodyGameId || paramGameId || queryGameId;

    if (providedPlayerId && providedPlayerId !== session.playerId) {
        mismatchResponse(res, 'session auth player mismatch');
        return;
    }
    if (providedGameId && providedGameId !== session.gameId) {
        mismatchResponse(res, 'session auth game mismatch');
        return;
    }

    sessionManager.touchSession(token);

    if (req.body && typeof req.body === 'object') {
        req.body.playerId = session.playerId;
        req.body.gameId = session.gameId;
    }
    if (req.params) {
        if (typeof req.params.playerId === 'string') {
            req.params.playerId = session.playerId;
        }
        if (typeof req.params.gameId === 'string') {
            req.params.gameId = session.gameId;
        }
    }
    if (req.query) {
        (req.query as any).playerId = session.playerId;
        (req.query as any).gameId = session.gameId;
    }

    (req as SessionAuthedRequest).session = session;
    next();
};
