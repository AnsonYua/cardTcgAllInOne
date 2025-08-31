// src/models/Player.ts
// Unified Player class with integrated zone management for custom trading card game

import { ZoneType } from './GameEnums';
import { 
    BaseZoneCard, 
    UnitZoneCard, 
    PilotZoneCard, 
    CommandZoneCard, 
    BaseStructureZoneCard,
    EnergyZoneCard,
    CardData,
    createZoneCard,
    isUnitZoneCard,
    isPilotZoneCard,
    isCommandZoneCard,
    isBaseStructureZoneCard,
    isEnergyZoneCard
} from './CardSystem';
import { GameEngine } from '../services/GameEngine';

// ============ ZONE INTERFACES ============

export interface SlotZone {
    unit?: UnitZoneCard;        // Primary unit in slot
    pilot?: PilotZoneCard;      // Pilot paired with unit
}

export interface PlayerZones {
    slot1: SlotZone;
    slot2: SlotZone;
    slot3: SlotZone;
    slot4: SlotZone;
    slot5: SlotZone;
    slot6: SlotZone;
    base: BaseStructureZoneCard[];
    shieldArea: BaseZoneCard[];    // Any card from deck can be placed as shield
    energyArea: EnergyZoneCard[];  // Energy cards for resource management
    trashArea: BaseZoneCard[];     // Discarded/destroyed cards
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

export type ZoneContent = BaseZoneCard[] | undefined;

export const isZoneCardArray = (content: ZoneContent): content is BaseZoneCard[] => {
    return Array.isArray(content) && (content.length === 0 || 'cardUid' in content[0]);
};

// ============ PLAYER FIELD EFFECTS ============

export interface FieldEffect {
    effectId: string;
    source: string;
    sourcePlayerId?: string;
    type: string;
    target: {
        scope: 'SELF' | 'OPPONENT' | 'ALL' | 'SPECIFIC';
        zones?: ZoneType[] | 'ALL';
        colors?: string[];
        traits?: string[];
        nameContains?: string[];
        playerId?: string;
        cardIds?: string[];
        level?: string;
        cost?: string;
    };
    value: number | boolean;
    priority?: number;
    unremovable?: boolean;
    isEnabled?: boolean;
    createdAt?: number;
    effectData?: any;
}

export interface PlayerFieldEffects {
    zoneRestrictions: {
        [zone in ZoneType]?: string[] | 'ALL';
    };
    activeEffects: FieldEffect[];
    specialEffects?: {
        zonePlacementFreedom?: boolean;
        immuneToNeutralization?: boolean;
        untargetable?: boolean;
        canPlayFromResource?: boolean;
    };
    disabledCards?: string[];
    restedCards?: string[];
    victoryPointModifiers?: number;
    resourceModifiers?: {
        bonusResources?: number;
        resourceCostReduction?: number;
    };
}

// ============ PLACEHOLDER DECK CLASS ============
// This is a simplified placeholder - implement proper deck management for your custom game

export interface HandCard {
    cardUid: string;
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
        return this._handUids.map(cardUid => {
            const cardId = cardUid.split('_')[0];
            const cardData = GameEngine.getCardDetails(cardId);
            
            return {
                cardUid,
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
        const cardUid = this.mainDeck.pop() || null;
        if (cardUid) {
            this._handUids.push(cardUid);
        }
        return cardUid;
    }

    getHandSize(): number {
        return this._handUids.length;
    }

    getDeckSize(): number {
        return this.mainDeck.length;
    }


    playCardFromHand(cardUid: string, zone: string): boolean {
        const cardIndex = this._handUids.indexOf(cardUid);
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
    public redraw: boolean;
    public playerPoint: number;
    public isReady: boolean;
    public fieldEffects?: PlayerFieldEffects;
    public zones!: PlayerZones;

    constructor(id: string, name: string = id) {
        this.id = id;
        this.name = name;
        this.redraw = false;
        this.playerPoint = 0;
        this.isReady = false;
        this.deck = new PlayerDeck();
        this.initializeZones();
    }

    // ============ ZONE INITIALIZATION ============

    private initializeZones(): void {
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
            trashArea: []
        };
    }

    // ============ ZONE MANAGEMENT ============

    public setCardInZone(zone: ZoneType, cardUid: string, cardData?: CardData): void {
        console.log(`🔍 Player.setCardInZone ENTRY: playerId=${this.id}, zone=${zone}, cardUid=${cardUid}`);
        
        const normalizedZone = zone.toLowerCase() as ZoneType;
        const cardId = cardUid.split("_")[0];
        
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
        
        const zoneCard = createZoneCard(cardUid, cardId, resolvedCardData, this.id);
        
        if (isSlotZone(normalizedZone)) {
            // Type-safe access to slot zones
            const slotKey = normalizedZone as keyof Pick<PlayerZones, 'slot1'|'slot2'|'slot3'|'slot4'|'slot5'|'slot6'>;
            const slotZone = this.zones[slotKey] as SlotZone;
            
            if (zoneCard.cardData.cardType === 'unit') {
                slotZone.unit = zoneCard as UnitZoneCard;
                console.log(`✅ Set unit in ${zone}: ${cardUid}`);
            } else if (zoneCard.cardData.cardType === 'pilot') {
                slotZone.pilot = zoneCard as PilotZoneCard;
                console.log(`✅ Set pilot in ${zone}: ${cardUid}`);
            } else {
                console.warn(`⚠️ Invalid card type ${zoneCard.cardData.cardType} for slot zone ${zone}`);
            }
            
        } else if (normalizedZone === ZoneType.BASE) {
            this.zones.base.push(zoneCard as BaseStructureZoneCard);
            
        } else if (normalizedZone === ZoneType.SHIELD) {
            // Shield can accept any card type from deck
            this.zones.shieldArea.push(zoneCard);
            console.log(`✅ Set shield card in ${zone}: ${cardUid}`);
            
        } else if (normalizedZone === ZoneType.ENERGY) {
            // Energy cards go to energy zone
            this.zones.energyArea.push(zoneCard as EnergyZoneCard);
            console.log(`✅ Set energy card in ${zone}: ${cardUid}`);
            
        } else if (normalizedZone === ZoneType.TRASH) {
            // Any card can go to trash area
            this.zones.trashArea.push(zoneCard);
            console.log(`🗑️ Set card in trash area: ${cardUid}`);
            
        } else {
            console.warn(`⚠️ Unknown zone placement for card type ${zoneCard.cardData.cardType} in zone ${normalizedZone}`);
        }
        
        console.log(`✅ Set card in zone: ${cardUid} (${cardId}) → ${zone} for player ${this.id}`);
    }

    public setCardInZoneWithData(zone: ZoneType, cardUid: string, cardData: any): void {
        this.setCardInZone(zone, cardUid, cardData);
    }

    public getCardInZone(zone: ZoneType, cardType: 'unit' | 'pilot' = 'unit'): string | null {
        if (isSlotZone(zone)) {
            const slotKey = zone as keyof Pick<PlayerZones, 'slot1'|'slot2'|'slot3'|'slot4'|'slot5'|'slot6'>;
            const slotZone = this.zones[slotKey] as SlotZone;
            
            const card = cardType === 'pilot' ? slotZone.pilot : slotZone.unit;
            return card?.cardUid || null;
        }
        
        if (zone === ZoneType.SHIELD) {
            return this.zones.shieldArea.length > 0 ? this.zones.shieldArea[0].cardUid : null;
        }
        
        if (zone === ZoneType.ENERGY) {
            return this.zones.energyArea.length > 0 ? this.zones.energyArea[0].cardUid : null;
        }
        
        if (zone === ZoneType.TRASH) {
            return this.zones.trashArea.length > 0 ? this.zones.trashArea[0].cardUid : null;
        }
        
        const targetZone = this.zones[zone];
        if (Array.isArray(targetZone) && targetZone.length > 0) {
            const zoneCard = targetZone[0] as BaseZoneCard;
            return zoneCard.cardUid || null;
        }
        
        return null;
    }
    
    public getCardObjectInZone(zone: ZoneType, cardType: 'unit' | 'pilot' = 'unit'): BaseZoneCard | null {
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
            return targetZone[0] as BaseZoneCard;
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

    public getShieldCards(): BaseZoneCard[] {
        return this.zones.shieldArea;
    }

    public getShieldCount(): number {
        return this.zones.shieldArea.length;
    }

    public hasShield(): boolean {
        return this.zones.shieldArea.length > 0;
    }

    public addShieldCard(cardUid: string, cardData?: CardData): void {
        this.setCardInZone(ZoneType.SHIELD, cardUid, cardData);
    }

    public removeShieldCard(cardUid: string): boolean {
        const index = this.zones.shieldArea.findIndex(card => card.cardUid === cardUid);
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
        console.log(`⚔️ Unit ${slotZone.unit.cardUid} declares attack from ${attackerZone}`);
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
        
        console.log(`🩸 Unit ${slotZone.unit.cardUid} takes ${damage} damage (total: ${slotZone.unit.damageReceived})`);
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
            .reduce((total, card) => total + (card.energyValue || 0), 0);
    }

    public getTotalEnergyValue(): number {
        return this.zones.energyArea
            .filter(card => !card.isExtraEnergy)
            .reduce((total, card) => total + (card.energyValue || 0), 0);
    }

    public tapEnergy(cardUid: string): boolean {
        const energyCard = this.zones.energyArea.find(card => card.cardUid === cardUid);
        if (!energyCard || energyCard.isRested || energyCard.isExtraEnergy) return false;
        
        energyCard.isRested = true;
        console.log(`⚡ Energy ${cardUid} tapped`);
        return true;
    }

    public consumeEnergy(cardUid: string): boolean {
        const energyCard = this.zones.energyArea.find(card => card.cardUid === cardUid);
        if (!energyCard || energyCard.isExtraEnergy) return false;
        
        if (energyCard.cardData.energyType === 'consumable') {
            energyCard.isExtraEnergy = true;
            console.log(`💥 Consumable energy ${cardUid} consumed and removed`);
            return true;
        } else {
            // Permanent energy just gets tapped
            energyCard.isRested = true;
            console.log(`⚡ Permanent energy ${cardUid} tapped`);
            return true;
        }
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

    public getTrashCards(): BaseZoneCard[] {
        return this.zones.trashArea;
    }

    public getTrashCount(): number {
        return this.zones.trashArea.length;
    }

    public hasTrash(): boolean {
        return this.zones.trashArea.length > 0;
    }

    public addTrashCard(cardUid: string, cardData?: CardData): void {
        this.setCardInZone(ZoneType.TRASH, cardUid, cardData);
    }

    public removeTrashCard(cardUid: string): boolean {
        const index = this.zones.trashArea.findIndex(card => card.cardUid === cardUid);
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

    public playCardFromHand(cardUid: string, zone: string = 'slot1'): boolean {
        return this.deck.playCardFromHand(cardUid, zone);
    }

    public getHandSize(): number {
        return this.deck.getHandSize();
    }

    public getDeckSize(): number {
        return this.deck.getDeckSize();
    }


    public getCardIdFromUid(cardUid: string): string | null {
        return this.deck.getCardIdFromUid(cardUid);
    }

    // ============ FIELD EFFECTS ============

    public initializeGameStateOnly(): void {
        if (!this.fieldEffects) {
            this.fieldEffects = {
                zoneRestrictions: {},
                activeEffects: [],
                specialEffects: {},
                disabledCards: [],
                victoryPointModifiers: 0
            };
        }
        this.playerPoint = 0;
    }

    public initializeFieldEffects(): void {
        this.fieldEffects = {
            zoneRestrictions: {},
            activeEffects: [],
            specialEffects: {},
            disabledCards: [],
            victoryPointModifiers: 0
        };
    }

    public addFieldEffect(effect: FieldEffect): void {
        if (!this.fieldEffects) this.initializeFieldEffects();
        this.fieldEffects!.activeEffects.push(effect);
    }

    public get activeZoneRestrictions(): { [zone in ZoneType]?: string[] | 'ALL' } {
        if (!this.fieldEffects) return {};

        const ALL_TRAITS = ['Earth Federation', 'White Base Team', 'Academy', 'Newtype', 'Warship'];
        const ALL_COLORS = ['Blue', 'White', 'Red', 'Green', 'Yellow'];

        const activeRestrictions: { [zone in ZoneType]?: string[] | 'ALL' } = {};

        Object.keys(this.fieldEffects.zoneRestrictions).forEach((zone: string) => {
            const zoneType = zone as ZoneType;
            activeRestrictions[zoneType] = this.fieldEffects!.zoneRestrictions[zoneType];
        });

        this.fieldEffects.activeEffects.forEach(effect => {
            if (effect.type === 'preventSummon' && effect.isEnabled) {
                const targetZones = effect.target.zones || [];
                const zonesToProcess = targetZones === 'ALL' 
                    ? [ZoneType.SLOT1, ZoneType.SLOT2, ZoneType.SLOT3, ZoneType.SLOT4, ZoneType.SLOT5, ZoneType.SLOT6, ZoneType.BASE]
                    : targetZones as ZoneType[];

                zonesToProcess.forEach((zone: ZoneType) => {
                    const zoneType = zone as ZoneType;
                    
                    if (activeRestrictions[zoneType]) {
                        if (activeRestrictions[zoneType] === 'ALL') {
                            if (effect.target.traits?.length || effect.target.colors?.length) {
                                const preventedTraits = effect.target.traits || [];
                                const preventedColors = effect.target.colors || [];
                                activeRestrictions[zoneType] = [...ALL_TRAITS, ...ALL_COLORS].filter(
                                    item => !preventedTraits.includes(item) && !preventedColors.includes(item)
                                );
                            } else {
                                activeRestrictions[zoneType] = [];
                            }
                        } else {
                            const currentRestrictions = activeRestrictions[zoneType] as string[];
                            
                            if (effect.target.traits?.length || effect.target.colors?.length) {
                                const preventedTraits = effect.target.traits || [];
                                const preventedColors = effect.target.colors || [];
                                activeRestrictions[zoneType] = currentRestrictions.filter(
                                    item => !preventedTraits.includes(item) && !preventedColors.includes(item)
                                );
                            } else {
                                activeRestrictions[zoneType] = [];
                            }
                        }
                    } else {
                        if (effect.target.traits?.length || effect.target.colors?.length) {
                            const preventedTraits = effect.target.traits || [];
                            const preventedColors = effect.target.colors || [];
                            activeRestrictions[zoneType] = [...ALL_TRAITS, ...ALL_COLORS].filter(
                                item => !preventedTraits.includes(item) && !preventedColors.includes(item)
                            );
                        } else {
                            activeRestrictions[zoneType] = [];
                        }
                    }
                });
            }
        });

        return activeRestrictions;
    }

    // ============ SERIALIZATION ============

    public toJSON(): any {
        return {
            id: this.id,
            name: this.name,
            deck: this.deck.toJSON(),
            redraw: this.redraw,
            playerPoint: this.playerPoint,
            isReady: this.isReady,
            zones: this.zones,
            ...(this.fieldEffects && { 
                fieldEffects: {
                    ...this.fieldEffects,
                    activeZoneRestrictions: this.activeZoneRestrictions
                }
            })
        };
    }

    public static fromJSON(data: any): Player {
        const player = new Player(data.id, data.name);
        if (data.deck) {
            player.deck = PlayerDeck.fromJSON(data.deck);
        }
        player.redraw = data.redraw || false;
        player.playerPoint = data.playerPoint || 0;
        player.isReady = data.isReady || false;
        if (data.zones) {
            player.zones = data.zones;
        }
        if (data.fieldEffects) {
            player.fieldEffects = data.fieldEffects;
        }
        return player;
    }
}