import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetChoiceEvent, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { EventFactory } from '../EventQueue/EventFactory';

type ForcedAttackTargetContext = {
    kind: 'FORCED_ATTACK_TARGET';
    attackerPlayerId: string;
    attackerCarduid: string;
    defendingPlayerId: string;
};

export class ForcedAttackTargetChoiceHandler {
    static tryHandle(
        gameEnv: GameEnvironment,
        event: TargetChoiceEvent,
        selectedTargets: TargetReference[]
    ): { handled: boolean; success: boolean; error?: string } {
        const eventData = event.data;
        const action = typeof eventData.effect?.action === 'string' ? eventData.effect.action : '';
        if (action !== 'force_attack_target') {
            return { handled: false, success: true };
        }

        const context = eventData.context as ForcedAttackTargetContext | undefined;
        if (!context || context.kind !== 'FORCED_ATTACK_TARGET') {
            return { handled: true, success: false, error: 'force_attack_target missing context' };
        }

        const forced = selectedTargets[0];
        if (!forced) {
            return { handled: true, success: false, error: 'force_attack_target missing selected target' };
        }

        const attackerPlayerId = context.attackerPlayerId;
        const attackerCarduid = context.attackerCarduid;
        const defendingPlayerId = context.defendingPlayerId;
        if (!attackerPlayerId || !attackerCarduid || !defendingPlayerId) {
            return { handled: true, success: false, error: 'force_attack_target context incomplete' };
        }

        const resumeEvent = EventFactory.createPlayerActionEvent(attackerPlayerId, 'attackUnit', {
            playerId: attackerPlayerId,
            actionType: 'attackUnit',
            attackerCarduid,
            targetPlayerId: forced.playerId,
            targetCarduid: forced.carduid,
            skipForcedTargetCheck: true
        });

        gameEnv.enqueueForProcessing(resumeEvent);
        return { handled: true, success: true };
    }
}

