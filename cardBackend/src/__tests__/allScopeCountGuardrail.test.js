const fs = require('fs');
const path = require('path');

const DATA_FILES = [
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

const ACTIONS_REQUIRING_MULTI_TARGET_COUNT = new Set([
    'damage',
    'heal',
    'modifyAP',
    'modifyHP',
    'setActive',
    'rest',
    'grant_keyword',
    'grant_breach',
    'prevent_battle_damage'
]);

const ALLOWLIST = new Set([
    // Continuous-path safe by design
    'gd01Card.json|GD01-001|grant_repair_1|cards.GD01-001.effects.rules[0]',
    'st01Card.json|ST01-001|pair_ap_boost_all|cards.ST01-001.effects.rules[1]',
    'gd03Card.json|GD03-033|during_pair_zaft_units_ap_plus_2|cards.GD03-033.effects.rules[0]',
    'gd03Card.json|GD03-126|opponent_turn_tokens_ap_plus_1|cards.GD03-126.effects.rules[2]'
]);

function hasInsufficientCount(count) {
    if (typeof count === 'number') {
        return count <= 1;
    }
    if (count && typeof count === 'object') {
        const max = typeof count.max === 'number' ? count.max : undefined;
        if (typeof max === 'number') {
            return max <= 1;
        }
        return true;
    }
    return true;
}

function descriptionImpliesAll(descriptionText) {
    if (typeof descriptionText !== 'string') {
        return false;
    }
    return /\ball\b/i.test(descriptionText);
}

function collectFindingsFromNode(node, context, findings) {
    if (!node || typeof node !== 'object') {
        return;
    }

    const action = typeof node.action === 'string' ? node.action : '';
    const target = node.target && typeof node.target === 'object' ? node.target : null;

    if (target && ACTIONS_REQUIRING_MULTI_TARGET_COUNT.has(action)) {
        const scope = typeof target.scope === 'string' ? target.scope : '';
        const scopeLower = scope.toLowerCase();
        const selectionType = typeof target.selection?.type === 'string' ? target.selection.type : '';

        const scopeContainsAll = scopeLower.includes('all');
        const isExplicitAllOverride = scopeLower === 'any_all_unit';
        const hasExplicitSelection = selectionType.length > 0;
        const insufficientCount = hasInsufficientCount(target.count);

        const allowlistKey = `${context.file}|${context.cardId}|${context.effectId}|${context.path}`;
        const allowlisted = ALLOWLIST.has(allowlistKey);
        const descriptionHasAll = descriptionImpliesAll(context.descriptionText);

        if (descriptionHasAll && scopeContainsAll && !isExplicitAllOverride && !hasExplicitSelection && insufficientCount && !allowlisted) {
            findings.push({
                file: context.file,
                cardId: context.cardId,
                effectId: context.effectId,
                path: context.path,
                action,
                scope,
                count: target.count === undefined ? null : target.count
            });
        }
    }

    const parameters = node.parameters && typeof node.parameters === 'object' ? node.parameters : {};
    ['steps', 'then', 'else'].forEach((key) => {
        if (Array.isArray(parameters[key])) {
            parameters[key].forEach((child, index) => {
                collectFindingsFromNode(child, {
                    ...context,
                    path: `${context.path}.parameters.${key}[${index}]`
                }, findings);
            });
        }
    });

    if (Array.isArray(parameters.branches)) {
        parameters.branches.forEach((branch, branchIndex) => {
            if (!branch || typeof branch !== 'object' || !Array.isArray(branch.steps)) {
                return;
            }

            branch.steps.forEach((step, stepIndex) => {
                collectFindingsFromNode(step, {
                    ...context,
                    path: `${context.path}.parameters.branches[${branchIndex}].steps[${stepIndex}]`
                }, findings);
            });
        });
    }
}

describe('all-scope target count guardrail', () => {
    test('all-scope operational actions must declare explicit multi-target count unless allowlisted', () => {
        const findings = [];

        for (const filename of DATA_FILES) {
            const absolutePath = path.join(__dirname, '..', 'data', filename);
            const json = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));

            for (const [cardId, card] of Object.entries(json.cards || {})) {
                const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];

                rules.forEach((rule, ruleIndex) => {
                    const effectId = typeof rule?.effectId === 'string' ? rule.effectId : 'unknown_effect';
                    const descriptionText = Array.isArray(card?.effects?.description)
                        ? card.effects.description.join(' | ')
                        : '';
                    collectFindingsFromNode(rule, {
                        file: filename,
                        cardId,
                        effectId,
                        path: `cards.${cardId}.effects.rules[${ruleIndex}]`,
                        descriptionText
                    }, findings);
                });
            }
        }

        if (findings.length > 0) {
            const details = findings
                .map((f) => `${f.file} :: ${f.cardId} :: ${f.effectId} :: ${f.path} :: action=${f.action} scope=${f.scope} count=${JSON.stringify(f.count)}`)
                .join('\n');
            throw new Error(`Found all-scope rules missing explicit multi-target count:\n${details}`);
        }

        expect(findings).toHaveLength(0);
    });
});
