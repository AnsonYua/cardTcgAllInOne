// src/models/PlaySequence.ts
// Play sequence management for custom trading card game

import { ActionType, ZoneType } from './GameEnums';

// ============ INTERFACES ============

export interface PlaySequenceAction {
    sequenceId: number;
    playerId: string;
    /** Unique card instance identifier (e.g., "c-43_player1_001") - NOT base card ID */
    cardUid: string;
    action: ActionType;
    zone: ZoneType;
    effectData?: any;
    /** Turn number when this action was performed - for turn completion tracking */
    turnNumber?: number;
}

export interface PlaySequence {
    globalSequence: number;
    plays: PlaySequenceAction[];
}

// ============ PLAY SEQUENCE MANAGER ============

export class PlaySequenceManager {
    private sequence: PlaySequence;
    private gameEnv?: any; // Reference to parent GameEnvironment for auto-injection

    constructor(gameEnv?: any) {
        this.sequence = {
            globalSequence: 0,
            plays: []
        };
        this.gameEnv = gameEnv;
    }

    /**
     * Add a play action to the sequence
     * @param playerId - ID of the player making the play
     * @param cardUid - Unique card instance identifier (e.g., "c-43_player1_001")
     * @param action - Type of action being performed
     * @param zone - Zone where the card is being played
     * @param effectData - Additional effect data (optional)
     * @param turnNumber - Turn number when this action was performed (optional)
     * @returns The created PlaySequenceAction
     */
    public addPlay(playerId: string, cardUid: string, action: ActionType, zone: ZoneType, effectData?: any, turnNumber?: number): PlaySequenceAction {
        this.sequence.globalSequence++;
        
        const play: PlaySequenceAction = {
            sequenceId: this.sequence.globalSequence,
            playerId,
            cardUid,
            action,
            zone,
            ...(effectData && { effectData }),
            ...(turnNumber !== undefined && { turnNumber })
        };
        
        this.sequence.plays.push(play);
        return play;
    }

    public getPlays(): PlaySequenceAction[] {
        return [...this.sequence.plays];
    }

    public getGlobalSequence(): number {
        return this.sequence.globalSequence;
    }

    public getNextSequenceId(): number {
        return this.sequence.globalSequence + 1;
    }

    public recordAction(action: PlaySequenceAction): void {
        // Auto-inject turnNumber if not provided and gameEnv is available
        if (action.turnNumber === undefined && this.gameEnv) {
            console.log(`🔧 Auto-injecting turnNumber ${this.gameEnv.currentTurn} for action ${action.sequenceId}`);
            action.turnNumber = this.gameEnv.currentTurn;
        }
        
        this.sequence.globalSequence = action.sequenceId;
        this.sequence.plays.push(action);
    }

    public clearSequence(): void {
        this.sequence = {
            globalSequence: 0,
            plays: []
        };
    }

    // ============ SERIALIZATION ============

    public toJSON(): any {
        return this.sequence;
    }

    public static fromJSON(data: any): PlaySequenceManager {
        const manager = new PlaySequenceManager();
        manager.sequence = data || { globalSequence: 0, plays: [] };
        return manager;
    }
}