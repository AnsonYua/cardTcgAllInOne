// src/models/GameEnums.ts
// Game enumerations for custom trading card game

export enum GamePhase {
    WAITING_FOR_PLAYERS = 'WAITING_FOR_PLAYERS',
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
    CREATE_GAME = 'CREATE_GAME',
    JOIN_GAME = 'JOIN_GAME',
    CONFIRM_REDRAW = 'CONFIRM_REDRAW',
    PLAY_CARD = 'PLAY_CARD',
    PHASE_ADVANCE = 'PHASE_ADVANCE',
    TAP_ENERGY = 'TAP_ENERGY',
    RESOLVE_CHOICE = 'RESOLVE_CHOICE',
    END_TURN = 'END_TURN',
    ACKNOWLEDGE_EVENTS = 'ACKNOWLEDGE_EVENTS'
}

export enum EventType {
    // Core game events
    CREATE_GAME = PlayerActionType.CREATE_GAME,
    JOIN_GAME = PlayerActionType.JOIN_GAME,
    CONFIRM_REDRAW = PlayerActionType.CONFIRM_REDRAW,
    GAMEPLAY_BEGINS = 'GAMEPLAY_BEGINS',
    
    // Card events
    CARD_PLAYED = 'CARD_PLAYED',
    CARD_EFFECT_TRIGGERED = 'CARD_EFFECT_TRIGGERED',
    
    // Player events
    PLAYER_CHOICE_REQUIRED = 'PLAYER_CHOICE_REQUIRED',
    PLAYER_CHOICE_RESOLVED = 'PLAYER_CHOICE_RESOLVED',
    
    // Phase events
    PHASE_ADVANCE = 'PHASE_ADVANCE',
    TURN_CHANGE = 'TURN_CHANGE',
    
    // Resource events
    RESOURCE_GAINED = 'RESOURCE_GAINED',
    ENERGY_TAPPED = 'ENERGY_TAPPED',
    
    // Error events
    ERROR_OCCURRED = 'ERROR_OCCURRED',
    VALIDATION_FAILED = 'VALIDATION_FAILED',
    
    // State-based events
    STATE_BASED_ACTION = 'STATE_BASED_ACTION',
    FORCE_DISCARD = 'FORCE_DISCARD',
    
    // Turn management events
    END_TURN = 'END_TURN',
    CARDS_UNREST = 'CARDS_UNREST',
    
    // Event management events
    ACKNOWLEDGE_EVENTS = 'ACKNOWLEDGE_EVENTS'
}