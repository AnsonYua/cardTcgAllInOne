const {
    __testUtils: {
        classifyAlwaysOnCompleteness
    }
} = require('../tests/review/effectCanonicalInventory');

describe('effectCanonicalInventory classifier', () => {
    test('marks canonical triggered repair rule as complete', () => {
        const status = classifyAlwaysOnCompleteness({
            effects: {
                description: ['<Repair 1> (At the end of your turn, this Unit recovers HP.)'],
                rules: [
                    {
                        effectId: 'repair_1',
                        type: 'triggered',
                        trigger: 'END_OF_TURN',
                        action: 'heal',
                        parameters: { value: 1 }
                    }
                ]
            }
        });

        expect(status).toBe('complete');
    });

    test('marks keyword-typed legacy rule as legacy-encoding-but-behaviorally-complete', () => {
        const status = classifyAlwaysOnCompleteness({
            effects: {
                description: ['<Breach 2> (When this Unit destroys an enemy Unit, damage shield.)'],
                rules: [
                    {
                        effectId: 'breach_2',
                        type: 'keyword',
                        trigger: 'BATTLE_DESTROY',
                        action: 'damageShield',
                        parameters: { value: 2 }
                    }
                ]
            }
        });

        expect(status).toBe('legacy-encoding-but-behaviorally-complete');
    });
});
