const { GameEnvironment } = require('../models/GameEnvironment');
const { SlotHealthService } = require('../services/health/SlotHealthService');
const { SlotHealthStorage } = require('../services/health/SlotHealthStorage');
const { SlotHpDestructionChecker } = require('../services/destruction/SlotHpDestructionChecker');

function createUnit(carduid, hp = 2, ap = 1) {
    return {
        carduid,
        cardId: carduid.split('_')[0] || 'UNIT',
        cardData: { id: 'UNIT', name: 'Unit', cardType: 'unit', hp, ap },
        originalHP: hp,
        originalAP: ap,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        isRested: false,
        effectUsage: {},
        playedThisTurn: false,
        canAttackOnPlayTurn: false,
        canAttackThisTurn: true
    };
}

function createPilot(carduid, hp = 1, ap = 1) {
    return {
        carduid,
        cardId: carduid.split('_')[0] || 'PILOT',
        cardData: { id: 'PILOT', name: 'Pilot', cardType: 'pilot', hp, ap },
        originalHP: hp,
        originalAP: ap,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        isRested: false,
        effectUsage: {}
    };
}

describe('SlotHealthService shared slot HP model', () => {
    test('overflow damage to unit consumes shared unit+pilot pool and destroys slot at <=0', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p2.zones.slot1.unit = createUnit('unit_1', 2, 2);
        p2.zones.slot1.pilot = createPilot('pilot_1', 2, 1);

        const firstHit = SlotHealthService.applyDamageByCarduid(gameEnv, 'unit_1', 3);
        expect(firstHit).toBeTruthy();
        expect(firstHit.remainingHp).toBe(1);
        expect(SlotHealthStorage.getSharedDamage(p2.zones.slot1)).toBe(3);

        const secondHit = SlotHealthService.applyDamageByCarduid(gameEnv, 'unit_1', 2);
        expect(secondHit).toBeTruthy();
        expect(secondHit.remainingHp).toBe(0);
        expect(SlotHealthStorage.getSharedDamage(p2.zones.slot1)).toBe(5);

        const destroyed = SlotHpDestructionChecker.destroyUnitIfSlotHpZero(gameEnv, 'unit_1');
        expect(destroyed).toBe(true);
        expect(p2.zones.slot1.unit).toBeFalsy();
        expect(p2.zones.slot1.pilot).toBeFalsy();
        expect(p2.zones.trashArea.some((card) => card.carduid === 'unit_1')).toBe(true);
        expect(p2.zones.trashArea.some((card) => card.carduid === 'pilot_1')).toBe(true);
        expect(p1.zones.slot1.unit).toBeFalsy();
    });

    test('pilot-targeted damage and heal read/write the same shared pool', () => {
        const gameEnv = new GameEnvironment();
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p2.zones.slot1.unit = createUnit('unit_2', 3, 2);
        p2.zones.slot1.pilot = createPilot('pilot_2', 2, 1);

        const pilotDamage = SlotHealthService.applyDamageByCarduid(gameEnv, 'pilot_2', 2);
        expect(pilotDamage).toBeTruthy();
        expect(pilotDamage.remainingHp).toBe(3);
        expect(SlotHealthStorage.getSharedDamage(p2.zones.slot1)).toBe(2);
        expect(p2.zones.slot1.unit.damageReceived).toBe(2);

        const pilotHeal = SlotHealthService.applyHealByCarduid(gameEnv, 'pilot_2', 1);
        expect(pilotHeal).toBeTruthy();
        expect(pilotHeal.remainingHp).toBe(4);
        expect(SlotHealthStorage.getSharedDamage(p2.zones.slot1)).toBe(1);
        expect(p2.zones.slot1.unit.damageReceived).toBe(1);
    });

    test('pilot-only slot can still store and resolve shared damage/heal', () => {
        const gameEnv = new GameEnvironment();
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p2.zones.slot1.pilot = createPilot('pilot_only', 2, 1);

        const hit = SlotHealthService.applyDamageByCarduid(gameEnv, 'pilot_only', 3);
        expect(hit).toBeTruthy();
        expect(hit.maxHp).toBe(2);
        expect(hit.sharedDamage).toBe(3);
        expect(hit.remainingHp).toBe(0);

        const heal = SlotHealthService.applyHealByCarduid(gameEnv, 'pilot_only', 2);
        expect(heal).toBeTruthy();
        expect(heal.sharedDamage).toBe(1);
        expect(heal.remainingHp).toBe(1);
    });
});
