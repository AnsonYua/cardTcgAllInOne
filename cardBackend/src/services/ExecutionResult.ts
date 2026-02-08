// src/services/ExecutionResult.ts
// Shared execution result interface for service managers

export interface ExecutionResult {
    success: boolean;
    error?: string;
    errorCode?: string;
    acknowledgedCount?: number;
    requiresSelection?: boolean;
}
