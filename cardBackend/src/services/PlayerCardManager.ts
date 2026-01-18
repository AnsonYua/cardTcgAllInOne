// src/services/PlayerCardManager.ts
// Player card placement and management system

import { GameEnvironment } from '../models/GameEnvironment';
import { createZoneCard, UnitZoneCard, PilotZoneCard, BaseCard, CardDatabaseManager } from '../models/CardSystem';
import { SLOT_ZONES } from '../config/gameConstants';
import { PlayCardEventData } from './EventQueue/interfaces/GameEvent';
import { v4 as uuidv4 } from 'uuid';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';
import { getSlotTotals } from '../utils/FieldValueCalculator';
import { ContinuousEffectManager } from './ContinuousEffectManager';
import { GameNotificationManager } from './GameNotificationManager';
import { BaseLifecycleManager } from './BaseLifecycleManager';
import { EffectExecutor } from './effects/EffectExecutor';

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
     * Streamlined card placement - accepts PlayCardEventData directly for type safety and to minimize conversions
     */
    static placeCardWithEventData(
        gameEnv: GameEnvironment,
        playerId: string,
        eventData: PlayCardEventData
    ): CardPlacementResult {
        try {
            // Use eventData object directly to minimize property extraction conversions
            const player = gameEnv.players[playerId];
            if (!player || !player.zones) {
                return {
                    success: false,
                    error: `Player ${playerId} or zones not found`
                };
            }

            const fullCardData = CardDatabaseManager.getCardDetailsFromCarduid(eventData.carduid);
            if (!fullCardData) {
                return {
                    success: false,
                    error: `Card data not found for ${eventData.carduid} in card database`
                };
            }

            // Use eventData properties directly in method calls to minimize conversions
            switch (eventData.playAs) {
                case 'unit':
                    return this.placeUnitCard(player.zones, 
                                             fullCardData, 
                                             eventData.carduid, 
                                             playerId);

                case 'pilot':
                    return this.placePilotCard(player.zones, 
                                               fullCardData, 
                                               eventData.carduid,
                                               playerId, 
                                               eventData.targetUnit);

                case 'command':
                    return this.placeCommandCard(player.zones, 
                                                 fullCardData, 
                                                 eventData.carduid, 
                                                 playerId);

                case 'base':
                    return this.placeBaseCard(gameEnv, 
                                              player.zones, 
                                              fullCardData, 
                                              eventData.carduid, 
                                              playerId);

                default:
                    return {
                        success: false,
                        error: `cannot play as ${eventData.playAs} for card ${eventData.carduid}`
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
        carduid: string,
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

            // Extract cardId from carduid
            const cardId = carduid.split('_')[0];

            // Load full card data from card database
            const fullCardData = CardDatabaseManager.getCardDetails(cardId);
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
                    return this.placeUnitCard(player.zones, fullCardData, carduid, playerId);

                case 'pilot':
                    return this.placePilotCard(player.zones, fullCardData, carduid, playerId, options.targetUnit);

                case 'command':
                    return this.placeCommandCard(player.zones, fullCardData, carduid, playerId);

                case 'base':
                    return this.placeBaseCard(gameEnv, player.zones, fullCardData, carduid, playerId);

                default:
                    return {
                        success: false,
                        error: `Unknown card type '${cardType}' for card ${carduid}`
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
        carduid: string,
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
            carduid,
            cardData.id,
            cardData,
            playerId,
            'unit'
        ) as UnitZoneCard;

        // Place unit in target slot
        playerZones[targetZone].unit = unitCard;
        console.log(`🎮 Placed unit card ${carduid} in ${targetZone}`);

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
        carduid: string,
        playerId: string,
        targetUnit?: string
    ): CardPlacementResult {
        if (!targetUnit) {
            return {
                success: false,
                error: `Pilot card ${carduid} requires targetUnit parameter`
            };
        }

        // Use local utility to find target unit slot - minimize object destructuring
        const slotResult = PlayerCardManager.findSlotByCarduid({ zones: playerZones }, targetUnit);
        const targetZone = slotResult.slot;

        if (!targetZone) {
            return {
                success: false,
                error: `Target unit ${targetUnit} not found in slots for pilot ${carduid}`
            };
        }

        // Create pilot card using proper PilotZoneCard interface from CardSystem
        // This handles special case where command cards can be played as pilots
        const pilotCard = createZoneCard(
            carduid,
            cardData.id,
            cardData,
            playerId,
            'pilot'
        ) as PilotZoneCard;

        // Place pilot in target slot with unit
        playerZones[targetZone].pilot = pilotCard;
        console.log(`🎮 Placed pilot card ${carduid} with unit in ${targetZone}`);

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
     * Place command card - currently not supported in main placement flow
     * Note: Command cards can be played as pilots via designate_pilot effect
     */
    private static placeCommandCard(
        playerZones: any,
        cardData: any,
        carduid: string,
        playerId: string
    ): CardPlacementResult {
        console.log(`🚧 Command card direct placement not supported for ${carduid}, sending to trash`);

        // Ensure trash area exists
        if (!playerZones.trashArea) {
            playerZones.trashArea = [];
        }

        // Move the command card to trash to acknowledge the play attempt
        const trashCard = createZoneCard(carduid, cardData.id, cardData, playerId, 'command');
        playerZones.trashArea.push(trashCard);
        console.log(`🗑️ Command card ${carduid} moved to trash`);

        return {
            success: true,
            placedZone: 'trashArea',
            isOnLink: false,
            isOnPair: false
        };
    }

    /**
     * Place base card - replaces existing base or places new one
     */
    private static placeBaseCard(
        gameEnv: GameEnvironment,
        playerZones: any,
        cardData: any,
        carduid: string,
        playerId: string
    ): CardPlacementResult {
        try {
            console.log(`🏗️ Placing base card ${carduid} for player ${playerId}`);

            // Check if base[0] exists (base zone is an array)
            if (playerZones.base && playerZones.base.length > 0) {
                const existingBase = playerZones.base[0];
                BaseLifecycleManager.replaceExistingBase(gameEnv, playerId, existingBase);
            }

            // Create new base card using proper BaseCard interface from CardSystem
            const baseCard = createZoneCard(
                carduid,
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
            console.log(`🏗️ Placed new base card ${carduid} in base zone`);

            // Analyze the placement result (base cards don't create pairs but for consistency)
            const { isOnLink, isOnPair } = this.analyzePlacementResult(playerZones, 'base', 'base');

            return {
                success: true,
                placedZone: 'base',
                isOnLink,
                isOnPair
            };

        } catch (error) {
            console.error(`❌ Error placing base card ${carduid}:`, error);
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
    static removeCardFromHand(gameEnv: GameEnvironment, playerId: string, carduid: string): boolean {
        try {
            const player = gameEnv.players[playerId];
            if (!player?.deck?.handUids) {
                return false;
            }

            const handUidIndex = player.deck.handUids.findIndex(uid => uid === carduid);
            if (handUidIndex === -1) {
                return false;
            }

            // Remove card from handUids array only (hand is generated from handUids)
            player.deck.handUids.splice(handUidIndex, 1);
            console.log(`🎮 Removed card ${carduid} from handUids`);

            return true;

        } catch (error) {
            console.error(`❌ Error removing card from hand:`, error);
            return false;
        }
    }

    /**
     * Validate card is in player hand
     */
    static validateCardInHand(gameEnv: GameEnvironment, playerId: string, carduid: string): boolean {
        const player = gameEnv.players[playerId];
        if (!player?.deck?.handUids) {
            return false;
        }

        return player.deck.handUids.includes(carduid);
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
                rule.action === 'designate_pilot'
            );

            if (designatePilotEffect?.parameters?.pilotName) {
                pilotNameForMatching = designatePilotEffect.parameters.pilotName as string;
                console.log(`🎯 Command card as pilot: using designate_pilot.pilotName="${pilotNameForMatching}"`);
            } else {
                console.warn(`⚠️ Command card played as pilot but no designate_pilot effect found for ${pilot.carduid}`);
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
     * Handle link formation - allow linked unit to attack on its play turn
     * This method should be called when a link is detected after card placement
     * 
     * @param gameEnv - Game environment
     * @param playerId - Player who owns the linked unit
     * @param carduid - The carduid of the card that was just placed (typically pilot)
     */
    static handleLinkFormation(gameEnv: GameEnvironment, playerId: string, carduid: string): void {
        try {
            console.log(`🔗 Processing link formation for player ${playerId}, card ${carduid}`);

            const player = gameEnv.players[playerId];
            if (!player || !player.zones) {
                console.error(`❌ Could not find player ${playerId} or zones`);
                return;
            }

            // Find the slot containing the carduid that was just placed using type-safe access
            let targetSlot: keyof Pick<typeof player.zones, 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6'> | null = null;

            for (const slotName of SLOT_ZONES) {
                const slotKey = slotName as keyof Pick<typeof player.zones, 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6'>;
                const slot = player.zones[slotKey];
                if (slot?.unit?.carduid === carduid || slot?.pilot?.carduid === carduid) {
                    targetSlot = slotKey;
                    break;
                }
            }

            if (!targetSlot) {
                console.error(`❌ Could not find slot containing card ${carduid}`);
                return;
            }

            console.log(`🎯 Found card ${carduid} in slot ${targetSlot}`);

            // Access the slot and get the unit card using type-safe access
            const slot = player.zones[targetSlot];
            if (!slot || !slot.unit) {
                console.error(`❌ No unit found in slot ${targetSlot} for link formation`);
                return;
            }

            const unitCard = slot.unit;
            console.log(`📋 Processing unit ${unitCard.carduid} for link formation`);

            const previousOverride = unitCard.canAttackOnPlayTurn;
            if (unitCard.playedThisTurn) {
                unitCard.canAttackOnPlayTurn = true;
            }

            console.log(`✅ Link formation complete: Unit ${unitCard.carduid} canAttackOnPlayTurn changed from ${previousOverride} to ${unitCard.canAttackOnPlayTurn}`);

        } catch (error) {
            console.error(`❌ Error handling link formation:`, error);
        }
    }

    // ============ CARD MANAGEMENT UTILITIES ============

    /**
     * Draw cards from deck to hand
     */
    static drawCards(
        gameEnv: GameEnvironment,
        playerId: string,
        count: number,
        options: { notify?: boolean; drawContext?: string } = {}
    ): void {
        const player = gameEnv.getPlayer(playerId);
        if (!player?.deck || !Array.isArray(player.deck.mainDeck)) {
            console.error(`❌ Cannot draw cards - deck not found for player ${playerId}`);
            return;
        }

        try {
            const beforeHandUids = Array.isArray(player.deck.handUids)
                ? [...player.deck.handUids]
                : [...(player.deck._handUids || [])];
            const beforeCount = beforeHandUids.length;

            EffectExecutor.drawCardsIntoHand(gameEnv, playerId, player.deck, count, options);

            const afterHandUids = Array.isArray(player.deck.handUids)
                ? [...player.deck.handUids]
                : [...(player.deck._handUids || [])];
            const afterCount = afterHandUids.length;
            const drawnCount = Math.max(0, afterCount - beforeCount);
            console.log(`🃏 Drew ${drawnCount} cards, hand size: ${afterCount}`);

            if (options.notify !== false && options.drawContext && drawnCount > 0) {
                const notificationManager = new GameNotificationManager(gameEnv);
                const existingEvents = gameEnv.notificationQueue || [];
                const previousHandSet = new Set(beforeHandUids);
                const newCarduids = afterHandUids.filter(carduid => !previousHandSet.has(carduid));

                for (const carduid of newCarduids) {
                    const alreadyNotified = existingEvents.some(event => {
                        if (event.type !== 'CARD_DRAWN') {
                            return false;
                        }
                        const payload = event.payload as { carduid?: string; playerId?: string; drawContext?: string };
                        return (
                            payload?.carduid === carduid &&
                            payload?.playerId === playerId &&
                            payload?.drawContext === options.drawContext
                        );
                    });

                    if (!alreadyNotified) {
                        notificationManager.addNotificationEvent('CARD_DRAWN', {
                            playerId,
                            carduid,
                            sourceZone: 'deck',
                            reason: 'draw',
                            timestamp: Date.now(),
                            drawContext: options.drawContext
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Failed to draw cards for player ${playerId}:`, error);
        }
    }

    /**
     * Find which slot contains a specific card UID
     */
    static findSlotByCarduid(player: any, carduid: string): { slot: string | null, unit: UnitZoneCard | null } {
        for (const slot of SLOT_ZONES) {
            const slotZone = (player.zones as any)[slot];
            if (slotZone?.unit?.carduid === carduid) {
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
        // Optimize string processing - split once and extract if needed
        const parts = originalCardId.split("/");
        const cleanCardId = parts.length > 1 ? parts[1] : originalCardId;
        return `${cleanCardId}_${uuidv4()}`;
    }

    /**
     * Move a card to trash area
     */
    static moveCardToTrash(gameEnv: GameEnvironment, playerId: string, carduid: string, cardId: string, cardData: any): boolean {
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
            const trashCard = createZoneCard(carduid, cardId, cardData, playerId);
            player.zones.trashArea.push(trashCard);

            console.log(`🗑️ Card ${carduid} moved to trash`);
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
            const trashCard = createZoneCard(card.carduid, card.cardId, card.cardData, playerId);
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

            console.log(`🗑️ ${cardType.charAt(0).toUpperCase() + cardType.slice(1)} ${card.carduid} moved to trash from ${slotName}`);
            return true;
        } catch (error) {
            console.error(`❌ Error moving ${cardType} to trash:`, error);
            return false;
        }
    }

    /**
     * Centralized destroy hook for future expansion (notifications, triggers, etc.).
     */
    static destroyUnitInSlot(gameEnv: GameEnvironment, playerId: string, slotName: string, unit: UnitZoneCard): boolean {
        // TODO: Extend with on-destroy triggers, notifications, and cleanup when effects are added.
        const destroyed = PlayerCardManager.moveCardToTrashFromSlot(gameEnv, playerId, slotName, unit, 'unit');
        if (!destroyed) {
            return false;
        }

        const player = gameEnv.getPlayer(playerId);
        if (player?.zones) {
            const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotName);
            if (slotResult.isValid && slotResult.slot && SlotZoneUtils.hasPilot(slotResult.slot)) {
                const pilotCard = SlotZoneUtils.getPilot(slotResult.slot) as PilotZoneCard | null;
                if (pilotCard) {
                    PlayerCardManager.moveCardToTrashFromSlot(gameEnv, playerId, slotName, pilotCard, 'pilot');
                }
            }
        }

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        return true;
    }



    /**
     * Update unit HP
     */
    static updateUnitDamage(unit: UnitZoneCard, newDamage: number): void {
        unit.damageReceived = (unit.damageReceived || 0) + newDamage;

        const maxHP = unit.originalHP ?? unit.cardData?.hp ?? 0;
        const remainingHP = Math.max(0, maxHP - unit.damageReceived);

        console.log(`🩹 Updated unit damage to ${unit.damageReceived} (remaining HP ${remainingHP})`);
    }

    static getCurrentUnitCardInSlotAPandHP(gameEnv:GameEnvironment , unitCardUid:string): { totalAP: number, totalHP: number } {
        const searchResult = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, unitCardUid);
        if (!searchResult.found || !searchResult.playerId || !searchResult.slotName) {
            return { totalAP: 0, totalHP: 0 };
        }

        const player = gameEnv.players[searchResult.playerId];
        if (!player?.zones) {
            return { totalAP: 0, totalHP: 0 };
        }

        const slotResult = SlotZoneUtils.getSlotZone(player.zones, searchResult.slotName);
        if (!slotResult.isValid || !slotResult.slot) {
            return { totalAP: 0, totalHP: 0 };
        }

        const slot = slotResult.slot;
        const unit = slot.unit as UnitZoneCard | undefined;
        if (!unit || unit.carduid !== unitCardUid) {
            return { totalAP: 0, totalHP: 0 };
        }
        return getSlotTotals(slot);
    }

   

}
