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

        if (!fromBurst) {
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

        const energyResult: EnergyCheckResult = EnergyManager.validateAndPayEnergyForCard(
            gameEnv,
            playerId,
            cardData,
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
                const handUids = player.deck._handUids;
                if (!handUids.includes(eventData.carduid)) {
                    handUids.push(eventData.carduid);
                }
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
