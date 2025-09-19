// src/services/GameEventFactory.ts
// Centralized event creation factory for all game events

import { GameEvent, EventStatus, EventPriority } from './EventQueue/interfaces/GameEvent';
import { EventType } from '../models/GameEnums';

/**
 * GameEventFactory handles creation of all game events
 * Centralizes event creation logic and ensures consistent event structure
 */
export class GameEventFactory {

    /**
     * Create Pairing effect event for processing queue
     */
    static createPairingEffectEvent(eventData: any, pairingEffects: any[], placementResult: any): GameEvent {
        const pairingEvent: GameEvent = {
            id: `pairing_${eventData.cardUID}_${Date.now()}`,
            type: EventType.PAIRING_EFFECT_TRIGGERED,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            playerId: eventData.playerId,
            data: {
                // Only include data actually used by PairingEffect.processPairingEffect
                playerId: eventData.playerId,
                effects: pairingEffects
            },
            timestamp: Date.now()
        };

        console.log(`🤝 Created Pairing event: ${pairingEvent.id} with ${pairingEffects.length} effects`);
        return pairingEvent;
    }

    /**
     * Create PLAY_CARD event for burst deploy effects
     */
    static createBurstDeployEvent(playerId: string, cardUid: string, cardData: any, burstEffect: any): GameEvent {
        // Determine playAs based on card type and burst effect
        let playAs = cardData.cardType;
        if (cardData.cardType === 'command' && burstEffect.effect?.action === 'designate_pilot') {
            playAs = 'pilot';
        }

        const playCardEvent: GameEvent = {
            id: `burst_deploy_${Date.now()}_${Math.random()}`,
            type: EventType.PLAY_CARD,
            status: EventStatus.DECLARED,
            priority: EventPriority.NORMAL,
            timestamp: Date.now(),
            playerId: playerId,
            data: {
                playerId: playerId,
                cardUID: cardUid,
                cardId: cardData.id || cardData.cardId,
                cardData: cardData,
                playAs: playAs,
                fromBurst: true
            }
        };

        console.log(`🚀 Created burst deploy PLAY_CARD event: ${playCardEvent.id} (playAs: ${playAs})`);
        return playCardEvent;
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
     * Create phase change event for frontend notification
     */
    static createPhaseChangeEvent(fromPhase: string, toPhase: string, reason: string, playerId: string): any {
        return {
            type: 'PHASE_CHANGE',
            data: {
                fromPhase: fromPhase,
                toPhase: toPhase,
                reason: reason,
                playerId: playerId
            },
            requiresAcknowledgment: false,
            priority: 'high'
        };
    }

    /**
     * Generate unique event ID with prefix
     */
    static generateEventId(prefix: string, suffix?: string): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return suffix ? `${prefix}_${timestamp}_${suffix}` : `${prefix}_${timestamp}_${random}`;
    }

    /**
     * Create base event structure with common fields
     */
    static createBaseEvent(
        type: EventType,
        playerId: string,
        data: any,
        options: {
            id?: string;
            status?: EventStatus;
            priority?: EventPriority;
        } = {}
    ): GameEvent {
        return {
            id: options.id || this.generateEventId(type.toLowerCase()),
            type: type,
            status: options.status || EventStatus.DECLARED,
            priority: options.priority || EventPriority.NORMAL,
            playerId: playerId,
            data: data,
            timestamp: Date.now()
        };
    }
}