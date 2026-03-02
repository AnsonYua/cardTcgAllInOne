// src/services/effects/AttackEffectOrderManager.ts
// Handles OPTION_CHOICE events that let a player pick which ATTACK_PHASE effect resolves next.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { ExecutionResult } from '../ExecutionResult';
import { EventFactory } from '../EventQueue/EventFactory';
import {
    EventStatus,
    type OptionChoiceEvent,
    type PlayerActionEventData,
    type QueuedAttackEffectDefinition
} from '../EventQueue/interfaces/GameEvent';
import { AttackPhaseEffectManager } from './AttackPhaseEffectManager';

type AttackEffectOrderContext = {
    kind: 'ATTACK_EFFECT_ORDER';
    attackPlayerId: string;
    attackerCarduid?: string;
    attackNotificationId?: string;
    originalAttackEventData: PlayerActionEventData;
    effects: QueuedAttackEffectDefinition[];
    allEffects?: QueuedAttackEffectDefinition[];
};

export class AttackEffectOrderManager {
    static executeOptionChoice(event: OptionChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        if (event.status !== EventStatus.RESOLVING) {
            return { success: true };
        }

        const context = event.data.context as Partial<AttackEffectOrderContext> | undefined;
        if (!context || context.kind !== 'ATTACK_EFFECT_ORDER') {
            return { success: false, error: 'ATTACK_EFFECT_ORDER missing context' };
        }

        const fallbackEffects = Array.isArray(context.effects) ? (context.effects as QueuedAttackEffectDefinition[]) : [];
        const allEffects = Array.isArray(context.allEffects) ? (context.allEffects as QueuedAttackEffectDefinition[]) : fallbackEffects;
        if (allEffects.length === 0) {
            return { success: false, error: 'ATTACK_EFFECT_ORDER has no effects to order' };
        }

        const selectedIndex = event.data.selectedOptionIndex;
        if (typeof selectedIndex !== 'number') {
            return { success: false, error: 'ATTACK_EFFECT_ORDER missing selected option' };
        }

        const selectedOption = Array.isArray(event.data.availableOptions)
            ? event.data.availableOptions.find((option) => option.index === selectedIndex)
            : undefined;
        if (Array.isArray(event.data.availableOptions) && event.data.availableOptions.length > 0 && !selectedOption) {
            return { success: false, error: 'ATTACK_EFFECT_ORDER selected option is out of range' };
        }
        if (selectedOption?.disabled === true) {
            const reason = typeof selectedOption.disabledReason === 'string' && selectedOption.disabledReason.length > 0
                ? selectedOption.disabledReason
                : 'Option is currently unavailable';
            return { success: false, error: `ATTACK_EFFECT_ORDER selected option is disabled: ${reason}` };
        }

        const selectedEffectOrderIndex = typeof (selectedOption as any)?.payload?.effectOrderIndex === 'number'
            ? (selectedOption as any).payload.effectOrderIndex
            : selectedIndex;
        const selectedEffect = allEffects.find((_effect, idx) => idx === selectedEffectOrderIndex);
        if (!selectedEffect) {
            return { success: false, error: 'ATTACK_EFFECT_ORDER selected option is out of range' };
        }

        const attackPlayerId = typeof context.attackPlayerId === 'string' && context.attackPlayerId.length > 0
            ? context.attackPlayerId
            : event.playerId;
        const originalAttackEventData = context.originalAttackEventData;
        if (!originalAttackEventData || typeof originalAttackEventData !== 'object') {
            return { success: false, error: 'ATTACK_EFFECT_ORDER missing original attack event data' };
        }

        const attackEvent = EventFactory.createPlayerActionEvent(
            attackPlayerId,
            originalAttackEventData.actionType,
            {
                ...originalAttackEventData,
                playerId: attackPlayerId,
                actionType: originalAttackEventData.actionType,
                ...(typeof context.attackNotificationId === 'string'
                    ? { attackNotificationId: context.attackNotificationId }
                    : {})
            }
        );

        AttackPhaseEffectManager.queueChosenAttackEffect(gameEnv, attackEvent, allEffects, selectedEffectOrderIndex);
        return { success: true };
    }
}

