// src/services/PlayerCardManager.ts
// Player card placement and management system

import { GameEnvironment } from '../models/GameEnvironment';
import { GameEngine } from './GameEngine';
import { createZoneCard, UnitZoneCard, PilotZoneCard, BaseCard } from '../models/CardSystem';
import { SLOT_ZONES } from '../config/gameConstants';
import { v4 as uuidv4 } from 'uuid';

export interface CardPlacementResult {
    success: boolean;
    error?: string;
    placedZone?: string;
    isOnLink?: boolean;      // Whether the placement created a link (unit + pilot same card family)
    isOnPair?: boolean;      // Whether the placement created a pair (any unit + pilot combination)
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
        // Use local utility to find first empty slot
        const targetZone = PlayerCardManager.findFirstEmptySlot(playerZones);

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

        // Analyze the placement result for link/pair status
        const { isOnLink, isOnPair } = this.analyzePlacementResult(playerZones, targetZone, 'unit');

        return {
            success: true,
            placedZone: targetZone,
            isOnLink,
            isOnPair
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

        // Use local utility to find target unit slot
        const { slot: targetZone } = PlayerCardManager.findSlotByCardUid({ zones: playerZones }, targetUnit);

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

        // Analyze the placement result for link/pair status
        const { isOnLink, isOnPair } = this.analyzePlacementResult(playerZones, targetZone, 'pilot');

        return {
            success: true,
            placedZone: targetZone,
            isOnLink,
            isOnPair
        };
    }

    /**
     * Place command card - placeholder implementation
     */
    private static placeCommandCard(
        _playerZones: any,
        _cardData: any,
        cardUID: string,
        _playerId: string
    ): CardPlacementResult {
        console.log(`🚧 [PLACEHOLDER] Command card placement for ${cardUID} - not yet implemented`);
        // TODO: Implement command card placement logic
        // Command cards might go to a specific command zone or have special rules

        return {
            success: false,
            error: `Command card placement not yet implemented for ${cardUID}`,
            isOnLink: false,
            isOnPair: false
        };
    }

    /**
     * Place base card - replaces existing base or places new one
     */
    private static placeBaseCard(
        playerZones: any,
        cardData: any,
        cardUID: string,
        playerId: string
    ): CardPlacementResult {
        try {
            console.log(`🏗️ Placing base card ${cardUID} for player ${playerId}`);

            // Check if base[0] exists (base zone is an array)
            if (playerZones.base && playerZones.base.length > 0) {
                const existingBase = playerZones.base[0];
                console.log(`🏗️ Existing base found: ${existingBase.cardUid}, moving to trash`);

                // Move existing base to trash area
                if (!playerZones.trashArea) {
                    playerZones.trashArea = [];
                }
                playerZones.trashArea.push(existingBase);

                // Clear the base zone
                playerZones.base = [];
                console.log(`🗑️ Moved existing base ${existingBase.cardUid} to trash`);
            }

            // Create new base card using proper BaseCard interface from CardSystem
            const baseCard = createZoneCard(
                cardUID,
                cardData.id,
                cardData,
                playerId,
                'base'
            ) as BaseCard;

            // Initialize base zone if it doesn't exist
            if (!playerZones.base) {
                playerZones.base = [];
            }

            // Place new base card in base[0]
            playerZones.base.push(baseCard);
            console.log(`🏗️ Placed new base card ${cardUID} in base zone`);

            // Analyze the placement result (base cards don't create pairs but for consistency)
            const { isOnLink, isOnPair } = this.analyzePlacementResult(playerZones, 'base', 'base');

            return {
                success: true,
                placedZone: 'base',
                isOnLink,
                isOnPair
            };

        } catch (error) {
            console.error(`❌ Error placing base card ${cardUID}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Base card placement failed',
                isOnLink: false,
                isOnPair: false
            };
        }
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

    // ============ LINK AND PAIR DETECTION HELPERS ============

    /**
     * Check if a slot has both unit and pilot (any combination = pair)
     * 
     * A "pair" occurs when any unit card is combined with any pilot card in the same slot.
     * This is different from a "link" which requires the cards to be from the same family.
     * 
     * @param playerZones - The player's zone structure containing all slots
     * @param slotName - The specific slot to check (e.g., "slot1", "slot2", etc.)
     * @returns true if both unit and pilot cards exist in the slot, false otherwise
     * 
     * Examples:
     * - Unit "Gundam" + Pilot "Amuro" = pair (true)
     * - Unit "Gundam" + Pilot "Char" = pair (true) 
     * - Unit "Gundam" only = not a pair (false)
     * - Pilot "Amuro" only = not a pair (false)
     * - Empty slot = not a pair (false)
     */
    private static isPairInSlot(playerZones: any, slotName: string): boolean {
        // Access the specific slot from the player's zones
        const slot = playerZones[slotName];

        // Use optional chaining (?.) to safely access properties
        // Use logical AND (&&) to ensure BOTH unit and pilot exist
        // Use double negation (!!) to convert the result to a strict boolean
        return !!(slot?.unit && slot?.pilot);
    }

    /**
     * Check if unit and pilot in a slot are from the same card family (link)
     * 
     * A "link" occurs when a unit's link field matches either:
     * 1. The pilot's name (regular pilot cards)
     * 2. One of the pilot's traits (regular pilot cards)
     * 3. The pilotName from designate_pilot effect (command cards played as pilots)
     * 
     * @param playerZones - The player's zone structure containing all slots
     * @param slotName - The specific slot to check (e.g., "slot1", "slot2", etc.)
     * @returns true if unit and pilot are linked, false otherwise
     * 
     * Examples:
     * - Unit with link: ["Amuro"] + Pilot with name: "Amuro" = link (true)
     * - Unit with link: ["Newtype"] + Pilot with traits: ["Newtype", "Hero"] = link (true)
     * - Unit with link: ["Hayato Kobayashi"] + Command card with designate_pilot.pilotName: "Hayato Kobayashi" = link (true)
     * - Unit with link: ["Amuro"] + Pilot with name: "Char" = no link (false)
     */
    private static isLinkInSlot(playerZones: any, slotName: string): boolean {
        const slot = playerZones[slotName];
        if (!slot?.unit || !slot?.pilot) {
            return false;
        }

        // Try to get link from unit card (check both direct property and cardData)
        const unit = slot.unit;
        const pilot = slot.pilot;

        // Get unit's link field - check direct property first, then cardData
        const unitLink = unit.cardData?.link;
        if (!unitLink || !Array.isArray(unitLink) || unitLink.length === 0) {
            return false;
        }

        // Determine pilot name for matching - handle both regular pilots and command cards with designate_pilot effect
        let pilotNameForMatching: string | null = null;
        let pilotTraits: string[] = [];
        let isCommandCardPilot = false;

        // Check if this is a command card played as pilot
        if (pilot.playedAs === 'pilot' && pilot.cardData?.cardType === 'command') {
            isCommandCardPilot = true;
            // Look for designate_pilot effect
            const designatePilotEffect = pilot.cardData?.effects?.rules?.find((rule: any) =>
                rule.effect?.action === 'designate_pilot'
            );

            if (designatePilotEffect?.effect?.parameters?.pilotName) {
                pilotNameForMatching = designatePilotEffect.effect.parameters.pilotName;
                console.log(`🎯 Command card as pilot: using designate_pilot.pilotName="${pilotNameForMatching}"`);
            } else {
                console.warn(`⚠️ Command card played as pilot but no designate_pilot effect found for ${pilot.cardUid}`);
            }
        } else {
            // Regular pilot card - use name and traits
            pilotNameForMatching = pilot.cardData?.name || null;
            pilotTraits = pilot.cardData?.traits || [];
        }

        console.log(`🔗 Checking link: unit.link=${JSON.stringify(unitLink)}, pilotName="${pilotNameForMatching}", pilotTraits=${JSON.stringify(pilotTraits)}, isCommandCardPilot=${isCommandCardPilot}`);

        // Check if unit's link matches pilot name (including designate_pilot name)
        if (pilotNameForMatching && unitLink.includes(pilotNameForMatching)) {
            console.log(`✅ Link found: unit.link includes pilot name "${pilotNameForMatching}" ${isCommandCardPilot ? '(from designate_pilot effect)' : ''}`);
            return true;
        }

        // For regular pilot cards, also check traits
        if (!isCommandCardPilot) {
            for (const linkValue of unitLink) {
                if (pilotTraits.includes(linkValue)) {
                    console.log(`✅ Link found: unit.link "${linkValue}" matches pilot trait`);
                    return true;
                }
            }
        }

        console.log(`❌ No link found between unit and pilot`);
        return false;
    }

    /**
     * Analyze placement result for link/pair status
     * Returns the state after placement has occurred
     * 
     * @param playerZones - The player's zone structure
     * @param placedZone - The zone where the card was placed
     * @param placedCardType - The type of card that was placed ('unit', 'pilot', etc.)
     * @returns Object with isOnLink and isOnPair boolean flags
     */
    private static analyzePlacementResult(playerZones: any, placedZone: string, placedCardType: string): { isOnLink: boolean; isOnPair: boolean } {
        // Check if slot has both unit and pilot after placement
        // isOnPair need to check placedCardType
        const isOnPair = this.isPairInSlot(playerZones, placedZone) && placedCardType == "pilot";

        // Only check for link if we have a pair
        const isOnLink = isOnPair ? this.isLinkInSlot(playerZones, placedZone) : false;

        console.log(`🔍 Placement analysis for ${placedZone} (placed ${placedCardType}): isOnPair=${isOnPair}, isOnLink=${isOnLink}`);

        return { isOnLink, isOnPair };
    }

    /**
     * Handle link formation - set linked unit's isFirstPlay to false
     * This method should be called when a link is detected after card placement
     * 
     * @param gameEnv - Game environment
     * @param playerId - Player who owns the linked unit
     * @param cardUID - The cardUID of the card that was just placed (typically pilot)
     */
    static handleLinkFormation(gameEnv: GameEnvironment, playerId: string, cardUID: string): void {
        try {
            console.log(`🔗 Processing link formation for player ${playerId}, card ${cardUID}`);

            const player = gameEnv.players[playerId];
            if (!player || !player.zones) {
                console.error(`❌ Could not find player ${playerId} or zones`);
                return;
            }

            // Find the slot containing the cardUID that was just placed using type-safe access
            let targetSlot: keyof Pick<typeof player.zones, 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6'> | null = null;

            for (const slotName of SLOT_ZONES) {
                const slotKey = slotName as keyof Pick<typeof player.zones, 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6'>;
                const slot = player.zones[slotKey];
                if (slot?.unit?.cardUid === cardUID || slot?.pilot?.cardUid === cardUID) {
                    targetSlot = slotKey;
                    break;
                }
            }

            if (!targetSlot) {
                console.error(`❌ Could not find slot containing card ${cardUID}`);
                return;
            }

            console.log(`🎯 Found card ${cardUID} in slot ${targetSlot}`);

            // Access the slot and get the unit card using type-safe access
            const slot = player.zones[targetSlot];
            if (!slot || !slot.unit) {
                console.error(`❌ No unit found in slot ${targetSlot} for link formation`);
                return;
            }

            const unitCard = slot.unit;
            console.log(`📋 Processing unit ${unitCard.cardUid} for link formation`);

            // Set the unit's isFirstPlay to false since it's now linked
            const previousFirstPlay = unitCard.isFirstPlay;
            unitCard.isFirstPlay = false;

            console.log(`✅ Link formation complete: Unit ${unitCard.cardUid} isFirstPlay changed from ${previousFirstPlay} to ${unitCard.isFirstPlay}`);

        } catch (error) {
            console.error(`❌ Error handling link formation:`, error);
        }
    }

    // ============ CARD MANAGEMENT UTILITIES ============

    /**
     * Draw cards from deck to hand
     */
    static drawCards(deck: any, count: number): void {
        for (let i = 0; i < count && deck.mainDeck.length > 0; i++) {
            const drawnCard = deck.mainDeck.shift();
            if (drawnCard) {
                deck._handUids.push(drawnCard);
            }
        }
        console.log(`🃏 Drew ${count} cards, hand size: ${deck._handUids.length}`);
    }

    /**
     * Find which slot contains a specific card UID
     */
    static findSlotByCardUid(player: any, cardUid: string): { slot: string | null, unit: UnitZoneCard | null } {
        for (const slot of SLOT_ZONES) {
            const slotZone = (player.zones as any)[slot];
            if (slotZone?.unit?.cardUid === cardUid) {
                return { slot, unit: slotZone.unit as UnitZoneCard };
            }
        }
        
        return { slot: null, unit: null };
    }

    /**
     * Find first empty unit slot
     */
    static findFirstEmptySlot(playerZones: any): string | null {
        for (const zone of SLOT_ZONES) {
            const slotZone = playerZones[zone];
            if (slotZone && !slotZone.unit) {
                return zone;
            }
        }
        
        return null;
    }

    /**
     * Create unique card instance with UUID
     */
    static createUniqueCardId(originalCardId: string): string {
        let cleanCardId = originalCardId;
        if(originalCardId.split("/").length > 1){
            cleanCardId = originalCardId.split("/")[1];
        }
        // Add UUID to make each card instance unique
        return `${cleanCardId}_${uuidv4()}`;
    }

    /**
     * Move a card to trash area
     */
    static moveCardToTrash(gameEnv: GameEnvironment, playerId: string, cardUid: string, cardId: string, cardData: any): boolean {
        try {
            const player = gameEnv.getPlayer(playerId);
            if (!player || !player.zones) {
                console.error(`❌ Could not find player ${playerId} or zones`);
                return false;
            }

            // Initialize trash area if it doesn't exist
            if (!player.zones.trashArea) {
                player.zones.trashArea = [];
            }

            // Create trash card with card data
            const trashCard = createZoneCard(cardUid, cardId, cardData, playerId);
            player.zones.trashArea.push(trashCard);

            console.log(`🗑️ Card ${cardUid} moved to trash`);
            return true;
        } catch (error) {
            console.error(`❌ Error moving card to trash:`, error);
            return false;
        }
    }

    /**
     * Move a card (unit or pilot) to trash area after being destroyed
     */
    static moveCardToTrashFromSlot(gameEnv: GameEnvironment, playerId: string, slotName: string, card: UnitZoneCard | PilotZoneCard, cardType: 'unit' | 'pilot'): boolean {
        try {
            const player = gameEnv.getPlayer(playerId);
            if (!player || !player.zones) {
                console.error(`❌ Could not find player ${playerId} or zones`);
                return false;
            }

            // Initialize trash area if it doesn't exist
            if (!player.zones.trashArea) {
                player.zones.trashArea = [];
            }

            // Create trash card with card data
            const trashCard = createZoneCard(card.cardUid, card.cardId, card.cardData, playerId);
            player.zones.trashArea.push(trashCard);

            // Remove card from slot
            const slot = (player.zones as any)[slotName];
            if (slot) {
                if (cardType === 'unit') {
                    slot.unit = null;
                } else if (cardType === 'pilot') {
                    slot.pilot = null;
                }
            }

            console.log(`🗑️ ${cardType.charAt(0).toUpperCase() + cardType.slice(1)} ${card.cardUid} moved to trash from ${slotName}`);
            return true;
        } catch (error) {
            console.error(`❌ Error moving ${cardType} to trash:`, error);
            return false;
        }
    }

    /**
     * Update unit HP
     */
    static updateUnitHP(unit: UnitZoneCard, newHP: number): void {
        unit.currentHP = Math.max(0, newHP);
        console.log(`🩹 Updated unit HP to ${unit.currentHP}`);
    }

    /**
     * Update pilot HP
     */
    static updatePilotHP(pilot: PilotZoneCard, newHP: number): void {
        pilot.currentHP = Math.max(0, newHP);
        console.log(`🩹 Updated pilot HP to ${pilot.currentHP}`);
    }

    /**
     * Calculate combined stats for unit and pilot in a slot
     */
    static calculateCombinedStats(player: any, slotName: string, unit: UnitZoneCard): { totalAP: number, totalHP: number } {
        // Get base unit stats and apply unit-specific modifications
        let currentAP = unit.currentAP|| 0;
        let currentHP = unit.currentHP || 0;
        
        // Get pilot in the same slot if exists
        const pilot = (player.zones as any)[slotName]?.pilot;
        
        if (pilot) {
            // Add pilot stats to unit stats
            const pilotAP = pilot.currentAP || pilot.cardData?.ap || 0;
            const pilotHP = pilot.currentHP || pilot.cardData?.hp || 0;
            
            currentAP += pilotAP;
            currentHP += pilotHP;
            
            console.log(`🔢 Combined stats: Unit(${unit.currentAP || 0}/${unit.currentHP || 0}) + Pilot(${pilotAP}/${pilotHP}) = Total(${currentAP}/${currentHP})`);
        } else {
            console.log(`🔢 Unit only stats: ${currentAP}/${currentHP}`);
        }
        
        return {
            totalAP: currentAP,
            totalHP: currentHP
        };
    }

    /**
     * Check if a card has Deploy effects (ENTERS_PLAY triggers) using cardUID to extract cardId and fetch card data
     */
    static checkForDeployEffects(cardUID: string): any[] {
        console.log("checkForDeployEffects using cardUID:", cardUID);
        
        // Extract cardId from cardUID (remove UUID suffix)
        const cardId = cardUID.split('_')[0];
        
        // Get card data from GameEngine's card database
        const cardData = GameEngine.getCardDetails(cardId);
        if (!cardData) {
            console.warn(`⚠️ Card data not found for ${cardId}`);
            return [];
        }
        
        console.log(`📋 Checking deploy effects for card: ${cardData.name} (${cardId})`);
        
        // Check if card has effects with ENTERS_PLAY trigger
        const deployEffects: any[] = [];
        
        if (cardData.effects && cardData.effects.rules) {
            for (const rule of cardData.effects.rules) {
                if (rule.trigger === 'ENTERS_PLAY') {
                    deployEffects.push(rule);
                    console.log(`🎯 Found deploy effect: ${rule.effect?.action || 'unknown'}`);
                }
            }
        }
        
        console.log(`✅ Found ${deployEffects.length} deploy effects for ${cardUID}`);
        return deployEffects;
    }
}