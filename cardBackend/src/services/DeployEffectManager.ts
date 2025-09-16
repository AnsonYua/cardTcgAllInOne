// src/services/DeployEffectManager.ts
// Deploy effect processing system for ENTERS_PLAY triggered effects

import { GameEnvironment } from '../models/GameEnvironment';
import { EventType } from '../models/GameEnums';
import { CardEffect, EffectResult } from './CardEffect';

/**
 * DeployEffectManager handles Deploy (ENTERS_PLAY) effect processing
 * All effects are processed automatically with smart target selection
 * REFACTORED: Removed pendingCardSelections - no longer supports player-interactive effects
 */
export class DeployEffectManager {
    
    /**
     * Process Deploy effect triggered by card entering play
     * All effects are processed automatically with smart target selection
     */
    static processDeployEffect(gameEnv: GameEnvironment, eventData: any): any {
        console.log(`🚀 Processing Deploy effects for card ${eventData.cardId} (${eventData.cardUID})`);
        console.log(`📋 Effects to process: ${eventData.effects.length}`);
        
        let processedEffects = 0;
        let failedEffects = 0;
        
        try {
            // Process each Deploy effect automatically
            for (const effect of eventData.effects) {
                console.log(`⚡ Processing Deploy effect: ${effect.effectId || 'unnamed'} (${effect.effect?.action})`);
                
                const result = this.processIndividualEffect(gameEnv, eventData, effect);
                
                if (result.success) {
                    processedEffects++;
                    console.log(`✅ Deploy effect processed successfully`);
                } else {
                    failedEffects++;
                    console.log(`❌ Deploy effect failed: ${result.error}`);
                }
            }
            
            return {
                success: true,
                processedEffects,
                failedEffects,
                message: `Deploy effects completed: ${processedEffects} successful, ${failedEffects} failed`
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
     * Process individual Deploy effect using universal CardEffect processor
     * All effects are processed automatically without player selection
     */
    private static processIndividualEffect(gameEnv: GameEnvironment, eventData: any, effect: any): any {
        const { playerId } = eventData;
        
        console.log(`🔧 Processing Deploy effect using CardEffect for player ${playerId}`);
        console.log(`📋 Effect data:`, JSON.stringify(effect, null, 2));
        
        try {
            // Create universal card effect processor
            const cardEffect = new CardEffect(
                gameEnv,
                playerId,
                effect.target,
                effect.effect
            );
            
            // Execute the effect automatically
            const result: EffectResult = cardEffect.execute();
            
            // Return result directly - no more player selection support
            return {
                success: result.success,
                message: result.message,
                error: result.error,
                affectedCards: result.affectedCards
            };
            
        } catch (error) {
            console.error(`❌ Error in Deploy effect processing:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Deploy effect processing failed'
            };
        }
    }
}