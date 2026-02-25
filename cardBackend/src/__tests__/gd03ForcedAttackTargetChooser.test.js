const fs = require('fs');
const path = require('path');
const { GameEnvironment } = require('../models/GameEnvironment');
const { EventFactory } = require('../services/EventQueue/EventFactory');
const { ForcedAttackTargetManager } = require('../services/battle/ForcedAttackTargetManager');
const { EventType } = require('../models/GameEnums');

function loadCard(cardId) {
    const file = path.join(__dirname, '../data/gd03Card.json');
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const cards = parsed.cards || parsed;
    return cards[cardId];
}

function createUnit(carduid, cardData, overrides = {}) {
    return {
        carduid,
        cardData,
        isRested: false,
        damageReceived: 0,
        ...overrides
    };
}

describe('GD03 forced attack target chooser semantics', () => {
    test('GD03-025 uses attacker as chooser when multiple forced targets exist', () => {
        const gd03025 = loadCard('GD03-025');
        expect(gd03025).toBeTruthy();
        const rule = gd03025.effects.rules.find((entry) => entry.effectId === 'force_enemy_attack_target_rested_maganac_corps');
        expect(rule).toBeTruthy();
        expect(rule.parameters.chooser).toBe('ATTACKER');

        const gameEnv = new GameEnvironment();
        const defender = gameEnv.addPlayer('playerId_1', 'P1');
        const attacker = gameEnv.addPlayer('playerId_2', 'P2');

        defender.zones.slot1 = {
            unit: createUnit('GD03-025_unit_0001', gd03025, { isRested: false })
        };
        defender.zones.slot2 = {
            unit: createUnit('MAGANAC_A_unit_0001', {
                id: 'TEST-MAGANAC-A',
                name: 'Maganac A',
                cardType: 'unit',
                color: 'White',
                level: 2,
                cost: 1,
                zone: ['Earth'],
                traits: ['Maganac Corps'],
                link: [],
                ap: 2,
                hp: 2,
                effects: { description: [], rules: [] }
            }, { isRested: true })
        };
        defender.zones.slot3 = {
            unit: createUnit('MAGANAC_B_unit_0001', {
                id: 'TEST-MAGANAC-B',
                name: 'Maganac B',
                cardType: 'unit',
                color: 'White',
                level: 2,
                cost: 1,
                zone: ['Earth'],
                traits: ['Maganac Corps'],
                link: [],
                ap: 2,
                hp: 2,
                effects: { description: [], rules: [] }
            }, { isRested: true })
        };
        defender.zones.slot4 = {
            unit: createUnit('NON_MAGANAC_unit_0001', {
                id: 'TEST-NON-MAGANAC',
                name: 'Non Maganac',
                cardType: 'unit',
                color: 'Blue',
                level: 3,
                cost: 2,
                zone: ['Earth'],
                traits: ['Earth Federation'],
                link: [],
                ap: 3,
                hp: 3,
                effects: { description: [], rules: [] }
            }, { isRested: true })
        };

        attacker.zones.slot1 = {
            unit: createUnit('ATTACKER_unit_0001', {
                id: 'TEST-ATTACKER',
                name: 'Attacker',
                cardType: 'unit',
                color: 'Blue',
                level: 4,
                cost: 2,
                zone: ['Earth'],
                traits: ['Earth Federation'],
                link: [],
                ap: 3,
                hp: 3,
                effects: { description: [], rules: [] }
            })
        };

        const attackEvent = EventFactory.createPlayerActionEvent('playerId_2', 'attackUnit', {
            attackerCarduid: 'ATTACKER_unit_0001',
            targetUnitUid: 'NON_MAGANAC_unit_0001',
            targetCarduid: 'NON_MAGANAC_unit_0001',
            targetPlayerId: 'playerId_1'
        });

        const result = ForcedAttackTargetManager.enforceIfNeeded(gameEnv, attackEvent, 'playerId_1');
        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const forcedChoice = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(forcedChoice).toBeTruthy();
        expect(forcedChoice.playerId).toBe('playerId_2');
        expect(forcedChoice.data.context.kind).toBe('FORCED_ATTACK_TARGET');
        expect(forcedChoice.data.availableTargets).toHaveLength(2);
    });
});
