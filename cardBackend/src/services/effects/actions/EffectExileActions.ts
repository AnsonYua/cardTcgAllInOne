// src/services/effects/actions/EffectExileActions.ts

import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { GameNotificationManager } from '../../GameNotificationManager';

export function applyExileFromTrashEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    const requiredCount = typeof effect.target?.count === 'number' ? effect.target.count : undefined;

    if (typeof requiredCount === 'number' && requiredCount > 0 && selectedTargets.length !== requiredCount) {
        return {
            success: false,
            error: `exileFromTrash requires selecting exactly ${requiredCount} card(s)`
        };
    }

    if (selectedTargets.length === 0) {
        return { success: true };
    }

    if (selectedTargets.some(target => target.playerId !== sourcePlayerId)) {
        return { success: false, error: 'exileFromTrash can only exile cards from your own trash' };
    }

    const player = gameEnv.getPlayer(sourcePlayerId);
    if (!player?.zones || !Array.isArray(player.zones.trashArea)) {
        return { success: false, error: 'Player trash not found for exileFromTrash' };
    }

    const toExile = selectedTargets.map(target => target.carduid);
    const before = player.zones.trashArea.length;
    player.zones.trashArea = player.zones.trashArea.filter(card => !toExile.includes(card.carduid));
    const removedCount = Math.max(0, before - player.zones.trashArea.length);

    const notificationManager = new GameNotificationManager(gameEnv);
    notificationManager.addNotificationEvent('CARDS_EXILED_FROM_TRASH', {
        playerId: sourcePlayerId,
        sourceCarduid,
        effectId: effect.effectId,
        carduids: toExile,
        removedCount,
        timestamp: Date.now()
    });

    if (removedCount !== toExile.length) {
        return {
            success: false,
            error: `exileFromTrash expected to remove ${toExile.length} card(s), removed ${removedCount}`
        };
    }

    return { success: true };
}
