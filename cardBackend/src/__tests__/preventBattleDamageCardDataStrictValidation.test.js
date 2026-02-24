const fs = require('fs');
const path = require('path');

const CARD_FILES = [
    'gd01Card.json',
    'gd02Card.json',
    'gd03Card.json',
    'st01Card.json',
    'st02Card.json',
    'st03Card.json',
    'st04Card.json',
    'st05Card.json',
    'st06Card.json',
    'st07Card.json',
    'st08Card.json'
];

const ALLOWED_PREVENT_BATTLE_DAMAGE_PARAMETER_KEYS = new Set([
    'from',
    'enemyLevel',
    'enemyAp',
    'maxEnemyAp',
    'enemyHp',
    'notes'
]);

function walk(node, jsonPath, onNode) {
    if (Array.isArray(node)) {
        node.forEach((value, index) => walk(value, `${jsonPath}[${index}]`, onNode));
        return;
    }
    if (!node || typeof node !== 'object') {
        return;
    }

    onNode(node, jsonPath);

    for (const [key, value] of Object.entries(node)) {
        walk(value, `${jsonPath}.${key}`, onNode);
    }
}

describe('strict prevent_battle_damage parameter-key validation across GD/ST card data', () => {
    test('all prevent_battle_damage entries use only supported parameter keys', () => {
        const violations = [];

        for (const fileName of CARD_FILES) {
            const fullPath = path.join(__dirname, '..', 'data', fileName);
            const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            const cards = parsed && typeof parsed === 'object' && parsed.cards ? parsed.cards : parsed;

            if (!cards || typeof cards !== 'object') {
                continue;
            }

            for (const [cardId, card] of Object.entries(cards)) {
                walk(card, `cards.${cardId}`, (node, nodePath) => {
                    if (node.action !== 'prevent_battle_damage') {
                        return;
                    }

                    const parameters = node.parameters && typeof node.parameters === 'object'
                        ? node.parameters
                        : {};

                    for (const key of Object.keys(parameters)) {
                        if (!ALLOWED_PREVENT_BATTLE_DAMAGE_PARAMETER_KEYS.has(key)) {
                            violations.push(`${fileName}:${nodePath}.parameters.${key}`);
                        }
                    }
                });
            }
        }

        expect(violations).toEqual([]);
    });
});
