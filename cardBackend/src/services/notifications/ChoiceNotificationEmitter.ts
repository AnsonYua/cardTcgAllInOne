// src/services/notifications/ChoiceNotificationEmitter.ts
// Centralized notification helpers for choice-based UI flows

import { GameEnvironment } from '../../models/GameEnvironment';
import { BlockerChoiceEvent, BurstEffectChoiceEvent, TargetChoiceEvent, TokenChoiceEvent, OptionChoiceEvent, PromptChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import { GameNotificationManager } from '../GameNotificationManager';
import { TargetCountUtils } from '../targets/TargetCountUtils';
import { ChoiceKind, isSequenceContextKind } from '../../types/ChoiceKind';

export class ChoiceNotificationEmitter {
    private static deriveTargetChoiceKind(action: unknown, contextKind: unknown): string {
        const normalizedAction = typeof action === 'string' ? action : '';

        const kindByAction: Record<string, ChoiceKind> = {
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
            pair_from_trash: ChoiceKind.PAIR_FROM_TRASH,

            grant_keyword: ChoiceKind.GRANT_KEYWORD,
            grant_breach: ChoiceKind.GRANT_BREACH,
            prevent_shield_damage: ChoiceKind.PREVENT_SHIELD_DAMAGE,
            scry_top_deck: ChoiceKind.SCRY_TOP_DECK,
            addBasicEnergy: ChoiceKind.ADD_BASIC_ENERGY,
            addExtraEnergy: ChoiceKind.ADD_EXTRA_ENERGY,
            conditionalTokenDeploy: ChoiceKind.CONDITIONAL_TOKEN_DEPLOY
        };

        const baseKind = kindByAction[normalizedAction] || ChoiceKind.EFFECT_TARGET_CHOICE;
        if (isSequenceContextKind(contextKind)) {
            return `SEQUENCE_${baseKind}`;
        }

        return baseKind;
    }

    private static emitPersistentChoiceCreated(
        gameEnv: GameEnvironment,
        params: {
            eventId: string;
            type: string;
            payload: Record<string, unknown>;
            priority: 'low' | 'normal' | 'high' | 'critical';
        }
    ): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEventWithId(params.eventId, params.type, params.payload, params.priority);

        // Choice notifications should not expire until the frontend explicitly acknowledges them.
        notificationManager.makePersistent(params.eventId);
    }

    static buildBurstChoiceGroupNotificationId(sourceEventId: string): string {
        return `${sourceEventId}_burst_choice_group`;
    }

    static emitBurstChoiceCreated(gameEnv: GameEnvironment, event: BurstEffectChoiceEvent): void {
        ChoiceNotificationEmitter.emitPersistentChoiceCreated(gameEnv, {
            eventId: event.id,
            type: 'BURST_EFFECT_CHOICE',
            payload: {
                playerId: event.playerId,
                event,
                isCompleted: false
            },
            priority: 'high'
        });
    }

    static emitBurstChoiceGroupCreated(
        gameEnv: GameEnvironment,
        params: {
            playerId: string;
            sourceEventId: string;
            events: BurstEffectChoiceEvent[];
        }
    ): void {
        const groupId = ChoiceNotificationEmitter.buildBurstChoiceGroupNotificationId(params.sourceEventId);
        ChoiceNotificationEmitter.emitPersistentChoiceCreated(gameEnv, {
            eventId: groupId,
            type: 'BURST_EFFECT_CHOICE_GROUP',
            payload: {
                playerId: params.playerId,
                sourceEventId: params.sourceEventId,
                events: params.events,
                resolvedEventIds: [],
                isCompleted: false
            },
            priority: 'high'
        });
    }

    static emitBurstChoiceResolved(
        gameEnv: GameEnvironment,
        event: BurstEffectChoiceEvent,
        userDecision: 'ACTIVATE' | 'DECLINE'
    ): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        const resolvedId = `${event.id}_resolved`;
        notificationManager.addNotificationEventWithId(resolvedId, 'BURST_EFFECT_CHOICE_RESOLVED', {
            playerId: event.playerId,
            eventId: event.id,
            choiceId: event.data?.choiceId,
            userDecision
        }, 'normal');
    }

    static emitBlockerChoiceCreated(gameEnv: GameEnvironment, event: BlockerChoiceEvent): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEventWithId(event.id, 'BLOCKER_CHOICE', {
            playerId: event.playerId,
            event
        }, 'high');
    }

    static emitBlockerChoiceResolved(
        gameEnv: GameEnvironment,
        event: BlockerChoiceEvent,
        userDecision: 'BLOCK' | 'DECLINE'
    ): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        const resolvedId = `${event.id}_resolved`;
        notificationManager.addNotificationEventWithId(resolvedId, 'BLOCKER_CHOICE_RESOLVED', {
            playerId: event.playerId,
            eventId: event.id,
            choiceId: event.data?.choiceId,
            userDecision
        }, 'normal');
    }

    static emitTargetChoiceCreated(gameEnv: GameEnvironment, event: TargetChoiceEvent): void {
        const allowEmptySelection = event.data?.effect?.optional === true;
        const rawCount = event.data?.effect?.target?.count;
        const countRange = TargetCountUtils.parseRange(rawCount, { min: 1, max: 1 });
        const isCostChoice = event.data?.effect?.trigger === 'COST';
        const effectAction = event.data?.effect?.action;
        const effectId = event.data?.effect?.effectId;
        const contextKind = (event.data as any)?.context?.kind;
        const choiceKind = ChoiceNotificationEmitter.deriveTargetChoiceKind(effectAction, contextKind);

        // For optional COST choices (i.e., "you may pay this cost"), allow declining (empty selection),
        // but if the player chooses to pay, the selection should still match the effect's count.
        const targetCount = (allowEmptySelection && !isCostChoice)
            ? { min: 0, max: countRange.max }
            : countRange;
        ChoiceNotificationEmitter.emitPersistentChoiceCreated(gameEnv, {
            eventId: event.id,
            type: 'TARGET_CHOICE',
            payload: {
                playerId: event.playerId,
                allowEmptySelection,
                targetCount,
                choiceKind,
                choice: {
                    action: typeof effectAction === 'string' ? effectAction : undefined,
                    effectId: typeof effectId === 'string' ? effectId : undefined,
                    sourceCarduid: event.data?.sourceCarduid,
                    contextKind: typeof contextKind === 'string' ? contextKind : undefined
                },
                event,
                isCompleted: false
            },
            priority: 'high'
        });
    }

    static emitTargetChoiceResolved(
        gameEnv: GameEnvironment,
        event: TargetChoiceEvent
    ): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        // Reuse the existing TARGET_CHOICE notification object rather than emitting a separate
        // TARGET_CHOICE_RESOLVED notification, so the frontend only needs to handle one shape.
        // Note: event.data.userDecisionMade / selectedTargets are already set in ChoiceConfirmationService.
        notificationManager.updateNotificationEvent(event.id, {
            isCompleted: true,
            event
        });
    }

    static emitTokenChoiceCreated(gameEnv: GameEnvironment, event: TokenChoiceEvent): void {
        ChoiceNotificationEmitter.emitPersistentChoiceCreated(gameEnv, {
            eventId: event.id,
            type: 'TOKEN_CHOICE',
            payload: {
                playerId: event.playerId,
                event,
                isCompleted: false
            },
            priority: 'high'
        });
    }

    static emitTokenChoiceResolved(gameEnv: GameEnvironment, event: TokenChoiceEvent): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        // Reuse the existing TOKEN_CHOICE notification object rather than emitting a separate
        // TOKEN_CHOICE_RESOLVED notification, so the frontend only needs to handle one shape.
        // Note: event.data.userDecisionMade / selectedChoiceIndex are already set in ChoiceConfirmationService.
        notificationManager.updateNotificationEvent(event.id, {
            isCompleted: true,
            event
        });
    }

    static emitOptionChoiceCreated(gameEnv: GameEnvironment, event: OptionChoiceEvent): void {
        ChoiceNotificationEmitter.emitPersistentChoiceCreated(gameEnv, {
            eventId: event.id,
            type: 'OPTION_CHOICE',
            payload: {
                playerId: event.playerId,
                event,
                isCompleted: false
            },
            priority: 'high'
        });
    }

    static emitOptionChoiceResolved(gameEnv: GameEnvironment, event: OptionChoiceEvent): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        // Reuse the existing OPTION_CHOICE notification object rather than emitting a separate
        // OPTION_CHOICE_RESOLVED notification, so the frontend only needs to handle one shape.
        // Note: event.data.userDecisionMade / selectedOptionIndex are already set in ChoiceConfirmationService.
        notificationManager.updateNotificationEvent(event.id, {
            isCompleted: true,
            event
        });
    }

    static emitPromptChoiceCreated(gameEnv: GameEnvironment, event: PromptChoiceEvent): void {
        ChoiceNotificationEmitter.emitPersistentChoiceCreated(gameEnv, {
            eventId: event.id,
            type: 'PROMPT_CHOICE',
            payload: {
                playerId: event.playerId,
                event,
                isCompleted: false
            },
            priority: 'high'
        });
    }

    static emitPromptChoiceResolved(gameEnv: GameEnvironment, event: PromptChoiceEvent): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.updateNotificationEvent(event.id, {
            isCompleted: true,
            event
        });
    }
}
