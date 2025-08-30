// src/models/GameEnums.ts
// Game enumerations for custom trading card game

export enum GamePhase {
    WAITING_FOR_PLAYERS = 'WAITING_FOR_PLAYERS',
    BOTH_JOINED = 'BOTH_JOINED',
    READY_PHASE = 'READY_PHASE',
    START_REDRAW = 'START_REDRAW',
    REDRAW_PHASE = 'REDRAW_PHASE',
    DRAW_PHASE = 'DRAW_PHASE',
    RESOURCE_PHASE = 'RESOURCE_PHASE',
    MAIN_PHASE = 'MAIN_PHASE',
    ATTACK_PHASE = 'ATTACK_PHASE',
    BLOCK_PHASE = 'BLOCK_PHASE',
    DAMAGE_PHASE = 'DAMAGE_PHASE',
    END_PHASE = 'END_PHASE'
}

export enum ZoneType {
    SLOT1 = 'slot1',
    SLOT2 = 'slot2',
    SLOT3 = 'slot3',
    SLOT4 = 'slot4',
    SLOT5 = 'slot5',
    SLOT6 = 'slot6',
    BASE = 'base',
    SHIELD = 'shield',
    ENERGY = 'energy',
    TRASH = 'trash'
}

export enum PlayerActionType {
    START_GAME = 'START_GAME',
    JOIN_GAME = 'JOIN_GAME',
    PLAY_CARD = 'PLAY_CARD',
    PHASE_ADVANCE = 'PHASE_ADVANCE',
    TAP_ENERGY = 'TAP_ENERGY',
    RESOLVE_CHOICE = 'RESOLVE_CHOICE'
}