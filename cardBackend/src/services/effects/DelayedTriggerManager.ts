// src/services/effects/DelayedTriggerManager.ts
// Centralized runtime support for "registerDelayedTrigger" sequence steps.

import { GameEnvironment } from '../../models/GameEnvironment';
import type { DelayedTrigger, DelayedTriggerSpec, DelayedTriggerThenStep } from '../../models/DelayedTrigger';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { GameNotificationManager } from '../GameNotificationManager';
import { DeployTargetManager } from '../DeployTargetManager';
import type { BattleDestroyContext } from './BattleDestroyEffectManager';

type RegisterDelayedTriggerParameters = {
    duration?: string;
    trigger?: Record<string, unknown>;
    then?: Array<Record<string, unknown>>;
};

export class DelayedTriggerManager {
    static registerFromSequenceStep(
        gameEnv: GameEnvironment,
        ownerPlayerId: string,
        sourceCarduid: string,
        rawParams: Record<string, unknown>
    ): { success: boolean; error?: string } {
        const params = rawParams as RegisterDelayedTriggerParameters;

        const duration = typeof params.duration === 'string' ? params.duration : '';
        if (duration !== 'UNTIL_END_OF_TURN') {
            return { success: false, error: `Unsupported delayed trigger duration: ${duration || '(missing)'}` };
        }

        const trigger = this.parseTriggerSpec(params.trigger);
        if (!trigger) {
            return { success: false, error: 'Invalid or unsupported delayed trigger spec' };
        }

        const then = this.parseThenSteps(params.then);
        if (then.length === 0) {
            return { success: false, error: 'Delayed trigger must include non-empty then[] steps' };
        }

        const player = gameEnv.getPlayer(ownerPlayerId);
        if (!player) {
            return { success: false, error: `Player ${ownerPlayerId} not found` };
        }

        const triggerId = this.buildTriggerId();
        const delayed: DelayedTrigger = {
            id: triggerId,
            ownerPlayerId,
            sourceCarduid,
            createdTurn: gameEnv.currentTurn,
            expiresTurn: gameEnv.currentTurn,
            trigger,
            then
        };

        player.delayedTriggers = Array.isArray(player.delayedTriggers) ? player.delayedTriggers : [];
        player.delayedTriggers.push(delayed);

        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent('DELAYED_TRIGGER_REGISTERED', {
            playerId: ownerPlayerId,
            triggerId,
            sourceCarduid,
            trigger,
            duration,
            timestamp: Date.now()
        });

        return { success: true };
    }

    static handleBattleDestroy(
        gameEnv: GameEnvironment,
        context: BattleDestroyContext
    ): { success: boolean; error?: string } {
        const player = gameEnv.getPlayer(context.sourcePlayerId);
        if (!player?.delayedTriggers || player.delayedTriggers.length === 0) {
            return { success: true };
        }

        const triggers = player.delayedTriggers.filter(item => item?.trigger?.type === 'BATTLE_DESTROY');
        if (triggers.length === 0) {
            return { success: true };
        }

        for (const trigger of triggers) {
            if (!this.battleDestroyTriggerMatches(trigger.ownerPlayerId, trigger.trigger, context)) {
                continue;
            }

            const effect = this.buildThenEffect(trigger.then);
            if (!effect) {
                return {
                    success: false,
                    error: `Unsupported delayed trigger 'then' steps for ${trigger.sourceCarduid}`
                };
            }

            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.addNotificationEvent('DELAYED_TRIGGER_FIRED', {
                playerId: trigger.ownerPlayerId,
                triggerId: trigger.id,
                sourceCarduid: trigger.sourceCarduid,
                triggerType: trigger.trigger.type,
                timestamp: Date.now()
            });

            const result = DeployTargetManager.processEffectWithTargetChoice(
                gameEnv,
                trigger.ownerPlayerId,
                trigger.sourceCarduid,
                effect
            );
            if (!result.success) {
                return { success: false, error: result.error || 'Failed to resolve delayed trigger effect' };
            }
        }

        return { success: true };
    }

    static cleanupEndOfTurn(gameEnv: GameEnvironment, endingPlayerId: string): number {
        const player = gameEnv.getPlayer(endingPlayerId);
        if (!player?.delayedTriggers || player.delayedTriggers.length === 0) {
            return 0;
        }

        const before = player.delayedTriggers.length;
        player.delayedTriggers = player.delayedTriggers.filter(trigger => {
            const expiresTurn = typeof trigger.expiresTurn === 'number' ? trigger.expiresTurn : gameEnv.currentTurn;
            const durationExpired = expiresTurn <= gameEnv.currentTurn;
            return !durationExpired;
        });

        return Math.max(0, before - player.delayedTriggers.length);
    }

    private static parseTriggerSpec(raw: unknown): DelayedTriggerSpec | null {
        if (!raw || typeof raw !== 'object') {
            return null;
        }

        const obj = raw as Record<string, unknown>;
        const type = typeof obj.type === 'string' ? obj.type : '';

        if (type !== 'BATTLE_DESTROY') {
            return null;
        }

        const attackerController = typeof obj.attackerController === 'string' ? obj.attackerController : undefined;
        const attackerTraitsAny = Array.isArray(obj.attackerTraitsAny)
            ? obj.attackerTraitsAny.filter(item => typeof item === 'string')
            : undefined;

        return {
            type: 'BATTLE_DESTROY',
            ...(attackerController === 'self' ? { attackerController: 'self' } : {}),
            ...(attackerTraitsAny && attackerTraitsAny.length > 0 ? { attackerTraitsAny } : {})
        };
    }

    private static parseThenSteps(raw: unknown): DelayedTriggerThenStep[] {
        if (!Array.isArray(raw)) {
            return [];
        }

        return raw
            .filter(item => item && typeof item === 'object')
            .map(item => item as Record<string, unknown>)
            .filter(item => typeof item.action === 'string')
            .map(item => ({
                action: item.action as string,
                target: item.target && typeof item.target === 'object' ? (item.target as Record<string, unknown>) : undefined,
                timing: item.timing && typeof item.timing === 'object' ? (item.timing as Record<string, unknown>) : undefined,
                parameters: item.parameters && typeof item.parameters === 'object'
                    ? (item.parameters as Record<string, unknown>)
                    : undefined
            }));
    }

    private static battleDestroyTriggerMatches(
        ownerPlayerId: string,
        trigger: DelayedTriggerSpec,
        context: BattleDestroyContext
    ): boolean {
        if (trigger.attackerController === 'self') {
            if (context.sourcePlayerId !== ownerPlayerId) {
                return false;
            }
        }

        if (trigger.attackerTraitsAny && trigger.attackerTraitsAny.length > 0) {
            const traits = Array.isArray(context.sourceUnit?.cardData?.traits) ? context.sourceUnit.cardData.traits : [];
            const matches = trigger.attackerTraitsAny.some(trait => traits.includes(trait));
            if (!matches) {
                return false;
            }
        }

        return true;
    }

    private static buildThenEffect(then: DelayedTriggerThenStep[]): EffectDefinition | null {
        const directCombinedStep = then.find(step => step.action === 'setActive_then_restrict_attack');
        if (directCombinedStep?.target) {
            const restriction = typeof directCombinedStep.parameters?.restriction === 'string'
                ? directCombinedStep.parameters.restriction
                : 'cannot_attack';
            const duration = typeof directCombinedStep.timing?.duration === 'string'
                ? directCombinedStep.timing.duration
                : 'UNTIL_END_OF_TURN';
            return {
                effectId: 'delayed_set_active_then_cannot_attack',
                action: 'setActive_then_restrict_attack',
                target: directCombinedStep.target as any,
                timing: { duration },
                parameters: {
                    restriction
                }
            };
        }

        const setActiveStep = then.find(step => step.action === 'setActive');
        const statusStep = then.find(step => step.action === 'applyStatusEffect');

        const restriction = typeof statusStep?.parameters?.restriction === 'string'
            ? statusStep?.parameters?.restriction
            : undefined;
        const duration = typeof statusStep?.timing?.duration === 'string'
            ? statusStep?.timing?.duration
            : 'UNTIL_END_OF_TURN';

        if (setActiveStep?.target && restriction === 'cannot_attack' && duration === 'UNTIL_END_OF_TURN') {
            return {
                effectId: 'delayed_set_active_then_cannot_attack',
                action: 'setActive_then_restrict_attack',
                target: setActiveStep.target as any,
                timing: { duration: 'UNTIL_END_OF_TURN' },
                parameters: {
                    restriction
                }
            };
        }

        if (setActiveStep?.target) {
            return {
                effectId: 'delayed_set_active',
                action: 'setActive',
                target: setActiveStep.target as any
            };
        }

        return null;
    }

    private static buildTriggerId(): string {
        return `delayed_trigger_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
}
