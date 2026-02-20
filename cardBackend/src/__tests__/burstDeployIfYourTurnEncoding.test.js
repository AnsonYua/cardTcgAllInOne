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
].map((name) => path.join(__dirname, '..', 'data', name));

const BURST_DEPLOY_RE = /(\[Burst\]|【Burst】)Deploy this card\./i;
const SHIELD_IF_TURN_RE = /Add 1 of your Shields to your hand\..*if it(?:'s| is) your turn/i;

function hasTurnGate(node) {
    if (!node || typeof node !== 'object') return false;

    if (Array.isArray(node)) {
        return node.some((entry) => hasTurnGate(entry));
    }

    if (node.actionTurn === 'YOUR_TURN') return true;
    if (node.selfTurn === true) return true;
    if (node.type === 'turnPlayer') return true;
    if (node.type === 'turn' && node.value === 'YOUR_TURN') return true;

    return Object.values(node).some((value) => hasTurnGate(value));
}

describe('Burst deploy cards with "if your turn" shield text include machine-readable turn gating', () => {
    test('all reviewed card files encode turn gate in rules', () => {
        const failures = [];

        for (const file of CARD_FILES) {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            const cards = data.cards || {};

            for (const [cardId, card] of Object.entries(cards)) {
                const descriptions = Array.isArray(card?.effects?.description) ? card.effects.description : [];
                const hasBurstDeployText = descriptions.some((line) => typeof line === 'string' && BURST_DEPLOY_RE.test(line));
                const hasShieldIfTurnText = descriptions.some((line) => typeof line === 'string' && SHIELD_IF_TURN_RE.test(line));

                if (!hasBurstDeployText || !hasShieldIfTurnText) {
                    continue;
                }

                const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
                const hasGate = hasTurnGate(rules);

                if (!hasGate) {
                    failures.push(`${path.basename(file)}:${cardId}`);
                }
            }
        }

        expect(failures).toEqual([]);
    });
});
