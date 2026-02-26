const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const { BattlePhaseManager } = require('../services/BattlePhaseManager');
const { EventFactory } = require('../services/EventQueue/EventFactory');
const { SlotZoneUtils } = require('../utils/SlotZoneUtils');

function findUnit(gameEnv, playerId, carduid) {
    const player = gameEnv.getPlayer(playerId);
    const zones = player?.zones || {};
    for (let i = 1; i <= 6; i++) {
        const unit = zones[`slot${i}`]?.unit;
        if (unit?.carduid === carduid) {
            return unit;
        }
    }
    return null;
}

describe('GD03-002 During Pair reacts to granted Repair attacker', () => {
    test('triggers on another friendly unit with dynamically granted Repair and prompts valid rest target', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        const theOUid = 'GD03-002_unit_0001';
        const theOPilotUid = 'GD03-084_pilot_0001';
        const attackerUid = 'GD01-001_unit_0001';
        const attackerPilotUid = 'GD01-087_pilot_0001';
        const enemyValidUid = 'GD01-020_unit_0001'; // Lv4 valid for GD01-001 (Lv4)

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: theOUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: theOPilotUid,
                playAs: 'pilot',
                targetUnit: theOUid
            }).success
        ).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: attackerUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: attackerPilotUid,
                playAs: 'pilot',
                targetUnit: attackerUid
            }).success
        ).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: enemyValidUid, playAs: 'unit' }).success).toBe(true);

        // Build effect registry + apply continuous grants so attacker receives Repair via runtime temporaryEffects.
        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        const attacker = findUnit(gameEnv, 'playerId_1', attackerUid);
        expect(attacker).toBeTruthy();
        expect(Array.isArray(attacker.temporaryEffects)).toBe(true);
        expect(
            attacker.temporaryEffects.some((effect) =>
                Array.isArray(effect?.grantedKeywords) && effect.grantedKeywords.includes('Repair')
            )
        ).toBe(true);

        // Simulate an attack event context. Reactive continuous pass uses processingQueue[0] + latest notification.
        gameEnv.notificationQueue.push({
            id: 'unit_attack_declared_gd03002_regression',
            type: 'UNIT_ATTACK_DECLARED',
            payload: {
                attackingPlayerId: 'playerId_1',
                defendingPlayerId: 'playerId_2',
                attackerCarduid: attackerUid,
                targetCarduid: enemyValidUid,
                targetSlotName: 'slot1'
            }
        });
        gameEnv.processingQueue = [
            {
                id: 'player_action_attack_gd03002_regression',
                type: 'PLAYER_ACTION',
                status: 'RESOLVING',
                priority: 1,
                timestamp: Date.now(),
                playerId: 'playerId_1',
                data: {
                    actionType: 'attackUnit',
                    attackerCarduid: attackerUid,
                    targetUnitUid: enemyValidUid,
                    targetPlayerId: 'playerId_2'
                }
            }
        ];

        const reactiveResult = ContinuousEffectManager.processReactiveContinuousEffects(gameEnv);
        expect(reactiveResult.success).toBe(true);
        expect((reactiveResult.executed || 0)).toBeGreaterThan(0);

        const choiceEvent = gameEnv.processingQueue.find(
            (event) =>
                event.type === 'TARGET_CHOICE' &&
                event.data?.effect?.effectId === 'during_pair_effect_seq_0_then_0'
        );
        expect(choiceEvent).toBeFalsy();

        const enemyUnit = findUnit(gameEnv, 'playerId_2', enemyValidUid);
        expect(enemyUnit).toBeTruthy();
        expect(enemyUnit.isRested).toBe(true);
    });

    test('does not trigger when attacker is GD03-002 itself', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        const theOUid = 'GD03-002_unit_self_0001';
        const theOPilotUid = 'GD03-084_pilot_self_0001';
        const enemyUid = 'GD01-020_enemy_self_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: theOUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: theOPilotUid,
                playAs: 'pilot',
                targetUnit: theOUid
            }).success
        ).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: enemyUid, playAs: 'unit' }).success).toBe(true);

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        gameEnv.notificationQueue.push({
            id: 'unit_attack_declared_gd03002_self_attack',
            type: 'UNIT_ATTACK_DECLARED',
            payload: {
                attackingPlayerId: 'playerId_1',
                defendingPlayerId: 'playerId_2',
                attackerCarduid: theOUid,
                targetCarduid: enemyUid,
                targetSlotName: 'slot1'
            }
        });
        gameEnv.processingQueue = [
            {
                id: 'player_action_attack_gd03002_self_attack',
                type: 'PLAYER_ACTION',
                status: 'RESOLVING',
                priority: 1,
                timestamp: Date.now(),
                playerId: 'playerId_1',
                data: {
                    actionType: 'attackUnit',
                    attackerCarduid: theOUid,
                    targetUnitUid: enemyUid,
                    targetPlayerId: 'playerId_2'
                }
            }
        ];

        const reactiveResult = ContinuousEffectManager.processReactiveContinuousEffects(gameEnv);
        expect(reactiveResult.success).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find(
            (event) =>
                event.type === 'TARGET_CHOICE' &&
                event.data?.effect?.effectId === 'during_pair_effect_seq_0_then_0'
        );
        expect(choiceEvent).toBeFalsy();
    });

    test('still triggers on attackShieldArea when later notifications (GAME_ENDED/PHASE_CHANGED) exist', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 3;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        const theOUid = 'GD03-002_unit_shield_0001';
        const theOPilotUid = 'GD03-084_pilot_shield_0001';
        const attackerUid = 'GD01-001_unit_shield_0001';
        const attackerPilotUid = 'GD01-087_pilot_shield_0001';
        const enemyValidUid = 'GD01-020_unit_shield_enemy_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: theOUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: theOPilotUid,
                playAs: 'pilot',
                targetUnit: theOUid
            }).success
        ).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: attackerUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: attackerPilotUid,
                playAs: 'pilot',
                targetUnit: attackerUid
            }).success
        ).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: enemyValidUid, playAs: 'unit' }).success).toBe(true);

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        // Mimic real notification order from the reported no-shield shield attack path:
        // UNIT_ATTACK_DECLARED -> PHASE_CHANGED -> BATTLE_RESOLVED -> GAME_ENDED -> PHASE_CHANGED
        gameEnv.notificationQueue.push(
            {
                id: 'unit_attack_declared_shield_path',
                type: 'UNIT_ATTACK_DECLARED',
                payload: {
                    attackingPlayerId: 'playerId_1',
                    defendingPlayerId: 'playerId_2',
                    attackerCarduid: attackerUid,
                    targetSlotName: 'shieldArea'
                }
            },
            {
                id: 'phase_changed_to_action_step_shield_path',
                type: 'PHASE_CHANGED',
                payload: {
                    playerId: 'playerId_1',
                    previousPhase: 'MAIN_PHASE',
                    nextPhase: 'ACTION_STEP_PHASE',
                    currentTurn: 3
                }
            },
            {
                id: 'battle_resolved_shield_path',
                type: 'BATTLE_RESOLVED',
                payload: {
                    battleType: 'attackShieldArea',
                    attackingPlayerId: 'playerId_1',
                    defendingPlayerId: 'playerId_2',
                    attacker: {
                        unit: {
                            carduid: attackerUid
                        }
                    },
                    result: {
                        targetType: 'shield',
                        defenderHadNoShields: true,
                        gameEnded: true
                    }
                }
            },
            {
                id: 'game_ended_shield_path',
                type: 'GAME_ENDED',
                payload: {
                    winnerId: 'playerId_1',
                    loserId: 'playerId_2'
                }
            },
            {
                id: 'phase_changed_back_main_shield_path',
                type: 'PHASE_CHANGED',
                payload: {
                    playerId: 'playerId_1',
                    previousPhase: 'ACTION_STEP_PHASE',
                    nextPhase: 'MAIN_PHASE',
                    currentTurn: 3
                }
            }
        );

        gameEnv.processingQueue = [
            {
                id: 'player_action_attack_shield_path',
                type: 'PLAYER_ACTION',
                status: 'RESOLVING',
                priority: 1,
                timestamp: Date.now(),
                playerId: 'playerId_1',
                data: {
                    actionType: 'attackShieldArea',
                    attackerCarduid: attackerUid,
                    targetPlayerId: 'playerId_2'
                }
            }
        ];

        const reactiveResult = ContinuousEffectManager.processReactiveContinuousEffects(gameEnv);
        expect(reactiveResult.success).toBe(true);
        expect((reactiveResult.executed || 0)).toBeGreaterThan(0);

        const enemyUnit = findUnit(gameEnv, 'playerId_2', enemyValidUid);
        expect(enemyUnit).toBeTruthy();
        expect(enemyUnit.isRested).toBe(true);
    });

    test('interrupts immediately on attack declaration before shield battle can end the game', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        const theOUid = 'GD03-002_unit_immediate_0001';
        const theOPilotUid = 'GD03-084_pilot_immediate_0001';
        const attackerUid = 'GD01-001_unit_immediate_0001';
        const attackerPilotUid = 'GD01-087_pilot_immediate_0001';
        const enemyUid1 = 'GD01-020_unit_immediate_enemy_0001';
        const enemyUid2 = 'GD03-007_unit_immediate_enemy_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: theOUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: theOPilotUid,
                playAs: 'pilot',
                targetUnit: theOUid
            }).success
        ).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: attackerUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: attackerPilotUid,
                playAs: 'pilot',
                targetUnit: attackerUid
            }).success
        ).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: enemyUid1, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: enemyUid2, playAs: 'unit' }).success).toBe(true);

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        const attackEvent = EventFactory.createPlayerActionEvent('playerId_1', 'attackShieldArea', {
            playerId: 'playerId_1',
            gameId: 'gd03002_immediate_interrupt',
            attackerCarduid: attackerUid,
            targetPlayerId: 'playerId_2'
        });
        attackEvent.status = 'RESOLVING';
        gameEnv.processingQueue = [attackEvent];

        const result = BattlePhaseManager.initiateAttack(gameEnv, attackEvent);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const targetChoice = gameEnv.processingQueue.find(
            (event) =>
                event.type === 'TARGET_CHOICE' &&
                event.data?.effect?.effectId === 'during_pair_effect_seq_0_then_0'
        );
        expect(targetChoice).toBeTruthy();

        const resumeAttack = gameEnv.processingQueue.find(
            (event) =>
                event.type === 'PLAYER_ACTION' &&
                event.id !== attackEvent.id &&
                event.data?.actionType === 'attackShieldArea' &&
                event.data?.skipAttackDeclaration === true &&
                event.data?.skipAttackPhaseEffects === true
        );
        expect(resumeAttack).toBeTruthy();

        const notificationTypes = gameEnv.notificationQueue.map((notification) => notification.type);
        expect(notificationTypes).toContain('UNIT_ATTACK_DECLARED');
        expect(notificationTypes).not.toContain('GAME_ENDED');
    });

    test('auto-applied GD03-002 rest resolves before battle/game-end notifications when only one valid target exists', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        const theOUid = 'GD03-002_unit_auto_0001';
        const theOPilotUid = 'GD03-084_pilot_auto_0001';
        const attackerUid = 'GD03-007_unit_auto_attacker_0001'; // Lv3, gains Repair dynamically from pilot
        const attackerPilotUid = 'GD01-087_pilot_auto_attacker_0001';
        const enemyInvalidLv4 = 'GD01-020_unit_auto_enemy_lv4_0001'; // Lv4 invalid for Lv3 attacker
        const enemyValidLv3 = 'GD03-007_unit_auto_enemy_lv3_0001';   // Lv3 valid => exactly one valid target

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: theOUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: theOPilotUid,
                playAs: 'pilot',
                targetUnit: theOUid
            }).success
        ).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: attackerUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: attackerPilotUid,
                playAs: 'pilot',
                targetUnit: attackerUid
            }).success
        ).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: enemyInvalidLv4, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: enemyValidLv3, playAs: 'unit' }).success).toBe(true);

        // Force no shields/base so shield attack would immediately end the game if not interrupted/auto-applied first.
        const p2 = gameEnv.getPlayer('playerId_2');
        p2.zones.shieldArea = [];
        p2.zones.base = [];
        p2.zones.shieldCount = 0;

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        const attackEvent = EventFactory.createPlayerActionEvent('playerId_1', 'attackShieldArea', {
            playerId: 'playerId_1',
            gameId: 'gd03002_auto_apply_ordering',
            attackerCarduid: attackerUid,
            targetPlayerId: 'playerId_2'
        });
        attackEvent.status = 'RESOLVING';
        gameEnv.processingQueue = [attackEvent];

        const result = BattlePhaseManager.initiateAttack(gameEnv, attackEvent);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBeFalsy();

        // Auto-applied rest should happen immediately (exactly one valid target) before battle/game-end notifications.
        const types = (gameEnv.notificationQueue || []).map((n) => n.type);
        const restIndex = types.indexOf('CARD_RESTED');
        const battleResolvedIndex = types.indexOf('BATTLE_RESOLVED');
        const gameEndedIndex = types.indexOf('GAME_ENDED');
        expect(restIndex).toBeGreaterThanOrEqual(0);
        expect(battleResolvedIndex).toBeGreaterThanOrEqual(0);
        expect(gameEndedIndex).toBeGreaterThanOrEqual(0);
        expect(restIndex).toBeLessThan(battleResolvedIndex);
        expect(restIndex).toBeLessThan(gameEndedIndex);

        const enemySearch = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, enemyValidLv3);
        expect(enemySearch?.unit?.isRested).toBe(true);
    });
});
