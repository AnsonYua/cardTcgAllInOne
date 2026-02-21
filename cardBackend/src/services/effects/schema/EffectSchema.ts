export type ValidationSeverity = 'error' | 'warning';

export interface EffectValidationDiagnostic {
    severity: ValidationSeverity;
    cardId: string;
    effectId: string;
    jsonPath: string;
    message: string;
}

export const CANONICAL_EFFECT_TRIGGERS = new Set<string>([
    'continuous',
    'MAIN_PHASE',
    'ACTION_STEP',
    'ATTACK_PHASE',
    'ATTACK_REDIRECT',
    'END_OF_TURN',
    'DESTROYED',
    'ENTERS_PLAY',
    'PAIRING_COMPLETE',
    'PAIRING_COMPLETE_GLOBAL',
    'BATTLE_DESTROY',
    'BATTLE_DAMAGE_TO_UNIT',
    'SHIELD_AREA_CARD_DAMAGED',
    'EFFECT_DAMAGE_RECEIVED',
    'EFFECT_DRAW',
    'EX_RESOURCE_PLACED',
    'BURST_CONDITION',
    'COST',
    'CHOICE',
    'SEQUENCE_STEP',
    'CHOICE_RESOLUTION',
    'AP_REDUCED_BY_ENEMY_EFFECT',
    'SUPPORT_AP_INCREASED',
    'ATTACK_TARGET_REQUIREMENT',
    'DEFENSE_AREA_BATTLE_DAMAGE',
    'UNIT_RESTED_BY_EFFECT',
    'UNIT_SET_ACTIVE_BY_EFFECT'
]);

export const CANONICAL_CONDITION_TYPES = new Set<string>([
    'turnPlayer',
    'playerLevel',
    'handSize',
    'pairedPilotColor',
    'pairedPilotTrait',
    'pairedPilotTraitAny',
    'pairedPilotLevel',
    'pairedUnitColor',
    'pairedUnitTrait',
    'paired',
    'isPaired',
    'linked',
    'isLinked',
    'turn',
    'phase',
    'opponentHandSize',
    'noUnitTokenWithTrait',
    'cardsInTrash',
    'cardsInTrashWithTraitsAny',
    'cardsInTrashWithNameIncludes',
    'cardsInZone',
    'unitsInPlayWithTrait',
    'unitsInPlayWithFilter',
    'unitsInPlay',
    'cardsInPlay',
    'cardsInPlayWithFilter',
    'sourceTrait',
    'sourceColor',
    'hasAnotherLinkedUnit',
    'hasAnotherLinkedUnitWithTrait',
    'hasAnotherUnitWithTrait',
    'noPairedPilot',
    'sourcePairedWithPilot',
    'battleOpponentLevel',
    'sourceIsBattling',
    'battleTargetHasTrigger',
    'sourceDeployedFrom',
    'eventType',
    'eventAttacker',
    'eventAttackerController',
    'eventAttackerHasKeyword',
    'eventAttackerIsNotSource',
    'eventTarget',
    'eventTargetController',
    'eventTargetTraitsAny',
    'eventTargetWasRested',
    'eventTargetLinkStatus',
    'sourceStatus',
    'sourceDamaged',
    'sourceLevel',
    'sourceAp',
    'sourceHp',
    'traitMatch',
    'attackTargetCardType',
    'unitsInPlayWithStatus',
    'battleDestroyEvent',
    'shieldAreaCardDamagedByBattleDamage',
    'battleDamageToUnitEvent',
    'unitRestedByEffectEvent',
    'unitStateChangedByEffectEvent'
]);

export const SEQUENCE_INTERNAL_CONDITION_TYPES = new Set<string>([
    'stepResolved',
    'milledAnyCardHasTrait',
    'milledCardHasTraitsAny'
]);

export const CANONICAL_SELECTION_TYPES = new Set<string>([
    'player_choice',
    'HIGHEST_LEVEL',
    'LOWEST_HP',
    'JUST_LINKED'
]);

export const CANONICAL_TARGET_FILTER_KEYS = new Set<string>([
    'ap',
    'cardType',
    'color',
    'colorNot',
    'controller',
    'damaged',
    'excludeCarduids',
    'excludeSelf',
    'hp',
    'isBattling',
    'isEventAttacker',
    'isEventDefender',
    'isExtraEnergy',
    'isLinkUnit',
    'isRested',
    'keywords',
    'level',
    'linkStatus',
    'pairedPilot',
    'pairedPilotTrait',
    'pairedUnitLevel',
    'status',
    'traits',
    'traitsAll',
    'traitsAny',
    'zone'
]);

export const CANONICAL_SCALING_TYPES = new Set<string>([
    'COUNT_UNITS_IN_PLAY',
    'COUNT_UNIQUE_CARDS_IN_TRASH',
    'SOURCE_AP_PER'
]);

const CONDITION_TYPE_ALIASES: Record<string, string> = {
    sourceAP: 'sourceAp',
    sourceHP: 'sourceHp'
};

export function normalizeConditionTypeAlias(type: string | undefined): string | undefined {
    if (typeof type !== 'string' || type.length === 0) {
        return type;
    }
    return CONDITION_TYPE_ALIASES[type] || type;
}

export function normalizeSelectionTypeAlias(
    type: string | undefined,
    tieBreaker: string | undefined
): { type?: string; tieBreaker?: string } {
    if (type === 'CONTROLLER_CHOICE') {
        return {
            type: 'player_choice',
            tieBreaker: tieBreaker || 'CONTROLLER_CHOICE'
        };
    }
    return { type, tieBreaker };
}
