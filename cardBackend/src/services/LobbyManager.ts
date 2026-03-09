// src/services/LobbyManager.ts

import * as fs from 'fs';
import * as path from 'path';

export interface LobbyRoom {
    gameId: string;
    createdAt: string;
    joinToken?: string | null;
}

interface RoomMetadata {
    playerCount: number;
    lastUpdatedMs: number;
}

export class LobbyManager {
    private roomsPath: string;
    private soloExpiryMs: number;
    private activeExpiryMs: number;
    private gameDataPath: string;

    constructor() {
        this.gameDataPath = path.join(__dirname, '../gameData');
        this.roomsPath = path.join(this.gameDataPath, 'rooms.json');
        this.soloExpiryMs = this.parseExpiryMs(process.env.LOBBY_SOLO_EXPIRY_MS, 60 * 1000);
        this.activeExpiryMs = this.parseExpiryMs(process.env.LOBBY_ACTIVE_EXPIRY_MS, 30 * 60 * 1000);
    }

    private parseExpiryMs(rawValue: string | undefined, fallbackMs: number): number {
        if (!rawValue) {
            return fallbackMs;
        }
        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed) || parsed < 0) {
            return fallbackMs;
        }
        return parsed;
    }

    async addRoom(gameId: string, opts: { joinToken?: string | null } = {}): Promise<LobbyRoom> {
        const rooms = await this.loadRooms();
        const room: LobbyRoom = {
            gameId,
            createdAt: new Date().toISOString(),
            joinToken: typeof opts.joinToken === 'string' ? opts.joinToken : null
        };
        rooms.push(room);
        await this.saveRooms(rooms);
        return room;
    }

    async pruneExpiredRooms(nowMs: number = Date.now()): Promise<LobbyRoom[]> {
        const rooms = await this.loadRooms();
        const expiredRooms: LobbyRoom[] = [];
        const filteredRooms: LobbyRoom[] = [];

        for (const room of rooms) {
            const createdAtMs = Date.parse(room.createdAt);
            if (Number.isNaN(createdAtMs)) {
                expiredRooms.push(room);
                continue;
            }

            const metadata = await this.getRoomMetadata(room.gameId);
            if (!metadata) {
                expiredRooms.push(room);
                continue;
            }

            const isExpired = metadata.playerCount < 2
                ? nowMs - createdAtMs > this.soloExpiryMs
                : nowMs - metadata.lastUpdatedMs > this.activeExpiryMs;

            if (isExpired) {
                expiredRooms.push(room);
                continue;
            }

            filteredRooms.push(room);
        }

        if (filteredRooms.length !== rooms.length) {
            await this.removeExpiredGameFiles(expiredRooms);
            await this.saveRooms(filteredRooms);
        }
        return filteredRooms;
    }

    async removeRoom(gameId: string): Promise<boolean> {
        const rooms = await this.loadRooms();
        const filteredRooms = rooms.filter((room) => room.gameId !== gameId);

        if (filteredRooms.length === rooms.length) {
            return false;
        }

        await this.saveRooms(filteredRooms);
        return true;
    }

    private async getRoomMetadata(gameId: string): Promise<RoomMetadata | null> {
        const gamePath = path.join(this.gameDataPath, `${gameId}.json`);
        try {
            const stats = await fs.promises.stat(gamePath);
            const fileContent = await fs.promises.readFile(gamePath, 'utf8');
            const parsed = JSON.parse(fileContent);

            let playerCount = 0;
            if (typeof parsed?.playerId_1 === 'string' && parsed.playerId_1.length > 0) {
                playerCount += 1;
            }
            if (typeof parsed?.playerId_2 === 'string' && parsed.playerId_2.length > 0) {
                playerCount += 1;
            }

            if (playerCount === 0 && parsed && typeof parsed === 'object' && parsed.players && typeof parsed.players === 'object') {
                playerCount = Object.keys(parsed.players).filter((key) => Boolean(key)).length;
            }

            return {
                playerCount,
                lastUpdatedMs: stats.mtimeMs
            };
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return null;
            }
            console.warn(`⚠️ Failed to read room metadata for ${gameId}: ${error instanceof Error ? error.message : 'unknown error'}`);
            return null;
        }
    }

    private async loadRooms(): Promise<LobbyRoom[]> {
        try {
            const content = await fs.promises.readFile(this.roomsPath, 'utf8');
            const parsed = JSON.parse(content);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed
                .filter((room) => room && typeof room.gameId === 'string' && typeof room.createdAt === 'string')
                .map((room) => ({
                    gameId: room.gameId,
                    createdAt: room.createdAt,
                    joinToken: typeof room.joinToken === 'string' ? room.joinToken : null
                }));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    private async saveRooms(rooms: LobbyRoom[]): Promise<void> {
        await fs.promises.writeFile(this.roomsPath, JSON.stringify(rooms, null, 2));
    }

    private async removeExpiredGameFiles(expiredRooms: LobbyRoom[]): Promise<void> {
        await Promise.all(expiredRooms.map((room) => this.removeGameFile(room.gameId)));
    }

    private async removeGameFile(gameId: string): Promise<void> {
        const gamePath = path.join(this.gameDataPath, `${gameId}.json`);
        try {
            await fs.promises.unlink(gamePath);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
    }
}

export const lobbyManager = new LobbyManager();
