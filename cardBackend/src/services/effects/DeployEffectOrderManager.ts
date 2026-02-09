// src/services/effects/DeployEffectOrderManager.ts
// Handles OPTION_CHOICE events that let a player pick which deploy-triggered effect to resolve next.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { ExecutionResult } from '../ExecutionResult';
import { EventFactory } from '../EventQueue/EventFactory';
import { EventStatus, type EffectDefinition, type OptionChoiceEvent } from '../EventQueue/interfaces/GameEvent';

type DeployEffectOrderContext = {
    kind: 'DEPLOY_EFFECT_ORDER';
    deployCarduid?: string;
    effects: EffectDefinition[];
    cardPlayNotificationId?: string;
};

export class DeployEffectOrderManager {
    static executeOptionChoice(event: OptionChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        if (event.status !== EventStatus.RESOLVING) {
            return { success: true };
        }

        const context = event.data.context as Partial<DeployEffectOrderContext> | undefined;
        if (!context || context.kind !== 'DEPLOY_EFFECT_ORDER') {
            return { success: false, error: 'DEPLOY_EFFECT_ORDER missing context' };
        }

        const effects = Array.isArray(context.effects) ? (context.effects as EffectDefinition[]) : [];
        if (effects.length === 0) {
            return { success: false, error: 'DEPLOY_EFFECT_ORDER has no effects to order' };
        }

        const selectedIndex = event.data.selectedOptionIndex;
        if (typeof selectedIndex !== 'number') {
            return { success: false, error: 'DEPLOY_EFFECT_ORDER missing selected option' };
        }

        const selectedEffect = effects.find((_effect, idx) => idx === selectedIndex);
        if (!selectedEffect) {
            return { success: false, error: 'DEPLOY_EFFECT_ORDER selected option is out of range' };
        }

        const remainingEffects = effects.filter((_effect, idx) => idx !== selectedIndex);
        const deployCarduid = typeof context.deployCarduid === 'string' && context.deployCarduid.length > 0
            ? context.deployCarduid
            : event.data.sourceCarduid;

        const deployEvent = EventFactory.createDeployEffectEvent(
            event.playerId,
            deployCarduid,
            [selectedEffect],
            context.cardPlayNotificationId
        );

        (deployEvent.data as any).remainingEffects = remainingEffects;
        gameEnv.enqueueForProcessing(deployEvent);

        return { success: true };
    }
}

