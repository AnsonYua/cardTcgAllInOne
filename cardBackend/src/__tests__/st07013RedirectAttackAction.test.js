const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerActionType } = require('../models/GameEnums');
const { processAction } = require('../services/actions/ActionProcessor');
const { GameNotificationManager } = require('../services/GameNotificationManager');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');

const st07 = require('../data/st07Card.json');
const gd01 = require('../data/gd01Card.json');

function createUnit(carduid, cardData, zoneExtras = {}) {
    return createUnitZoneCard({
        carduid,
        cardId: cardData.id,
        name: cardData.name,
        ap: cardData.ap || 0,
        hp: cardData.hp || 1,
        traits: Array.isArray(cardData.traits) ? cardData.traits : [],
        link: Array.isArray(cardData.link) ? cardData.link : [],
        effectsRules: Array.isArray(cardData.effects?.rules) ? cardData.effects.rules : [],
        cardDataExtras: {
            color: cardData.color,
            level: cardData.level,
            cost: cardData.cost,
            zone: Array.isArray(cardData.zone) ? cardData.zone : []
        },
        zoneExtras: {
            placedAt: 0,
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            isFirstPlay: false,
            ...zoneExtras
        }
    });
}

describe('ST07-013 redirect_attack action effect', () => {
    test('redirects the active battle target to the selected rested friendly (CB) unit during ACTION_STEP', async () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.gameStarted = true;
        gameEnv.currentTurn = 2;
        gameEnv.currentPlayer = 'playerId_2';
        p1.isReady = true;
        p2.isReady = true;

        const originalTargetCarduid = 'ST07-005_target_p1_0001';
        const redirectTargetCarduid = 'ST07-006_redirect_p1_0001';
        const attackerCarduid = 'GD01-002_redirect_attacker_p2_0002';
        const commandCarduid = 'ST07-013_action_draw_p1_0001';

        p1.zones.slot2.unit = createUnit(originalTargetCarduid, st07.cards['ST07-005'], {
            placedBy: 'playerId_1',
            isRested: false
        });
        p1.zones.slot3.unit = createUnit(redirectTargetCarduid, st07.cards['ST07-006'], {
            placedBy: 'playerId_1',
            isRested: true
        });
        p2.zones.slot2.unit = createUnit(attackerCarduid, gd01.cards['GD01-002'], {
            placedBy: 'playerId_2',
            isRested: false
        });

        p1.deck._handUids = [commandCarduid];
        // Make the attacker still have an ACTION_STEP option so battle does not auto-resolve.
        p2.deck._handUids = ['ST07-013_action_draw_p2_dummy'];

        // ST07-013 play requires level/cost payment in this engine.
        for (let i = 1; i <= 5; i += 1) {
            p1.zones.energyArea.push({
                carduid: `energy_p1_${i}`,
                cardId: 'energy_basic',
                isRested: false,
                isExtraEnergy: false,
                placedAt: 0,
                placedBy: 'playerId_1'
            });
        }
        p2.zones.energyArea.push({
            carduid: 'energy_p2_1',
            cardId: 'energy_basic',
            isRested: false,
            isExtraEnergy: false,
            placedAt: 0,
            placedBy: 'playerId_2'
        });

        const notificationManager = new GameNotificationManager(gameEnv);
        const attackNotificationId = notificationManager.addNotificationEvent(
            'UNIT_ATTACK_DECLARED',
            {
                attackingPlayerId: 'playerId_2',
                defendingPlayerId: 'playerId_1',
                attackerCarduid,
                attackerSlot: 'slot2',
                targetCarduid: originalTargetCarduid,
                targetSlotName: 'slot2',
                targetPlayerId: 'playerId_1',
                targetName: st07.cards['ST07-005'].name
            },
            'normal'
        );

        gameEnv.setCurrentBattle({
            actionType: 'attackUnit',
            attackingPlayerId: 'playerId_2',
            defendingPlayerId: 'playerId_1',
            attackerCarduid,
            targetCarduid: originalTargetCarduid,
            targetPlayerId: 'playerId_1',
            status: 'ACTION_STEP',
            openedAt: Date.now(),
            attackNotificationId
        });

        const result = await processAction(gameEnv, {
            type: PlayerActionType.PLAY_CARD,
            playerId: 'playerId_1',
            gameId: 'st07_013_redirect_attack_test',
            carduid: commandCarduid,
            playAs: 'command'
        });

        expect(result.success).toBe(true);
        expect(gameEnv.currentBattle).toBeTruthy();
        expect(gameEnv.currentBattle.actionType).toBe('attackUnit');
        expect(gameEnv.currentBattle.targetCarduid).toBe(redirectTargetCarduid);
        expect(gameEnv.currentBattle.targetPlayerId).toBe('playerId_1');
        expect(gameEnv.currentBattle.forcedTarget).toMatchObject({
            carduid: redirectTargetCarduid,
            zone: 'slot3',
            playerId: 'playerId_1'
        });

        const redirected = (gameEnv.notificationQueue || []).filter(
            (event) => event.type === 'ATTACK_REDIRECTED'
        );
        expect(redirected).toHaveLength(1);
        expect(redirected[0].payload.fromTargetCarduid).toBe(originalTargetCarduid);
        expect(redirected[0].payload.toTargetCarduid).toBe(redirectTargetCarduid);

        const refreshTarget = (gameEnv.notificationQueue || []).filter(
            (event) => event.type === 'REFRESH_TARGET'
        );
        expect(refreshTarget.length).toBeGreaterThan(0);

        const updatedAttackNotification = (gameEnv.notificationQueue || []).find(
            (event) => event.id === attackNotificationId
        );
        expect(updatedAttackNotification).toBeTruthy();
        expect(updatedAttackNotification.payload.targetCarduid).toBe(redirectTargetCarduid);
        expect(updatedAttackNotification.payload.targetSlotName).toBe('slot3');
        expect(updatedAttackNotification.payload.targetPlayerId).toBe('playerId_1');
        expect(updatedAttackNotification.payload.forcedTargetCarduid).toBe(redirectTargetCarduid);
        expect(updatedAttackNotification.payload.forcedTargetZone).toBe('slot3');
        expect(updatedAttackNotification.payload.forcedTargetPlayerId).toBe('playerId_1');

        expect(p1.deck.handUids).not.toContain(commandCarduid);
        expect((p1.zones.trashArea || []).some((card) => card.carduid === commandCarduid)).toBe(true);
        expect((p1.zones.energyArea || []).filter((card) => card.isRested).length).toBe(1);
    });
});
