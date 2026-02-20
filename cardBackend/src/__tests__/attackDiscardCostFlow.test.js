const { GameEnvironment } = require('../models/GameEnvironment');
const { AttackPhaseEffectManager } = require('../services/effects/AttackPhaseEffectManager');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { EventStatus } = require('../services/EventQueue/interfaces/GameEvent');

function createUnitWithAttackEffect(carduid, rule) {
    return {
        carduid,
        cardId: carduid.split('_')[0],
        cardData: {
            id: carduid.split('_')[0],
            name: carduid,
            cardType: 'unit',
            color: 'Blue',
            level: 4,
            ap: 3,
            hp: 3,
            traits: [],
            effects: { rules: [rule] }
        },
        originalAP: 3,
        originalHP: 3,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        effectUsage: {},
        isRested: false,
        canAttackThisTurn: true,
        playedThisTurn: false
    };
}

describe('attack-phase discardFromHand cost flow', () => {
    test('pays discard cost before resolving attack draw effect', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        player.deck.mainDeck = ['GD01-001_draw_after_attack_0001'];
        player.deck._handUids = ['GD01-002_attack_cost_card_0001', 'GD01-003_attack_cost_card_0001'];
        player.deck.handUids = ['GD01-002_attack_cost_card_0001', 'GD01-003_attack_cost_card_0001'];

        const attackRule = {
            effectId: 'attack_draw_with_discard_cost',
            type: 'triggered',
            trigger: 'ATTACK_PHASE',
            action: 'draw',
            cost: {
                discardFromHand: 1
            },
            parameters: {
                value: 1
            }
        };

        player.zones.slot1.unit = createUnitWithAttackEffect('ATK_UNIT_0001', attackRule);

        const startHandSize = player.deck._handUids.length;
        const startTrashSize = player.zones.trashArea.length;

        const attackEvent = {
            playerId: 'playerId_1',
            data: {
                playerId: 'playerId_1',
                actionType: 'attackShieldArea',
                attackerCarduid: 'ATK_UNIT_0001',
                targetPlayerId: 'playerId_2',
                fromBurst: false
            }
        };

        const result = AttackPhaseEffectManager.processAttackPhaseEffects(gameEnv, attackEvent);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((evt) => evt.type === 'TARGET_CHOICE');
        expect(choiceEvent).toBeTruthy();
        choiceEvent.status = EventStatus.RESOLVING;
        choiceEvent.data.selectedTargets = [choiceEvent.data.availableTargets[0]];

        const executeResult = DeployTargetManager.executeTargetChoice(choiceEvent, gameEnv);
        expect(executeResult.success).toBe(true);

        expect(player.zones.trashArea.length).toBe(startTrashSize + 1);
        expect(player.deck._handUids.length).toBe(startHandSize);
    });
});
