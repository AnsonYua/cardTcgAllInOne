// src/services/DeployTargetResult.ts

import type { TargetReference } from './EventQueue/interfaces/GameEvent';

export type DeployTargetFailureKind =
    | 'NO_TARGETS_REQUIRED'
    | 'EXECUTION_ERROR'
    | 'VALIDATION_ERROR';

export interface DeployTargetResult {
    success: boolean;
    error?: string;
    failureKind?: DeployTargetFailureKind;
    requiresSelection?: boolean;    // true if TARGET_CHOICE event created
    choiceEventId?: string;         // populated when requiresSelection is true
    autoApplied?: boolean;          // true if effect auto-applied (single target)
    affectedTargets?: TargetReference[];
}
