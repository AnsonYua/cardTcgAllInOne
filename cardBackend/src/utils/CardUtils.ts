// src/utils/CardUtils.ts
// Core utility functions for card operations and ID handling

/**
 * Extract cardId from carduid using split operation
 * carduid format: "cardId_timestamp_uniqueId"
 * Returns the base cardId (first part before underscore)
 */
export function getCardIdFromUid(carduid: string): string {
    if (!carduid) {
        console.warn('getCardIdFromUid: Empty or null carduid provided');
        return '';
    }
    
    const parts = carduid.split('_');
    if (parts.length === 0) {
        console.warn(`getCardIdFromUid: Invalid carduid format: ${carduid}`);
        return carduid; // Return original if no underscore found
    }
    
    return parts[0];
}

export type CardUidLike = string | { carduid?: unknown } | null | undefined;

/**
 * Normalize mixed carduid shapes to a usable string.
 * Accepts plain string carduid or object-like entries containing a carduid field.
 */
export function normalizeCarduid(input: CardUidLike): string | undefined {
    if (typeof input === 'string') {
        return input.length > 0 ? input : undefined;
    }

    if (input && typeof input === 'object') {
        const value = (input as { carduid?: unknown }).carduid;
        if (typeof value === 'string' && value.length > 0) {
            return value;
        }
    }

    return undefined;
}

/**
 * Validate carduid format
 * Expected format: "cardId_timestamp_uniqueId"
 */
export function isValidCardUid(carduid: string): boolean {
    if (!carduid || typeof carduid !== 'string') {
        return false;
    }
    
    const parts = carduid.split('_');
    return parts.length >= 2; // At minimum cardId_something
}

/**
 * Extract timestamp from carduid if present
 */
export function getTimestampFromUid(carduid: string): number | null {
    if (!carduid) return null;
    
    const parts = carduid.split('_');
    if (parts.length < 2) return null;
    
    const timestamp = parseInt(parts[1], 10);
    return isNaN(timestamp) ? null : timestamp;
}

/**
 * Extract unique identifier from carduid if present
 */
export function getUniqueIdFromUid(carduid: string): string | null {
    if (!carduid) return null;
    
    const parts = carduid.split('_');
    if (parts.length < 3) return null;
    
    return parts[2];
}
