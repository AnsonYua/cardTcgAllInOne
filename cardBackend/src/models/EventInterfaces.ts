// src/models/EventInterfaces.ts
// Event system interfaces - separated to avoid circular dependencies

export interface ProcessingResult {
    success: boolean;
    eventsProcessed: number;
    needsPlayerInput: boolean;
    waitingForChoice?: string;
    error?: string;
}

export interface ValidationResult {
    isValid: boolean;
    reason?: string;
    warnings?: string[];
}

export interface PlayerAction {
    type: string;
    playerId: string;
    cardId?: string;
    carduid?: string;
    zone?: string;
    targetPhase?: any; // GamePhase
    [key: string]: any;
}