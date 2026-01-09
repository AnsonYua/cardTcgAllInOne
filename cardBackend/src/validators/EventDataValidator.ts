// src/validators/EventDataValidator.ts
// Runtime validation for event data structures

import { 
    StandardGameEvent, 
    ValidationResult,
    EventDataValidator as IEventDataValidator,
    isStandardGameEvent,
    isStandardEventData 
} from '../interfaces/StandardizedInterfaces';
import { isValidCardUid } from '../utils/CardUtils';

export class EventDataValidator implements IEventDataValidator {
    
    /**
     * Validate complete event structure
     */
    validateEvent(event: any): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Basic structure validation
        if (!event) {
            errors.push('Event is null or undefined');
            return { isValid: false, errors, warnings };
        }
        
        // Required fields
        if (!event.id || typeof event.id !== 'string') {
            errors.push('Event.id must be a non-empty string');
        }
        
        if (!event.type || typeof event.type !== 'string') {
            errors.push('Event.type must be a non-empty string');
        }
        
        if (!event.status || typeof event.status !== 'string') {
            errors.push('Event.status must be a non-empty string');
        }
        
        if (typeof event.priority !== 'number') {
            errors.push('Event.priority must be a number');
        }
        
        if (typeof event.timestamp !== 'number') {
            errors.push('Event.timestamp must be a number');
        }
        
        // Validate event data
        if (!event.data) {
            errors.push('Event.data is required');
        } else {
            const dataValidation = this.validateEventData(event.data);
            errors.push(...dataValidation.errors);
            warnings.push(...dataValidation.warnings);
        }
        
        // Type guard final check
        if (errors.length === 0 && !isStandardGameEvent(event)) {
            errors.push('Event does not conform to StandardGameEvent interface');
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    /**
     * Validate event data structure
     */
    validateEventData(data: any): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        if (!data) {
            errors.push('Event data is null or undefined');
            return { isValid: false, errors, warnings };
        }
        
        // Required fields
        if (!data.playerId || typeof data.playerId !== 'string') {
            errors.push('EventData.playerId must be a non-empty string');
        }
        
        if (!data.carduid || typeof data.carduid !== 'string') {
            errors.push('EventData.carduid must be a non-empty string');
        } else if (!isValidCardUid(data.carduid)) {
            errors.push(`EventData.carduid has invalid format: ${data.carduid}`);
        }
        
        // Validate parameters
        if (!data.parameters) {
            errors.push('EventData.parameters is required');
        } else {
            const paramValidation = this.validateParameters(data.parameters);
            errors.push(...paramValidation.errors);
            warnings.push(...paramValidation.warnings);
        }
        
        // Optional fields validation
        if (data.gameId && typeof data.gameId !== 'string') {
            warnings.push('EventData.gameId should be a string if provided');
        }
        
        if (data.targets && !Array.isArray(data.targets)) {
            warnings.push('EventData.targets should be an array if provided');
        }
        
        // Type guard final check
        if (errors.length === 0 && !isStandardEventData(data)) {
            errors.push('Event data does not conform to StandardEventData interface');
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    /**
     * Validate effect parameters
     */
    validateParameters(parameters: any): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        if (!parameters) {
            errors.push('Parameters object is required');
            return { isValid: false, errors, warnings };
        }
        
        // Required fields
        if (!parameters.action || typeof parameters.action !== 'string') {
            errors.push('Parameters.action must be a non-empty string');
        }
        
        if (typeof parameters.value !== 'number') {
            errors.push('Parameters.value must be a number');
        }
        
        // Optional field validation
        if (parameters.scope && typeof parameters.scope !== 'string') {
            warnings.push('Parameters.scope should be a string if provided');
        }
        
        if (parameters.duration && typeof parameters.duration !== 'string') {
            warnings.push('Parameters.duration should be a string if provided');
        }
        
        if (parameters.conditions && !Array.isArray(parameters.conditions)) {
            warnings.push('Parameters.conditions should be an array if provided');
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    /**
     * Validate and convert legacy event to standard format
     */
    convertLegacyEvent(legacyEvent: any): { event: StandardGameEvent | null, validation: ValidationResult } {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        if (!legacyEvent) {
            return {
                event: null,
                validation: { isValid: false, errors: ['Legacy event is null'], warnings }
            };
        }
        
        try {
            // Extract carduid and derive cardId if needed
            let carduid = legacyEvent.data?.carduid;
            if (!carduid && legacyEvent.data?.cardId) {
                warnings.push('Using cardId to construct carduid - this is a fallback behavior');
                carduid = legacyEvent.data.cardId; // Assume simple format if no uid
            }
            
            if (!carduid) {
                errors.push('No carduid or cardId found in legacy event');
                return { event: null, validation: { isValid: false, errors, warnings } };
            }
            
            // Convert to standard format
            const standardEvent: StandardGameEvent = {
                id: legacyEvent.id || `converted_${Date.now()}`,
                type: legacyEvent.type,
                status: legacyEvent.status,
                priority: legacyEvent.priority || 2, // Default to NORMAL
                timestamp: legacyEvent.timestamp || Date.now(),
                playerId: legacyEvent.playerId,
                data: {
                    playerId: legacyEvent.data?.playerId || legacyEvent.playerId,
                    gameId: legacyEvent.data?.gameId,
                    carduid: carduid,
                    parameters: {
                        action: legacyEvent.data?.action || 'unknown',
                        value: this.extractNumericValue(legacyEvent.data),
                        scope: legacyEvent.data?.scope,
                        duration: legacyEvent.data?.duration
                    },
                    targets: legacyEvent.data?.targets,
                    metadata: {
                        sourceCardName: legacyEvent.data?.cardName,
                        effectDescription: legacyEvent.data?.description
                    }
                }
            };
            
            // Validate converted event
            const validation = this.validateEvent(standardEvent);
            
            return {
                event: validation.isValid ? standardEvent : null,
                validation: {
                    isValid: validation.isValid,
                    errors: [...errors, ...validation.errors],
                    warnings: [...warnings, ...validation.warnings]
                }
            };
            
        } catch (error) {
            return {
                event: null,
                validation: { 
                    isValid: false, 
                    errors: [`Conversion failed: ${error}`], 
                    warnings 
                }
            };
        }
    }
    
    /**
     * Extract numeric value from legacy parameter formats
     */
    private extractNumericValue(data: any): number {
        if (!data) return 0;
        
        // Try different legacy parameter names
        if (typeof data.value === 'number') return data.value;
        if (typeof data.amount === 'number') return data.amount;
        if (typeof data.count === 'number') return data.count;
        
        // Handle string modifiers like "+1", "-2"
        if (typeof data.modifier === 'string') {
            const cleanValue = data.modifier.replace(/[^\d\-\+]/g, '');
            const parsed = parseInt(cleanValue, 10);
            return isNaN(parsed) ? 0 : parsed;
        }
        
        if (typeof data.modifier === 'number') return data.modifier;
        
        return 0;
    }
}

// Singleton instance for global use
export const eventDataValidator = new EventDataValidator();
