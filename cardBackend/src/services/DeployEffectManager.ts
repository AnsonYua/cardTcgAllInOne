// src/services/DeployEffectManager.ts
// Deploy effect processing system for ENTERS_PLAY triggered effects

import { GameEnvironment } from '../models/GameEnvironment';
import { EventType } from '../models/GameEnums';
import { CardEffect, EffectResult } from './CardEffect';
import { EventFactory, GameEvent, EventStatus, EventPriority } from './EventQueue/interfaces/GameEvent';
import { SLOT_ZONES } from '../config/gameConstants';
import { GameValidator } from './GameValidator';

export interface ExecutionResult {
    success: boolean;
    error?: string;
}

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
     * Process individual Deploy effect with player target selection support
     * Detects if effect requires player choice and creates appropriate events
     */
    private static processIndividualEffect(gameEnv: GameEnvironment, eventData: any, effect: any): any {
        const { playerId, cardUID, cardId } = eventData;
        
        console.log(`🔧 Processing Deploy effect for player ${playerId}`);
        console.log(`📋 Effect data:`, JSON.stringify(effect, null, 2));
        
        try {
            // Check if effect requires player target selection
            if (this.requiresPlayerTargetSelection(effect)) {
                console.log(`🎯 Deploy effect requires player target selection`);
                
                // Generate available targets based on effect filters
                const availableTargets = this.generateAvailableTargets(gameEnv, playerId, effect);
                
                if (availableTargets.length === 0) {
                    return {
                        success: false,
                        error: "No valid targets available for deploy effect"
                    };
                }
                
                console.log(`🎯 Found ${availableTargets.length} available targets`);
                
                // Create target choice event
                const targetChoiceEvent = EventFactory.createDeployTargetChoiceEvent(
                    playerId,
                    cardUID,
                    cardId,
                    effect,
                    availableTargets
                );
                
                // Queue the choice event
                gameEnv.enqueueForProcessing(targetChoiceEvent);
                
                console.log(`📤 Enqueued deploy target choice event: ${targetChoiceEvent.id}`);
                
                return {
                    success: true,
                    message: "Target selection required",
                    requiresPlayerInput: true
                };
            }
            
            // Process automatically for non-interactive effects
            console.log(`⚡ Processing Deploy effect automatically (no player input required)`);
            
            // Create universal card effect processor
            const cardEffect = new CardEffect(
                gameEnv,
                playerId,
                effect.target,
                effect.effect
            );
            
            // Execute the effect automatically
            const result: EffectResult = cardEffect.execute();
            
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
    
    /**
     * Check if effect requires player target selection
     */
    private static requiresPlayerTargetSelection(effect: any): boolean {
        // Check if target requires player choice
        return effect.target?.count === 1 && 
               effect.target?.scope === "opponent" &&
               effect.target?.type === "unit";
    }
    
    /**
     * Generate available targets based on effect filters
     */
    private static generateAvailableTargets(gameEnv: GameEnvironment, playerId: string, effect: any): any[] {
        const targets: any[] = [];
        const { target } = effect;
        
        console.log(`🔍 Generating targets for effect with filters:`, JSON.stringify(target, null, 2));
        
        // Get opponent player ID
        const opponentId = Object.keys(gameEnv.players).find(id => id !== playerId);
        if (!opponentId) {
            console.error(`❌ Could not find opponent for player ${playerId}`);
            return targets;
        }
        
        const opponent = gameEnv.players[opponentId];
        if (!opponent) {
            console.error(`❌ Opponent player ${opponentId} not found`);
            return targets;
        }
        
        console.log(`🎯 Searching opponent ${opponentId} for valid targets`);
        
        // Search opponent's units based on filters
        for (const slotName of SLOT_ZONES) {
            const slot = opponent.zones[slotName];
            if (slot?.unit) {
                const unit = slot.unit;
                console.log(`🔍 Checking unit in ${slotName}: ${unit.cardUid} (HP: ${unit.cardData?.hp || 0}, Damage: ${unit.damageReceived || 0})`);
                
                // Apply HP filter if specified
                if (target.filters?.hp) {
                    const maxHp = this.parseHpFilter(target.filters.hp); // "<=2" → 2
                    const currentHp = (unit.cardData?.hp || 0) - (unit.damageReceived || 0);
                    
                    console.log(`🔍 HP filter check: currentHp=${currentHp}, maxHp=${maxHp}, filter=${target.filters.hp}`);
                    
                    if (currentHp > maxHp) {
                        console.log(`❌ Unit ${unit.cardUid} current HP ${currentHp} exceeds max ${maxHp}`);
                        continue;
                    }
                }
                
                // Add valid target
                const targetInfo = {
                    cardUid: unit.cardUid,
                    cardId: unit.cardId,
                    zone: slotName,
                    playerId: opponentId,
                    cardData: unit.cardData,
                    currentHp: (unit.cardData?.hp || 0) - (unit.damageReceived || 0)
                };
                
                targets.push(targetInfo);
                console.log(`✅ Added valid target: ${unit.cardUid} in ${slotName}`);
            }
        }
        
        console.log(`🎯 Generated ${targets.length} valid targets`);
        return targets;
    }
    
    /**
     * Parse HP filter string to number (e.g., "<=2" → 2)
     */
    private static parseHpFilter(hpFilter: string): number {
        if (typeof hpFilter === 'string') {
            const match = hpFilter.match(/<=?(\d+)/);
            if (match) {
                return parseInt(match[1], 10);
            }
        }
        return 0;
    }

    /**
     * Apply deploy effect to the selected target
     */
    static applyDeployEffectToTarget(gameEnv: GameEnvironment, deployEffect: any, target: any, playerId: string): ExecutionResult {
        console.log(`🎯 Applying deploy effect action: ${deployEffect.effect.action} to target: ${target.cardUid}`);

        try {
            // Validate target player using GameValidator
            const playerValidation = GameValidator.validatePlayer(gameEnv, target.playerId);
            if (!playerValidation.isValid) {
                return {
                    success: false,
                    error: playerValidation.error
                };
            }

            // Validate target zone and unit using GameValidator
            const zoneValidation = GameValidator.validateTargetZone(gameEnv, target.playerId, target.zone, target.cardUid);
            if (!zoneValidation.isValid) {
                return {
                    success: false,
                    error: zoneValidation.error
                };
            }

            // Get the target unit (validation already confirmed it exists)
            const targetPlayer = playerValidation.player!;
            const slotKey = target.zone as keyof Pick<typeof targetPlayer.zones, 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6'>;
            const targetSlot = targetPlayer.zones[slotKey];
            const targetUnit = targetSlot.unit!; // Non-null assertion since validation confirmed it exists

            // Apply effect based on action type
            switch (deployEffect.effect.action) {
                case "rest":
                    targetUnit.isRested = true;
                    console.log(`💤 Unit ${target.cardUid} has been rested by deploy effect`);
                    break;

                case "damage":
                    const damageValue = deployEffect.effect.parameters?.value || 1;
                    targetUnit.damageReceived = (targetUnit.damageReceived || 0) + damageValue;
                    console.log(`🩸 Unit ${target.cardUid} takes ${damageValue} damage from deploy effect (total: ${targetUnit.damageReceived})`);
                    break;

                case "modifyAP":
                    const apModifier = deployEffect.effect.parameters?.value || 0;
                    if (!targetUnit.currentAP) {
                        targetUnit.currentAP = targetUnit.cardData?.ap || 0;
                    }
                    targetUnit.currentAP += apModifier;
                    console.log(`⚔️ Unit ${target.cardUid} AP modified by ${apModifier} (new AP: ${targetUnit.currentAP})`);
                    break;

                case "modifyHP":
                    const hpModifier = deployEffect.effect.parameters?.value || 0;
                    if (!targetUnit.currentHP) {
                        targetUnit.currentHP = targetUnit.cardData?.hp || 0;
                    }
                    targetUnit.currentHP += hpModifier;
                    console.log(`❤️ Unit ${target.cardUid} HP modified by ${hpModifier} (new HP: ${targetUnit.currentHP})`);
                    break;

                default:
                    console.warn(`⚠️ Unknown deploy effect action: ${deployEffect.effect.action}`);
                    return {
                        success: false,
                        error: `Unknown deploy effect action: ${deployEffect.effect.action}`
                    };
            }

            console.log(`✅ Deploy effect ${deployEffect.effect.action} applied successfully to ${target.cardUid}`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error applying deploy effect to target:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Deploy effect application failed'
            };
        }
    }

    /**
     * Create Deploy effect event for processing queue
     */
    static createDeployEffectEvent(eventData: any, deployEffects: any[]): GameEvent {
        const deployEvent: GameEvent = {
            id: `deploy_${eventData.cardUID}_${Date.now()}`,
            type: EventType.DEPLOY_EFFECT_TRIGGERED,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            playerId: eventData.playerId,
            data: {
                cardId: eventData.cardId,
                cardUID: eventData.cardUID,
                cardData: eventData.cardData,
                playerId: eventData.playerId,
                zone: eventData.zone,
                effects: deployEffects,
                timestamp: Date.now()
            },
            timestamp: Date.now()
        };

        console.log(`🚀 Created Deploy event: ${deployEvent.id} with ${deployEffects.length} effects`);
        return deployEvent;
    }

    /**
     * Execute Deploy effect triggered by card entering play
     */
    static executeDeployEffect(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🚀 Executing DEPLOY_EFFECT_TRIGGERED event: ${event.id}`);

        try {
            // Use DeployEffectManager to process the Deploy effects
            const result = DeployEffectManager.processDeployEffect(gameEnv, event.data);

            if (!result.success) {
                console.log(`❌ Deploy effect processing failed: ${result.error}`);
                return {
                    success: false,
                    error: result.error
                };
            }

            if (result.requiresSelection) {
                console.log(`🎯 Deploy effects require player selection - workflow set up`);
                return {
                    success: true
                };
            }

            console.log(`✅ Deploy effects processed successfully: ${result.message}`);
            return {
                success: true
            };

        } catch (error) {
            console.error(`❌ Error in executeDeployEffect:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Deploy effect execution failed'
            };
        }
    }

    /**
     * Handle DEPLOY_TARGET_CHOICE events - execute when user makes target selection
     */
    static executeDeployTargetChoice(event: GameEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🎯 Executing DEPLOY_TARGET_CHOICE event: ${event.id} (${event.status})`);

        try {
            const { selectedTarget, deployEffect, playerId, sourceCardUid } = event.data;

            // This method should only be called for RESOLVING events
            if (event.status !== EventStatus.RESOLVING) {
                console.log(`⚠️ Unexpected event status: ${event.status} (expected RESOLVING)`);
                return { success: true }; // Skip - should not happen in correct flow
            }

            if (!selectedTarget) {
                return {
                    success: false,
                    error: "No target selected for deploy effect"
                };
            }

            console.log(`🚀 Applying deploy effect to target: ${selectedTarget.cardUid} in ${selectedTarget.zone}`);

            // Apply the effect to selected target
            return DeployEffectManager.applyDeployEffectToTarget(gameEnv, deployEffect, selectedTarget, playerId);

        } catch (error) {
            console.error(`❌ Error in executeDeployTargetChoice:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Deploy target choice execution failed'
            };
        }
    }
}