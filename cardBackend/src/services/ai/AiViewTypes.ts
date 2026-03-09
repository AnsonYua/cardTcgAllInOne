import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';

export type AiSlotName = 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6';

export interface AiCardData {
    cardType?: string;
    ap?: number;
    hp?: number;
    cost?: number;
    level?: number;
    effectiveCost?: number;
    effectiveLevel?: number;
    effects?: {
        rules?: EffectDefinition[];
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export interface AiHandCard {
    carduid?: string;
    cardData?: AiCardData;
    [key: string]: unknown;
}

export interface AiDeckView {
    hand?: AiHandCard[];
    handUids?: string[];
    mainDeck?: string[];
    handCount?: number;
    deckCount?: number;
    [key: string]: unknown;
}

export interface AiFieldCardValue {
    totalAP?: number;
    totalHP?: number;
    totalDamageReceived?: number;
    [key: string]: unknown;
}

export interface AiEffectUsageEntry {
    lastUsedTurn?: number;
    [key: string]: unknown;
}

export interface AiUnitView {
    carduid?: string;
    cardData?: AiCardData;
    isRested?: boolean;
    playedThisTurn?: boolean;
    canAttackOnPlayTurn?: boolean;
    canAttackThisTurn?: boolean;
    continueModifyAP?: number;
    continueModifyHP?: number;
    damageReceived?: number;
    effectUsage?: Record<string, AiEffectUsageEntry>;
    [key: string]: unknown;
}

export interface AiPilotView extends AiUnitView {}

export interface AiBaseView {
    carduid?: string;
    cardData?: AiCardData;
    isRested?: boolean;
    effectUsage?: Record<string, AiEffectUsageEntry>;
    [key: string]: unknown;
}

export interface AiSlotView {
    unit?: AiUnitView;
    pilot?: AiPilotView;
    fieldCardValue?: AiFieldCardValue;
    [key: string]: unknown;
}

export interface AiZonesView {
    slot1?: AiSlotView;
    slot2?: AiSlotView;
    slot3?: AiSlotView;
    slot4?: AiSlotView;
    slot5?: AiSlotView;
    slot6?: AiSlotView;
    base?: AiBaseView[];
    shieldArea?: Array<Record<string, unknown>>;
    shieldCount?: number;
    energyArea?: Array<{ isRested?: boolean; [key: string]: unknown }>;
    trashArea?: Array<Record<string, unknown>>;
    [key: string]: unknown;
}

export interface AiPlayerView {
    deck?: AiDeckView;
    zones?: AiZonesView;
    confirmIsRedraw?: boolean;
    [key: string]: unknown;
}

export interface AiBattleContextView {
    status?: string;
    attackingPlayerId?: string;
    defendingPlayerId?: string;
    confirmations?: Record<string, boolean>;
    [key: string]: unknown;
}

export interface AiQueueEvent {
    id?: string;
    type?: string;
    status?: string;
    playerId?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface AiNotificationEvent {
    id?: string;
    type?: string;
    metadata?: {
        timestamp?: number;
        expiresAt?: number;
        requiresAcknowledgment?: boolean;
        priority?: string;
        [key: string]: unknown;
    };
    payload?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface AiGameEnvView {
    phase?: string;
    playerId_1?: string | null;
    playerId_2?: string | null;
    firstPlayerChooser?: string | null;
    currentPlayer?: string | null;
    currentTurn?: number;
    currentBattle?: AiBattleContextView | null;
    players?: Record<string, AiPlayerView>;
    processingQueue?: AiQueueEvent[];
    notificationQueue?: AiNotificationEvent[];
    [key: string]: unknown;
}
