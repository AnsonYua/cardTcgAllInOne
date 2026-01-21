// src/services/BattlePhaseManager.ts
// Coordinates battle flow, action step windows, and deferred resolution

import { GameEnvironment } from '../models/GameEnvironment';
import { BattleContext, ForcedTargetSummary } from '../models/BattleContext';
import { PlayerActionEvent, PlayerActionEventData } from './EventQueue/interfaces/GameEvent';
import { EventFactory } from './EventQueue/EventFactory';
import { ExecutionResult } from './ExecutionResult';
import { AttackPreparationManager } from './AttackPreparationManager';
import { PlayerCardManager } from './PlayerCardManager';
import { AttackPreparationFailure } from './AttackPreparationManager';
import { UnitZoneCard } from '../models/CardSystem';
import { GameNotificationManager } from './GameNotificationManager';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';
import { BlockerChoiceManager } from './BlockerChoiceManager';
import { AttackPhaseEffectManager } from './effects/AttackPhaseEffectManager';
import { BaseLifecycleManager } from './BaseLifecycleManager';
import { GameEndManager } from './GameEndManager';
import { BattleDestroyEffectManager } from './effects/BattleDestroyEffectManager';
import {
    buildSlotSnapshot,
    buildForcedTargetSnapshot,
    buildBaseSnapshot,
    buildShieldSnapshot,
    emitBattleResolutionNotification
} from './battle/BattleSnapshotUtils';
import { getShieldCardsToAttack, isShieldDamagePrevented } from './battle/BattleShieldUtils';

export class BattlePhaseManager {
    static initiateAttack(gameEnv: GameEnvironment, event: PlayerActionEvent): ExecutionResult {
        const defendingPlayerId = gameEnv.getOpponentId(event.playerId);
        if (!defendingPlayerId) {
            console.error(`❌ No opponent found for attacking player ${event.playerId}`);
            return { success: false, error: 'No opponent found' };
        }

        this.recordAttackDeclaration(gameEnv, event, defendingPlayerId);

        const effectsResult = AttackPhaseEffectManager.processAttackPhaseEffects(gameEnv, event);
        if (!effectsResult.success) {
            return { success: false, error: effectsResult.error };
        }

        const blockerResult = BlockerChoiceManager.processAttackWithBlockerChoice(
            gameEnv,
            event,
            defendingPlayerId
        );

        if (!blockerResult.success) {
            return { success: false, error: blockerResult.error };
        }

        if (blockerResult.requiresSelection) {
            return { success: true, requiresSelection: true };
        }

        if (blockerResult.normalAttack) {
            return this.startBattle(gameEnv, event);
        }

        return { success: true };
    }
    static startBattle(gameEnv: GameEnvironment, event: PlayerActionEvent): ExecutionResult {
        const eventData = event.data || {};
        const actionType = eventData.actionType;

        if (gameEnv.currentBattle) {
            console.warn('⚠️ Attempt to start battle while one is already active');
            return {
                success: false,
                error: 'Battle already in progress'
            };
        }

        if (actionType === 'attackUnit') {
            return this.startUnitBattle(gameEnv, event, eventData);
        }

        if (actionType === 'attackShieldArea') {
            return this.startShieldBattle(gameEnv, event, eventData);
        }

        return {
            success: false,
            error: `Unsupported battle action type: ${actionType}`
        };
    }

    static resolveBattle(gameEnv: GameEnvironment, resolvingPlayerId: string): ExecutionResult {
        const context = gameEnv.currentBattle;
        if (!context) {
            return {
                success: false,
                error: 'No active battle to resolve'
            };
        }

        if (!this.playerInBattle(context, resolvingPlayerId)) {
            return {
                success: false,
                error: 'Player not involved in current battle'
            };
        }

        if (!gameEnv.haveBothPlayersConfirmedBattle()) {
            return {
                success: false,
                error: 'Both players must confirm before resolving the battle'
            };
        }

        context.status = 'RESOLVING';

        switch (context.actionType) {
            case 'attackUnit':
                return this.resolveUnitBattle(gameEnv, context);
            case 'attackShieldArea':
                return this.resolveShieldBattle(gameEnv, context);
            default:
                return {
                    success: false,
                    error: `Unsupported battle resolution type: ${context.actionType}`
                };
        }
    }

    static handleBattleConfirmation(gameEnv: GameEnvironment, playerId: string): ExecutionResult {
        if (!playerId) {
            return { success: false, error: 'confirmBattle action requires playerId' };
        }

        const confirmation = gameEnv.confirmBattleResolution(playerId);
        if (!confirmation.success) {
            return { success: false, error: confirmation.error };
        }

        const autoResolveResult = this.tryAutoResolveBattle(gameEnv);
        if (autoResolveResult) {
            return autoResolveResult;
        }

        console.log('🤝 Battle confirmation recorded, awaiting opponent confirmation');
        return { success: true };
    }

    static isActionWindowOpen(gameEnv: GameEnvironment): boolean {
        return Boolean(gameEnv.currentBattle && gameEnv.currentBattle.status === 'ACTION_STEP');
    }

    static playerInActiveBattle(gameEnv: GameEnvironment, playerId: string): boolean {
        if (!gameEnv.currentBattle) {
            return false;
        }
        return this.playerInBattle(gameEnv.currentBattle, playerId);
    }

    static handlePostActionStepCardPlay(gameEnv: GameEnvironment, playerId: string): ExecutionResult {
        const battle = gameEnv.currentBattle;
        if (!battle || battle.status !== 'ACTION_STEP') {
            return { success: true };
        }

        if (!this.playerInBattle(battle, playerId)) {
            return { success: true };
        }

        if (!battle.confirmations) {
            battle.confirmations = {};
        }

        if (battle.confirmations[playerId] === false) {
            console.log(`♻️ Resetting confirmation for ${playerId} after card play`);
        }
        battle.confirmations[playerId] = false;
        gameEnv.refreshBattleActionTargets();
        console.log('🎯 Action targets refreshed after card play:', JSON.stringify(battle.actionTargets || {}));

        const autoResolveResult = this.tryAutoResolveBattle(gameEnv);
        if (autoResolveResult) {
            return autoResolveResult;
        }

        console.log('⏳ Waiting for other player confirmation before resolving battle');
        return { success: true };
    }

    private static playerInBattle(context: BattleContext, playerId: string): boolean {
        return context.attackingPlayerId === playerId || context.defendingPlayerId === playerId;
    }

    private static tryAutoResolveBattle(gameEnv: GameEnvironment): ExecutionResult | null {
        if (!gameEnv.currentBattle) {
            return null;
        }

        if (!gameEnv.haveBothPlayersConfirmedBattle()) {
            return null;
        }

        const attackerId = gameEnv.currentBattle.attackingPlayerId;
        if (!attackerId) {
            console.error('❌ Cannot auto-resolve battle: attacking player not found');
            return {
                success: false,
                error: 'Cannot auto-resolve battle: attacking player not found'
            };
        }

        const attackNotificationId = gameEnv.currentBattle.attackNotificationId;
        if (attackNotificationId) {
            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.updateNotificationEvent(attackNotificationId, {
                battleEnd: true
            });
            console.log(`📣 Attack notification ${attackNotificationId} marked as battleEnd`);
        }

        const result = this.resolveBattle(gameEnv, attackerId);
        if (!result.success) {
            console.error(`❌ Failed to auto-resolve battle: ${result.error}`);
        } else {
            console.log('✅ Battle auto-resolved');
        }
        return result;
    }

    private static startUnitBattle(
        gameEnv: GameEnvironment,
        _event: PlayerActionEvent,
        eventData: PlayerActionEventData
    ): ExecutionResult {
        const { playerId, attackerCarduid, targetPlayerId, targetUnitUid } = eventData;

        if (typeof playerId !== 'string' || typeof attackerCarduid !== 'string' || typeof targetPlayerId !== 'string' || typeof targetUnitUid !== 'string') {
            return {
                success: false,
                error: 'attackUnit action requires playerId, attackerCarduid, targetPlayerId, and targetUnitUid'
            };
        }

        const preparation = AttackPreparationManager.prepareUnitAttack(
            gameEnv,
            playerId,
            attackerCarduid,
            targetPlayerId,
            targetUnitUid
        );

        if (!preparation.success) {
            const failure = preparation as AttackPreparationFailure;
            return {
                success: false,
                error: failure.error
            };
        }

        const context: BattleContext = {
            actionType: 'attackUnit',
            attackingPlayerId: playerId,
            defendingPlayerId: targetPlayerId,
            attackerCarduid,
            targetCarduid: targetUnitUid,
            targetPlayerId,
            status: 'ACTION_STEP',
            fromBurst: Boolean(eventData.fromBurst),
            openedAt: Date.now(),
            forcedTarget: this.extractForcedTarget(eventData),
            attackNotificationId: this.extractAttackNotificationId(eventData)
        };

        gameEnv.setCurrentBattle(context);
        console.log('⚔️ Action step opened for unit battle');

        const autoResolveResult = this.tryAutoResolveBattle(gameEnv);
        if (autoResolveResult) {
            return autoResolveResult;
        }

        return {
            success: true,
            requiresSelection: true
        };
    }

    private static startShieldBattle(
        gameEnv: GameEnvironment,
        _event: PlayerActionEvent,
        eventData: PlayerActionEventData
    ): ExecutionResult {
        const { playerId, attackerCarduid } = eventData;

        if (typeof playerId !== 'string' || typeof attackerCarduid !== 'string') {
            return {
                success: false,
                error: 'attackShieldArea action requires playerId and attackerCarduid'
            };
        }

        const preparation = AttackPreparationManager.prepareBaseAttack(
            gameEnv,
            playerId,
            attackerCarduid
        );

        if (!preparation.success) {
            const failure = preparation as AttackPreparationFailure;
            return {
                success: false,
                error: failure.error
            };
        }

        const opponentId = gameEnv.getOpponentId(playerId);
        if (!opponentId) {
            return {
                success: false,
                error: 'Opponent not found for shield attack'
            };
        }

        const context: BattleContext = {
            actionType: 'attackShieldArea',
            attackingPlayerId: playerId,
            defendingPlayerId: opponentId,
            attackerCarduid,
            status: 'ACTION_STEP',
            fromBurst: Boolean(eventData.fromBurst),
            openedAt: Date.now(),
            targetPlayerId: opponentId,
            forcedTarget: this.extractForcedTarget(eventData),
            attackNotificationId: this.extractAttackNotificationId(eventData)
        };

        gameEnv.setCurrentBattle(context);
        console.log('⚔️ Action step opened for shield attack');

        const autoResolveResult = this.tryAutoResolveBattle(gameEnv);
        if (autoResolveResult) {
            return autoResolveResult;
        }

        return {
            success: true,
            requiresSelection: true
        };
    }

    private static resolveUnitBattle(gameEnv: GameEnvironment, context: BattleContext): ExecutionResult {
        const playerId = context.attackingPlayerId;
        const attackerCarduid = context.attackerCarduid as string;
        const targetPlayerId = context.targetPlayerId as string;
        const targetUnitUid = context.targetCarduid as string;

        const preparation = AttackPreparationManager.prepareUnitAttack(
            gameEnv,
            playerId,
            attackerCarduid,
            targetPlayerId,
            targetUnitUid
        );

        if (!preparation.success) {
            gameEnv.clearCurrentBattle();
            const failure = preparation as AttackPreparationFailure;
            return {
                success: false,
                error: failure.error
            };
        }

        const {
            attacker,
            defender,
            attackerSlot,
            attackingUnit,
            targetSlotName,
            targetUnit
        } = preparation;

        const attackerSnapshot = buildSlotSnapshot(attacker, attackerSlot);
        const originalTargetSnapshot = buildSlotSnapshot(defender, targetSlotName);
        const focusTargetSnapshot = buildForcedTargetSnapshot(gameEnv, context.forcedTarget);

        console.log(`⚔️ Resolving unit battle: ${attackingUnit.carduid} vs ${targetUnit.carduid}`);

        const attackerStats = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, attackingUnit.carduid);
        const defenderStats = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, targetUnit.carduid);

        const attackerRemainingHP = Math.max(0, attackerStats.totalHP - defenderStats.totalAP);
        const defenderRemainingHP = Math.max(0, defenderStats.totalHP - attackerStats.totalAP);

        const attackerDestroyed = attackerRemainingHP <= 0;
        const defenderDestroyed = defenderRemainingHP <= 0;

        if (attackerDestroyed) {
            PlayerCardManager.updateUnitDamage(attackingUnit, defenderStats.totalAP);
        } else {
            PlayerCardManager.updateUnitDamage(attackingUnit, defenderStats.totalAP);
        }

        if (defenderDestroyed) {
            PlayerCardManager.updateUnitDamage(targetUnit, attackerStats.totalAP);
        } else {
            PlayerCardManager.updateUnitDamage(targetUnit, attackerStats.totalAP);
        }

        if (defenderDestroyed) {
            const battleDestroyResult = BattleDestroyEffectManager.processBattleDestroy(gameEnv, {
                sourcePlayerId: attacker.id,
                sourceUnit: attackingUnit,
                sourceSlot: attackerSlot,
                destroyedPlayerId: defender.id,
                destroyedUnit: targetUnit
            });
            if (!battleDestroyResult.success) {
                gameEnv.clearCurrentBattle();
                return { success: false, error: battleDestroyResult.error || 'Battle destroy effect failed' };
            }
        }

        if (attackerDestroyed) {
            const battleDestroyResult = BattleDestroyEffectManager.processBattleDestroy(gameEnv, {
                sourcePlayerId: defender.id,
                sourceUnit: targetUnit,
                sourceSlot: targetSlotName,
                destroyedPlayerId: attacker.id,
                destroyedUnit: attackingUnit
            });
            if (!battleDestroyResult.success) {
                gameEnv.clearCurrentBattle();
                return { success: false, error: battleDestroyResult.error || 'Battle destroy effect failed' };
            }
        }

        if (attackerDestroyed) {
            PlayerCardManager.destroyUnitInSlot(gameEnv, attacker.id, attackerSlot, attackingUnit);
        }

        if (defenderDestroyed) {
            PlayerCardManager.destroyUnitInSlot(gameEnv, defender.id, targetSlotName, targetUnit);
        }

        console.log(`⚔️ Battle resolved: Attacker ${attackerDestroyed ? 'destroyed' : 'survived'}, Defender ${defenderDestroyed ? 'destroyed' : 'survived'}`);

        emitBattleResolutionNotification(gameEnv, context, {
            attacker: attackerSnapshot,
            target: focusTargetSnapshot || originalTargetSnapshot,
            focusTarget: focusTargetSnapshot,
            result: {
                targetType: 'unit',
                attackerDestroyed,
                defenderDestroyed,
                attackerDamageTaken: defenderStats.totalAP,
                defenderDamageTaken: attackerStats.totalAP
            }
        });

        gameEnv.clearCurrentBattle();
        return { success: true };
    }

    private static resolveShieldBattle(gameEnv: GameEnvironment, context: BattleContext): ExecutionResult {
        const playerId = context.attackingPlayerId;
        const attackerCarduid = context.attackerCarduid as string;

        const preparation = AttackPreparationManager.prepareBaseAttack(
            gameEnv,
            playerId,
            attackerCarduid
        );

        if (!preparation.success) {
            gameEnv.clearCurrentBattle();
            const failure = preparation as AttackPreparationFailure;
            return {
                success: false,
                error: failure.error
            };
        }

        const { attacker, defender, attackerSlot, attackingUnit } = preparation;
        const attackerSnapshot = buildSlotSnapshot(attacker, attackerSlot);

        if (AttackPreparationManager.unitHasAttackRestriction(attackingUnit as UnitZoneCard, 'cannot_attack_player')) {
            const cardName = attackingUnit.cardData?.name || attackingUnit.cardId || 'Attacking unit';
            console.warn(`⚠️ ${cardName} (${attackingUnit.carduid}) cannot attack the player due to restriction.`);
            gameEnv.clearCurrentBattle();
            return {
                success: false,
                error: `${cardName} cannot attack the player due to a restriction`
            };
        }

        const combinedStats = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, attackingUnit.carduid);
        const totalAttackPower = combinedStats.totalAP;

        const defenderBases = defender.zones.base;

        if (defenderBases.length > 0) {
            const baseCard = defenderBases[0];
            const baseSnapshot = buildBaseSnapshot(defender, baseCard);
            const currentDamage = baseCard.damageReceived || 0;
            const newDamage = currentDamage + totalAttackPower;
            const maxHP = baseCard.originalHP || baseCard.cardData?.hp || 0;
            const remainingHP = Math.max(0, maxHP - newDamage);

            baseCard.damageReceived = newDamage;

            let baseDestroyed = false;
            if (remainingHP <= 0) {
                BaseLifecycleManager.destroyBase(gameEnv, defender.id, baseCard);
                baseDestroyed = true;
            }

            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.addNotificationEvent(
                baseDestroyed ? 'BASE_DESTROYED' : 'BASE_DAMAGED',
                {
                    defendingPlayerId: defender.id,
                    attackingPlayerId: playerId,
                    attackerSlot,
                    damage: totalAttackPower,
                    totalDamage: newDamage,
                    baseHP: remainingHP,
                    baseDestroyed,
                    ...(baseDestroyed && {
                        destroyedCard: {
                            carduid: baseCard.carduid,
                            cardId: baseCard.cardId,
                            name: baseCard.cardData?.name || 'Unknown Base'
                        }
                    })
                },
                'normal'
            );

            console.log(`🏰 Base damage applied: ${currentDamage} → ${newDamage} (remaining HP: ${remainingHP}${baseDestroyed ? ' - DESTROYED' : ''})`);

            emitBattleResolutionNotification(gameEnv, context, {
                attacker: attackerSnapshot,
                target: baseSnapshot,
                result: {
                    targetType: 'base',
                    baseDestroyed,
                    damageApplied: totalAttackPower,
                    totalDamage: newDamage,
                    remainingHP
                }
            });
        } else {
            if (defender.hasShield() && totalAttackPower > 0) {
                if (isShieldDamagePrevented(gameEnv, defender.id, attackingUnit)) {
                    const shieldSnapshot = buildShieldSnapshot(defender);
                    emitBattleResolutionNotification(gameEnv, context, {
                        attacker: attackerSnapshot,
                        target: shieldSnapshot,
                        result: {
                            targetType: 'shield',
                            shieldsTargeted: 0,
                            attackPower: totalAttackPower,
                            damagePrevented: true
                        }
                    });
                } else {
                const shieldCardsToAttack = getShieldCardsToAttack(defender, 1);
                const shieldAttackEvent = EventFactory.createShieldCardAttackedEvent(
                    defender.id,
                    playerId,
                    attackerSlot,
                    shieldCardsToAttack,
                    totalAttackPower
                );
                gameEnv.enqueueForProcessing(shieldAttackEvent);
                console.log(`🎯 Shield attack event queued: ${shieldAttackEvent.id}`);

                const shieldSnapshot = buildShieldSnapshot(defender);
                emitBattleResolutionNotification(gameEnv, context, {
                    attacker: attackerSnapshot,
                    target: shieldSnapshot,
                    result: {
                        targetType: 'shield',
                        shieldsTargeted: shieldCardsToAttack.length,
                        attackPower: totalAttackPower
                    }
                });
                }
            } else if (totalAttackPower > 0) {
                const shieldSnapshot = buildShieldSnapshot(defender);
                emitBattleResolutionNotification(gameEnv, context, {
                    attacker: attackerSnapshot,
                    target: shieldSnapshot,
                    result: {
                        targetType: 'shield',
                        shieldsTargeted: 0,
                        attackPower: totalAttackPower,
                        defenderHadNoShields: true,
                        gameEnded: true
                    }
                });

                GameEndManager.endGame(gameEnv, attacker.id, 'no_shields_remaining');
            } else {
                gameEnv.clearCurrentBattle();
                return {
                    success: false,
                    error: 'No shields to attack'
                };
            }
        }

        console.log(`✅ Shield/base attack resolved - Total damage: ${totalAttackPower}`);
        gameEnv.clearCurrentBattle();
        return { success: true };
    }


    private static recordAttackDeclaration(
        gameEnv: GameEnvironment,
        event: PlayerActionEvent,
        defendingPlayerId: string
    ): void {
        const data = event.data || {};
        const actionType = data.actionType;

        if (data.attackNotificationSent) {
            return;
        }

        const isUnitAttack = actionType === 'attackUnit';
        const isShieldAttack = actionType === 'attackShieldArea';

        if (!isUnitAttack && !isShieldAttack) {
            return;
        }

        const attacker = gameEnv.getPlayer(event.playerId);
        const defender = gameEnv.getPlayer(typeof data.targetPlayerId === 'string' ? data.targetPlayerId : defendingPlayerId);

        if (!attacker || !defender) {
            return;
        }

        const attackerSlot = typeof data.attackerCarduid === 'string'
            ? SlotZoneUtils.findSlotByCarduid(attacker.zones, data.attackerCarduid)
            : null;

        if (attackerSlot?.unit && !attackerSlot.unit.isRested) {
            attackerSlot.unit.isRested = true;
            console.log(`💤 Attacker ${attackerSlot.unit.carduid} is now rested for attack declaration`);
        }

        let targetCarduid: string | undefined;
        let targetSlotName: string | undefined;
        let targetName: string | undefined;

        if (isUnitAttack) {
            targetCarduid = typeof data.targetUnitUid === 'string'
                ? data.targetUnitUid
                : typeof data.targetCarduid === 'string'
                    ? data.targetCarduid
                    : undefined;

            const targetSlot = targetCarduid
                ? SlotZoneUtils.findSlotByCarduid(defender.zones, targetCarduid)
                : null;

            targetSlotName = targetSlot?.slotName || undefined;
            targetName = targetSlot?.unit?.cardData?.name || targetSlot?.unit?.cardId || 'Unknown Unit';
        } else {
            const baseCards = defender.zones?.base || [];
            if (Array.isArray(baseCards) && baseCards.length > 0) {
                targetSlotName = 'base';
                targetName = 'Base';
            } else {
                const shieldCards = defender.getShieldCards();
                if (shieldCards.length > 0) {
                    targetSlotName = 'shieldArea';
                    targetName = 'Shield Area';
                } else {
                    targetSlotName = 'shieldArea';
                    targetName = 'Shield Area';
                }
            }
        }

        const notificationManager = new GameNotificationManager(gameEnv);
        const notificationId = notificationManager.addNotificationEvent(
            'UNIT_ATTACK_DECLARED',
            {
                gameId: typeof data.gameId === 'string' ? data.gameId : undefined,
                attackingPlayerId: attacker.id,
                defendingPlayerId,
                attackerCarduid: typeof data.attackerCarduid === 'string' ? data.attackerCarduid : undefined,
                attackerName: attackerSlot?.unit?.cardData?.name || attackerSlot?.unit?.cardId || 'Unknown Unit',
                attackerSlot: attackerSlot?.slotName,
                targetCarduid,
                targetName,
                targetSlotName,
                fromBurst: Boolean(data.fromBurst),
                timestamp: Date.now()
            }
        );

        data.attackNotificationSent = true;
        data.attackNotificationId = notificationId;
    }

    private static extractForcedTarget(eventData: PlayerActionEventData): ForcedTargetSummary | undefined {
        const forcedTarget = eventData?.forcedTarget as ForcedTargetSummary | undefined;
        if (!forcedTarget || typeof forcedTarget !== 'object') {
            return undefined;
        }

        if (typeof forcedTarget.carduid !== 'string') {
            return undefined;
        }

        return {
            carduid: forcedTarget.carduid,
            playerId: typeof forcedTarget.playerId === 'string' ? forcedTarget.playerId : undefined,
            zone: typeof forcedTarget.zone === 'string' ? forcedTarget.zone : undefined
        };
    }

    private static extractAttackNotificationId(eventData: PlayerActionEventData): string | undefined {
        const id = eventData && typeof (eventData as any).attackNotificationId === 'string'
            ? (eventData as any).attackNotificationId
            : undefined;
        return id;
    }

}
