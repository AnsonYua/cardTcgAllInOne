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
    'ATTACK_TARGET_REQUIREMENT',
    'DEFENSE_AREA_BATTLE_DAMAGE',
    'UNIT_RESTED_BY_EFFECT'
]);

export const CANONICAL_CONDITION_TYPES = new Set<string>([
    'playerLevel',
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
    'unitsInPlayWithTrait',
    'unitsInPlayWithFilter',
    'unitsInPlay',
    'cardsInPlay',
    'sourceTrait',
    'hasAnotherLinkedUnit',
    'hasAnotherLinkedUnitWithTrait',
    'hasAnotherUnitWithTrait',
    'noPairedPilot',
    'battleOpponentLevel',
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
    'unitRestedByEffectEvent'
]);

export const CANONICAL_SELECTION_TYPES = new Set<string>([
    'player_choice',
    'HIGHEST_LEVEL',
    'LOWEST_HP',
    'JUST_LINKED'
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
