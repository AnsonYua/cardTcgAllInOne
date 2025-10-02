// src/models/Player.ts
// Unified Player class with integrated zone management for custom trading card game

import { ZoneType } from './GameEnums';
import { 
    ZoneCard, 
    UnitZoneCard, 
    PilotZoneCard, 
    CommandZoneCard, 
    BaseCard,
    EnergyZoneCard,
    CardData,
    createZoneCard,
    isUnitZoneCard,
    isPilotZoneCard,
    isCommandZoneCard,
    isBaseCard,
    isEnergyZoneCard,
    CardDatabaseManager,
    FieldCardValue
} from './CardSystem';
import { GameEngine } from '../services/GameEngine';
import { calculateBaseFieldValue, calculateSlotFieldValue } from '../utils/FieldValueCalculator';

// ============ ZONE INTERFACES ============

export interface SlotZone {
    unit?: UnitZoneCard;        // Primary unit in slot
    pilot?: PilotZoneCard;      // Pilot paired with unit
    fieldCardValue?:FieldCardValue;
}

export interface PlayerZones {
    slot1: SlotZone;
    slot2: SlotZone;
    slot3: SlotZone;
    slot4: SlotZone;
    slot5: SlotZone;
    slot6: SlotZone;
    base: BaseCard[];
    shieldArea: ZoneCard[];    // Any card from deck can be placed as shield
    energyArea: EnergyZoneCard[];  // Energy cards for resource management
    trashArea: ZoneCard[];     // Discarded/destroyed cards
    repairAbilitiesCheckedThisCycle?: boolean;
}

// ============ ZONE UTILITY FUNCTIONS ============

export const isBaseZone = (zone: ZoneType): zone is ZoneType.BASE => {
    return zone === ZoneType.BASE;
};

export const isSlotZone = (zone: ZoneType): boolean => {
    return [ZoneType.SLOT1, ZoneType.SLOT2, ZoneType.SLOT3, ZoneType.SLOT4, ZoneType.SLOT5, ZoneType.SLOT6].includes(zone);
};

export const isShieldZone = (zone: ZoneType): zone is ZoneType.SHIELD => {
    return zone === ZoneType.SHIELD;
};

export const isEnergyZone = (zone: ZoneType): zone is ZoneType.ENERGY => {
    return zone === ZoneType.ENERGY;
};

export const isTrashZone = (zone: ZoneType): zone is ZoneType.TRASH => {
    return zone === ZoneType.TRASH;
};

export type ZoneContent = ZoneCard[] | undefined;

export const isZoneCardArray = (content: ZoneContent): content is ZoneCard[] => {
    return Array.isArray(content) && (content.length === 0 || 'carduid' in content[0]);
};

// ============ PLAYER FIELD EFFECTS ============
// Field effects system removed - not currently implemented in game logic

interface ContinuousModifiers {
    continueModifyAP?: number;
    continueModifyHP?: number;
    modifyAP?: number;
    modifyHP?: number;
}

export interface SerializedSlot {
    unit?: UnitZoneCard;
    pilot?: PilotZoneCard;
    fieldCardValue: FieldCardValue;
}

export interface SerializedPlayerZones {
    slot1: SerializedSlot;
    slot2: SerializedSlot;
    slot3: SerializedSlot;
    slot4: SerializedSlot;
    slot5: SerializedSlot;
    slot6: SerializedSlot;
    base: BaseCard[];
    shieldArea: ZoneCard[];
    energyArea: EnergyZoneCard[];
    trashArea: ZoneCard[];
    repairAbilitiesCheckedThisCycle?: boolean;
}

export function hasContinuousModifiers(card: ZoneCard): card is ZoneCard & ContinuousModifiers {
    return 'continueModifyAP' in card || 'continueModifyHP' in card;
}

// ============ PLACEHOLDER DECK CLASS ============
// This is a simplified placeholder - implement proper deck management for your custom game

export interface HandCard {
    carduid: string;
    cardId: string;
    cardData: any;
}

export class PlayerDeck {
    public _handUids: string[] = [];
    public mainDeck: string[] = [];

    constructor(data: any = {}) {
        this._handUids = data.hand || [];
        this.mainDeck = data.mainDeck || [];
    }
    
    /**
     * Get hand as array of card objects with details from global card database
     */
    get hand(): HandCard[] {
        return this._handUids.map(carduid => {
            const cardId = carduid.split('_')[0];
            const cardData = CardDatabaseManager.getCardDetails(cardId);
            
            return {
                carduid,
                cardId,
                cardData: cardData || {
                    id: cardId,
                    name: `Unknown Card ${cardId}`,
                    cardType: 'unknown',
                    power: 0
                }
            };
        });
    }
    
    /**
     * Get raw hand UIDs for internal operations
     */
    get handUids(): string[] {
        return this._handUids;
    }

    drawCard(): string | null {
        const carduid = this.mainDeck.pop() || null;
        if (carduid) {
            this._handUids.push(carduid);
        }
        return carduid;
    }

    getHandSize(): number {
        return this._handUids.length;
    }

    getDeckSize(): number {
        return this.mainDeck.length;
    }


    playCardFromHand(carduid: string, zone: string): boolean {
        const cardIndex = this._handUids.indexOf(carduid);
        if (cardIndex >= 0) {
            this._handUids.splice(cardIndex, 1);
            return true;
        }
        return false;
    }


    getCardIdFromUid(uid: string): string {
        return uid.split('_')[0] || uid;
    }

    toJSON(): any {
        return {
            hand: this.hand, // Use getter to include card details
            handUids: this._handUids, // Keep UIDs for internal operations
            mainDeck: this.mainDeck,
        };
    }

    static fromJSON(data: any): PlayerDeck {
        const deck = new PlayerDeck();
        deck._handUids = data.handUids || data.hand || [];
        deck.mainDeck = data.mainDeck || [];
        return deck;
    }
}

// ============ PLAYER CLASS ============

export class Player {
    public id: string;
    public name: string;
    public deck: PlayerDeck;
    public confirmIsRedraw: boolean;
    public isRedraw?: boolean; // Store their actual redraw choice
    public playerPoint: number;
    public isReady: boolean;
    // fieldEffects removed - not currently implemented
    public zones!: PlayerZones;
    
    // ============ EFFECT SYSTEMS ARCHITECTURE (January 2025) ============
    
    // 1. CONTINUOUS EFFECTS REGISTRY
    // Purpose: Tracks persistent effects from cards in play (leaders, paired units)
    // Lifecycle: Added when cards enter play, removed when they leave
    // Processing: Managed by ContinuousEffectManager.ts, applied during continuous effects phase
    // Example: Leader power boosts, pairing bonuses that last while conditions are met
    // Storage: gameEnv.players[id].effectRegistry
    public effectRegistry: { [effectKey: string]: any } = {};
    
    // 2. TEMPORARY EFFECTS (CARD-LEVEL STORAGE)
    // Purpose: Short-term effects that expire (UNTIL_END_OF_TURN, etc.)
    // Storage: Stored directly on individual cards in card.temporaryEffects arrays
    // Processing: Managed by DeployTargetManager.ts
    // Location: gameEnv.players[id].zones.slotX.unit.temporaryEffects
    // Example: ST01-006 "When Paired" -3 AP effect until end of turn

    constructor(id: string, name: string = id) {
        this.id = id;
        this.name = name;
        this.confirmIsRedraw = false;
        this.playerPoint = 0;
        this.isReady = false;
        this.deck = new PlayerDeck();
        this.effectRegistry = {};
        this.initializeZones();
    }

    // ============ ZONE INITIALIZATION ============

    public initializeZones(): void {
        this.zones = {
            slot1: {},
            slot2: {},
            slot3: {},
            slot4: {},
            slot5: {},
            slot6: {},
            base: [],
            shieldArea: [],
            energyArea: [],
            trashArea: [],
            repairAbilitiesCheckedThisCycle: false
        };
    }

    // ============ ZONE MANAGEMENT ============

    public setCardInZone(zone: ZoneType, carduid: string, cardData?: CardData): void {
        console.log(`🔍 Player.setCardInZone ENTRY: playerId=${this.id}, zone=${zone}, carduid=${carduid}`);
        
        const normalizedZone = zone.toLowerCase() as ZoneType;
        const cardId = carduid.split("_")[0];
        
        let resolvedCardData = cardData;
        if (!resolvedCardData) {
            console.warn(`🚧 [PLACEHOLDER] setCardInZone: Using fallback data for ${cardId}`);
            
            resolvedCardData = { 
                id: cardId, 
                name: `Unknown Card ${cardId}`,
                cardType: 'unit',
                color: 'Blue',
                level: 1,
                cost: 1,
                zone: ['Space', 'Earth'],
                traits: [],
                link: [],
                ap: 1,
                hp: 1,
                effects: { description: [], rules: [] }
            };
        }
        
        // Use createZoneCard for all card types now
        const zoneCard = createZoneCard(carduid, cardId, resolvedCardData, this.id);
        
        if (isSlotZone(normalizedZone)) {
            // Type-safe access to slot zones
            const slotKey = normalizedZone as keyof Pick<PlayerZones, 'slot1'|'slot2'|'slot3'|'slot4'|'slot5'|'slot6'>;
            const slotZone = this.zones[slotKey] as SlotZone;
            
            if (zoneCard.cardData?.cardType === 'unit') {
                slotZone.unit = zoneCard as UnitZoneCard;
                console.log(`✅ Set unit in ${zone}: ${carduid}`);
            } else if (zoneCard.cardData?.cardType === 'pilot') {
                slotZone.pilot = zoneCard as PilotZoneCard;
                console.log(`✅ Set pilot in ${zone}: ${carduid}`);
            } else {
                console.warn(`⚠️ Invalid card type ${zoneCard.cardData?.cardType} for slot zone ${zone}`);
            }
            
        } else if (normalizedZone === ZoneType.BASE) {
            this.zones.base.push(zoneCard as BaseCard);
            
        } else if (normalizedZone === ZoneType.SHIELD) {
            // Shield can accept any card type from deck
            this.zones.shieldArea.push(zoneCard);
            console.log(`✅ Set shield card in ${zone}: ${carduid}`);
            
        } else if (normalizedZone === ZoneType.ENERGY) {
            // Energy cards go to energy zone
            this.zones.energyArea.push(zoneCard as EnergyZoneCard);
            console.log(`✅ Set energy card in ${zone}: ${carduid}`);
            
        } else if (normalizedZone === ZoneType.TRASH) {
            // Any card can go to trash area
            this.zones.trashArea.push(zoneCard);
            console.log(`🗑️ Set card in trash area: ${carduid}`);
            
        } else {
            console.warn(`⚠️ Unknown zone placement for card type ${zoneCard.cardData?.cardType} in zone ${normalizedZone}`);
        }
        
        console.log(`✅ Set card in zone: ${carduid} (${cardId}) → ${zone} for player ${this.id}`);
    }

    public setCardInZoneWithData(zone: ZoneType, carduid: string, cardData: any): void {
        this.setCardInZone(zone, carduid, cardData);
    }

    public getCardInZone(zone: ZoneType, cardType: 'unit' | 'pilot' = 'unit'): string | null {
        if (isSlotZone(zone)) {
            const slotKey = zone as keyof Pick<PlayerZones, 'slot1'|'slot2'|'slot3'|'slot4'|'slot5'|'slot6'>;
            const slotZone = this.zones[slotKey] as SlotZone;
            
            const card = cardType === 'pilot' ? slotZone.pilot : slotZone.unit;
            return card?.carduid || null;
        }
        
        if (zone === ZoneType.SHIELD) {
            return this.zones.shieldArea.length > 0 ? this.zones.shieldArea[0].carduid : null;
        }
        
        if (zone === ZoneType.ENERGY) {
            return this.zones.energyArea.length > 0 ? this.zones.energyArea[0].carduid : null;
        }
        
        if (zone === ZoneType.TRASH) {
            return this.zones.trashArea.length > 0 ? this.zones.trashArea[0].carduid : null;
        }
        
        const targetZone = this.zones[zone];
        if (Array.isArray(targetZone) && targetZone.length > 0) {
            const zoneCard = targetZone[0] as ZoneCard;
            return zoneCard.carduid || null;
        }
        
        return null;
    }
    
    public getCardObjectInZone(zone: ZoneType, cardType: 'unit' | 'pilot' = 'unit'): ZoneCard | null {
        if (isSlotZone(zone)) {
            const slotKey = zone as keyof Pick<PlayerZones, 'slot1'|'slot2'|'slot3'|'slot4'|'slot5'|'slot6'>;
            const slotZone = this.zones[slotKey] as SlotZone;
            
            return cardType === 'pilot' ? slotZone.pilot || null : slotZone.unit || null;
        }
        
        if (zone === ZoneType.SHIELD) {
            return this.zones.shieldArea.length > 0 ? this.zones.shieldArea[0] : null;
        }
        
        if (zone === ZoneType.ENERGY) {
            return this.zones.energyArea.length > 0 ? this.zones.energyArea[0] : null;
        }
        
        if (zone === ZoneType.TRASH) {
            return this.zones.trashArea.length > 0 ? this.zones.trashArea[0] : null;
        }
        
        const targetZone = this.zones[zone];
        if (Array.isArray(targetZone) && targetZone.length > 0) {
            return targetZone[0] as ZoneCard;
        }
        
        return null;
    }

    public isZoneOccupied(zone: ZoneType, cardType?: 'unit' | 'pilot'): boolean {
        if (isSlotZone(zone)) {
            const slotKey = zone as keyof Pick<PlayerZones, 'slot1'|'slot2'|'slot3'|'slot4'|'slot5'|'slot6'>;
            const slotZone = this.zones[slotKey] as SlotZone;
            
            if (cardType === 'pilot') return !!slotZone.pilot;
            if (cardType === 'unit') return !!slotZone.unit;
            return !!slotZone.unit || !!slotZone.pilot; // Either occupied
        }
        
        if (zone === ZoneType.SHIELD) {
            return this.zones.shieldArea.length > 0;
        }
        
        if (zone === ZoneType.ENERGY) {
            return this.zones.energyArea.length > 0;
        }
        
        if (zone === ZoneType.TRASH) {
            return this.zones.trashArea.length > 0;
        }
        
        return this.getCardInZone(zone) !== null;
    }

    public isSlotCompletelyOccupied(zone: ZoneType): boolean {
        if (isSlotZone(zone)) {
            const slotKey = zone as keyof Pick<PlayerZones, 'slot1'|'slot2'|'slot3'|'slot4'|'slot5'|'slot6'>;
            const slotZone = this.zones[slotKey] as SlotZone;
            return !!(slotZone.unit && slotZone.pilot);
        }
        return false;
    }

    public clearZone(zone: ZoneType, cardType?: 'unit' | 'pilot'): void {
        if (isSlotZone(zone)) {
            const slotKey = zone as keyof Pick<PlayerZones, 'slot1'|'slot2'|'slot3'|'slot4'|'slot5'|'slot6'>;
            const slotZone = this.zones[slotKey] as SlotZone;
            
            if (cardType === 'unit') {
                slotZone.unit = undefined;
            } else if (cardType === 'pilot') {
                slotZone.pilot = undefined;
            } else {
                slotZone.unit = undefined;
                slotZone.pilot = undefined;
            }
        } else if (zone === ZoneType.BASE) {
            this.zones.base.length = 0;
        } else if (zone === ZoneType.SHIELD) {
            this.zones.shieldArea.length = 0;
        } else if (zone === ZoneType.ENERGY) {
            this.zones.energyArea.length = 0;
        } else if (zone === ZoneType.TRASH) {
            this.zones.trashArea.length = 0;
        } else {
            const targetZone = this.zones[zone];
            if (Array.isArray(targetZone)) {
                targetZone.length = 0;
            }
        }
    }

    // ============ ZONE VALIDATION METHODS ============

    public areAllSlotZonesFilled(): boolean {
        return this.isZoneOccupied(ZoneType.SLOT1, 'unit') &&
               this.isZoneOccupied(ZoneType.SLOT2, 'unit') &&
               this.isZoneOccupied(ZoneType.SLOT3, 'unit') &&
               this.isZoneOccupied(ZoneType.SLOT4, 'unit') &&
               this.isZoneOccupied(ZoneType.SLOT5, 'unit') &&
               this.isZoneOccupied(ZoneType.SLOT6, 'unit');
    }

    public isBaseZoneFilled(): boolean {
        return this.isZoneOccupied(ZoneType.BASE);
    }

    public getOccupiedSlotCount(cardType: 'unit' | 'pilot' = 'unit'): number {
        let count = 0;
        const slotZones = [ZoneType.SLOT1, ZoneType.SLOT2, ZoneType.SLOT3, ZoneType.SLOT4, ZoneType.SLOT5, ZoneType.SLOT6];
        slotZones.forEach(zone => {
            if (this.isZoneOccupied(zone, cardType)) count++;
        });
        return count;
    }

    public getPairedSlotCount(): number {
        let count = 0;
        const slotZones = [ZoneType.SLOT1, ZoneType.SLOT2, ZoneType.SLOT3, ZoneType.SLOT4, ZoneType.SLOT5, ZoneType.SLOT6];
        slotZones.forEach(zone => {
            if (this.isSlotCompletelyOccupied(zone)) count++;
        });
        return count;
    }

    // Backward compatibility methods
    public areAllCharacterZonesFilled(): boolean {
        return this.areAllSlotZonesFilled();
    }

    public isHelpZoneFilled(): boolean {
        return this.isBaseZoneFilled();
    }

    public isSpZoneFilled(): boolean {
        return false; // SP zones don't exist in new system
    }

    // ============ SHIELD ZONE METHODS ============

    public getShieldCards(): ZoneCard[] {
        return this.zones.shieldArea;
    }

    public getShieldCount(): number {
        return this.zones.shieldArea.length;
    }

    public hasShield(): boolean {
        return this.zones.shieldArea.length > 0;
    }

    public addShieldCard(carduid: string, cardData?: CardData): void {
        this.setCardInZone(ZoneType.SHIELD, carduid, cardData);
    }

    public removeShieldCard(carduid: string): boolean {
        const index = this.zones.shieldArea.findIndex(card => card.carduid === carduid);
        if (index >= 0) {
            this.zones.shieldArea.splice(index, 1);
            return true;
        }
        return false;
    }

    // ============ ATTACK MANAGEMENT METHODS ============

    public declareAttack(attackerZone: ZoneType): boolean {
        if (!isSlotZone(attackerZone)) return false;
        
        const slotKey = attackerZone as keyof Pick<PlayerZones, 'slot1'|'slot2'|'slot3'|'slot4'|'slot5'|'slot6'>;
        const slotZone = this.zones[slotKey];
        
        if (!slotZone.unit) return false;
        
        // Units can attack multiple times - no limitations
        console.log(`⚔️ Unit ${slotZone.unit.carduid} declares attack from ${attackerZone}`);
        return true;
    }

    public resetTurnStatus(): void {
        const slotZones = [ZoneType.SLOT1, ZoneType.SLOT2, ZoneType.SLOT3, ZoneType.SLOT4, ZoneType.SLOT5, ZoneType.SLOT6];
        slotZones.forEach(zone => {
            const slotKey = zone as keyof Pick<PlayerZones, 'slot1'|'slot2'|'slot3'|'slot4'|'slot5'|'slot6'>;
            const slotZone = this.zones[slotKey];
            if (slotZone.unit) {
                slotZone.unit.damageReceived = 0; // Reset damage for new turn
                slotZone.unit.isFirstPlay = false; // No longer first turn
            }
        });
        
        // Reset repair abilities flag for new turn
        this.zones.repairAbilitiesCheckedThisCycle = false;
    }

    public getAllUnits(): UnitZoneCard[] {
        const allUnits: UnitZoneCard[] = [];
        const slotZones = [ZoneType.SLOT1, ZoneType.SLOT2, ZoneType.SLOT3, ZoneType.SLOT4, ZoneType.SLOT5, ZoneType.SLOT6];
        
        slotZones.forEach(zone => {
            const slotKey = zone as keyof Pick<PlayerZones, 'slot1'|'slot2'|'slot3'|'slot4'|'slot5'|'slot6'>;
            const slotZone = this.zones[slotKey];
            if (slotZone.unit) {
                allUnits.push(slotZone.unit);
            }
        });
        
        return allUnits;
    }


    public canUnitAttack(zone: ZoneType): boolean {
        if (!isSlotZone(zone)) return false;
        
        const slotKey = zone as keyof Pick<PlayerZones, 'slot1'|'slot2'|'slot3'|'slot4'|'slot5'|'slot6'>;
        const slotZone = this.zones[slotKey];
        
        return !!(slotZone.unit && !slotZone.unit.isRested);
    }

    public isUnitFirstPlay(zone: ZoneType): boolean {
        if (!isSlotZone(zone)) return false;
        
        const slotKey = zone as keyof Pick<PlayerZones, 'slot1'|'slot2'|'slot3'|'slot4'|'slot5'|'slot6'>;
        const slotZone = this.zones[slotKey];
        
        return slotZone.unit?.isFirstPlay || false;
    }

    public applyDamageToUnit(zone: ZoneType, damage: number): boolean {
        if (!isSlotZone(zone)) return false;
        
        const slotKey = zone as keyof Pick<PlayerZones, 'slot1'|'slot2'|'slot3'|'slot4'|'slot5'|'slot6'>;
        const slotZone = this.zones[slotKey];
        
        if (!slotZone.unit) return false;
        
        // Apply damage
        slotZone.unit.damageReceived = (slotZone.unit.damageReceived || 0) + damage;
        
        console.log(`🩸 Unit ${slotZone.unit.carduid} takes ${damage} damage (total: ${slotZone.unit.damageReceived})`);
        return true;
    }

    public getUnitDamage(zone: ZoneType): number {
        if (!isSlotZone(zone)) return 0;
        
        const slotKey = zone as keyof Pick<PlayerZones, 'slot1'|'slot2'|'slot3'|'slot4'|'slot5'|'slot6'>;
        const slotZone = this.zones[slotKey];
        
        return slotZone.unit?.damageReceived || 0;
    }

    // ============ ENERGY MANAGEMENT METHODS ============

    public getEnergyCards(): EnergyZoneCard[] {
        return this.zones.energyArea;
    }

    public getAvailableEnergy(): number {
        return this.zones.energyArea
            .filter(card => !card.isRested && !card.isExtraEnergy)
            .length; // Each energy card provides 1 energy
    }

    public getTotalEnergyValue(): number {
        return this.zones.energyArea
            .filter(card => !card.isExtraEnergy)
            .length; // Each energy card provides 1 energy
    }

    public tapEnergy(carduid: string): boolean {
        const energyCard = this.zones.energyArea.find(card => card.carduid === carduid);
        if (!energyCard || energyCard.isRested || energyCard.isExtraEnergy) return false;
        
        energyCard.isRested = true;
        console.log(`⚡ Energy ${carduid} tapped`);
        return true;
    }

    public consumeEnergy(carduid: string): boolean {
        const energyCard = this.zones.energyArea.find(card => card.carduid === carduid);
        if (!energyCard || energyCard.isExtraEnergy) return false;
        
        // All energy cards are consumable in the simplified system
        energyCard.isExtraEnergy = true;
        console.log(`💥 Consumable energy ${carduid} consumed and removed`);
        return true;
    }

    public untapAllEnergy(): void {
        this.zones.energyArea.forEach(card => {
            if (!card.isExtraEnergy) {
                card.isRested = false;
            }
        });
        console.log(`🔄 All energy untapped for player ${this.id}`);
    }

    public removeConsumedEnergy(): void {
        this.zones.energyArea = this.zones.energyArea.filter(card => !card.isExtraEnergy);
        console.log(`🧹 Consumed energy cards removed for player ${this.id}`);
    }

    // ============ TRASH AREA METHODS ============

    public getTrashCards(): ZoneCard[] {
        return this.zones.trashArea;
    }

    public getTrashCount(): number {
        return this.zones.trashArea.length;
    }

    public hasTrash(): boolean {
        return this.zones.trashArea.length > 0;
    }

    public addTrashCard(carduid: string, cardData?: CardData): void {
        this.setCardInZone(ZoneType.TRASH, carduid, cardData);
    }

    public removeTrashCard(carduid: string): boolean {
        const index = this.zones.trashArea.findIndex(card => card.carduid === carduid);
        if (index >= 0) {
            this.zones.trashArea.splice(index, 1);
            return true;
        }
        return false;
    }

    public clearTrash(): void {
        this.zones.trashArea.length = 0;
        console.log(`🗑️ Trash area cleared for player ${this.id}`);
    }

    // ============ DECK METHODS ============


    public drawCard(): string | null {
        return this.deck.drawCard();
    }

    public playCardFromHand(carduid: string, zone: string = 'slot1'): boolean {
        return this.deck.playCardFromHand(carduid, zone);
    }

    public getHandSize(): number {
        return this.deck.getHandSize();
    }

    public getDeckSize(): number {
        return this.deck.getDeckSize();
    }


    public getCardIdFromUid(carduid: string): string | null {
        return this.deck.getCardIdFromUid(carduid);
    }

    // ============ FIELD EFFECTS ============
    // Field effects system removed - not currently implemented in game logic
    
    public initializeGameStateOnly(): void {
        this.playerPoint = 0;
    }

    // ============ SERIALIZATION ============

    public toJSON(): any {
        const serializedZones = this.serializeZonesForResponse();
        return {
            id: this.id,
            name: this.name,
            deck: this.deck.toJSON(),
            confirmIsRedraw: this.confirmIsRedraw,
            isRedraw: this.isRedraw,
            playerPoint: this.playerPoint,
            isReady: this.isReady,
            zones: serializedZones,
            // fieldEffects removed - not currently implemented
            effectRegistry: this.effectRegistry
        };
    }

    public static fromJSON(data: any): Player {
        const player = new Player(data.id, data.name);
        if (data.deck) {
            player.deck = PlayerDeck.fromJSON(data.deck);
        }
        player.confirmIsRedraw = data.confirmIsRedraw || data.redraw || false;
        player.isRedraw = data.isRedraw;
        player.playerPoint = data.playerPoint || 0;
        player.isReady = data.isReady || false;
        if (data.zones) {
            player.zones = data.zones;
        }
        
        // Restore effect registry
        player.effectRegistry = data.effectRegistry || {};
        
        // Legacy effects structure removed - no longer needed
        // effectRegistry is now the primary effects system
        
        // Clean up any legacy effects data from old save files
        if (data.effects) {
            console.log(`🧹 Removing legacy effects data from player ${data.id} save file`);
            delete data.effects;
        }
        
        // fieldEffects removed - not currently implemented
        return player;
    }

    private serializeZonesForResponse(): SerializedPlayerZones {
        type MutableCard<T extends ZoneCard> = T & Partial<ContinuousModifiers>;

        const serializeCard = <T extends ZoneCard>(card: T | undefined): T | undefined => {
            if (!card) {
                return undefined;
            }

            const serialized = { ...card } as MutableCard<T>;

            return serialized;
        };

        const serializeSlot = (slot: SlotZone | undefined): SerializedSlot => {
            const unit = serializeCard(slot?.unit);
            const pilot = serializeCard(slot?.pilot);

            return {
                unit,
                pilot,
                fieldCardValue: calculateSlotFieldValue(slot)
            };
        };

        return {
            slot1: serializeSlot(this.zones.slot1),
            slot2: serializeSlot(this.zones.slot2),
            slot3: serializeSlot(this.zones.slot3),
            slot4: serializeSlot(this.zones.slot4),
            slot5: serializeSlot(this.zones.slot5),
            slot6: serializeSlot(this.zones.slot6),
            base: this.zones.base.map((card) => this.maximizeBaseCard(card)),
            shieldArea: this.zones.shieldArea.map((card) => serializeCard(card) ?? card),
            energyArea: this.zones.energyArea.map((card) => serializeCard(card) ?? card),
            trashArea: this.zones.trashArea.map((card) => serializeCard(card) ?? card),
            repairAbilitiesCheckedThisCycle: this.zones.repairAbilitiesCheckedThisCycle
        };
    }

    private maximizeBaseCard(card: BaseCard): BaseCard {
        const serialized = { ...card };
        serialized.fieldCardValue = calculateBaseFieldValue(card);
        return serialized;
    }

}
