// src/services/CardPlayExecutor.ts
// Orchestrates PLAY_CARD event handling

import { PlayCardEvent, PlayCardEventData } from './EventQueue/interfaces/GameEvent';
import { EventFactory } from './EventQueue/EventFactory';
import { ExecutionResult } from './ExecutionResult';
import { GameEnvironment } from '../models/GameEnvironment';
import { PlayCardPreparationManager, PlayCardPreparationSuccess } from './PlayCardPreparationManager';
import { PlayerCardManager } from './PlayerCardManager';
import { GameNotificationManager } from './GameNotificationManager';
import { PairingEffectManager } from './PairingEffectManager';
import { BattlePhaseManager } from './BattlePhaseManager';
import { CardEnteredPlayManager } from './CardEnteredPlayManager';
import { PairingGlobalEffectManager } from './effects/PairingGlobalEffectManager';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';

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


            const enteredPlay = CardEnteredPlayManager.handleCardEnteredPlay(gameEnv, playerId, {
                carduid: eventData.carduid,
                playAs: eventData.playAs,
                slotName: placementResult.placedZone || eventData.slotName,
                cardPlayNotificationId: notificationId
            });

            if (!enteredPlay.success) {
                console.log(`⚠️ CardEnteredPlayManager error: ${enteredPlay.error}`);
            } else if (enteredPlay.deployEffectsQueued > 0) {
                console.log(`✅ Deploy effects processed: ${enteredPlay.deployEffectsQueued} effects queued`);
            }

            if (enteredPlay.deployEffectsQueued === 0) {
                notificationManager.updateNotificationEvent(notificationId, { isCompleted: true });
            }

            if (placementResult.isOnPair) {
                console.log(`🤝 Pairing detected - checking for pairing effects`);
                const pairingEvent = PairingEffectManager.checkForPairingEffectsEvent(eventData, gameEnv, playerId);
                if (pairingEvent) {
                    gameEnv.enqueueForProcessing(pairingEvent);
                    console.log(`📋 Pairing event queued: ${pairingEvent.id}`);
                }

                const pairedSlotName = placementResult.placedZone || eventData.slotName;
                let pairedUnitColor: string | undefined;
                const player = gameEnv.getPlayer(playerId);
                if (pairedSlotName && player?.zones) {
                    const slotResult = SlotZoneUtils.getSlotZone(player.zones, pairedSlotName);
                    if (slotResult.isValid) {
                        pairedUnitColor = slotResult.slot?.unit?.cardData?.color;
                    }
                }

                const globalResult = PairingGlobalEffectManager.enqueueGlobalPairingTriggeredEffects(gameEnv, playerId, {
                    pairedUnitColor
                });
                if (!globalResult.success) {
                    console.log(`⚠️ Global pairing effect error: ${globalResult.error}`);
                } else if ((globalResult.effectsQueued || 0) > 0) {
                    console.log(`🌐 Global pairing effects queued: ${globalResult.effectsQueued}`);
                }
            }

            if (placementResult.isOnLink) {
                console.log(`🔗 Link detected - enabling play-turn attack for linked unit`);
                PlayerCardManager.handleLinkFormation(gameEnv, playerId, eventData.carduid);
            }

            console.log(
                `🔄 Card entered play processed${placementResult.isOnPair ? ` (${placementResult.isOnLink ? 'Link' : 'Pair'} created)` : ''}`
            );

            if (BattlePhaseManager.isActionWindowOpen(gameEnv) &&
                BattlePhaseManager.playerInActiveBattle(gameEnv, playerId)) {
                const postPlayEvent = EventFactory.createActionStepPostPlayEvent(playerId);
                gameEnv.enqueueForProcessing(postPlayEvent);
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
