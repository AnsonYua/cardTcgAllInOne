const fs = require('fs');
const path = require('path');
const {
    getEventTrigger,
    normalizeActivationWindows
} = require('./helpers/effectTimingSourceTestUtils');

const ST_CARD_FILES = [
    'st01Card.json',
    'st02Card.json',
    'st03Card.json',
    'st04Card.json',
    'st05Card.json',
    'st06Card.json',
    'st07Card.json',
    'st08Card.json'
];

function loadCards(file) {
    const filePath = path.join(__dirname, '..', 'data', file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data.cards || {};
}

function ruleHasAction(rule, actionName) {
    if (String(rule?.action || '') === actionName) {
        return true;
    }
    if (String(rule?.action || '') !== 'sequence') {
        return false;
    }
    const steps = Array.isArray(rule?.parameters?.steps) ? rule.parameters.steps : [];
    return steps.some((step) => String(step?.action || '') === actionName);
}

describe('ST description semantic alignment', () => {
    test('burst add-to-hand text has BURST_CONDITION addToHand rule', () => {
        const failures = [];

        for (const file of ST_CARD_FILES) {
            const cards = loadCards(file);
            for (const [cardId, card] of Object.entries(cards)) {
                const descriptions = Array.isArray(card?.effects?.description) ? card.effects.description : [];
                const descriptionText = descriptions.join('\n');
                const hasBurstAddText =
                    /(?:\[Burst\]|【Burst】)[^\n]*Add this card to your hand\./i.test(descriptionText);
                if (!hasBurstAddText) {
                    continue;
                }

                const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
                const hasBurstAddRule = rules.some((rule) =>
                    getEventTrigger(rule) === 'BURST_CONDITION'
                    && String(rule?.action || '') === 'addToHand'
                );
                if (!hasBurstAddRule) {
                    failures.push(`${file}:${cardId}`);
                }
            }
        }

        expect(failures).toEqual([]);
    });

    test('once-per-turn text has oncePerTurn schema flag', () => {
        const failures = [];

        for (const file of ST_CARD_FILES) {
            const cards = loadCards(file);
            for (const [cardId, card] of Object.entries(cards)) {
                const descriptions = Array.isArray(card?.effects?.description) ? card.effects.description : [];
                const hasOncePerTurnText = descriptions.some((line) =>
                    typeof line === 'string' && /once per turn/i.test(line)
                );
                if (!hasOncePerTurnText) {
                    continue;
                }

                const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
                const hasOnceFlag = rules.some((rule) =>
                    rule?.cost?.oncePerTurn === true
                    || (Array.isArray(rule?.restrictions) && rule.restrictions.includes('once_per_turn'))
                );
                if (!hasOnceFlag) {
                    failures.push(`${file}:${cardId}`);
                }
            }
        }

        expect(failures).toEqual([]);
    });

    test('cannot-attack-this-turn text has attack restriction rule', () => {
        const failures = [];

        for (const file of ST_CARD_FILES) {
            const cards = loadCards(file);
            for (const [cardId, card] of Object.entries(cards)) {
                const descriptions = Array.isArray(card?.effects?.description) ? card.effects.description : [];
                const hasCannotAttackText = descriptions.some((line) =>
                    typeof line === 'string' && /(?:can'?t|cannot) attack during this turn/i.test(line)
                );
                if (!hasCannotAttackText) {
                    continue;
                }

                const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
                const hasRestrictionRule = rules.some((rule) =>
                    ruleHasAction(rule, 'restrict_attack') || ruleHasAction(rule, 'setActive_then_restrict_attack')
                );
                if (!hasRestrictionRule) {
                    failures.push(`${file}:${cardId}`);
                }
            }
        }

        expect(failures).toEqual([]);
    });

    test('prevent set-active text uses prevent_set_active_next_turn / restrict_set_active schema', () => {
        const failures = [];

        for (const file of ST_CARD_FILES) {
            const cards = loadCards(file);
            for (const [cardId, card] of Object.entries(cards)) {
                const descriptions = Array.isArray(card?.effects?.description) ? card.effects.description : [];
                const hasPreventSetActiveText = descriptions.some((line) =>
                    typeof line === 'string'
                    && (
                        /won't be set as active/i.test(line)
                        || /can'?t be set as active/i.test(line)
                    )
                );
                if (!hasPreventSetActiveText) {
                    continue;
                }

                const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
                const hasPreventSchema = rules.some((rule) =>
                    String(rule?.action || '') === 'prevent_set_active_next_turn'
                    || String(rule?.action || '') === 'restrict_set_active'
                );
                if (!hasPreventSchema) {
                    failures.push(`${file}:${cardId}`);
                }
            }
        }

        expect(failures).toEqual([]);
    });

    test('command [Main]/[Action] tags align with play timing windows', () => {
        const failures = [];

        for (const file of ST_CARD_FILES) {
            const cards = loadCards(file);
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
                    normalizeActivationWindows(rule).forEach((window) => playWindows.add(window));
                });

                const hasMainTag = descriptions.some((line) =>
                    typeof line === 'string' && /(?:\[Main\]|【Main】)/i.test(line)
                );
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
                    failures.push(`${file}:${cardId} [Main] without MAIN_PHASE play window`);
                }
                if (hasActionOnlyTag && !playWindows.has('ACTION_STEP')) {
                    failures.push(`${file}:${cardId} [Action] without ACTION_STEP play window`);
                }
            }
        }

        expect(failures).toEqual([]);
    });
});
