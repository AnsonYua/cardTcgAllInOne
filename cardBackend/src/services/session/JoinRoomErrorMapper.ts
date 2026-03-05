import type { JoinTokenFailureReason } from '../SessionManager';
import { ErrorCodes } from '../../constants/ErrorCodes';

export const mapJoinTokenFailureReason = (reason: JoinTokenFailureReason): string => {
    if (reason === 'expired') {
        return ErrorCodes.JOIN_TOKEN_EXPIRED;
    }
    return ErrorCodes.JOIN_TOKEN_INVALID;
};

export const mapJoinFailure = (errorMessage: string): { status: number; errorCode: string; error: string } => {
    const normalized = errorMessage.toLowerCase();
    if (normalized.includes('game not found')) {
        return {
            status: 404,
            errorCode: ErrorCodes.ROOM_NOT_FOUND,
            error: 'Game not found'
        };
    }
    if (normalized.includes('game is full')) {
        return {
            status: 409,
            errorCode: ErrorCodes.ROOM_FULL,
            error: 'Game is full'
        };
    }
    if (normalized.includes('room is not available for joining')) {
        return {
            status: 409,
            errorCode: ErrorCodes.MATCH_ALREADY_STARTED,
            error: 'Room is not available for joining'
        };
    }
    return {
        status: 400,
        errorCode: ErrorCodes.INTERNAL_ERROR,
        error: errorMessage
    };
};
