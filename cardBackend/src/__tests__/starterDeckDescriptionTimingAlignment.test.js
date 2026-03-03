const fs = require('fs');
const path = require('path');

const STARTER_FILES = [
    'st01Card.json',
    'st02Card.json',
    'st03Card.json',
    'st04Card.json',
    'st05Card.json',
    'st06Card.json',
    'st07Card.json',
    'st08Card.json'
];

function normalizeWindows(rule) {
    if (!Array.isArray(rule?.timing?.windows)) {
        return [];
    }
    return rule.timing.windows.map((window) => String(window).toUpperCase());
}

describe('Starter deck description timing alignment', () => {
    test('all starter deck play rules define explicit timing windows', () => {
        const failures = [];

        for (const file of STARTER_FILES) {
            const filePath = path.join(__dirname, '..', 'data', file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const cards = data.cards || {};

            for (const [cardId, card] of Object.entries(cards)) {
                const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
                rules.forEach((rule, index) => {
                    if ((rule?.type || '').toLowerCase() !== 'play') {
                        return;
                    }
                    if (normalizeWindows(rule).length > 0) {
                        return;
                    }
                    failures.push(`${file}:${cardId} rules[${index}] ${rule?.effectId || 'unknown'}`);
                });
            }
        }

        expect(failures).toEqual([]);
    });

    test('starter deck command [Main]/[Action] tags align with play timing windows', () => {
        const failures = [];

        for (const file of STARTER_FILES) {
            const filePath = path.join(__dirname, '..', 'data', file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const cards = data.cards || {};

            for (const [cardId, card] of Object.entries(cards)) {
                if ((card?.cardType || '').toLowerCase() !== 'command') {
                    continue;
                }

                const descriptions = Array.isArray(card?.effects?.description) ? card.effects.description : [];
                const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
                const playWindows = new Set();

                rules.forEach((rule) => {
                    if ((rule?.type || '').toLowerCase() !== 'play') {
                        return;
                    }
                    normalizeWindows(rule).forEach((window) => playWindows.add(window));
                });

                const hasMainTag = descriptions.some((line) => typeof line === 'string' && /(?:\[Main\]|【Main】)/i.test(line));
                const hasActionOnlyTag = descriptions.some((line) => {
                    if (typeof line !== 'string') {
                        return false;
                    }
                    const normalized = line.trim();
                    const startsActionOnly = /^(?:\[Action\]|【Action】)/i.test(normalized);
                    const mentionsMain = /(?:\[Main\]|【Main】)/i.test(normalized);
                    return startsActionOnly && !mentionsMain;
                });

                if (hasMainTag && !playWindows.has('MAIN_PHASE')) {
                    failures.push(`${file}:${cardId} has [Main] text but no MAIN_PHASE play window`);
                }
                if (hasActionOnlyTag && !playWindows.has('ACTION_STEP')) {
                    failures.push(`${file}:${cardId} has [Action] text but no ACTION_STEP play window`);
                }
            }
        }

        expect(failures).toEqual([]);
    });
});
