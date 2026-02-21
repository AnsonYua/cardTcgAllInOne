// src/services/PairingEffectManager.ts
// Pairing effect management - handles PAIRING_COMPLETE triggered effects

import { GameEnvironment } from '../models/GameEnvironment';
import { DeployTargetManager } from './DeployTargetManager';
import { EffectExecutor } from './effects/EffectExecutor';
import {
    PlayCardEventData,
    PairingEffectEvent,
    PairingEffectEventData,
    PairingEffectDefinition,
    TargetFilters
} from './EventQueue/interfaces/GameEvent';
import { EventFactory } from './EventQueue/EventFactory';

// Import standardized interfaces
import {
    StandardEffectManager,
    StandardGameEvent,
    StandardExecutionResult,
    ValidationResult,
    StateChange
} from '../interfaces/StandardizedInterfaces';
import { getCardIdFromUid } from '../utils/CardUtils';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';
import { getCardTotals } from '../utils/FieldValueCalculator';
import { eventDataValidator } from '../validators/EventDataValidator';
import { ensureEffectDefaults } from '../utils/EffectNormalizationUtils';
import { EffectRuleCatalog } from './effects/EffectRuleCatalog';
import { PairingConditionEvaluator } from './conditions/PairingConditionEvaluator';
import { ContinuousEffectManager } from './ContinuousEffectManager';
import { ChoiceEventScheduler } from './choices/ChoiceEventScheduler';
import { ChoiceDisplayBuilder } from './choices/ChoiceDisplayBuilder';
import { EventPriority } from './EventQueue/interfaces/GameEvent';
import { ChoiceNotificationEmitter } from './notifications/ChoiceNotificationEmitter';
import { GameNotificationManager } from './GameNotificationManager';
import { EffectSelfTargetNormalizer } from './targets/EffectSelfTargetNormalizer';

type PairingEffectOrderContext = {
    kind: 'PAIRING_EFFECT_ORDER';
    pairingCarduid: string;
    effects: PairingEffectDefinition[];
};

export interface PairingEffectResult {
    success: boolean;
    error?: string;
    message?: string;
    effectsProcessed?: number;
}

export interface CardPlacementResult {
    success: boolean;
    error?: string;
    isOnPair?: boolean;
    isOnLink?: boolean;
    slotName?: string;
}

export type EffectCondition = Record<string, unknown> & {
    type: string;
    target?: string;
    traits?: string[];
    cardTypes?: string[];
    operator?: string;
    value?: number;
    filters?: any;
};

export interface UnitCard {
    carduid: string;
    // REMOVED: cardId - use getCardIdFromUid(carduid) instead
    cardData: any;
}

export interface PilotCard {
    carduid: string;
    // REMOVED: cardId - use getCardIdFromUid(carduid) instead
    cardData: any;
}

export interface PairingEffect extends PairingEffectDefinition {
    conditions?: EffectCondition[];
    parameters?: PairingEffectParameters;
    target?: EffectTarget;
}

export interface PairingEffectParameters extends Record<string, unknown> {
    value?: number;
}

export interface EffectTarget {
    scope: string;
    type?: string;
    count?: number;
    filters?: TargetFilters;
}

// ✅ REMOVED: FullPairingEffect interface - no longer needed after simplification
// All execution properties are now directly on PairingEffect interface

export interface PlayerZones {
    zones: {
        [slotName: string]: {
            unit?: UnitCard & { cardData?: any };
            pilot?: PilotCard & { cardData?: any };
        };
    } & {
        [key: string]: any;
    };
}

export interface EffectFilters {
    level?: string;
    hp?: string;
    traits?: string[];
    [key: string]: any;
}

export interface NotificationManager {
    [key: string]: any;
}

export interface CardInfo {
    carduid: string;
    // REMOVED: cardId - use getCardIdFromUid(carduid) instead
    cardData: any;
    cardType: 'unit' | 'pilot';
}

export class PairingEffectManager implements StandardEffectManager {
    
    // ============ STANDARDIZED INTERFACE IMPLEMENTATION ============
    
    /**
     * Execute effect using standardized interface
     */
    async executeEffect(event: StandardGameEvent, gameEnv: GameEnvironment): Promise<StandardExecutionResult> {
        const startTime = Date.now();
        console.log(`🤝 [STANDARD] Processing Pairing effect for card ${event.data.carduid}`);
        
        // Validate event data
        const validation = this.validateEffect(event, gameEnv);
        if (!validation.isValid) {
            return {
                success: false,
                effectsApplied: 0,
                affectedCards: [],
                stateChanges: [],
                error: {
                    code: 'VALIDATION_FAILED',
                    message: `Pairing effect validation failed: ${validation.errors.join(', ')}`,
                    carduid: event.data.carduid,
                    playerId: event.data.playerId
                },
                warnings: validation.warnings,
                metadata: {
                    executionTime: Date.now() - startTime,
                    manager: this.getManagerName()
                }
            };
        }
        
        const stateChanges: StateChange[] = [];
        const affectedCards: string[] = [];
        
        try {
            // Extract effects from standardized event structure
            const effects = event.data.parameters.conditions || [];
            console.log(`🤝 Processing ${effects.length} pairing effects`);
            
            let processedEffects = 0;
            
            // Process each pairing effect
            for (const effect of effects) {
                console.log(`⚡ Processing Pairing effect: ${effect.type || 'unnamed'}`);
                
                const result = await this.processStandardizedPairingEffect(
                    gameEnv,
                    event.data,
                    effect,
                    stateChanges
                );
                
                if (result.success) {
                    processedEffects++;
                    affectedCards.push(...result.affectedCards);
                    console.log(`✅ Pairing effect processed successfully`);
                }
            }
            
            return {
                success: processedEffects > 0,
                effectsApplied: processedEffects,
                affectedCards,
                stateChanges,
                metadata: {
                    executionTime: Date.now() - startTime,
                    manager: this.getManagerName(),
                    debugInfo: { processedEffects, totalEffects: effects.length }
                }
            };
            
        } catch (error) {
            console.error(`❌ Error in standardized pairing effect execution:`, error);
            return {
                success: false,
                effectsApplied: 0,
                affectedCards,
                stateChanges,
                error: {
                    code: 'EXECUTION_ERROR',
                    message: error instanceof Error ? error.message : 'Pairing effect execution failed',
                    carduid: event.data.carduid,
                    playerId: event.data.playerId,
                    context: error
                },
                metadata: {
                    executionTime: Date.now() - startTime,
                    manager: this.getManagerName()
                }
            };
        }
    }
    
    /**
     * Validate effect before execution
     */
    validateEffect(event: StandardGameEvent, gameEnv: GameEnvironment): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Validate event structure
        const eventValidation = eventDataValidator.validateEvent(event);
        errors.push(...eventValidation.errors);
        warnings.push(...eventValidation.warnings);
        
        // Validate player exists
        if (!gameEnv.players || !gameEnv.players[event.data.playerId]) {
            errors.push(`Player ${event.data.playerId} not found in game environment`);
        }
        
        // Validate carduid format
        const cardId = getCardIdFromUid(event.data.carduid);
        if (!cardId) {
            errors.push(`Invalid carduid format: ${event.data.carduid}`);
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    /**
     * Get human-readable description of effect
     */
    getEffectDescription(event: StandardGameEvent): string {
        const cardId = getCardIdFromUid(event.data.carduid);
        const effectCount = event.data.parameters.conditions?.length || 0;
        return `Pairing effects for ${cardId}: ${effectCount} effects to process`;
    }
    
    /**
     * Get manager name for identification
     */
    getManagerName(): string {
        return 'PairingEffectManager';
    }
    
    // ============ STANDARDIZED HELPER METHODS ============
    
    /**
     * Process individual standardized pairing effect
     */
    private async processStandardizedPairingEffect(
        gameEnv: GameEnvironment,
        eventData: any,
        effect: any,
        stateChanges: StateChange[]
    ): Promise<{ success: boolean; error?: string; affectedCards: string[] }> {
        
        try {
            // Use unified DeployTargetManager for processing
            const normalizedEffect = ensureEffectDefaults(effect);
            const sourceCarduid = typeof (normalizedEffect as any).sourceCarduid === 'string'
                ? ((normalizedEffect as any).sourceCarduid as string)
                : eventData.carduid;
            const result = DeployTargetManager.processEffectWithTargetChoice(
                gameEnv,
                eventData.playerId,
                sourceCarduid,
                normalizedEffect
            );
            
            // Track state changes
            if (result.success && result.affectedTargets) {
                for (const target of result.affectedTargets) {
                    // Handle both string and TargetReference types
                    const carduid = typeof target === 'string' ? target : target.carduid;
                    stateChanges.push({
                        type: 'CARD_PROPERTY',
                        carduid: carduid,
                        property: normalizedEffect.action || 'pairing_effect',
                        oldValue: 'unknown',
                        newValue: 'modified',
                        timestamp: Date.now()
                    });
                }
            }
            
            return {
                success: result.success,
                error: result.error,
                affectedCards: result.affectedTargets?.map(t => typeof t === 'string' ? t : t.carduid) || []
            };
            
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Pairing effect processing failed',
                affectedCards: []
            };
        }
    }
    
    // ============ DYNAMIC DATA RETRIEVAL HELPERS ============
    
    /**
     * ✅ IMPROVED: Check for pairing effects and return event directly (consolidated)
     * Eliminates intermediate step and object creation overhead
     */
    static checkForPairingEffectsEvent(
        eventData: PlayCardEventData,
        gameEnv: GameEnvironment,
        playerId: string
    ): PairingEffectEvent | null {
        console.log("PairingEffectManager.checkForPairingEffects - pairing detected, checking for triggered effects");
        
        const pairingEffects: PairingEffect[] = [];
        const player = gameEnv.getPlayer(playerId);
        if (!player || !player.zones) {
            console.log(`⚠️ Player ${playerId} or zones not found for pairing effect check`);
            return null;
        }

        // Find the slot where the pairing occurred
        const { slotName: pairedSlot, unit: pairedUnit } = SlotZoneUtils.findSlotByCarduid(player.zones, eventData.carduid);
        if (!pairedSlot || !pairedUnit) {
            console.log(`⚠️ Could not find paired slot for card ${eventData.carduid}`);
            return null;
        }

        const slotZone = (player.zones as any)[pairedSlot];
        const pilot = slotZone?.pilot;
        
        if (!pilot) {
            console.log(`⚠️ No pilot found in paired slot ${pairedSlot}`);
            return null;
        }

        // Check both unit and pilot for pairing effects
        const cardsToCheck: CardInfo[] = [
            { carduid: pairedUnit.carduid, cardData: pairedUnit.cardData, cardType: 'unit' },
            { carduid: pilot.carduid, cardData: pilot.cardData, cardType: 'pilot' }
        ];

        for (const cardInfo of cardsToCheck) {
            /*if it is command (check pilot.cardData) and cardType = pilot , ignore the card effect  */
            const normalizedEffects = EffectRuleCatalog.collectEffects(cardInfo.cardData, {
                trigger: 'PAIRING_COMPLETE',
                fallbackEffectId: 'pairing_effect',
                expectedTriggers: ['PAIRING_COMPLETE'],
                requireAction: true,
                defaultTargetScope: 'self',
                includePairedMetadata: {
                    pairedSlot: pairedSlot!,
                    sourceCarduid: cardInfo.carduid
                }
            });

            console.log("pairing effect here ", JSON.stringify(normalizedEffects))

            for (const effect of normalizedEffects) {
                const pairingEffect = ensureEffectDefaults({ ...effect }) as PairingEffect;

                const sourceCard = cardInfo.cardType === 'unit' ? (pairedUnit as any) : (pilot as any);
                if (pairingEffect.sourceConditions && pairingEffect.sourceConditions.length > 0) {
                    const satisfied = ContinuousEffectManager.sourceConditionsMet(
                        pairingEffect as any,
                        sourceCard,
                        gameEnv,
                        playerId
                    );
                    if (!satisfied) {
                        continue;
                    }
                }

                if (!this.validatePairingConditions(pairingEffect.conditions || [], pairedUnit, pilot, gameEnv, playerId)) {
                    continue;
                }

                pairingEffects.push(pairingEffect);
                const cardId = getCardIdFromUid(cardInfo.carduid);
                console.log(`🔗 Found pairing effect: ${pairingEffect.effectId} from ${cardInfo.cardType} ${cardId} in slot ${pairedSlot}`);
            }
        }

        console.log(`🔍 Pairing effect check complete: found ${pairingEffects.length} effects`);
        
        // ✅ IMPROVED: Return event directly if effects found, null otherwise
        if (pairingEffects.length === 0) {
            return null;
        }
        
        // Create event directly instead of returning array
        const pairingEvent = EventFactory.createPairingEffectEvent(
            playerId,
            eventData.carduid,
            pairingEffects
        );

        console.log(`🤝 Created Pairing event: ${pairingEvent.id} with ${pairingEffects.length} effects`);
        return pairingEvent;
    }

    /**
     * Process pairing effects - main processing entry point
     */
    static processPairingEffect(gameEnv: GameEnvironment, playerId: string, eventData: PairingEffectEventData): PairingEffectResult {
        console.log(`🤝 PairingEffectManager.processPairingEffect - processing pairing effects`);
        
        try {
            const { effects } = eventData;
            let pairingEffects = effects as PairingEffect[];
            let remainingEffects = Array.isArray((eventData as any).remainingEffects)
                ? ((eventData as any).remainingEffects as PairingEffect[])
                : [];
            let skippedNoTargetEffectsCount = 0;
            
            if (!pairingEffects || pairingEffects.length === 0) {
                console.log(`⚠️ No pairing effects to process`);
                return { 
                    success: true, 
                    message: 'No pairing effects to process',
                    effectsProcessed: 0 
                };
            }

            const initialPartition = this.partitionImmediatelyResolvableEffects(
                gameEnv,
                playerId,
                eventData.carduid,
                pairingEffects
            );
            pairingEffects = initialPartition.resolvableEffects;
            skippedNoTargetEffectsCount += initialPartition.skippedNoTargetEffects.length;

            if (pairingEffects.length === 0 && remainingEffects.length > 0) {
                const remainingPartition = this.partitionImmediatelyResolvableEffects(
                    gameEnv,
                    playerId,
                    eventData.carduid,
                    remainingEffects
                );
                pairingEffects = remainingPartition.resolvableEffects;
                remainingEffects = [];
                skippedNoTargetEffectsCount += remainingPartition.skippedNoTargetEffects.length;
            }

            if (pairingEffects.length === 0) {
                console.log(`⏭️ All pairing effects skipped due to no legal targets`);
                return {
                    success: true,
                    message: 'No resolvable pairing effects',
                    effectsProcessed: 0
                };
            }

            // If multiple effects are present, resolve them in card-text order when they are
            // non-conflicting; otherwise let the player pick which one resolves next.
            if (pairingEffects.length > 1) {
                if (this.shouldPromptForPairingEffectOrder(pairingEffects)) {
                    const options = pairingEffects.map((effect, index) => {
                        const optionLabel = this.describePairingEffectOption(gameEnv, playerId, effect);
                        return {
                            index,
                            label: optionLabel,
                            display: ChoiceDisplayBuilder.text(optionLabel)
                        };
                    });

                    const choiceEffect = ensureEffectDefaults({
                        effectId: 'pairing_effect_order',
                        type: 'internal',
                        trigger: 'CHOICE',
                        action: 'pairing_effect_order'
                    } as any);

                    const context: PairingEffectOrderContext = {
                        kind: 'PAIRING_EFFECT_ORDER',
                        pairingCarduid: eventData.carduid,
                        effects: pairingEffects as unknown as PairingEffectDefinition[]
                    };

                    // Enqueue as an immediate choice and notify the frontend.
                    ChoiceEventScheduler.enqueueOptionChoice(gameEnv, {
                        playerId,
                        sourceCarduid: eventData.carduid,
                        effect: choiceEffect,
                        headerText: 'Choose Effect Order',
                        promptText: 'Select which effect resolves first.',
                        defaultOptionIndex: 0,
                        layoutHint: 'text',
                        availableOptions: options,
                        context
                    });

                    return {
                        success: true,
                        message: 'Waiting for player to choose pairing effect order',
                        effectsProcessed: 0
                    };
                }

                // Auto-resolve in card-text order (effects array order).
                remainingEffects = [...pairingEffects.slice(1), ...remainingEffects];
                pairingEffects = [pairingEffects[0]];
            }
            
            console.log(`🔗 Processing ${pairingEffects.length} pairing effect(s) for player ${playerId}`);
            let effectsProcessed = 0;
            
            // Resolve exactly one effect per event. If the effect requires a TARGET_CHOICE,
            // we enqueue it and stop here; remaining effects will be scheduled after the choice resolves.
            const effect = pairingEffects[0];
            const normalizedEffect = ensureEffectDefaults(effect);
            const { effectId } = normalizedEffect;

            console.log(`⚡ Executing pairing effect: ${effectId}`);
            const action = EffectExecutor.getEffectAction(normalizedEffect);

            if (action === 'draw') {
                const drawResult = EffectExecutor.applyPlayerDrawEffect(gameEnv, playerId, normalizedEffect);
                if (!drawResult.success) {
                    console.error(`❌ Failed to execute draw effect ${effectId}: ${drawResult.error}`);
                    return { success: false, error: drawResult.error || 'draw failed' };
                }
                console.log(`✅ Pairing effect ${effectId} executed successfully`);
                effectsProcessed++;
            } else {
                const sourceCarduid = normalizedEffect.sourceCarduid || eventData.carduid;
                const normalizedTargetingEffect = EffectSelfTargetNormalizer.normalizeWithSourceCarduid(
                    gameEnv,
                    normalizedEffect,
                    sourceCarduid
                );
                const choiceResult = DeployTargetManager.processEffectWithTargetChoice(
                    gameEnv,
                    playerId,
                    sourceCarduid,
                    normalizedTargetingEffect
                );

                if (!choiceResult.success && !choiceResult.requiresSelection) {
                    console.error(`❌ Failed to execute pairing effect ${effectId}: ${choiceResult.error}`);
                    return { success: false, error: choiceResult.error || 'pairing effect failed' };
                }

                console.log(`✅ Pairing effect ${effectId} executed successfully`);
                effectsProcessed++;
            }

            // Schedule remaining effects after the current one (and after any pending TARGET_CHOICE).
            if (remainingEffects.length > 0) {
                const remainingPartition = this.partitionImmediatelyResolvableEffects(
                    gameEnv,
                    playerId,
                    eventData.carduid,
                    remainingEffects
                );
                remainingEffects = remainingPartition.resolvableEffects;
                skippedNoTargetEffectsCount += remainingPartition.skippedNoTargetEffects.length;
            }

            if (remainingEffects.length > 0) {
                if (remainingEffects.length === 1) {
                    const nextEvent = EventFactory.createPairingEffectEvent(playerId, eventData.carduid, [
                        remainingEffects[0] as unknown as PairingEffectDefinition
                    ]);
                    (nextEvent.data as any).remainingEffects = [];
                    // Keep as NORMAL priority so any immediate choice events resolve first.
                    nextEvent.priority = EventPriority.NORMAL;
                    gameEnv.enqueueForProcessing(nextEvent);
                } else {
                    if (!this.shouldPromptForPairingEffectOrder(remainingEffects)) {
                        const nextEvent = EventFactory.createPairingEffectEvent(playerId, eventData.carduid, [
                            remainingEffects[0] as unknown as PairingEffectDefinition
                        ]);
                        (nextEvent.data as any).remainingEffects = remainingEffects.slice(1);
                        nextEvent.priority = EventPriority.NORMAL;
                        gameEnv.enqueueForProcessing(nextEvent);
                    } else {
                        const options = remainingEffects.map((remainingEffect, index) => {
                            const optionLabel = this.describePairingEffectOption(gameEnv, playerId, remainingEffect);
                            return {
                                index,
                                label: optionLabel,
                                display: ChoiceDisplayBuilder.text(optionLabel)
                            };
                        });

                        const choiceEffect = ensureEffectDefaults({
                            effectId: 'pairing_effect_order',
                            type: 'internal',
                            trigger: 'CHOICE',
                            action: 'pairing_effect_order'
                        } as any);

                        const context: PairingEffectOrderContext = {
                            kind: 'PAIRING_EFFECT_ORDER',
                            pairingCarduid: eventData.carduid,
                            effects: remainingEffects as unknown as PairingEffectDefinition[]
                        };

                        const followUpChoice = EventFactory.createOptionChoiceEvent({
                            playerId,
                            sourceCarduid: eventData.carduid,
                            effect: choiceEffect,
                            headerText: 'Choose Effect Order',
                            promptText: 'Select which effect resolves first.',
                            defaultOptionIndex: 0,
                            layoutHint: 'text',
                            availableOptions: options,
                            context
                        });

                        // Ensure this follow-up choice sits behind any immediate cost/target choices
                        // created by the current effect.
                        followUpChoice.priority = EventPriority.NORMAL;
                        gameEnv.enqueueForProcessing(followUpChoice);
                        ChoiceNotificationEmitter.emitOptionChoiceCreated(gameEnv, followUpChoice);
                    }
                }
            }

            // Notify frontend that a pairing effect step finished, so it can refresh UI/state immediately
            // before the next effect (or next choice) is handled.
            new GameNotificationManager(gameEnv).addNotificationEvent(
                'GAME_ENV_REFRESH',
                {
                    playerId,
                    reason: 'PAIRING_EFFECT_STEP_RESOLVED',
                    sourceCarduid: eventData.carduid,
                    effectId,
                    remainingEffects: remainingEffects.length,
                    skippedNoTargetEffects: skippedNoTargetEffectsCount,
                    timestamp: Date.now()
                },
                'normal'
            );
            
            console.log(`✅ Pairing effects processing complete: ${effectsProcessed} effects processed`);
            return { 
                success: true, 
                message: `Successfully processed ${effectsProcessed} pairing effects`,
                effectsProcessed 
            };
            
        } catch (error) {
            console.error(`❌ Error in PairingEffectManager.processPairingEffect:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Pairing effect processing failed'
            };
        }
    }

    private static describePairingEffectOption(
        gameEnv: GameEnvironment,
        playerId: string,
        effect: PairingEffect
    ): string {
        const effectId = typeof effect.effectId === 'string' && effect.effectId.length > 0 ? effect.effectId : 'pairing_effect';
        const action = typeof effect.action === 'string' && effect.action.length > 0 ? effect.action : 'effect';
        const sourceCarduid = typeof effect.sourceCarduid === 'string' ? effect.sourceCarduid : '';
        const sourceName = this.findCardName(gameEnv, playerId, sourceCarduid);
        const prefix = sourceName ? `${sourceName}: ` : '';
        return `${prefix}${effectId} (${action})`;
    }

    private static partitionImmediatelyResolvableEffects(
        gameEnv: GameEnvironment,
        playerId: string,
        pairingCarduid: string,
        effects: PairingEffect[]
    ): {
        resolvableEffects: PairingEffect[];
        skippedNoTargetEffects: PairingEffect[];
    } {
        const resolvableEffects: PairingEffect[] = [];
        const skippedNoTargetEffects: PairingEffect[] = [];

        for (const effect of effects) {
            const sourceCarduid = typeof effect?.sourceCarduid === 'string' && effect.sourceCarduid.length > 0
                ? effect.sourceCarduid
                : pairingCarduid;
            const preview = DeployTargetManager.evaluateImmediateResolution(
                gameEnv,
                playerId,
                sourceCarduid,
                effect
            );

            if (preview.noOpNoTargets) {
                skippedNoTargetEffects.push(effect);
                console.log(`⏭️ Auto-skipping pairing effect ${effect.effectId || 'pairing_effect'} (no legal targets)`);
                continue;
            }

            resolvableEffects.push(effect);
        }

        return { resolvableEffects, skippedNoTargetEffects };
    }

    private static shouldPromptForPairingEffectOrder(effects: PairingEffect[]): boolean {
        if (!Array.isArray(effects) || effects.length <= 1) {
            return false;
        }

        // Card-text order only makes sense when all effects come from the same source card.
        const sourceCarduid = typeof effects[0]?.sourceCarduid === 'string' ? effects[0].sourceCarduid : '';
        if (!sourceCarduid) {
            return true;
        }
        for (const effect of effects) {
            if (effect?.sourceCarduid !== sourceCarduid) {
                return true;
            }
        }

        // Optional effects should remain player-controlled.
        if (effects.some(effect => (effect as any)?.optional === true)) {
            return true;
        }

        // Auto-order only for a conservative set of actions that are unlikely to conflict.
        for (const effect of effects) {
            const action = typeof effect?.action === 'string' ? effect.action : '';
            if (!action) {
                return true;
            }

            if (action === 'addExtraEnergy' || action === 'addBasicEnergy') {
                continue;
            }

            if (action === 'grant_keyword' || action === 'grant_breach' || action === 'prevent_battle_damage' || action === 'prevent_damage') {
                continue;
            }

            if (action === 'modifyAP' || action === 'modifyHP') {
                const scope = typeof (effect as any)?.target?.scope === 'string' ? (effect as any).target.scope : '';
                if (scope === 'self') {
                    continue;
                }
                return true;
            }

            return true;
        }

        return false;
    }

    private static findCardName(gameEnv: GameEnvironment, playerId: string, carduid: string): string | undefined {
        if (!carduid) return undefined;
        const player = gameEnv.getPlayer(playerId);
        const zones = player?.zones as any;
        if (zones) {
            for (const slotName of Object.keys(zones)) {
                const slot = zones[slotName];
                if (slot?.unit?.carduid === carduid) return slot.unit?.cardData?.name;
                if (slot?.pilot?.carduid === carduid) return slot.pilot?.cardData?.name;
            }

            const trash = zones.trashArea;
            if (Array.isArray(trash)) {
                const hit = trash.find((c: any) => c?.carduid === carduid);
                if (hit?.cardData?.name) return hit.cardData.name;
            }
        }

        return undefined;
    }

    /**
     * Validate pairing effect conditions (trait matching, etc.)
     */
    private static validatePairingConditions(
        conditions: EffectCondition[],
        unit: UnitCard,
        pilot: PilotCard,
        gameEnv: GameEnvironment,
        playerId: string
    ): boolean {
        if (!conditions || conditions.length === 0) {
            return true;
        }

        for (const condition of conditions) {
            if (!this.validateSinglePairingCondition(condition, unit, pilot, gameEnv, playerId)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Validate a single pairing condition
     */
    private static validateSinglePairingCondition(
        condition: EffectCondition,
        unit: UnitCard,
        pilot: PilotCard,
        gameEnv: GameEnvironment,
        playerId: string
    ): boolean {
        console.log(`🔍 Validating condition:`, JSON.stringify(condition));

        switch (condition.type) {
            case 'traitMatch':
                return this.validateTraitMatch(condition, unit, pilot);
            case 'cardTypeMatch':
                return this.validateCardTypeMatch(condition, unit, pilot);
            case 'powerThreshold':
                return this.validatePowerThreshold(condition, unit, pilot);
            default:
                if (!gameEnv || !playerId) {
                    console.log(`⚠️ Unknown condition type: ${condition.type}`);
                    return false;
                }

                const resolved = PairingConditionEvaluator.evaluate(
                    gameEnv,
                    playerId,
                    condition as unknown as Record<string, unknown>,
                    unit as unknown as any,
                    pilot as unknown as any
                );

                if (resolved === null) {
                    console.log(`⚠️ Unknown condition type: ${condition.type}`);
                    return false;
                }

                return resolved;
        }
    }

    /**
     * Validate trait matching condition
     */
    private static validateTraitMatch(condition: EffectCondition, unit: UnitCard, pilot: PilotCard): boolean {
        const { target, traits } = condition;
        let targetCard;

        switch (target) {
            case 'unit':
                targetCard = unit;
                break;
            case 'pilot':
                targetCard = pilot;
                break;
            case 'any':
                // Check if either card has the required traits
                return this.hasRequiredTraits(unit, traits || []) || this.hasRequiredTraits(pilot, traits || []);
            default:
                console.log(`⚠️ Unknown trait match target: ${target}`);
                return false;
        }

        return this.hasRequiredTraits(targetCard, traits || []);
    }

    /**
     * Check if a card has the required traits
     */
    private static hasRequiredTraits(card: UnitCard | PilotCard, requiredTraits: string[]): boolean {
        if (!card?.cardData?.traits || !Array.isArray(card.cardData.traits)) {
            // Derive cardId from carduid for logging
            const cardId = card ? getCardIdFromUid(card.carduid) : 'unknown';
            console.log(`⚠️ Card ${cardId} has no traits array`);
            return false;
        }

        const cardTraits = card.cardData.traits;
        // Derive cardId from carduid for logging
        const cardId = getCardIdFromUid(card.carduid);
        console.log(`🏷️ Card ${cardId} traits:`, cardTraits, `Required:`, requiredTraits);

        // Check if card has all required traits
        const hasAllTraits = requiredTraits.every(requiredTrait => 
            cardTraits.some((cardTrait: string) => cardTrait === requiredTrait)
        );

        console.log(`✅ Trait match result for ${cardId}:`, hasAllTraits);
        return hasAllTraits;
    }

    /**
     * Validate card type matching condition
     */
    private static validateCardTypeMatch(condition: EffectCondition, unit: UnitCard, pilot: PilotCard): boolean {
        const { target, cardTypes } = condition;
        let targetCard;

        switch (target) {
            case 'unit':
                targetCard = unit;
                break;
            case 'pilot':
                targetCard = pilot;
                break;
            case 'any':
                return this.hasRequiredCardType(unit, cardTypes || []) || this.hasRequiredCardType(pilot, cardTypes || []);
            default:
                console.log(`⚠️ Unknown card type match target: ${target}`);
                return false;
        }

        return this.hasRequiredCardType(targetCard, cardTypes || []);
    }

    /**
     * Check if a card has the required card type
     */
    private static hasRequiredCardType(card: UnitCard | PilotCard, requiredTypes: string[]): boolean {
        if (!card?.cardData?.cardType) {
            return false;
        }

        const cardType = card.cardData.cardType;
        return requiredTypes.includes(cardType);
    }

    /**
     * Validate power threshold condition
     */
    private static validatePowerThreshold(condition: EffectCondition, unit: UnitCard, pilot: PilotCard): boolean {
        const { target, operator = '>=', value = 0 } = condition;
        let targetCard;

        switch (target) {
            case 'unit':
                targetCard = unit;
                break;
            case 'pilot':
                targetCard = pilot;
                break;
            case 'combined':
                const unitPower = this.getCardPower(unit);
                const pilotPower = this.getCardPower(pilot);
                const combinedPower = unitPower + pilotPower;
                return this.compareValues(combinedPower, operator, value);
            default:
                console.log(`⚠️ Unknown power threshold target: ${target}`);
                return false;
        }

        const cardPower = this.getCardPower(targetCard);
        return this.compareValues(cardPower, operator, value);
    }

    /**
     * Get card's current power
     */
    private static getCardPower(card: UnitCard | PilotCard): number {
        if (!card) {
            return 0;
        }

        const totals = getCardTotals(card as any);
        return totals.totalAP;
    }

    /**
     * Compare values using operator
     */
    private static compareValues(actual: number, operator: string, expected: number): boolean {
        switch (operator) {
            case '>=':
                return actual >= expected;
            case '>':
                return actual > expected;
            case '<=':
                return actual <= expected;
            case '<':
                return actual < expected;
            case '===':
                return actual === expected;
            default:
                console.log(`⚠️ Unknown comparison operator: ${operator}`);
                return false;
        }
    }

}
