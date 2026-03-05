// src/services/SessionManager.ts

import crypto from 'crypto';

export type SessionRecord = {
    token: string;
    gameId: string;
    playerId: string;
    createdAt: number;
    lastSeen: number;
    expiresAt: number;
};

export type JoinSeat = 'seat1' | 'seat2';

export type JoinTokenRecord = {
    token: string;
    gameId: string;
    seat: JoinSeat;
    createdAt: number;
    expiresAt: number;
};

export type JoinTokenFailureReason = 'invalid' | 'expired' | 'game_mismatch';

export type JoinTokenValidationResult =
    | { ok: true; record: JoinTokenRecord }
    | { ok: false; reason: JoinTokenFailureReason };

const readEnvSeconds = (name: string, fallbackSeconds: number): number => {
    const raw = process.env[name];
    if (!raw) {
        return fallbackSeconds;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallbackSeconds;
    }
    return parsed;
};

const SESSION_TTL_MS = readEnvSeconds('SESSION_TTL_SECONDS', 1800) * 1000;
const JOIN_TOKEN_TTL_MS = readEnvSeconds('JOIN_TOKEN_TTL_SECONDS', 3600) * 1000;

class SessionManager {
    private sessionsByToken = new Map<string, SessionRecord>();
    private sessionTokenByKey = new Map<string, string>();
    private joinTokensByToken = new Map<string, JoinTokenRecord>();

    private buildSessionKey(gameId: string, playerId: string): string {
        return `${gameId}::${playerId}`;
    }

    private generateToken(prefix: string): string {
        return `${prefix}_${crypto.randomBytes(32).toString('hex')}`;
    }

    private isExpired(expiresAt: number): boolean {
        return Date.now() > expiresAt;
    }

    private cleanupExpiredSessions(): void {
        for (const [token, session] of this.sessionsByToken.entries()) {
            if (this.isExpired(session.expiresAt)) {
                this.invalidateSession(token);
            }
        }
    }

    private cleanupExpiredJoinTokens(): void {
        for (const [token, joinToken] of this.joinTokensByToken.entries()) {
            if (this.isExpired(joinToken.expiresAt)) {
                this.joinTokensByToken.delete(token);
            }
        }
    }

    createSession(gameId: string, playerId: string): SessionRecord {
        this.cleanupExpiredSessions();
        const sessionKey = this.buildSessionKey(gameId, playerId);
        const existingToken = this.sessionTokenByKey.get(sessionKey);
        if (existingToken) {
            this.invalidateSession(existingToken);
        }

        const now = Date.now();
        const token = this.generateToken('session');
        const session: SessionRecord = {
            token,
            gameId,
            playerId,
            createdAt: now,
            lastSeen: now,
            expiresAt: now + SESSION_TTL_MS
        };

        this.sessionsByToken.set(token, session);
        this.sessionTokenByKey.set(sessionKey, token);
        return session;
    }

    validateSession(token: string): SessionRecord | null {
        this.cleanupExpiredSessions();
        const session = this.sessionsByToken.get(token);
        if (!session) {
            return null;
        }
        if (this.isExpired(session.expiresAt)) {
            this.invalidateSession(token);
            return null;
        }
        return session;
    }

    touchSession(token: string): SessionRecord | null {
        const session = this.validateSession(token);
        if (!session) {
            return null;
        }
        const now = Date.now();
        session.lastSeen = now;
        session.expiresAt = now + SESSION_TTL_MS;
        this.sessionsByToken.set(token, session);
        return session;
    }

    invalidateSession(token: string): void {
        const session = this.sessionsByToken.get(token);
        if (session) {
            const sessionKey = this.buildSessionKey(session.gameId, session.playerId);
            this.sessionTokenByKey.delete(sessionKey);
        }
        this.sessionsByToken.delete(token);
    }

    createJoinToken(gameId: string, seat: JoinSeat): JoinTokenRecord {
        this.cleanupExpiredJoinTokens();
        const now = Date.now();
        const token = this.generateToken('join');
        const record: JoinTokenRecord = {
            token,
            gameId,
            seat,
            createdAt: now,
            expiresAt: now + JOIN_TOKEN_TTL_MS
        };
        this.joinTokensByToken.set(token, record);
        return record;
    }

    validateJoinToken(gameId: string, token: string): JoinTokenValidationResult {
        this.cleanupExpiredJoinTokens();
        const record = this.joinTokensByToken.get(token);
        if (!record) {
            return { ok: false, reason: 'invalid' };
        }
        if (record.gameId !== gameId) {
            return { ok: false, reason: 'game_mismatch' };
        }
        if (this.isExpired(record.expiresAt)) {
            this.joinTokensByToken.delete(token);
            return { ok: false, reason: 'expired' };
        }
        return { ok: true, record };
    }

    consumeJoinToken(gameId: string, token: string): JoinTokenRecord | null {
        const validation = this.validateJoinToken(gameId, token);
        if (!validation.ok) return null;
        const record = validation.record;
        this.joinTokensByToken.delete(token);
        return record;
    }

    invalidateJoinTokensForGame(gameId: string): void {
        for (const [token, record] of this.joinTokensByToken.entries()) {
            if (record.gameId === gameId) {
                this.joinTokensByToken.delete(token);
            }
        }
    }
}

export const sessionManager = new SessionManager();
