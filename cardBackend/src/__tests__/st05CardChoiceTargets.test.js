const fs = require('fs');
const path = require('path');

function loadSt05Cards() {
    const filePath = path.join(__dirname, '..', 'data', 'st05Card.json');
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return json.cards;
}

describe('ST05 card target choice configuration', () => {
    test('ST05-010 pairing damage requires player choice for both targets', () => {
        const cards = loadSt05Cards();
        const effect = cards['ST05-010'].effects.rules.find(r => r.effectId === 'pair_damage_each_1');
        expect(effect).toBeTruthy();
        const [selfStep, opponentStep] = effect.parameters.steps;
        expect(selfStep.target.selection.type).toBe('player_choice');
        expect(opponentStep.target.selection.type).toBe('player_choice');
    });

    test('ST05-003 activated damage uses player choice', () => {
        const cards = loadSt05Cards();
        const effect = cards['ST05-003'].effects.rules.find(r => r.effectId === 'activate_damage_1_then_ap_plus_1');
        expect(effect).toBeTruthy();
        const [damageStep] = effect.parameters.steps;
        expect(damageStep.target.selection.type).toBe('player_choice');
    });

    test('ST05-013 command damage uses player choice', () => {
        const cards = loadSt05Cards();
        const effect = cards['ST05-013'].effects.rules.find(r => r.effectId === 'main_or_action_damage_1_then_ap_plus_3');
        expect(effect).toBeTruthy();
        const [damageStep] = effect.parameters.steps;
        expect(damageStep.target.selection.type).toBe('player_choice');
    });
});

