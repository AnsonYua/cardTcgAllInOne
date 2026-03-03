const fs = require('fs');
const path = require('path');

function normalizeWindows(rule) {
    if (!Array.isArray(rule?.timing?.windows)) {
        return [];
    }
    return rule.timing.windows.map((window) => String(window).toUpperCase());
}

describe('GD01 description timing alignment', () => {
    const filePath = path.join(__dirname, '..', 'data', 'gd01Card.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const cards = data.cards || {};

    test('all GD01 play rules define explicit timing windows', () => {
        const failures = [];

        for (const [cardId, card] of Object.entries(cards)) {
            const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
            rules.forEach((rule, index) => {
                if ((rule?.type || '').toLowerCase() !== 'play') {
                    return;
                }
                if (normalizeWindows(rule).length > 0) {
                    return;
                }
                failures.push(`${cardId} rules[${index}] ${rule?.effectId || 'unknown'}`);
            });
        }

        expect(failures).toEqual([]);
    });

    test('command description tags align with declared play timing windows', () => {
        const failures = [];

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
                failures.push(`${cardId} has [Main] text but no MAIN_PHASE play window`);
            }
            if (hasActionOnlyTag && !playWindows.has('ACTION_STEP')) {
                failures.push(`${cardId} has [Action] text but no ACTION_STEP play window`);
            }
        }

        expect(failures).toEqual([]);
    });
});
