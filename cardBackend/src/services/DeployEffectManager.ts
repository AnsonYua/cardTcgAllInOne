// src/services/DeployEffectManager.ts
// Deploy effect processing system for ENTERS_PLAY triggered effects

import { GameEnvironment } from '../models/GameEnvironment';
import { EventType } from '../models/GameEnums';

/**
 * DeployEffectManager handles Deploy (ENTERS_PLAY) effect processing
 * Supports both automatic and player-interactive Deploy effects
 */
export class DeployEffectManager {
    
    /**
     * Process Deploy effect triggered by card entering play
     */
    static processDeployEffect(gameEnv: GameEnvironment, eventData: any): any {
        console.log(`🚀 Processing Deploy effects for card ${eventData.cardId} (${eventData.cardUID})`);
        console.log(`📋 Effects to process: ${eventData.effects.length}`);
        
        let processedEffects = 0;
        let pendingSelections = [];
        
        try {
            // Process each Deploy effect
            for (const effect of eventData.effects) {
                console.log(`⚡ Processing Deploy effect: ${effect.effectId || 'unnamed'} (${effect.effect?.action})`);
                
                const result = this.processIndividualEffect(gameEnv, eventData, effect);
                
                if (result.requiresSelection) {
                    pendingSelections.push(result.selection);
                    console.log(`🎯 Deploy effect requires player selection: ${result.selection.selectionId}`);
                } else if (result.success) {
                    processedEffects++;
                    console.log(`✅ Deploy effect processed successfully`);
                } else {
                    console.log(`❌ Deploy effect failed: ${result.error}`);
                }
            }
            
            // If we have pending selections, set up card selection workflow
            if (pendingSelections.length > 0) {
                this.setupCardSelectionWorkflow(gameEnv, pendingSelections);
                return {
                    success: true,
                    requiresSelection: true,
                    message: `Deploy effects triggered, ${pendingSelections.length} require player selection`
                };
            }
            
            return {
                success: true,
                processedEffects,
                message: `Deploy effects completed: ${processedEffects} automatic effects processed`
            };
            
        } catch (error) {
            console.error(`❌ Error processing Deploy effects:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Deploy effect processing failed'
            };
        }
    }
    
    /**
     * Process individual Deploy effect based on type
     */
    private static processIndividualEffect(gameEnv: GameEnvironment, eventData: any, effect: any): any {
        const { action } = effect.effect;
        const { playerId } = eventData;
        
        console.log(`🔧 Processing Deploy effect action: ${action} for player ${playerId}`);
        
        switch (action) {
            case 'rest':
                return this.processRestEffect(gameEnv, playerId, effect);
                
            case 'addToHand':
                return this.processAddToHandEffect(gameEnv, playerId, effect);
                
            default:
                console.log(`⚠️ Unknown Deploy effect action: ${action}`);
                return {
                    success: false,
                    error: `Unknown Deploy effect action: ${action}`
                };
        }
    }
    
    /**
     * Process rest effect (tap/exhaust target units)
     * Handles: "action": "rest" for low HP opponent units
     */
    private static processRestEffect(gameEnv: GameEnvironment, playerId: string, effect: any): any {
        console.log(`😴 Processing rest effect for player ${playerId}`);
        
        // Placeholder for rest effect logic
        // TODO: Find opponent units with HP <= 2 and set them to rested state
        
        return {
            success: true,
            message: 'Rest effect processed (placeholder)'
        };
    }
    
    /**
     * Process add to hand effect (move shield cards to hand)
     * Handles: "action": "addToHand" with "from": "shield"
     */
    private static processAddToHandEffect(gameEnv: GameEnvironment, playerId: string, effect: any): any {
        console.log(`🃏 Processing add to hand effect for player ${playerId}`);
        
        // Placeholder for add to hand logic
        // TODO: Move specified number of cards from shield area to hand
        
        return {
            success: true,
            message: 'Add to hand effect processed (placeholder)'
        };
    }
    
    /**
     * Setup card selection workflow for Deploy effects requiring player choice
     */
    private static setupCardSelectionWorkflow(gameEnv: GameEnvironment, pendingSelections: any[]): void {
        // Add each selection to pending card selections
        for (const selection of pendingSelections) {
            if (!gameEnv.pendingCardSelections) {
                gameEnv.pendingCardSelections = {};
            }
            
            gameEnv.pendingCardSelections[selection.selectionId] = selection;
            console.log(`🎯 Added Deploy card selection: ${selection.selectionId}`);
        }
    }
}