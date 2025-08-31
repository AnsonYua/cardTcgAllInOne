// src/services/EnergyManager.ts
// Energy card management and resource allocation system

import { GameEnvironment } from '../models/GameEnvironment';
import { EnergyZoneCard, EnergyCardData, createZoneCard } from '../models/CardSystem';

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

            const basicEnergyData: EnergyCardData = {
                id: 'energy_basic',
                name: 'Basic Energy',
                cardType: 'energy' as const,
                color: 'neutral',
                level: 1,
                cost: 0,
                zone: ['energy'],
                traits: [],
                link: [],
                ap: 0,
                hp: 0,
                effects: { description: [], rules: [] },
                energyType: 'permanent' as const,
                energyValue: 1
            };

            const cardUid = `energy_basic_${Date.now()}_${Math.random()}`;
            const basicEnergyCard = createZoneCard(cardUid, 'energy_basic', basicEnergyData, playerId) as EnergyZoneCard;

            player.zones.energyArea.push(basicEnergyCard);
            console.log(`⚡ Added basic energy to player ${playerId}`);
            return true;

        } catch (error) {
            console.error(`❌ Error adding basic energy to ${playerId}:`, error);
            return false;
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

            const extraEnergyData: EnergyCardData = {
                id: 'energy_extra',
                name: 'Extra Energy',
                cardType: 'energy' as const,
                color: 'neutral',
                level: 1,
                cost: 0,
                zone: ['energy'],
                traits: [],
                link: [],
                ap: 0,
                hp: 0,
                effects: { description: [], rules: [] },
                energyType: 'permanent' as const,
                energyValue: 1
            };

            const cardUid = `energy_extra_${Date.now()}_${Math.random()}`;
            const extraEnergyCard = createZoneCard(cardUid, 'energy_extra', extraEnergyData, playerId) as EnergyZoneCard;
            extraEnergyCard.isExtraEnergy = true;

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
                return total + (energyCard.isRested ? 0 : (energyCard.energyValue || energyCard.cardData.energyValue));
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
                .reduce((total, energyCard) => total + (energyCard.energyValue || energyCard.cardData.energyValue), 0);
        } catch (error) {
            console.error(`❌ Error calculating available energy for ${playerId}:`, error);
            return 0;
        }
    }

    /**
     * Tap energy cards to pay cost
     */
    static tapEnergyForCost(gameEnv: GameEnvironment, playerId: string, cost: number): boolean {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones || !player.zones.energyArea) {
                return false;
            }

            const availableEnergy = this.getAvailableEnergy(gameEnv, playerId);
            if (availableEnergy < cost) {
                console.log(`❌ Insufficient energy: need ${cost}, have ${availableEnergy}`);
                return false;
            }

            let remainingCost = cost;
            for (const energyCard of player.zones.energyArea) {
                if (!energyCard.isRested && remainingCost > 0) {
                    const energyValue = energyCard.energyValue || energyCard.cardData.energyValue;
                    const energyToTap = Math.min(energyValue, remainingCost);
                    if (energyToTap > 0) {
                        energyCard.isRested = true;
                        remainingCost -= energyToTap;
                        console.log(`⚡ Tapped ${energyToTap} energy from ${energyCard.cardId}`);
                    }
                }
            }

            return remainingCost === 0;
        } catch (error) {
            console.error(`❌ Error tapping energy for ${playerId}:`, error);
            return false;
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
}