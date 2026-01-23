// src/models/DelayedTrigger.ts

export interface DelayedTriggerSpec {
    type: 'BATTLE_DESTROY';
    attackerController?: 'self';
    attackerTraitsAny?: string[];
}

export interface DelayedTriggerThenStep {
    action: string;
    target?: Record<string, unknown>;
    timing?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
}

export interface DelayedTrigger {
    id: string;
    ownerPlayerId: string;
    sourceCarduid: string;
    createdTurn: number;
    expiresTurn: number;
    trigger: DelayedTriggerSpec;
    then: DelayedTriggerThenStep[];
}

