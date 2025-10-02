// src/services/EnergyManager.ts
// Energy card management and resource allocation system

import { GameEnvironment } from '../models/GameEnvironment';
import { EnergyCardData, EnergyZoneCard } from '../models/CardSystem';
import { EnergyRequirement, getEnergyRequirement, isEnergyCard } from '../utils/EnergyUtils';

export interface EnergyValidationOptions {
    fromBurst?: boolean;
}

export interface EnergyValidationResult {
    isValid: boolean;
    error?: string;
    requirements: EnergyRequirement;
    availableEnergy: number;
    totalEnergy: number;
    shouldConsume: boolean;
}

export interface EnergyPaymentResult {
    success: boolean;
    tapped: EnergyZoneCard[];
    consumedExtras?: EnergyZoneCard[];
    error?: string;
}

export interface EnergyCheckResult {
    success: boolean;
    error?: string;
    tapped: EnergyZoneCard[];
    requirements: EnergyRequirement;
    consumedExtras?: EnergyZoneCard[];
}

export class EnergyManager {
    
    /**
     * Add basic energy card to player
     */
    static addBasicEnergy(gameEnv: GameEnvironment, playerId: string): boolean {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones) {
                console.error(`❌ Player ${playerId} or zones not found`);
                return false;
            }

            const carduid = `energy_basic_${Date.now()}_${Math.random()}`;
            const basicEnergyCard: EnergyZoneCard = {
                carduid,
                cardId: 'energy_basic',
                placedAt: Date.now(),
                placedBy: playerId,
                isRested: false,
                isExtraEnergy: false,
                cardData : this.newEnergyCardData()
            };

            player.zones.energyArea.push(basicEnergyCard);
            console.log(`⚡ Added basic energy to player ${playerId}`);
            return true;

        } catch (error) {
            console.error(`❌ Error adding basic energy to ${playerId}:`, error);
            return false;
        }
    }

    static newEnergyCardData():EnergyCardData{
        return {
            cardType: 'energy'
        }
    }
    /**
     * Add extra energy card to player (isExtraEnergy=true)
     */
    static addExtraEnergy(gameEnv: GameEnvironment, playerId: string): boolean {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones) {
                console.error(`❌ Player ${playerId} or zones not found`);
                return false;
            }

            const carduid = `energy_extra_${Date.now()}_${Math.random()}`;
            const extraEnergyCard: EnergyZoneCard = {
                carduid,
                cardId: 'energy_extra',
                placedAt: Date.now(),
                placedBy: playerId,
                isRested: false,
                isExtraEnergy: true,
                cardData : this.newEnergyCardData()
            };

            player.zones.energyArea.push(extraEnergyCard);
            console.log(`⚡ Added extra energy to player ${playerId}`);
            return true;

        } catch (error) {
            console.error(`❌ Error adding extra energy to ${playerId}:`, error);
            return false;
        }
    }

    /**
     * Get total energy value for a player
     */
    static getTotalEnergy(gameEnv: GameEnvironment, playerId: string): number {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones || !player.zones.energyArea) {
                return 0;
            }

            return player.zones.energyArea.length;
        } catch (error) {
            console.error(`❌ Error calculating total energy for ${playerId}:`, error);
            return 0;
        }
    }

    /**
     * Get available (untapped) energy for a player
     */
    static getAvailableEnergy(gameEnv: GameEnvironment, playerId: string): number {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones || !player.zones.energyArea) {
                return 0;
            }

            return player.zones.energyArea
                .filter(energyCard => !energyCard.isRested)
                .length; // Each untapped energy card provides 1 energy
        } catch (error) {
            console.error(`❌ Error calculating available energy for ${playerId}:`, error);
            return 0;
        }
    }

    /**
     * Tap energy cards to pay cost
     */
    static tapEnergyForCost(
        gameEnv: GameEnvironment,
        playerId: string,
        cost: number,
        options: EnergyValidationOptions = {}
    ): EnergyPaymentResult {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones || !player.zones.energyArea) {
                return {
                    success: false,
                    tapped: [],
                    error: `Player ${playerId} has no energy area`
                };
            }

            const activeEnergyCards = player.zones.energyArea.filter(card => !card.isRested);
            if (activeEnergyCards.length < cost) {
                console.log(`❌ Insufficient energy: need ${cost}, have ${activeEnergyCards.length}`);
                return {
                    success: false,
                    tapped: [],
                    error: `Insufficient energy: need ${cost}, have ${activeEnergyCards.length}`
                };
            }

            const sortedActive = this.sortEnergyOrder(activeEnergyCards, options);

            let remainingCost = cost;
            const tappedCards: EnergyZoneCard[] = [];
            const extrasToRemove: EnergyZoneCard[] = [];

            for (const energyCard of sortedActive) {
                if (remainingCost <= 0) {
                    break;
                }

                energyCard.isRested = true;
                remainingCost -= 1;
                console.log(`⚡ Tapped 1 energy from ${energyCard.cardId} (extra=${energyCard.isExtraEnergy})`);
                tappedCards.push(energyCard);

                if (energyCard.isExtraEnergy) {
                    extrasToRemove.push(energyCard);
                }
            }

            if (remainingCost > 0) {
                tappedCards.forEach(card => {
                    card.isRested = false;
                });

                return {
                    success: false,
                    tapped: tappedCards,
                    consumedExtras: [],
                    error: `Failed to tap ${cost} energy`
                };
            }

            extrasToRemove.forEach(extraCard => {
                this.removeEnergyCard(gameEnv, playerId, extraCard.carduid);
            });

            return {
                success: true,
                tapped: tappedCards,
                consumedExtras: extrasToRemove
            };
        } catch (error) {
            console.error(`❌ Error tapping energy for ${playerId}:`, error);
            return {
                success: false,
                tapped: [],
                error: error instanceof Error ? error.message : 'Tap energy failed'
            };
        }
    }

    /**
     * Untap all energy cards for a player (typically at start of turn)
     */
    static untapAllEnergy(gameEnv: GameEnvironment, playerId: string): boolean {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones || !player.zones.energyArea) {
                return false;
            }

            let untappedCount = 0;
            for (const energyCard of player.zones.energyArea) {
                if (energyCard.isRested) {
                    energyCard.isRested = false;
                    untappedCount++;
                }
            }

            if (untappedCount > 0) {
                console.log(`⚡ Untapped ${untappedCount} energy cards for player ${playerId}`);
            }
            return true;

        } catch (error) {
            console.error(`❌ Error untapping energy for ${playerId}:`, error);
            return false;
        }
    }

    static sortEnergyOrder(energyCards: EnergyZoneCard[], options: EnergyValidationOptions = {}): EnergyZoneCard[] {
        if (energyCards.length <= 1) {
            return [...energyCards];
        }

        const normalEnergy = energyCards.filter(card => !card.isExtraEnergy);
        const extraEnergy = energyCards.filter(card => card.isExtraEnergy);

        const orderedNormals = options.fromBurst ? [...normalEnergy] : [...normalEnergy].reverse();
        const orderedExtras = options.fromBurst ? [...extraEnergy] : [...extraEnergy].reverse();

        return [...orderedNormals, ...orderedExtras];
    }

    static removeEnergyCard(gameEnv: GameEnvironment, playerId: string, carduid: string): boolean {
        const player = gameEnv.players[playerId];
        if (!player?.zones?.energyArea) {
            return false;
        }

        const index = player.zones.energyArea.findIndex(card => card.carduid === carduid);
        if (index === -1) {
            console.warn(`⚠️ Could not find extra energy ${carduid} in ${playerId}'s energy area for removal`);
            return false;
        }

        player.zones.energyArea.splice(index, 1);
        console.log(`🧪 Extra energy ${carduid} consumed and removed from ${playerId}'s energy area`);
        return true;
    }

    static validateEnergyForCard(
        gameEnv: GameEnvironment,
        playerId: string,
        cardData: any,
        options: EnergyValidationOptions = {}
    ): EnergyValidationResult {
        const requirements = getEnergyRequirement(cardData);
        const player = gameEnv.players[playerId];
        const energyArea = player?.zones?.energyArea || [];
        const totalEnergy = energyArea.length;
        const activeEnergyCards = energyArea.filter((card: EnergyZoneCard) => !card.isRested);
        const availableEnergy = activeEnergyCards.length;
        const shouldConsume = !options.fromBurst && !isEnergyCard(cardData) && requirements.cost > 0;

        if (options.fromBurst || isEnergyCard(cardData)) {
            return {
                isValid: true,
                requirements,
                availableEnergy,
                totalEnergy,
                shouldConsume: false
            };
        }

        if (requirements.level > 0 && totalEnergy < requirements.level) {
            return {
                isValid: false,
                error: `Not enough energy to meet level ${requirements.level} (have ${totalEnergy})`,
                requirements,
                availableEnergy,
                totalEnergy,
                shouldConsume
            };
        }

        if (requirements.cost > 0 && availableEnergy < requirements.cost) {
            return {
                isValid: false,
                error: `Not enough active energy to pay cost ${requirements.cost} (available ${availableEnergy})`,
                requirements,
                availableEnergy,
                totalEnergy,
                shouldConsume
            };
        }

        return {
            isValid: true,
            requirements,
            availableEnergy,
            totalEnergy,
            shouldConsume
        };
    }

    static payEnergyCost(
        gameEnv: GameEnvironment,
        playerId: string,
        cost: number,
        options: EnergyValidationOptions = {}
    ): EnergyPaymentResult {
        if (cost <= 0) {
            return {
                success: true,
                tapped: [],
                consumedExtras: []
            };
        }

        return this.tapEnergyForCost(gameEnv, playerId, cost, options);
    }

    static payEnergyForCard(
        gameEnv: GameEnvironment,
        playerId: string,
        cardData: any,
        options: EnergyValidationOptions = {}
    ): EnergyPaymentResult {
        const requirements = getEnergyRequirement(cardData);
        if (options.fromBurst || isEnergyCard(cardData) || requirements.cost <= 0) {
            return {
                success: true,
                tapped: [],
                consumedExtras: []
            };
        }

        return this.payEnergyCost(gameEnv, playerId, requirements.cost, options);
    }

    static validateAndPayEnergyForCard(
        gameEnv: GameEnvironment,
        playerId: string,
        cardData: any,
        options: EnergyValidationOptions = {}
    ): EnergyCheckResult {
        const validation = this.validateEnergyForCard(gameEnv, playerId, cardData, options);
        if (!validation.isValid) {
            return {
                success: false,
                error: validation.error,
                tapped: [],
                requirements: validation.requirements,
                consumedExtras: []
            };
        }

        if (!validation.shouldConsume) {
            return {
                success: true,
                tapped: [],
                requirements: validation.requirements,
                consumedExtras: []
            };
        }

        const payment = this.payEnergyCost(gameEnv, playerId, validation.requirements.cost, options);
        if (!payment.success) {
            return {
                success: false,
                error: payment.error,
                tapped: payment.tapped,
                requirements: validation.requirements,
                consumedExtras: payment.consumedExtras || []
            };
        }

        return {
            success: true,
            tapped: payment.tapped,
            requirements: validation.requirements,
            consumedExtras: payment.consumedExtras || []
        };
    }
}
