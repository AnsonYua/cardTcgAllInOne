import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { GameNotificationManager } from '../../GameNotificationManager';
import { TargetCardResolver } from '../../targets/TargetCardResolver';

export function applyRedirectAttackEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string; appliedTargets?: TargetReference[] } {
    const battle = gameEnv.currentBattle;
    if (!battle || battle.status !== 'ACTION_STEP') {
        return { success: false, error: 'redirect_attack requires an active ACTION_STEP battle' };
    }

    const attackingPlayerId = typeof battle.attackingPlayerId === 'string' ? battle.attackingPlayerId : '';
    if (!attackingPlayerId) {
        return { success: false, error: 'redirect_attack requires an attacking player in battle context' };
    }

    // This action text is "Change the attack target of the battling enemy Unit".
    // If source is the attacking player, there is no "enemy attacking unit" to redirect.
    if (attackingPlayerId === sourcePlayerId) {
        return { success: false, error: 'redirect_attack can only be used by the defending battle participant' };
    }

    const countValidation = validateSelectedTargetCount(effect, selectedTargets.length);
    if (!countValidation.success) {
        return countValidation;
    }

    const chosenTarget = selectedTargets[0];
    if (!chosenTarget) {
        return { success: false, error: 'redirect_attack requires a selected target' };
    }

    if (chosenTarget.playerId !== sourcePlayerId) {
        return { success: false, error: 'redirect_attack target must be controlled by the effect source player' };
    }

    const resolved = TargetCardResolver.resolve(gameEnv, chosenTarget);
    if (!resolved) {
        return { success: false, error: `redirect_attack target ${chosenTarget.carduid} not found` };
    }
    if (resolved.kind !== 'unit') {
        return { success: false, error: `redirect_attack target must be a unit (got ${resolved.kind})` };
    }

    const fromTargetCarduid = typeof battle.targetCarduid === 'string' ? battle.targetCarduid : undefined;
    const notificationManager = new GameNotificationManager(gameEnv);

    // Redirect the current battle context to a unit target.
    battle.actionType = 'attackUnit';
    battle.targetCarduid = chosenTarget.carduid;
    battle.targetPlayerId = chosenTarget.playerId;
    battle.forcedTarget = {
        carduid: chosenTarget.carduid,
        zone: chosenTarget.zone,
        playerId: chosenTarget.playerId
    };

    if (battle.attackNotificationId) {
        const attackNotification = (gameEnv.notificationQueue || []).find(
            (event: any) => event?.id === battle.attackNotificationId
        );
        const attackPayload = attackNotification?.payload || {};
        const targetName =
            (resolved.card as any)?.cardData?.name ||
            (resolved.card as any)?.cardId ||
            attackPayload.targetName;

        notificationManager.updateNotificationEvent(battle.attackNotificationId, {
            forcedTargetCarduid: chosenTarget.carduid,
            forcedTargetZone: chosenTarget.zone,
            forcedTargetPlayerId: chosenTarget.playerId,
            targetCarduid: chosenTarget.carduid,
            targetSlotName: chosenTarget.zone,
            targetPlayerId: chosenTarget.playerId,
            targetName
        });

        notificationManager.addNotificationEvent(
            'REFRESH_TARGET',
            {
                attackingPlayerId: battle.attackingPlayerId,
                defendingPlayerId: battle.defendingPlayerId,
                attackerCarduid: battle.attackerCarduid,
                attackerSlot: attackPayload.attackerSlot,
                forcedTargetCarduid: chosenTarget.carduid,
                forcedTargetZone: chosenTarget.zone,
                forcedTargetPlayerId: chosenTarget.playerId,
                sourceNotificationId: battle.attackNotificationId
            },
            'normal'
        );
    }

    notificationManager.addNotificationEvent(
        'ATTACK_REDIRECTED',
        {
            sourcePlayerId,
            sourceCarduid,
            effectId: effect.effectId,
            attackerPlayerId: battle.attackingPlayerId,
            attackerCarduid: battle.attackerCarduid,
            fromTargetCarduid,
            toTargetCarduid: chosenTarget.carduid,
            toTargetZone: chosenTarget.zone,
            toTargetPlayerId: chosenTarget.playerId,
            timestamp: Date.now()
        },
        'normal'
    );

    // Recompute ACTION_STEP options/confirmations after target context changed.
    gameEnv.refreshBattleActionTargets();

    return { success: true, appliedTargets: [chosenTarget] };
}

function validateSelectedTargetCount(
    effect: EffectDefinition,
    selectedCount: number
): { success: boolean; error?: string } {
    const countConfig = effect?.target?.count;
    if (typeof countConfig === 'number' && countConfig > 0) {
        if (selectedCount !== countConfig) {
            return {
                success: false,
                error: `redirect_attack requires exactly ${countConfig} selected target(s), got ${selectedCount}`
            };
        }
        return { success: true };
    }

    if (!countConfig || typeof countConfig !== 'object') {
        if (selectedCount < 1) {
            return { success: false, error: 'redirect_attack requires at least 1 selected target' };
        }
        return { success: true };
    }

    const min = typeof (countConfig as any).min === 'number' ? (countConfig as any).min : 1;
    const max = typeof (countConfig as any).max === 'number' ? (countConfig as any).max : Number.MAX_SAFE_INTEGER;
    if (selectedCount < min || selectedCount > max) {
        return {
            success: false,
            error: `redirect_attack requires selected target count within [${min}, ${max}], got ${selectedCount}`
        };
    }

    return { success: true };
}
