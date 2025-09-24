// src/services/EventQueue/EffectStack.ts
// LIFO effect stack for proper TCG chain resolution

import { GameEvent, EventPriority } from './interfaces/GameEvent';
import { GameEnvironment } from '../../models/GameEnvironment';

// ============ EFFECT STACK INTERFACES ============

export interface ActivatedEffect {
    effectId: string;
    sourceCardId: string;
    sourceCarduid: string;
    abilityId: string;
    playerId: string;
    cost?: number;
    targets?: string[];
    effectData: any;
    canBeResponded: boolean;
    priority: EventPriority;
    timestamp: number;
}

export interface StackResolutionResult {
    success: boolean;
    effectsResolved: number;
    needsPlayerInput: boolean;
    waitingForResponse?: string;
    generatedEvents: GameEvent[];
}

export interface ResponseWindow {
    playerId: string;
    allowedResponses: string[];
    timeoutMs?: number;
    isOptional: boolean;
}

// ============ EFFECT STACK CLASS ============

export class EffectStack {
    private stack: ActivatedEffect[] = [];
    private currentlyResolving?: ActivatedEffect;
    private responseWindow?: ResponseWindow;
    private gameEnv: GameEnvironment;
    
    constructor(gameEnv: GameEnvironment) {
        this.gameEnv = gameEnv;
        console.log('⚡ EffectStack initialized');
    }
    
    // ============ STACK MANAGEMENT ============
    
    /**
     * Add effect to top of stack (LIFO)
     */
    push(effect: ActivatedEffect): void {
        this.stack.push(effect);
        console.log(`⚡ Effect added to stack: ${effect.abilityId} (stack size: ${this.stack.length})`);
    }
    
    /**
     * Remove and return top effect from stack
     */
    pop(): ActivatedEffect | undefined {
        const effect = this.stack.pop();
        if (effect) {
            console.log(`⚡ Effect popped from stack: ${effect.abilityId} (remaining: ${this.stack.length})`);
        }
        return effect;
    }
    
    /**
     * Peek at top effect without removing
     */
    peek(): ActivatedEffect | undefined {
        return this.stack.length > 0 ? this.stack[this.stack.length - 1] : undefined;
    }
    
    /**
     * Check if stack is empty
     */
    isEmpty(): boolean {
        return this.stack.length === 0;
    }
    
    /**
     * Get stack size
     */
    size(): number {
        return this.stack.length;
    }
    
    /**
     * Clear entire stack (emergency reset)
     */
    clear(): void {
        this.stack = [];
        this.currentlyResolving = undefined;
        this.responseWindow = undefined;
        console.log('🧹 Effect stack cleared');
    }
    
    // ============ RESOLUTION CONTROL ============
    
    /**
     * Check if new effects can be added to stack
     */
    canAddToStack(): boolean {
        // Can't add during response window unless it's a valid response
        if (this.responseWindow) {
            return false;
        }
        
        // Can't add while an effect is resolving
        if (this.currentlyResolving) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Start resolution of next effect on stack
     */
    resolveNext(): StackResolutionResult {
        if (this.isEmpty()) {
            return {
                success: true,
                effectsResolved: 0,
                needsPlayerInput: false,
                generatedEvents: []
            };
        }
        
        const effect = this.pop();
        if (!effect) {
            return {
                success: false,
                effectsResolved: 0,
                needsPlayerInput: false,
                generatedEvents: []
            };
        }
        
        this.currentlyResolving = effect;
        console.log(`⚡ Resolving effect: ${effect.abilityId}`);
        
        // Check for response window
        if (effect.canBeResponded && this.hasOpponentResponses(effect)) {
            this.openResponseWindow(effect);
            return {
                success: true,
                effectsResolved: 0,
                needsPlayerInput: true,
                waitingForResponse: this.responseWindow?.playerId,
                generatedEvents: []
            };
        }
        
        // Resolve effect immediately
        const resolutionEvents = this.executeEffect(effect);
        this.currentlyResolving = undefined;
        
        return {
            success: true,
            effectsResolved: 1,
            needsPlayerInput: false,
            generatedEvents: resolutionEvents
        };
    }
    
    /**
     * Resolve all effects on stack
     */
    resolveAll(): StackResolutionResult {
        const allGeneratedEvents: GameEvent[] = [];
        let totalResolved = 0;
        
        while (!this.isEmpty() && !this.responseWindow) {
            const result = this.resolveNext();
            
            if (!result.success) {
                break;
            }
            
            totalResolved += result.effectsResolved;
            allGeneratedEvents.push(...result.generatedEvents);
            
            // Stop if waiting for player input
            if (result.needsPlayerInput) {
                return {
                    success: true,
                    effectsResolved: totalResolved,
                    needsPlayerInput: true,
                    waitingForResponse: result.waitingForResponse,
                    generatedEvents: allGeneratedEvents
                };
            }
        }
        
        return {
            success: true,
            effectsResolved: totalResolved,
            needsPlayerInput: false,
            generatedEvents: allGeneratedEvents
        };
    }
    
    // ============ RESPONSE SYSTEM ============
    
    /**
     * Open response window for opponent
     */
    private openResponseWindow(effect: ActivatedEffect): void {
        const opponentId = this.gameEnv.getOpponentId(effect.playerId);
        if (!opponentId) return;
        
        this.responseWindow = {
            playerId: opponentId,
            allowedResponses: this.getAllowedResponses(effect),
            isOptional: true,
            timeoutMs: 30000 // 30 second timeout
        };
        
        console.log(`🤔 Response window opened for ${opponentId} to respond to ${effect.abilityId}`);
    }
    
    /**
     * Close response window (player passed or responded)
     */
    closeResponseWindow(): void {
        if (this.responseWindow) {
            console.log(`🚪 Response window closed for ${this.responseWindow.playerId}`);
            this.responseWindow = undefined;
        }
    }
    
    /**
     * Handle player response to effect
     */
    handleResponse(playerId: string, responseType: string, responseData?: any): boolean {
        if (!this.responseWindow || this.responseWindow.playerId !== playerId) {
            return false;
        }
        
        if (!this.responseWindow.allowedResponses.includes(responseType)) {
            return false;
        }
        
        console.log(`📨 Response received: ${responseType} from ${playerId}`);
        
        // TODO: Process response and add response effects to stack
        this.processResponse(responseType, responseData);
        
        this.closeResponseWindow();
        return true;
    }
    
    // ============ EFFECT EXECUTION ============
    
    /**
     * Execute an effect and return generated events
     */
    private executeEffect(effect: ActivatedEffect): GameEvent[] {
        const generatedEvents: GameEvent[] = [];
        
        console.log(`🔥 Executing effect: ${effect.abilityId}`);
        
        // TODO: Integrate with your existing card effect system
        // This should apply the effect to the game state and generate appropriate events
        
        switch (effect.effectData.type) {
            case 'POWER_BOOST':
                generatedEvents.push(...this.executePowerBoost(effect));
                break;
                
            case 'CARD_DESTRUCTION':
                generatedEvents.push(...this.executeCardDestruction(effect));
                break;
                
            case 'CARD_SEARCH':
                generatedEvents.push(...this.executeCardSearch(effect));
                break;
                
            case 'ZONE_MOVE':
                generatedEvents.push(...this.executeZoneMove(effect));
                break;
                
            default:
                console.warn(`⚠️ Unknown effect type: ${effect.effectData.type}`);
        }
        
        return generatedEvents;
    }
    
    // ============ SPECIFIC EFFECT IMPLEMENTATIONS ============
    
    private executePowerBoost(effect: ActivatedEffect): GameEvent[] {
        // TODO: Integrate with your power modification system
        console.log(`⚡ Executing power boost: +${effect.effectData.value}`);
        return [];
    }
    
    private executeCardDestruction(effect: ActivatedEffect): GameEvent[] {
        // TODO: Integrate with your card destruction logic
        console.log(`💥 Executing card destruction: ${effect.targets}`);
        return [];
    }
    
    private executeCardSearch(effect: ActivatedEffect): GameEvent[] {
        // TODO: Integrate with your card search system
        console.log(`🔍 Executing card search: ${effect.effectData.searchCriteria}`);
        return [];
    }
    
    private executeZoneMove(effect: ActivatedEffect): GameEvent[] {
        // TODO: Integrate with your zone movement system
        console.log(`📦 Executing zone move: ${effect.effectData.fromZone} → ${effect.effectData.toZone}`);
        return [];
    }
    
    // ============ HELPER METHODS ============
    
    private hasOpponentResponses(effect: ActivatedEffect): boolean {
        // TODO: Check if opponent has valid responses to this effect
        // - Counter abilities
        // - Interrupt effects
        // - Optional triggered abilities
        return false;
    }
    
    private getAllowedResponses(effect: ActivatedEffect): string[] {
        // TODO: Determine what responses are valid for this effect
        return ['PASS', 'COUNTER', 'INTERRUPT'];
    }
    
    private processResponse(responseType: string, responseData?: any): void {
        // TODO: Process player response and add response effects to stack
        console.log(`📨 Processing response: ${responseType}`);
    }
    
    // ============ SERIALIZATION ============
    
    /**
     * Serialize stack state
     */
    toJSON(): any {
        return {
            stack: this.stack,
            currentlyResolving: this.currentlyResolving,
            responseWindow: this.responseWindow
        };
    }
    
    /**
     * Restore stack from serialized state
     */
    static fromJSON(data: any, gameEnv: GameEnvironment): EffectStack {
        const stack = new EffectStack(gameEnv);
        stack.stack = data.stack || [];
        stack.currentlyResolving = data.currentlyResolving;
        stack.responseWindow = data.responseWindow;
        return stack;
    }
}