// src/services/effects/actions/EffectPairActions.ts

import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { finalizePairingFromAction, resolvePairingSourceContext } from './PairingActionSupport';

export function applyPairFromTrashEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    const context = resolvePairingSourceContext(gameEnv, sourcePlayerId, sourceCarduid, 'pair_from_trash');
    if (!context.success) {
        return context;
    }

    if (selectedTargets.length === 0) {
        return { success: false, error: 'pair_from_trash requires a selected pilot from trash' };
    }

    const target = selectedTargets[0];
    if (target.playerId !== sourcePlayerId) {
        return { success: false, error: 'pair_from_trash can only select from your own trash' };
    }

    const { player } = context;

    if (!Array.isArray(player.zones.trashArea)) {
        player.zones.trashArea = [];
    }

    const trashIndex = player.zones.trashArea.findIndex((card: any) => card?.carduid === target.carduid);
    if (trashIndex < 0) {
        return { success: false, error: `Pilot ${target.carduid} not found in trash for pair_from_trash` };
    }

    const removedTrashCard = player.zones.trashArea.splice(trashIndex, 1)[0];
    const finalizeResult = finalizePairingFromAction(
        gameEnv,
        sourcePlayerId,
        sourceCarduid!,
        effect,
        target.carduid,
        'PILOT_PAIRED_FROM_TRASH'
    );
    if (!finalizeResult.success) {
        player.zones.trashArea.push(removedTrashCard);
        return finalizeResult;
    }

    return finalizeResult;
}

export function applyPairFromHandEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    const context = resolvePairingSourceContext(gameEnv, sourcePlayerId, sourceCarduid, 'pair_from_hand');
    if (!context.success) {
        return context;
    }

    if (selectedTargets.length === 0) {
        return { success: false, error: 'pair_from_hand requires a selected pilot from hand' };
    }

    const target = selectedTargets[0];
    if (target.playerId !== sourcePlayerId) {
        return { success: false, error: 'pair_from_hand can only select from your own hand' };
    }

    const { player } = context;
    if (!player.deck) {
        return { success: false, error: 'Player not found for pair_from_hand' };
    }

    const handIndex = player.deck.hand.findIndex((card: any) => card?.carduid === target.carduid);
    if (handIndex < 0) {
        return { success: false, error: `Pilot ${target.carduid} not found in hand for pair_from_hand` };
    }

    const handCard = player.deck.hand[handIndex];
    if (String(handCard?.cardData?.cardType || '').toLowerCase() !== 'pilot') {
        return { success: false, error: 'pair_from_hand requires a pilot card target' };
    }

    const removed = player.deck.playCardFromHand(target.carduid);
    if (!removed) {
        return { success: false, error: `Failed to remove pilot ${target.carduid} from hand` };
    }
    const finalizeResult = finalizePairingFromAction(
        gameEnv,
        sourcePlayerId,
        sourceCarduid!,
        effect,
        target.carduid,
        'PILOT_PAIRED_FROM_HAND'
    );
    if (!finalizeResult.success) {
        player.deck.hand.push(handCard);
        return finalizeResult;
    }

    return finalizeResult;
}
