const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { AttackPhaseEffectManager } = require('../services/effects/AttackPhaseEffectManager');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');

function createPilotWithAttackBuff(carduid, effectId = 'pilot_boost') {
    return {
        carduid,
        cardId: carduid.split('_')[0],
        playedAs: 'pilot',
        isRested: false,
        damageReceived: 0,
        modifyAP: 0,
        modifyHP: 0,
        continueModifyAP: 0,
        continueModifyHP: 0,
        originalAP: 1,
        originalHP: 1,
        temporaryEffects: [],
        effectUsage: {},
        cardData: {
            id: carduid.split('_')[0],
            name: carduid,
            cardType: 'pilot',
            color: 'Blue',
            level: 1,
            ap: 1,
            hp: 1,
            traits: [],
            effects: {
                description: [],
                rules: [
                    {
                        effectId,
                        type: 'triggered',
                        trigger: 'ATTACK_PHASE',
                        action: 'modifyAP',
                        target: {
                            type: 'unit',
                            scope: 'source_paired_unit',
                            count: 1
                        },
                        parameters: {
                            value: 1
                        }
                    }
                ]
            }
        }
    };
}

function createAttackEvent(attackerCarduid) {
    return {
        playerId: 'playerId_1',
        data: {
            playerId: 'playerId_1',
            actionType: 'attackShieldArea',
            attackerCarduid,
            targetPlayerId: 'playerId_2',
            targetType: 'shield',
            attackNotificationId: 'attack_note_custom'
        }
    };
}

function dequeue(gameEnv, event) {
    if (event) {
        gameEnv.dequeueFromProcessing(event);
    }
}

describe('queued attack trigger regressions', () => {
    test('no-target queued effect skips and still continues to later attack trigger', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const attackerUid = 'CUSTOM_ATTACKER_0001';
        gameEnv.getPlayer('playerId_1').zones.slot1.unit = createUnitZoneCard({
            carduid: attackerUid,
            cardId: 'CUSTOM-ATTACKER',
            ap: 3,
            hp: 3,
            effectsRules: [
                {
                    effectId: 'no_target_attack_effect',
                    type: 'triggered',
                    trigger: 'ATTACK_PHASE',
                    action: 'modifyAP',
                    target: {
                        type: 'unit',
                        scope: 'opponent',
                        count: 1,
                        filters: {
                            level: '<=1'
                        }
                    },
                    parameters: {
                        value: -1
                    }
                }
            ]
        });
        gameEnv.getPlayer('playerId_1').zones.slot1.pilot = createPilotWithAttackBuff('CUSTOM_PILOT_0001');

        const queueResult = AttackPhaseEffectManager.queueAttackPhaseEffects(gameEnv, createAttackEvent(attackerUid));
        expect(queueResult.success).toBe(true);

        const firstEvent = gameEnv.processingQueue.find((event) => event.type === EventType.ATTACK_PHASE_EFFECT_TRIGGERED);
        const firstResult = AttackPhaseEffectManager.executeQueuedAttackPhaseEffect(gameEnv, firstEvent);
        dequeue(gameEnv, firstEvent);
        expect(firstResult.success).toBe(true);
        expect(firstResult.consumed).toBe(false);

        const secondEvent = gameEnv.processingQueue.find((event) => event.type === EventType.ATTACK_PHASE_EFFECT_TRIGGERED);
        expect(secondEvent.data.effect.effectId).toBe('pilot_boost');

        const secondResult = AttackPhaseEffectManager.executeQueuedAttackPhaseEffect(gameEnv, secondEvent);
        dequeue(gameEnv, secondEvent);
        expect(secondResult.success).toBe(true);
        expect(gameEnv.getPlayer('playerId_1').zones.slot1.unit.modifyAP).toBe(1);
        expect(gameEnv.processingQueue.some((event) => event.type === EventType.PLAYER_ACTION)).toBe(true);
    });

    test('once-per-turn queued attack trigger is marked once and excluded from recollection after choice resolution', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const attackerUid = 'CUSTOM_ATTACKER_0002';
        gameEnv.getPlayer('playerId_1').zones.slot1.unit = createUnitZoneCard({
            carduid: attackerUid,
            cardId: 'CUSTOM-ATTACKER-2',
            ap: 3,
            hp: 3,
            effectsRules: [
                {
                    effectId: 'once_attack_choice',
                    type: 'triggered',
                    trigger: 'ATTACK_PHASE',
                    action: 'modifyAP',
                    restrictions: ['once_per_turn'],
                    target: {
                        type: 'unit',
                        scope: 'opponent',
                        count: 1
                    },
                    parameters: {
                        value: -1
                    }
                }
            ]
        });
        gameEnv.getPlayer('playerId_1').zones.slot1.pilot = createPilotWithAttackBuff('CUSTOM_PILOT_0002', 'pilot_followup');
        gameEnv.getPlayer('playerId_2').zones.slot1.unit = createUnitZoneCard({
            carduid: 'ENEMY_0001',
            cardId: 'ENEMY-1',
            ap: 2,
            hp: 2
        });
        gameEnv.getPlayer('playerId_2').zones.slot2.unit = createUnitZoneCard({
            carduid: 'ENEMY_0002',
            cardId: 'ENEMY-2',
            ap: 2,
            hp: 2
        });

        const attackEvent = createAttackEvent(attackerUid);
        expect(AttackPhaseEffectManager.queueAttackPhaseEffects(gameEnv, attackEvent).success).toBe(true);

        const firstEvent = gameEnv.processingQueue.find((event) => event.type === EventType.ATTACK_PHASE_EFFECT_TRIGGERED);
        const firstResult = AttackPhaseEffectManager.executeQueuedAttackPhaseEffect(gameEnv, firstEvent);
        dequeue(gameEnv, firstEvent);
        expect(firstResult.requiresSelection).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find(
            (event) => event.type === EventType.TARGET_CHOICE && event.data.effect.effectId === 'once_attack_choice'
        );
        choiceEvent.status = 'RESOLVING';
        choiceEvent.data.userDecisionMade = true;
        choiceEvent.data.selectedTargets = [choiceEvent.data.availableTargets[0]];
        expect(DeployTargetManager.executeTargetChoice(choiceEvent, gameEnv).success).toBe(true);
        dequeue(gameEnv, choiceEvent);

        const secondEvent = gameEnv.processingQueue.find((event) => event.type === EventType.ATTACK_PHASE_EFFECT_TRIGGERED);
        expect(secondEvent.data.effect.effectId).toBe('pilot_followup');
        expect(AttackPhaseEffectManager.executeQueuedAttackPhaseEffect(gameEnv, secondEvent).success).toBe(true);
        dequeue(gameEnv, secondEvent);

        const usage = gameEnv.getPlayer('playerId_1').zones.slot1.unit.effectUsage.once_attack_choice;
        expect(usage).toBeTruthy();
        expect(usage.lastUsedTurn).toBe(gameEnv.currentTurn);

        const recollected = AttackPhaseEffectManager.collectAttackPhaseEffects(gameEnv, attackEvent);
        const recollectedEffectIds = (recollected.effects || []).map((effect) => effect.effectId);
        expect(recollectedEffectIds).not.toContain('once_attack_choice');
    });
});
