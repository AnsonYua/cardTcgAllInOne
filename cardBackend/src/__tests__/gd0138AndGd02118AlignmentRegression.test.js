const { GameEnvironment } = require('../models/GameEnvironment');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');
const gd01 = require('../data/gd01Card.json');
const gd02 = require('../data/gd02Card.json');
const gd03 = require('../data/gd03Card.json');

function unitWithCardData(carduid, cardData, zoneExtras = {}) {
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
            placedBy: 'seed',
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            isFirstPlay: false,
            ...zoneExtras
        }
    });
}

function fallbackUnitCardData(id, name) {
    return {
        id,
        name,
        cardType: 'unit',
        color: 'White',
        level: 3,
        cost: 2,
        zone: ['Space', 'Earth'],
        traits: [],
        link: [],
        ap: 2,
        hp: 4,
        effects: { description: [], rules: [] }
    };
}

describe('GD01-038 and GD02-118 alignment regression', () => {
    test('GD01-038 deals 1 to all enemy units only when opponent has 5 or more units', () => {
        const effect = gd01.cards['GD01-038'].effects.rules.find((r) => r.effectId === 'deploy_damage_1');
        expect(effect).toBeTruthy();

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        for (let i = 1; i <= 4; i++) {
            p2.zones[`slot${i}`].unit = createUnitZoneCard({
                carduid: `enemy_u_${i}`,
                cardId: `ENEMY-${i}`,
                ap: 2,
                hp: 2,
                zoneExtras: { placedAt: 0, placedBy: 'playerId_2', playedThisTurn: false, canAttackThisTurn: true }
            });
        }

        const firstAttempt = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD01-038_src_0001',
            effect
        );
        expect(firstAttempt.success).toBe(true);
        for (let i = 1; i <= 4; i++) {
            expect(p2.zones[`slot${i}`].unit.damageReceived || 0).toBe(0);
        }

        p2.zones.slot5.unit = createUnitZoneCard({
            carduid: 'enemy_u_5',
            cardId: 'ENEMY-5',
            ap: 2,
            hp: 2,
            zoneExtras: { placedAt: 0, placedBy: 'playerId_2', playedThisTurn: false, canAttackThisTurn: true }
        });

        const secondAttempt = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD01-038_src_0001',
            effect
        );
        expect(secondAttempt.success).toBe(true);
        for (let i = 1; i <= 5; i++) {
            expect(p2.zones[`slot${i}`].unit.damageReceived).toBe(1);
        }
    });

    test('GD02-118 can only target battling enemy unit whose battle opponent has Blocker', () => {
        const effect = gd02.cards['GD02-118'].effects.rules.find((r) => r.effectId === 'bounce');
        expect(effect).toBeTruthy();

        const blockerUnitData = gd03.cards['GD03-083'];
        const normalUnitData = gd02.cards['GD02-061'] || fallbackUnitCardData('GD02-061', 'Normal Unit');

        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.currentTurn = 1;
        gameEnv.phase = 'ACTION_STEP';

        p1.zones.slot1.unit = unitWithCardData('friendly_blocker_uid', blockerUnitData);
        p2.zones.slot1.unit = unitWithCardData('enemy_battling_uid', normalUnitData, { originalHP: 4, damageReceived: 0 });
        p2.zones.slot2.unit = unitWithCardData('enemy_not_battling_uid', normalUnitData, { originalHP: 4, damageReceived: 0 });

        gameEnv.setCurrentBattle({
            actionType: 'attackUnit',
            attackingPlayerId: 'playerId_1',
            defendingPlayerId: 'playerId_2',
            attackerCarduid: 'friendly_blocker_uid',
            targetCarduid: 'enemy_battling_uid',
            targetPlayerId: 'playerId_2',
            status: 'ACTION_STEP',
            openedAt: Date.now()
        });

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD02-118_cmd_0001',
            effect
        );

        expect(result.success).toBe(true);
        expect(result.autoApplied).toBe(true);
        expect(p2.zones.slot1.unit).toBeFalsy();
        expect(p2.zones.slot2.unit).toBeTruthy();
    });

    test('GD02-118 has no legal target when battling condition is met but friendly opponent is not Blocker', () => {
        const effect = gd02.cards['GD02-118'].effects.rules.find((r) => r.effectId === 'bounce');
        expect(effect).toBeTruthy();

        const nonBlockerUnitData = gd02.cards['GD02-061'] || fallbackUnitCardData('GD02-061', 'Normal Unit');

        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.currentTurn = 1;
        gameEnv.phase = 'ACTION_STEP';

        p1.zones.slot1.unit = unitWithCardData('friendly_non_blocker_uid', nonBlockerUnitData);
        p2.zones.slot1.unit = unitWithCardData('enemy_battling_uid', nonBlockerUnitData, { originalHP: 4, damageReceived: 0 });

        gameEnv.setCurrentBattle({
            actionType: 'attackUnit',
            attackingPlayerId: 'playerId_1',
            defendingPlayerId: 'playerId_2',
            attackerCarduid: 'friendly_non_blocker_uid',
            targetCarduid: 'enemy_battling_uid',
            targetPlayerId: 'playerId_2',
            status: 'ACTION_STEP',
            openedAt: Date.now()
        });

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD02-118_cmd_0001',
            effect
        );

        expect(result.success).toBe(true);
        expect(result.autoApplied).toBe(true);
        expect(Array.isArray(result.affectedTargets) ? result.affectedTargets.length : 0).toBe(0);
        expect(p2.zones.slot1.unit).toBeTruthy();
    });
});
