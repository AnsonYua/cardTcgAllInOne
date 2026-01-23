// src/services/PlayCardPreparationManager.ts
// Centralized validation and setup for PLAY_CARD events

import { GameEnvironment } from '../models/GameEnvironment';
import { Player } from '../models/Player';
import { PlayCardEventData } from './EventQueue/interfaces/GameEvent';
import { GameValidator } from './GameValidator';
import { getCardIdFromUid } from '../utils/CardUtils';
import { CardDatabaseManager, EnergyZoneCard } from '../models/CardSystem';
import { EnergyManager, EnergyCheckResult } from './EnergyManager';
import { PlayerCardManager } from './PlayerCardManager';
import { EffectExecutor } from './effects/EffectExecutor';
import { HandContinuousModifier } from './effects/HandContinuousModifier';
import { GameNotificationManager } from './GameNotificationManager';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';
import { UnitRestrictionUtils } from './restrictions/UnitRestrictionUtils';
import { RestrictionNotificationEmitter } from './restrictions/RestrictionNotificationEmitter';

export interface PlayCardPreparationFailure {
    success: false;
    error: string;
}

export interface PlayCardPreparationSuccess {
    success: true;
    player: Player;
    cardId: string;
    cardData: any;
    tappedEnergy: EnergyZoneCard[];
    fromBurst: boolean;
    rollback: () => void;
}

export type PlayCardPreparationResult = PlayCardPreparationSuccess | PlayCardPreparationFailure;

export class PlayCardPreparationManager {

    static prepare(
        gameEnv: GameEnvironment,
        playerId: string,
        eventData: PlayCardEventData,
        fromBurst: boolean
    ): PlayCardPreparationResult {

        const isActionStepCommand =
            eventData.playAs === 'command' && gameEnv.currentBattle?.status === 'ACTION_STEP';

        if (isActionStepCommand) {
            const { attackingPlayerId, defendingPlayerId } = gameEnv.currentBattle!;
            if (playerId !== attackingPlayerId && playerId !== defendingPlayerId) {
                return {
                    success: false,
                    error: 'Command cards during ACTION_STEP can only be played by battle participants'
                };
            }
        }

        if (!fromBurst && !isActionStepCommand) {
            const turnValidation = GameValidator.validatePlayerTurn(gameEnv, playerId);
            if (!turnValidation.isValid) {
                return {
                    success: false,
                    error: turnValidation.error || 'It is not your turn'
                };
            }
        }

        const playerValidation = GameValidator.validatePlayerZones(gameEnv, playerId);
        if (!playerValidation.isValid || !playerValidation.player) {
            return {
                success: false,
                error: playerValidation.error || 'Player zones invalid'
            };
        }
        const player = playerValidation.player;

        const cardId = getCardIdFromUid(eventData.carduid);
        const cardData = CardDatabaseManager.getCardDetails(cardId);
        if (!cardData) {
            return {
                success: false,
                error: `Card data not found for ${cardId}`
            };
        }

        if (eventData.playAs === 'pilot') {
            const targetUid = typeof eventData.targetUnit === 'string' ? eventData.targetUnit : '';
            const slotResult = targetUid ? SlotZoneUtils.findSlotByCarduid(player.zones, targetUid) : { slotName: null, unit: null };
            if (!slotResult.unit) {
                return {
                    success: false,
                    error: `Target unit ${eventData.targetUnit || ''} not found for pilot play`
                };
            }

            if (UnitRestrictionUtils.cannotBePairedWithPilot(slotResult.unit as any)) {
                RestrictionNotificationEmitter.emitPairingBlocked(gameEnv, {
                    playerId,
                    pilotCarduid: eventData.carduid,
                    targetUnitCarduid: targetUid,
                    reason: 'restrict_pairing'
                });
                return {
                    success: false,
                    error: 'Target unit cannot be paired with a pilot'
                };
            }
        }

        const cardDataForEnergy = HandContinuousModifier.applyModifiersForHandCardPlay(
            gameEnv,
            playerId,
            cardData
        );

        if (cardDataForEnergy && (cardDataForEnergy.cost !== cardData.cost || cardDataForEnergy.level !== cardData.level)) {
            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.addNotificationEvent(
                'HAND_CARD_MODIFIERS_APPLIED',
                {
                    playerId,
                    carduid: eventData.carduid,
                    cardId,
                    baseCost: cardData.cost,
                    effectiveCost: cardDataForEnergy.cost,
                    baseLevel: cardData.level,
                    effectiveLevel: cardDataForEnergy.level,
                    timestamp: Date.now()
                },
                'normal'
            );
        }

        const energyResult: EnergyCheckResult = EnergyManager.validateAndPayEnergyForCard(
            gameEnv,
            playerId,
            cardDataForEnergy,
            { fromBurst }
        );

        if (!energyResult.success) {
            return {
                success: false,
                error: energyResult.error || 'Energy payment failed'
            };
        }

        if (!fromBurst) {
            const handValidation = GameValidator.validateCardInHand(gameEnv, playerId, eventData.carduid);
            if (!handValidation.isValid) {
                this.rollbackEnergy(gameEnv, playerId, energyResult.tapped, energyResult.consumedExtras);
                return {
                    success: false,
                    error: handValidation.error || 'Card not in hand'
                };
            }

            if (!PlayerCardManager.removeCardFromHand(gameEnv, playerId, eventData.carduid)) {
                this.rollbackEnergy(gameEnv, playerId, energyResult.tapped, energyResult.consumedExtras);
                return {
                    success: false,
                    error: `Failed to remove card ${eventData.carduid} from hand`
                };
            }
        }

        const rollback = () => {
            this.rollbackEnergy(gameEnv, playerId, energyResult.tapped, energyResult.consumedExtras);
            if (!fromBurst) {
                EffectExecutor.addCardToPlayerHand(gameEnv, playerId, eventData.carduid, cardData, 
                {
                    notify: false,
                    reason: 'rollback'
                });
            }
        };

        return {
            success: true,
            player,
            cardId,
            cardData,
            tappedEnergy: energyResult.tapped,
            fromBurst,
            rollback
        };
    }

    private static rollbackEnergy(
        gameEnv: GameEnvironment,
        playerId: string,
        tapped: EnergyZoneCard[],
        consumedExtras: EnergyZoneCard[] = []
    ): void {
        const player = gameEnv.players[playerId];
        const energyArea = player?.zones?.energyArea;
        if (!energyArea) {
            return;
        }

        const consumedIds = new Set(consumedExtras.map(card => card.carduid));

        consumedExtras.forEach(card => {
            if (!energyArea.some(existing => existing.carduid === card.carduid)) {
                card.isRested = false;
                energyArea.push(card);
            }
        });

        tapped.forEach(card => {
            if (!consumedIds.has(card.carduid)) {
                card.isRested = false;
            }
        });
    }
}
