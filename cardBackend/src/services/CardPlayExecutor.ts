// src/services/CardPlayExecutor.ts
// Orchestrates PLAY_CARD event handling

import { EventFactory, PlayCardEvent, PlayCardEventData } from './EventQueue/interfaces/GameEvent';
import { ExecutionResult } from './ExecutionResult';
import { GameEnvironment } from '../models/GameEnvironment';
import { PlayCardPreparationManager, PlayCardPreparationSuccess } from './PlayCardPreparationManager';
import { PlayerCardManager } from './PlayerCardManager';
import { GameNotificationManager } from './GameNotificationManager';
import { DeployEffectManager } from './DeployEffectManager';
import { PairingEffectManager } from './PairingEffectManager';
import { ContinuousEffectManager } from './ContinuousEffectManager';
import { BattlePhaseManager } from './BattlePhaseManager';

export class CardPlayExecutor {
    static execute(event: PlayCardEvent, gameEnv: GameEnvironment): ExecutionResult {
        const playerId = event.playerId;
        const eventData: PlayCardEventData = event.data;
        const fromBurst = eventData.fromBurst || false;

        if (!playerId) {
            return {
                success: false,
                error: 'No playerId found in event'
            };
        }

        console.log(`🎯 Processing PLAY_CARD event for player: ${playerId}, carduid: ${eventData.carduid}, playAs: ${eventData.playAs}, fromBurst: ${fromBurst}, targetUnit: ${eventData.targetUnit || 'none'}`);

        try {
            const preparationResult = PlayCardPreparationManager.prepare(gameEnv, playerId, eventData, fromBurst);
            if (!preparationResult.success) {
                return {
                    success: false,
                    error: preparationResult.error
                };
            }

            const { tappedEnergy, rollback } = preparationResult as PlayCardPreparationSuccess;
            const placementResult = PlayerCardManager.placeCardWithEventData(gameEnv, playerId, eventData);

            if (!placementResult.success) {
                rollback();
                return {
                    success: false,
                    error: placementResult.error
                };
            }

            const notificationManager = new GameNotificationManager(gameEnv);
            const cardNotificationPayload = {
                carduid: eventData.carduid,
                playerId,
                playAs: eventData.playAs,
                reason: eventData.fromBurst ? 'burst' : 'hand',
                fromBurst: Boolean(eventData.fromBurst),
                targetUnit: eventData.targetUnit,
                slotName: eventData.slotName,
                isCompleted: false,
                timestamp: Date.now()
            };

            const notificationId = notificationManager.addNotificationEvent(
                'CARD_PLAYED',
                cardNotificationPayload,
                'normal'
            );
            eventData.cardPlayNotificationId = notificationId;

            if (tappedEnergy.length > 0) {
                eventData.payEnergyCards = tappedEnergy.map(card => card.carduid);
            }


            const deployResult = DeployEffectManager.checkAndQueueDeployEffects(eventData, playerId, gameEnv);
            if (!deployResult.success) {
                console.log(`⚠️ Deploy effect processing error: ${deployResult.error}`);
            } else if (deployResult.effectsFound > 0) {
                console.log(`✅ Deploy effects processed: ${deployResult.effectsFound} effects queued`);
            }

            if (deployResult.effectsFound === 0) {
                notificationManager.updateNotificationEvent(notificationId, { isCompleted: true });
            }

            if (placementResult.isOnPair) {
                console.log(`🤝 Pairing detected - checking for pairing effects`);
                const pairingEvent = PairingEffectManager.checkForPairingEffectsEvent(eventData, gameEnv, playerId);
                if (pairingEvent) {
                    gameEnv.processingQueue.push(pairingEvent);
                    console.log(`📋 Pairing event queued: ${pairingEvent.id}`);
                }
            }

            if (placementResult.isOnLink) {
                console.log(`🔗 Link detected - updating linked unit's isFirstPlay status`);
                PlayerCardManager.handleLinkFormation(gameEnv, playerId, eventData.carduid);
            }

            console.log(`🔄 Processing continuous effects after card placement${placementResult.isOnPair ? ` (${placementResult.isOnLink ? 'Link' : 'Pair'} created)` : ''}`);
            try {
                const result = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
                console.log(`✅ Continuous effects processed: ${result.effectsProcessed} processed, ${result.effectsActivated} activated, ${result.effectsDeactivated} deactivated`);
            } catch (error) {
                console.error(`❌ Error processing continuous effects after card placement:`, error);
            }

            if (BattlePhaseManager.isActionWindowOpen(gameEnv) &&
                BattlePhaseManager.playerInActiveBattle(gameEnv, playerId)) {
                const postPlayEvent = EventFactory.createActionStepPostPlayEvent(playerId);
                gameEnv.enqueueForProcessing(postPlayEvent);
                console.log("data 12312312 ", JSON.stringify(gameEnv.processingQueue))
                console.log(`📋 Action step post-play event queued: ${postPlayEvent.id}`);
            }

            return { success: true };
        } catch (error) {
            console.error(`❌ Error in CardPlayExecutor.execute:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'PLAY_CARD execution failed'
            };
        }
    }

}
