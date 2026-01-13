// src/config/gameConstants.ts
// Common game constants and configuration

/**
 * Standard slot zones for player game boards
 * These are the 6 slots where unit/pilot cards can be placed
 */
export const SLOT_ZONES = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;

/**
 * Type definition for slot zone names
 */
export type SlotZone = typeof SLOT_ZONES[number];

/**
 * Other zone types in the game
 */
export const ZONE_TYPES = {
    BASE: 'base',
    SHIELD_AREA: 'shieldArea',
    ENERGY_AREA: 'energyArea',
    TRASH_AREA: 'trashArea',
    LEADER: 'leader'
} as const;

/**
 * Game phases
 */
export const GAME_PHASES = {
    WAITING_FOR_PLAYERS: 'WAITING_FOR_PLAYERS',
    BOTH_JOINED: 'BOTH_JOINED',
    DECIDE_FIRST_PLAYER_PHASE: 'DECIDE_FIRST_PLAYER_PHASE',
    REDRAW_PHASE: 'REDRAW_PHASE',
    DRAW_PHASE: 'DRAW_PHASE',
    MAIN_PHASE: 'MAIN_PHASE',
    SP_PHASE: 'SP_PHASE',
    BATTLE_PHASE: 'BATTLE_PHASE',
    END_PHASE: 'END_PHASE'
} as const;

/**
 * Effect types for continuous effects system
 */
export const CONTINUOUS_EFFECT_TYPES = {
    ALWAYS_ACTIVE: 'ALWAYS_ACTIVE',
    PAIR_TRIGGERED: 'PAIR_TRIGGERED',
    LINK_TRIGGERED: 'LINK_TRIGGERED'
} as const;
