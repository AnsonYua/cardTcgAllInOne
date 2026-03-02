// src/models/GameEnums.ts
// Game enumerations for custom trading card game

export enum GamePhase {
    WAITING_FOR_PLAYERS = 'WAITING_FOR_PLAYERS',
    DECIDE_FIRST_PLAYER_PHASE = 'DECIDE_FIRST_PLAYER_PHASE',
    REDRAW_PHASE = 'REDRAW_PHASE',
    DRAW_PHASE = 'DRAW_PHASE',
    RESOURCE_PHASE = 'RESOURCE_PHASE',
    MAIN_PHASE = 'MAIN_PHASE',
    BLOCKER_PHASE = 'BLOCKER_PHASE',
    ACTION_STEP_PHASE = 'ACTION_STEP_PHASE',
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

export enum CardPlayType {
    UNIT = 'unit',
    COMMAND = 'command',
    PILOT = 'pilot',
    BASE = 'base'
}

export enum PlayerActionType {
    CREATE_GAME = 'CREATE_GAME',
    JOIN_GAME = 'JOIN_GAME',
    CHOOSE_FIRST_PLAYER = 'CHOOSE_FIRST_PLAYER',
    CONFIRM_REDRAW = 'CONFIRM_REDRAW',
    RESOLVE_CHOICE = 'RESOLVE_CHOICE',
    END_TURN = 'END_TURN',
    ACKNOWLEDGE_EVENTS = 'ACKNOWLEDGE_EVENTS',
    PLAY_CARD = 'PLAY_CARD',
    PLAYER_ACTION = 'PLAYER_ACTION'
}

export enum EventType {
    // Core game events
    CREATE_GAME = PlayerActionType.CREATE_GAME,
    JOIN_GAME = PlayerActionType.JOIN_GAME,
    CHOOSE_FIRST_PLAYER = PlayerActionType.CHOOSE_FIRST_PLAYER,
    CONFIRM_REDRAW = PlayerActionType.CONFIRM_REDRAW,
    GAMEPLAY_BEGINS = 'GAMEPLAY_BEGINS',
    
    // Card events
    CARD_ENTERS_PLAY = 'CARD_ENTERS_PLAY',
    TRIGGER_HEALING = 'TRIGGER_HEALING',
    TRIGGER_END_OF_TURN_EFFECT = 'TRIGGER_END_OF_TURN_EFFECT',
    
    // Player events
    PLAYER_CHOICE_RESOLVED = 'PLAYER_CHOICE_RESOLVED',
    
    // Phase events
    PHASE_ADVANCE = 'PHASE_ADVANCE',
    TURN_CHANGE = 'TURN_CHANGE',
    
    // Resource events
    RESOURCE_GAINED = 'RESOURCE_GAINED',
    
    // Error events
    ERROR_OCCURRED = 'ERROR_OCCURRED',
    VALIDATION_FAILED = 'VALIDATION_FAILED',
    
    // State-based events
    STATE_BASED_ACTION = 'STATE_BASED_ACTION',
    FORCE_DISCARD = 'FORCE_DISCARD',
    
    // Turn management events
    END_TURN = 'END_TURN',
    NEXT_PLAYER_TURN = 'NEXT_PLAYER_TURN',
    
    // Player action events
    PLAY_CARD = PlayerActionType.PLAY_CARD,
    PLAYER_ACTION = PlayerActionType.PLAYER_ACTION,
    
    // Event management events
    ACKNOWLEDGE_EVENTS = 'ACKNOWLEDGE_EVENTS',
    
    // Shield attack events
    SHIELD_CARD_ATTACKED = 'SHIELD_CARD_ATTACKED',
    BURST_EFFECT_CHOICE = 'BURST_EFFECT_CHOICE',
    
    // Deploy effect events
    DEPLOY_EFFECT_TRIGGERED = 'DEPLOY_EFFECT_TRIGGERED',
    
    // Pairing effect events
    PAIRING_EFFECT_TRIGGERED = 'PAIRING_EFFECT_TRIGGERED',

    // Attack-phase effect events
    ATTACK_PHASE_EFFECT_TRIGGERED = 'ATTACK_PHASE_EFFECT_TRIGGERED',

    // Effect draw trigger events
    TRIGGER_EFFECT_DRAW = 'TRIGGER_EFFECT_DRAW',

    // EX resource trigger events
    TRIGGER_EX_RESOURCE_PLACED = 'TRIGGER_EX_RESOURCE_PLACED',

    // Shield/base battle damage trigger events
    TRIGGER_SHIELD_AREA_CARD_DAMAGED = 'TRIGGER_SHIELD_AREA_CARD_DAMAGED',

    // Unified target choice system
    TARGET_CHOICE = 'TARGET_CHOICE',
    
    // Blocker choice system
    BLOCKER_CHOICE = 'BLOCKER_CHOICE',

    // Token choice system
    TOKEN_CHOICE = 'TOKEN_CHOICE',

    // Generic option choice system
    OPTION_CHOICE = 'OPTION_CHOICE',

    // Generic prompt choice system (frontend-friendly prompts)
    PROMPT_CHOICE = 'PROMPT_CHOICE',

    // Action step maintenance
    ACTION_STEP_POST_PLAY = 'ACTION_STEP_POST_PLAY'
}
