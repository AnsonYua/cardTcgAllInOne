// src/services/BattlePhaseManager.ts
// Coordinates battle flow, action step windows, and deferred resolution

import { GameEnvironment } from '../models/GameEnvironment';
import { BattleContext } from '../models/BattleContext';
import { PlayerActionEvent, PlayerActionEventData, EventFactory } from './EventQueue/interfaces/GameEvent';
import { ExecutionResult } from './ExecutionResult';
import { AttackPreparationManager } from './AttackPreparationManager';
import { PlayerCardManager } from './PlayerCardManager';
import { AttackPreparationFailure } from './AttackPreparationManager';
import { UnitZoneCard } from '../models/CardSystem';
import { GameNotificationManager } from './GameNotificationManager';

export class BattlePhaseManager {
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

    static isActionWindowOpen(gameEnv: GameEnvironment): boolean {
        return Boolean(gameEnv.currentBattle && gameEnv.currentBattle.status === 'ACTION_STEP');
    }

    static playerInActiveBattle(gameEnv: GameEnvironment, playerId: string): boolean {
        if (!gameEnv.currentBattle) {
            return false;
        }
        return this.playerInBattle(gameEnv.currentBattle, playerId);
    }

    private static playerInBattle(context: BattleContext, playerId: string): boolean {
        return context.attackingPlayerId === playerId || context.defendingPlayerId === playerId;
    }

    private static startUnitBattle(
        gameEnv: GameEnvironment,
        event: PlayerActionEvent,
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
            pendingEvent: { ...eventData },
            attackerCarduid,
            targetCarduid: targetUnitUid,
            targetPlayerId,
            status: 'ACTION_STEP',
            fromBurst: Boolean(eventData.fromBurst),
            openedAt: Date.now()
        };

        gameEnv.setCurrentBattle(context);
        console.log('⚔️ Action step opened for unit battle');

        return {
            success: true,
            requiresSelection: true
        };
    }

    private static startShieldBattle(
        gameEnv: GameEnvironment,
        event: PlayerActionEvent,
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
            pendingEvent: { ...eventData },
            attackerCarduid,
            status: 'ACTION_STEP',
            fromBurst: Boolean(eventData.fromBurst),
            openedAt: Date.now()
        };

        gameEnv.setCurrentBattle(context);
        console.log('⚔️ Action step opened for shield attack');

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

        console.log(`⚔️ Resolving unit battle: ${attackingUnit.carduid} vs ${targetUnit.carduid}`);

        const attackerStats = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, attackingUnit.carduid);
        const defenderStats = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, targetUnit.carduid);

        const attackerRemainingHP = Math.max(0, attackerStats.totalHP - defenderStats.totalAP);
        const defenderRemainingHP = Math.max(0, defenderStats.totalHP - attackerStats.totalAP);

        const attackerDestroyed = this.applyBattleDamage(
            gameEnv,
            attacker.id,
            attackerSlot,
            attackingUnit,
            'Attacker',
            attackerRemainingHP,
            defenderStats.totalAP
        );

        const defenderDestroyed = this.applyBattleDamage(
            gameEnv,
            defender.id,
            targetSlotName,
            targetUnit,
            'Defender',
            defenderRemainingHP,
            attackerStats.totalAP
        );

        console.log(`⚔️ Battle resolved: Attacker ${attackerDestroyed ? 'destroyed' : 'survived'}, Defender ${defenderDestroyed ? 'destroyed' : 'survived'}`);

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

        const { defender, attackerSlot, attackingUnit } = preparation;

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
            const currentDamage = baseCard.damageReceived || 0;
            const newDamage = currentDamage + totalAttackPower;
            const maxHP = baseCard.originalHP || baseCard.cardData?.hp || 0;
            const remainingHP = Math.max(0, maxHP - newDamage);

            baseCard.damageReceived = newDamage;

            let baseDestroyed = false;
            if (remainingHP <= 0) {
                console.log(`🏰 Base destroyed: ${baseCard.carduid}`);
                PlayerCardManager.moveCardToTrash(gameEnv, defender.id, baseCard.carduid, baseCard.cardId, baseCard.cardData);
                defender.zones.base = defender.zones.base.filter((card: any) => card.carduid !== baseCard.carduid);
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
                false,
                'normal'
            );

            console.log(`🏰 Base damage applied: ${currentDamage} → ${newDamage} (remaining HP: ${remainingHP}${baseDestroyed ? ' - DESTROYED' : ''})`);
        } else {
            if (defender.hasShield() && totalAttackPower > 0) {
                const shieldCardsToAttack = this.getShieldCardsToAttack(defender, 1);
                const shieldAttackEvent = EventFactory.createShieldCardAttackedEvent(
                    defender.id,
                    playerId,
                    attackerSlot,
                    shieldCardsToAttack,
                    totalAttackPower
                );
                gameEnv.enqueueForProcessing(shieldAttackEvent);
                console.log(`🎯 Shield attack event queued: ${shieldAttackEvent.id}`);
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

    private static applyBattleDamage(
        gameEnv: GameEnvironment,
        playerId: string,
        slotName: string,
        unit: UnitZoneCard,
        role: 'Attacker' | 'Defender',
        remainingHP: number,
        damageTaken: number
    ): boolean {
        if (remainingHP <= 0) {
            console.log(`💥 ${role} unit ${unit.carduid} destroyed (took ${damageTaken} damage)`);
            PlayerCardManager.moveCardToTrashFromSlot(gameEnv, playerId, slotName, unit, 'unit');
            return true;
        }

        PlayerCardManager.updateUnitDamage(unit, damageTaken);
        console.log(`🩹 ${role} unit ${unit.carduid} survived with ${remainingHP} HP`);
        return false;
    }

    private static getShieldCardsToAttack(defender: any, maxCards: number = 1): Array<{ carduid: string; cardId: string; cardData: any }> {
        const availableShields = defender.getShieldCards();
        const cardsToAttack: Array<{ carduid: string; cardId: string; cardData: any }> = [];

        for (let i = 0; i < Math.min(maxCards, availableShields.length); i++) {
            const shieldCard = availableShields[i];
            cardsToAttack.push({
                carduid: shieldCard.carduid,
                cardId: shieldCard.cardId,
                cardData: shieldCard.cardData
            });
        }

        return cardsToAttack;
    }
}
