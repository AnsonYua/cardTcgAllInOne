const { buildDeployOptions } = require('../services/effects/deployFromTopDeck/DeployFromTopDeckOptionUtils');

describe('DeployFromTopDeck option display contract', () => {
    test('emits card display for deploy choices and text display for bottom choice', () => {
        const options = buildDeployOptions(
            [
                { carduid: 'GD03-035_a', cardId: 'GD03-035', name: 'GFreD' },
                { carduid: 'ST03-001_b', cardId: 'ST03-001', name: 'Sinanju' }
            ],
            true
        );

        expect(options).toHaveLength(3);

        expect(options[0].display).toEqual({
            mode: 'card',
            cardId: 'GD03-035',
            label: 'Deploy GFreD'
        });
        expect(options[1].display).toEqual({
            mode: 'card',
            cardId: 'ST03-001',
            label: 'Deploy Sinanju'
        });
        expect(options[2].display).toEqual({
            mode: 'text',
            label: 'Put the cards on the bottom of your deck'
        });
    });
});
