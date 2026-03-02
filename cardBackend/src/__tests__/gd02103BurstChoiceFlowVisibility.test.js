const { GameEnvironment } = require('../models/GameEnvironment');
const { CardDatabaseManager } = require('../models/CardSystem');
const { BurstEffectManager } = require('../services/BurstEffectManager');
const { EventStatus } = require('../services/EventQueue/interfaces/GameEvent');

describe('GD02-103 burst choice flow visibility', () => {
    test('burst activation emits CARD_ADDED_TO_HAND with reason=burst for opponent-visible popup contract', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const gd02103 = CardDatabaseManager.getCardDetails('GD02-103');
        expect(gd02103).toBeTruthy();

        const shieldCarduid = 'GD02-103_shield_p1_0001';
        p1.zones.shieldArea.push({
            carduid: shieldCarduid,
            cardId: 'GD02-103',
            cardData: gd02103,
        });

        const trashPilotUid = 'GD02-088_trash_p1_0001';
        p1.zones.trashArea.push({
            carduid: trashPilotUid,
            cardId: 'GD02-088',
            cardData: {
                id: 'GD02-088',
                name: 'Flit Asuno',
                cardType: 'pilot',
                color: 'Green',
                level: 3,
                cost: 1,
                traits: ['Asuno Family'],
                effects: { rules: [] },
            },
        });

        const shieldAttackEvent = {
            id: 'shield_attack_gd02103_1',
            type: 'SHIELD_CARD_ATTACKED',
            status: EventStatus.RESOLVING,
            priority: 1,
            playerId: 'playerId_2',
            timestamp: Date.now(),
            data: {
                defendingPlayerId: 'playerId_1',
                attackingPlayerId: 'playerId_2',
                attackerSlot: 'slot1',
                shieldCards: [
                    {
                        carduid: shieldCarduid,
                        cardData: gd02103,
                    },
                ],
                attackPower: 3,
            },
        };

        const attackResult = BurstEffectManager.processShieldCardAttack(shieldAttackEvent, gameEnv);
        expect(attackResult.success).toBe(true);

        const burstChoiceEvent = (gameEnv.processingQueue || []).find((evt) => evt.type === 'BURST_EFFECT_CHOICE');
        expect(burstChoiceEvent).toBeTruthy();

        burstChoiceEvent.status = EventStatus.RESOLVING;
        burstChoiceEvent.data.userDecision = 'ACTIVATE';

        const choiceResult = BurstEffectManager.processBurstEffectChoice(burstChoiceEvent, gameEnv);
        expect(choiceResult.success).toBe(true);

        expect(p1.deck._handUids.includes(trashPilotUid)).toBe(true);
        expect(p1.zones.trashArea.some((card) => card.carduid === trashPilotUid)).toBe(false);

        const addToHandEvent = (gameEnv.notificationQueue || [])
            .slice()
            .reverse()
            .find((note) => note.type === 'CARD_ADDED_TO_HAND' && note?.payload?.carduid === trashPilotUid);
        expect(addToHandEvent).toBeTruthy();
        expect(addToHandEvent.payload.reason).toBe('burst');
        expect(addToHandEvent.payload.cardId).toBe('GD02-088');
        expect(addToHandEvent.payload.cardName).toBe('Flit Asuno');
    });
});
