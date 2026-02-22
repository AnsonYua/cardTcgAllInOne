const { GameEnvironment } = require('../models/GameEnvironment');
const { BattleDamageToUnitTriggeredEffectManager } = require('../services/effects/BattleDamageToUnitTriggeredEffectManager');
const gd03 = require('../data/gd03Card.json');
const { createPilotZoneCard, createUnitZoneCard, findSlotByUnit } = require('./helpers/zoneCardFactory');

function setupGame({ hasCbPilot, defenderLevel }) {
    const gameEnv = new GameEnvironment();
    const p1 = gameEnv.addPlayer('playerId_1', 'P1');
    const p2 = gameEnv.addPlayer('playerId_2', 'P2');

    const sourceCard = gd03.cards['GD03-052'];
    p1.zones.slot1.unit = createUnitZoneCard({
        carduid: 'GD03-052_source_0001',
        cardId: 'GD03-052',
        name: sourceCard.name,
        ap: sourceCard.ap,
        hp: sourceCard.hp,
        traits: sourceCard.traits,
        link: sourceCard.link,
        effectsRules: sourceCard.effects.rules,
        cardDataExtras: {
            level: sourceCard.level,
            color: sourceCard.color,
            cost: sourceCard.cost,
            zone: sourceCard.zone
        }
    });

    p2.zones.slot1.unit = createUnitZoneCard({
        carduid: 'enemy_target_0001',
        cardId: 'ENEMY-TARGET',
        name: 'Enemy Target',
        ap: 3,
        hp: 4,
        traits: ['Test'],
        cardDataExtras: {
            level: defenderLevel,
            color: 'Green'
        }
    });

    if (hasCbPilot) {
        p1.zones.slot2.pilot = createPilotZoneCard({
            carduid: 'cb_pilot_0001',
            cardId: 'CB-PILOT',
            name: 'CB Pilot',
            traits: ['CB']
        });
    }

    return gameEnv;
}

describe('GD03-052 battle damage trigger', () => {
    test('destroys event defender when defender is Lv.5 or lower and CB pilot is in play', () => {
        const gameEnv = setupGame({ hasCbPilot: true, defenderLevel: 5 });

        const result = BattleDamageToUnitTriggeredEffectManager.process(gameEnv, {
            attackingPlayerId: 'playerId_1',
            defendingPlayerId: 'playerId_2',
            attackerSlot: 'slot1',
            defenderSlot: 'slot1',
            sourceUnit: gameEnv.getPlayer('playerId_1').zones.slot1.unit,
            targetUnit: gameEnv.getPlayer('playerId_2').zones.slot1.unit,
            damage: 1
        });

        expect(result.success).toBe(true);
        expect(findSlotByUnit(gameEnv, 'playerId_2', 'enemy_target_0001')).toBeNull();
        expect(gameEnv.getPlayer('playerId_2').zones.trashArea.some((card) => card.carduid === 'enemy_target_0001')).toBe(true);
    });

    test('does not destroy event defender when no CB pilot is in play', () => {
        const gameEnv = setupGame({ hasCbPilot: false, defenderLevel: 5 });

        const result = BattleDamageToUnitTriggeredEffectManager.process(gameEnv, {
            attackingPlayerId: 'playerId_1',
            defendingPlayerId: 'playerId_2',
            attackerSlot: 'slot1',
            defenderSlot: 'slot1',
            sourceUnit: gameEnv.getPlayer('playerId_1').zones.slot1.unit,
            targetUnit: gameEnv.getPlayer('playerId_2').zones.slot1.unit,
            damage: 1
        });

        expect(result.success).toBe(true);
        expect(findSlotByUnit(gameEnv, 'playerId_2', 'enemy_target_0001')).toBeTruthy();
    });

    test('does not destroy event defender when defender level is 6 even if CB pilot is in play', () => {
        const gameEnv = setupGame({ hasCbPilot: true, defenderLevel: 6 });

        const result = BattleDamageToUnitTriggeredEffectManager.process(gameEnv, {
            attackingPlayerId: 'playerId_1',
            defendingPlayerId: 'playerId_2',
            attackerSlot: 'slot1',
            defenderSlot: 'slot1',
            sourceUnit: gameEnv.getPlayer('playerId_1').zones.slot1.unit,
            targetUnit: gameEnv.getPlayer('playerId_2').zones.slot1.unit,
            damage: 1
        });

        expect(result.success).toBe(true);
        expect(findSlotByUnit(gameEnv, 'playerId_2', 'enemy_target_0001')).toBeTruthy();
    });
});
