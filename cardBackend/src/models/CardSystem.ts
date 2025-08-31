// src/models/CardSystem.ts
// Card system interfaces and utilities for custom trading card game

// ============ CARD DATA INTERFACES ============

export interface EffectRule {
    id: string;
    type: 'continuous' | 'triggered' | 'restriction';
    trigger: {
        event: string;
        conditions?: any[];
    };
    target: {
        owner: 'self' | 'opponent' | 'both';
        zones: string[];
        filters?: any[];
        requiresSelection?: boolean;
        selectCount?: number;
        targetCount?: number;
    };
    effect: {
        type: string;
        value: any;
        [key: string]: any;
    };
}

export interface BasicCardData {
    id?: string;
    name?: string;
    cardType?: string;
    color?: string;
    level?: number;
    cost?: number;
    zone?: string[];             // Array of zone types this card can be played in
    traits?: string[];           // Array of traits for effect targeting
    link?: string[];             // Array of linked pilots/units
    ap?: number;                 // Attack Power
    hp?: number;                 // Health Points
    effects?: {
        description?: string[];
        rules?: EffectRule[];
    };
}

export interface UnitCardData extends BasicCardData {
    cardType: 'unit';
}

export interface PilotCardData extends BasicCardData {
    cardType: 'pilot';
}

export interface CommandCardData extends BasicCardData {
    cardType: 'command';
}


export interface BaseCardData extends BasicCardData {
    cardType: 'base';
}

export interface EnergyCardData extends BasicCardData {
    cardType: 'energy';
}

export interface ShieldCardData extends BasicCardData {
    cardType: 'shield';
}

export type CardData = UnitCardData | PilotCardData | CommandCardData | BaseCardData | EnergyCardData | ShieldCardData;

// ============ ZONE CARD INTERFACES ============

export interface ZoneCard {
    cardUid: string;            // Unique game instance ID
    cardId: string;             // Base card ID
    cardData?: CardData;        // Complete card data from JSON (optional for energy cards)
    placedAt?: number;          // Timestamp when placed
    placedBy?: string;          // Player ID who placed card
    isRested?: boolean;         // Whether the card is rested/tapped (common field)
}

export interface UnitZoneCard extends ZoneCard {
    cardData: UnitCardData;  // Required for units
    currentAP?: number;      // Current Attack Power after modifiers
    currentHP?: number;      // Current Health Points after damage
    originalHP?: number;
    originalAP?: number;
    isFirstPlay?: boolean;   // Whether this is the unit's first turn on field
    damageReceived?: number; // Cumulative damage taken this turn
}

export interface PilotZoneCard extends ZoneCard {
    cardData: PilotCardData;
}

export interface CommandZoneCard extends ZoneCard {
    cardData: CommandCardData;  // Required for commands
    isActivated?: boolean;      // Whether the command has been activated
}

export interface BaseCard extends ZoneCard {
    cardData: BaseCardData;  // Required for base structures
    currentHP?: number; 
    originalHP?: number;
    damageReceived?:number;
}

export interface EnergyZoneCard extends ZoneCard {
    cardData: EnergyCardData; // Required for energy cards
    isExtraEnergy?: boolean;   // For consumable energy - whether used up
}

export interface ShieldCard extends ZoneCard {
    cardData: ShieldCardData; // Required for shields
}

// ============ ZONE CARD UTILITIES ============

export function createZoneCard(
    cardUid: string,
    cardId: string,
    cardData: CardData,
    placedBy: string = ''
): ZoneCard {
    const baseCard: ZoneCard = {
        cardUid,
        cardId,
        cardData,
        placedAt: Date.now(),
        placedBy,
        isRested: false
    };

    switch ((cardData as CardData).cardType) {
        case 'unit':
            return {
                ...baseCard,
                cardData: cardData as UnitCardData,
                currentAP: cardData.ap,
                currentHP: cardData.hp,
                isRested: false,
                isFirstPlay: true,
                damageReceived: 0
            } as UnitZoneCard;
            
        case 'pilot':
            return {
                ...baseCard,
                cardData: cardData as PilotCardData
            } as PilotZoneCard;
            
        case 'command':
            return {
                ...baseCard,
                cardData: cardData as CommandCardData,
                isActivated: false
            } as CommandZoneCard;
            
        case 'base':
            return {
                ...baseCard,
                cardData: cardData as BaseCardData,
                isRested: false
            } as BaseCard;
            
        case 'energy':
            return {
                ...baseCard,
                cardData: cardData as EnergyCardData,
                isExtraEnergy: false
            } as EnergyZoneCard;
            
        case 'shield':
            return {
                ...baseCard,
                cardData: cardData as ShieldCardData
            } as ShieldCard;
            
        default:
            throw new Error(`Unknown card type: ${(cardData as CardData).cardType}`);
    }
}

// Type guard functions
export function isUnitZoneCard(card: ZoneCard): card is UnitZoneCard {
    return card.cardData?.cardType === 'unit';
}

export function isPilotZoneCard(card: ZoneCard): card is PilotZoneCard {
    return card.cardData?.cardType === 'pilot';
}

export function isCommandZoneCard(card: ZoneCard): card is CommandZoneCard {
    return card.cardData?.cardType === 'command';
}

export function isBaseCard(card: ZoneCard): card is BaseCard {
    return card.cardData?.cardType === 'base';
}

export function isEnergyZoneCard(card: ZoneCard): card is EnergyZoneCard {
    return card.cardData?.cardType === 'energy';
}

export function isShieldCard(card: ZoneCard): card is ShieldCard {
    return card.cardData?.cardType === 'shield';
}

export class ZoneCardUtils {
    static getCardColor(card: ZoneCard): string {
        return card.cardData?.color || 'Unknown';
    }

    static getEffectiveTraits(card: ZoneCard): string[] {
        return card.cardData?.traits || [];
    }

    static getLinkedCards(card: ZoneCard): string[] {
        return card.cardData?.link || [];
    }

    static getValidZones(card: ZoneCard): string[] {
        return card.cardData?.zone || [];
    }

    static canBePlacedInZone(card: ZoneCard, targetZone: string): boolean {
        const validZones = card.cardData?.zone || [];
        return validZones.includes(targetZone) || validZones.includes('Any');
    }

    static canTriggerEffects(card: ZoneCard): boolean {
        return (card.cardData?.effects?.rules?.length || 0) > 0;
    }

    static getCurrentAP(card: ZoneCard): number {
        if (isUnitZoneCard(card)) {
            return card.currentAP || card.cardData?.ap || 0;
        }
        return card.cardData?.ap || 0;
    }

    static getCurrentHP(card: ZoneCard): number {
        if (isUnitZoneCard(card)) {
            return card.currentHP || card.cardData?.hp || 0;
        }
        return card.cardData?.hp || 0;
    }

    // Note: Pilot-unit pairing now handled implicitly through SlotZone structure
    // No longer need explicit pairing references

    static isRested(card: ZoneCard): boolean {
        return card.isRested || false;
    }

    static getDisplayName(card: ZoneCard): string {
        return card.cardData?.name || card.cardId;
    }

    static getActiveEffects(card: ZoneCard): EffectRule[] {
        return card.cardData?.effects?.rules || [];
    }
}

// ============ OTHER INTERFACES ============

export interface CardMapping {
    [uid: string]: string; // UID to cardId mapping
}

export interface PlayerDeckData {
    hand: string[];
    mainDeck: string[];
}