// src/services/PlayerCardManager.ts
// Player card placement and management system

import { GameEnvironment } from '../models/GameEnvironment';
import { GameEngine } from './GameEngine';
import { createZoneCard, UnitZoneCard, PilotZoneCard, CommandZoneCard, BaseCard } from '../models/CardSystem';

export interface CardPlacementResult {
    success: boolean;
    error?: string;
    placedZone?: string;
}

export interface CardPlacementOptions {
    targetUnit?: string;
    [key: string]: any;
}

export class PlayerCardManager {
    
    /**
     * Streamlined card placement - accepts event data directly to minimize conversions
     */
    static placeCardWithEventData(
        gameEnv: GameEnvironment, 
        eventData: any
    ): CardPlacementResult {
        try {
            const { playerId, cardUID, playAs, targetUnit } = eventData;
            
            const player = gameEnv.players[playerId];
            if (!player || !player.zones) {
                return {
                    success: false,
                    error: `Player ${playerId} or zones not found`
                };
            }

            // Extract cardId from cardUID
            const cardId = cardUID.split('_')[0];
            
            // Load full card data from card database
            const fullCardData = GameEngine.getCardDetails(cardId);
            if (!fullCardData) {
                return {
                    success: false,
                    error: `Card data not found for ${cardId} in card database`
                };
            }

        
            switch (playAs) {
                case 'unit':
                    return this.placeUnitCard(player.zones, fullCardData, cardUID, playerId);
                    
                case 'pilot':
                    return this.placePilotCard(player.zones, fullCardData, cardUID, playerId, targetUnit);
                    
                case 'command':
                    return this.placeCommandCard(player.zones, fullCardData, cardUID, playerId);
                    
                case 'base':
                    return this.placeBaseCard(player.zones, fullCardData, cardUID, playerId);
                    
                default:
                    return {
                        success: false,
                        error: `cannot play as ${playAs} for card ${cardUID}`
                    };
            }

        } catch (error) {
            console.error(`❌ Error in placeCardWithEventData:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Card placement failed'
            };
        }
    }
    
    /**
     * Main card placement interface - handles all card types
     */
    static placeCard(
        gameEnv: GameEnvironment, 
        playerId: string, 
        cardUID: string, 
        options: CardPlacementOptions = {}
    ): CardPlacementResult {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones) {
                return {
                    success: false,
                    error: `Player ${playerId} or zones not found`
                };
            }

            // Extract cardId from cardUID
            const cardId = cardUID.split('_')[0];
            
            // Load full card data from card database
            const fullCardData = GameEngine.getCardDetails(cardId);
            if (!fullCardData) {
                return {
                    success: false,
                    error: `Card data not found for ${cardId} in card database`
                };
            }

            // Route to specific card type handler
            const cardType = fullCardData.cardType;
            console.log(`🎯 Placing card ${cardId} type: ${cardType}`);

            switch (cardType) {
                case 'unit':
                    return this.placeUnitCard(player.zones, fullCardData, cardUID, playerId);
                    
                case 'pilot':
                    return this.placePilotCard(player.zones, fullCardData, cardUID, playerId, options.targetUnit);
                    
                case 'command':
                    return this.placeCommandCard(player.zones, fullCardData, cardUID, playerId);
                    
                case 'base':
                    return this.placeBaseCard(player.zones, fullCardData, cardUID, playerId);
                    
                default:
                    return {
                        success: false,
                        error: `Unknown card type '${cardType}' for card ${cardUID}`
                    };
            }

        } catch (error) {
            console.error(`❌ Error in placeCard:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Card placement failed'
            };
        }
    }

    /**
     * Place unit card in first empty slot
     */
    private static placeUnitCard(
        playerZones: any, 
        cardData: any, 
        cardUID: string, 
        playerId: string
    ): CardPlacementResult {
        // Use GameEngine utility to find first empty slot
        const targetZone = GameEngine.findFirstEmptySlot(playerZones);
        
        if (!targetZone) {
            return {
                success: false,
                error: `No empty unit slots available in zones slot1-slot6`
            };
        }

        // Create unit card using proper UnitZoneCard interface from CardSystem
        const unitCard = createZoneCard(
            cardUID,
            cardData.id,
            cardData,
            playerId,
            'unit'
        ) as UnitZoneCard;
        
        // Place unit in target slot
        playerZones[targetZone].unit = unitCard;
        console.log(`🎮 Placed unit card ${cardUID} in ${targetZone}`);
        
        return {
            success: true,
            placedZone: targetZone
        };
    }

    /**
     * Place pilot card on target unit
     */
    private static placePilotCard(
        playerZones: any, 
        cardData: any, 
        cardUID: string, 
        playerId: string,
        targetUnit?: string
    ): CardPlacementResult {
        if (!targetUnit) {
            return {
                success: false,
                error: `Pilot card ${cardUID} requires targetUnit parameter`
            };
        }

        // Use GameEngine utility to find target unit slot
        const { slot: targetZone } = GameEngine.findSlotByCardUid({ zones: playerZones }, targetUnit);
        
        if (!targetZone) {
            return {
                success: false,
                error: `Target unit ${targetUnit} not found in slots for pilot ${cardUID}`
            };
        }

        // Create pilot card using proper PilotZoneCard interface from CardSystem
        // This handles special case where command cards can be played as pilots
        const pilotCard = createZoneCard(
            cardUID,
            cardData.id,
            cardData,
            playerId,
            'pilot'
        ) as PilotZoneCard;
        
        // Place pilot in target slot with unit
        playerZones[targetZone].pilot = pilotCard;
        console.log(`🎮 Placed pilot card ${cardUID} with unit in ${targetZone}`);
        
        return {
            success: true,
            placedZone: targetZone
        };
    }

    /**
     * Place command card - placeholder implementation
     */
    private static placeCommandCard(
        playerZones: any, 
        cardData: any, 
        cardUID: string, 
        playerId: string
    ): CardPlacementResult {
        console.log(`🚧 [PLACEHOLDER] Command card placement for ${cardUID} - not yet implemented`);
        // TODO: Implement command card placement logic
        // Command cards might go to a specific command zone or have special rules
        
        return {
            success: false,
            error: `Command card placement not yet implemented for ${cardUID}`
        };
    }

    /**
     * Place base card - placeholder implementation  
     */
    private static placeBaseCard(
        playerZones: any, 
        cardData: any, 
        cardUID: string, 
        playerId: string
    ): CardPlacementResult {
        console.log(`🚧 [PLACEHOLDER] Base card placement for ${cardUID} - not yet implemented`);
        // TODO: Implement base card placement logic
        // Base cards might go to base zone or have special placement rules
        
        return {
            success: false,
            error: `Base card placement not yet implemented for ${cardUID}`
        };
    }

    /**
     * Remove card from player hand (handUids only)
     */
    static removeCardFromHand(gameEnv: GameEnvironment, playerId: string, cardUID: string): boolean {
        try {
            const player = gameEnv.players[playerId];
            if (!player?.deck?.handUids) {
                return false;
            }

            const handUidIndex = player.deck.handUids.findIndex(uid => uid === cardUID);
            if (handUidIndex === -1) {
                return false;
            }

            // Remove card from handUids array only (hand is generated from handUids)
            player.deck.handUids.splice(handUidIndex, 1);
            console.log(`🎮 Removed card ${cardUID} from handUids`);
            
            return true;

        } catch (error) {
            console.error(`❌ Error removing card from hand:`, error);
            return false;
        }
    }

    /**
     * Validate card is in player hand
     */
    static validateCardInHand(gameEnv: GameEnvironment, playerId: string, cardUID: string): boolean {
        const player = gameEnv.players[playerId];
        if (!player?.deck?.handUids) {
            return false;
        }

        return player.deck.handUids.includes(cardUID);
    }
}