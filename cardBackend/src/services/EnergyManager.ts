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
    shouldConsume: boolean;
}

export interface EnergyPaymentResult {
    success: boolean;
    tapped: EnergyZoneCard[];
    error?: string;
}

export interface EnergyCheckResult {
    success: boolean;
    error?: string;
    tapped: EnergyZoneCard[];
    requirements: EnergyRequirement;
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

            return player.zones.energyArea.reduce((total, energyCard) => {
                return total + (energyCard.isRested ? 0 : 1); // Each energy card provides 1 energy
            }, 0);
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
    static tapEnergyForCost(gameEnv: GameEnvironment, playerId: string, cost: number): EnergyPaymentResult {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones || !player.zones.energyArea) {
                return {
                    success: false,
                    tapped: [],
                    error: `Player ${playerId} has no energy area`
                };
            }

            const availableEnergy = this.getAvailableEnergy(gameEnv, playerId);
            if (availableEnergy < cost) {
                console.log(`❌ Insufficient energy: need ${cost}, have ${availableEnergy}`);
                return {
                    success: false,
                    tapped: [],
                    error: `Insufficient energy: need ${cost}, have ${availableEnergy}`
                };
            }

            let remainingCost = cost;
            const tappedCards: EnergyZoneCard[] = [];
            for (const energyCard of player.zones.energyArea) {
                if (!energyCard.isRested && remainingCost > 0) {
                    energyCard.isRested = true;
                    remainingCost -= 1; // Each energy card provides 1 energy
                    console.log(`⚡ Tapped 1 energy from ${energyCard.cardId}`);
                    tappedCards.push(energyCard);
                }
            }

            return {
                success: remainingCost === 0,
                tapped: tappedCards,
                error: remainingCost === 0 ? undefined : `Failed to tap ${cost} energy`
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

    static validateEnergyForCard(
        gameEnv: GameEnvironment,
        playerId: string,
        cardData: any,
        options: EnergyValidationOptions = {}
    ): EnergyValidationResult {
        const requirements = getEnergyRequirement(cardData);
        const availableEnergy = this.getAvailableEnergy(gameEnv, playerId);
        const shouldConsume = !options.fromBurst && !isEnergyCard(cardData) && requirements.cost > 0;

        if (options.fromBurst || isEnergyCard(cardData)) {
            return {
                isValid: true,
                requirements,
                availableEnergy,
                shouldConsume: false
            };
        }

        if (requirements.level > 0 && availableEnergy < requirements.level) {
            return {
                isValid: false,
                error: `Not enough active energy: require ${requirements.level}, have ${availableEnergy}`,
                requirements,
                availableEnergy,
                shouldConsume
            };
        }

        if (requirements.cost > 0 && availableEnergy < requirements.cost) {
            return {
                isValid: false,
                error: `Not enough active energy to pay cost ${requirements.cost} (available ${availableEnergy})`,
                requirements,
                availableEnergy,
                shouldConsume
            };
        }

        return {
            isValid: true,
            requirements,
            availableEnergy,
            shouldConsume
        };
    }

    static payEnergyCost(gameEnv: GameEnvironment, playerId: string, cost: number): EnergyPaymentResult {
        if (cost <= 0) {
            return {
                success: true,
                tapped: []
            };
        }

        return this.tapEnergyForCost(gameEnv, playerId, cost);
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
                tapped: []
            };
        }

        return this.payEnergyCost(gameEnv, playerId, requirements.cost);
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
                requirements: validation.requirements
            };
        }

        if (!validation.shouldConsume) {
            return {
                success: true,
                tapped: [],
                requirements: validation.requirements
            };
        }

        const payment = this.payEnergyCost(gameEnv, playerId, validation.requirements.cost);
        if (!payment.success) {
            return {
                success: false,
                error: payment.error,
                tapped: payment.tapped,
                requirements: validation.requirements
            };
        }

        return {
            success: true,
            tapped: payment.tapped,
            requirements: validation.requirements
        };
    }
}
