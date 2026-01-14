// src/services/LobbyManager.ts

import * as fs from 'fs';
import * as path from 'path';

export interface LobbyRoom {
    gameId: string;
    createdAt: string;
}

export class LobbyManager {
    private roomsPath: string;
    private expiryMs: number;
    private gameDataPath: string;

    constructor() {
        this.gameDataPath = path.join(__dirname, '../gameData');
        this.roomsPath = path.join(this.gameDataPath, 'rooms.json');
        this.expiryMs = 60 * 1000;
    }

    async addRoom(gameId: string): Promise<LobbyRoom> {
        const rooms = await this.loadRooms();
        const room: LobbyRoom = {
            gameId,
            createdAt: new Date().toISOString()
        };
        rooms.push(room);
        await this.saveRooms(rooms);
        return room;
    }

    async pruneExpiredRooms(nowMs: number = Date.now()): Promise<LobbyRoom[]> {
        const rooms = await this.loadRooms();
        const expiredRooms: LobbyRoom[] = [];
        const filteredRooms = rooms.filter((room) => {
            const createdAtMs = Date.parse(room.createdAt);
            if (Number.isNaN(createdAtMs)) {
                expiredRooms.push(room);
                return false;
            }
            const isExpired = nowMs - createdAtMs > this.expiryMs;
            if (isExpired) {
                expiredRooms.push(room);
            }
            return !isExpired;
        });
        if (filteredRooms.length !== rooms.length) {
            await this.removeExpiredGameFiles(expiredRooms);
            await this.saveRooms(filteredRooms);
        }
        return filteredRooms;
    }

    private async loadRooms(): Promise<LobbyRoom[]> {
        try {
            const content = await fs.promises.readFile(this.roomsPath, 'utf8');
            const parsed = JSON.parse(content);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed.filter((room) => room && typeof room.gameId === 'string' && typeof room.createdAt === 'string');
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
