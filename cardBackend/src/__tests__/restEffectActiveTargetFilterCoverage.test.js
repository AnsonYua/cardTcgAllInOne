const fs = require('fs');
const path = require('path');

const EXPECTED_REST_RULES = {
    'gd01Card.json': [
        ['GD01-002', 'attack_rest', 1],
        ['GD01-004', 'pair_rest', 1],
        ['GD01-010', 'pair_rest', 0],
        ['GD01-012', 'pair_rest', 0],
        ['GD01-099', 'burst_rest', 0],
        ['GD01-099', 'rest', 1]
    ],
    'gd02Card.json': [
        ['GD02-005', 'attack_rest', 0],
        ['GD02-061', 'pair_rest_low_ap_if_trash_traits', 0],
        ['GD02-087', 'linked_rest_enemy_blocker_if_blue_unit', 1]
    ],
    'gd03Card.json': [
        ['GD03-004', 'attack_rest', 0],
        ['GD03-006', 'deploy_rest', 0],
        ['GD03-009', 'deploy_rest', 0],
        ['GD03-124', 'effect', 2]
    ],
    'st01Card.json': [
        ['ST01-004', 'deploy_rest_low_hp', 0],
        ['ST01-010', 'paired_rest_medium_hp', 1]
    ],
    'st02Card.json': [
        ['ST02-014', 'main_action_rest_low_hp', 1]
    ],
    'st05Card.json': [
        ['ST05-005', 'destroyed_rest_enemy_ap_le_4', 0],
        ['ST05-012', 'pair_rest_enemy_hp_le_3_if_gh_or_tekkadan_ge_3', 1]
    ]
};

describe('rest effect active target filter coverage', () => {
    test('selected rest effects explicitly require active targets', () => {
        const baseDir = path.join(__dirname, '..', 'data');

        for (const [fileName, rows] of Object.entries(EXPECTED_REST_RULES)) {
            const filePath = path.join(baseDir, fileName);
            const cardDb = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            for (const [cardId, effectId, ruleIndex] of rows) {
                const card = cardDb.cards?.[cardId];
                expect(card).toBeDefined();

                const rule = card.effects?.rules?.[ruleIndex];
                expect(rule).toBeDefined();
                expect(rule.effectId).toBe(effectId);
                expect(rule.action).toBe('rest');
                expect(rule.target?.filters?.status).toBe('active');
            }
        }
    });
});

