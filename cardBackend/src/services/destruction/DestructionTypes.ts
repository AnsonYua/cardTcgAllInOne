export type DestructionTiming = 'IMMEDIATE' | 'AFTER_BATTLE_RESOLVED';

export type DestructionCause =
    | 'BATTLE_DAMAGE'
    | 'EFFECT_DAMAGE'
    | 'EFFECT_DESTROY'
    | 'COST_DESTROY'
    | 'RULE_DESTROY';

export interface PendingDestruction {
    playerId: string;
    slotName: string;
    unitCarduid: string;
    timing: DestructionTiming;
    cause: DestructionCause;
    battleContextId?: string;
    orderKey: number;
}

export interface DestructionRequest {
    unitCarduid: string;
    timing: DestructionTiming;
    cause: DestructionCause;
    battleContextId?: string;
    orderKey?: number;
    allowNonLethal?: boolean;
}
