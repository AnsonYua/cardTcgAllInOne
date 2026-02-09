const { calculateSlotFieldValue } = require('../utils/FieldValueCalculator');
const { ZoneCardUtils } = require('../models/CardSystem');

describe('Field value calculations with legacy modifiers and temporaryEffects', () => {
    test('uses legacy modifyAP even when temporaryEffects is non-empty (no stat modifiers yet)', () => {
        const unit = {
            carduid: 'unit_1',
            cardData: { id: 'U1', name: 'Unit', cardType: 'unit', ap: 3, hp: 5 },
            originalAP: 3,
            originalHP: 5,
            modifyAP: 2,
            modifyHP: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            damageReceived: 0,
            temporaryEffects: [{ grantedKeywords: ['High-Maneuver'] }],
            isRested: false
        };

        const pilot = {
            carduid: 'pilot_1',
            cardData: { id: 'P1', name: 'Pilot', cardType: 'pilot', ap: 1, hp: 2 },
            originalAP: 1,
            originalHP: 2,
            continueModifyAP: 0,
            continueModifyHP: 0,
            isRested: false
        };

        expect(ZoneCardUtils.getCurrentAP(unit)).toBe(5);

        const slot = { unit, pilot };
        const fieldValue = calculateSlotFieldValue(slot);
        expect(fieldValue.totalAP).toBe(6);
        expect(fieldValue.totalTempModifyAP).toBe(2);
    });

    test('does not double-count when both legacy modifyAP and temporaryEffects modifyAP are present', () => {
        const unit = {
            carduid: 'unit_2',
            cardData: { id: 'U2', name: 'Unit', cardType: 'unit', ap: 3, hp: 5 },
            originalAP: 3,
            originalHP: 5,
            modifyAP: 2,
            modifyHP: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            damageReceived: 0,
            temporaryEffects: [{ modifyAP: 2 }],
            isRested: false
        };

        const pilot = {
            carduid: 'pilot_2',
            cardData: { id: 'P2', name: 'Pilot', cardType: 'pilot', ap: 1, hp: 2 },
            originalAP: 1,
            originalHP: 2,
            continueModifyAP: 0,
            continueModifyHP: 0,
            isRested: false
        };

        expect(ZoneCardUtils.getCurrentAP(unit)).toBe(5);

        const slot = { unit, pilot };
        const fieldValue = calculateSlotFieldValue(slot);
        expect(fieldValue.totalAP).toBe(6);
        expect(fieldValue.totalTempModifyAP).toBe(2);
    });

    test('falls back to temporaryEffects when legacy modifyAP is absent', () => {
        const unit = {
            carduid: 'unit_3',
            cardData: { id: 'U3', name: 'Unit', cardType: 'unit', ap: 3, hp: 5 },
            originalAP: 3,
            originalHP: 5,
            continueModifyAP: 0,
            continueModifyHP: 0,
            damageReceived: 0,
            temporaryEffects: [{ modifyAP: 2 }],
            isRested: false
        };

        expect(ZoneCardUtils.getCurrentAP(unit)).toBe(5);
    });
});

