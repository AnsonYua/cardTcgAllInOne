import { ChoiceKind, isSequenceContextKind } from '../../types/ChoiceKind';

const KIND_BY_ACTION: Record<string, ChoiceKind> = {
    discardFromHand: ChoiceKind.DISCARD_FROM_HAND,
    moveFromHandToDeckBottom: ChoiceKind.MOVE_FROM_HAND_TO_DECK_BOTTOM,
    moveFromTrashToDeck: ChoiceKind.MOVE_FROM_TRASH_TO_DECK,
    exileFromTrash: ChoiceKind.EXILE_FROM_TRASH,

    destroy: ChoiceKind.DESTROY,
    returnToHand: ChoiceKind.RETURN_TO_HAND,
    addToHand: ChoiceKind.ADD_TO_HAND,

    rest: ChoiceKind.REST,
    setActive: ChoiceKind.SET_ACTIVE,
    restrict_attack: ChoiceKind.RESTRICT_ATTACK,
    prevent_battle_damage: ChoiceKind.PREVENT_BATTLE_DAMAGE,
    prevent_set_active_next_turn: ChoiceKind.PREVENT_SET_ACTIVE_NEXT_TURN,
    allow_attack_target: ChoiceKind.ALLOW_ATTACK_TARGET,

    damage: ChoiceKind.DAMAGE,
    damageShield: ChoiceKind.DAMAGE_SHIELD,
    heal: ChoiceKind.HEAL,

    deploy_from_hand: ChoiceKind.DEPLOY_FROM_HAND,
    pair_from_hand: ChoiceKind.PAIR_FROM_HAND,
    pair_from_trash: ChoiceKind.PAIR_FROM_TRASH,

    grant_keyword: ChoiceKind.GRANT_KEYWORD,
    grant_breach: ChoiceKind.GRANT_BREACH,
    prevent_shield_damage: ChoiceKind.PREVENT_SHIELD_DAMAGE,
    scry_top_deck: ChoiceKind.SCRY_TOP_DECK,
    addBasicEnergy: ChoiceKind.ADD_BASIC_ENERGY,
    addExtraEnergy: ChoiceKind.ADD_EXTRA_ENERGY,
    conditionalTokenDeploy: ChoiceKind.CONDITIONAL_TOKEN_DEPLOY
};

export function deriveTargetChoiceKind(action: unknown, contextKind: unknown): string {
    const normalizedAction = typeof action === 'string' ? action : '';
    const baseKind = KIND_BY_ACTION[normalizedAction] || ChoiceKind.EFFECT_TARGET_CHOICE;

    if (isSequenceContextKind(contextKind)) {
        return `SEQUENCE_${baseKind}`;
    }

    return baseKind;
}
