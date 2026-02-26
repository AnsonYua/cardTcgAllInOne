const fs = require('fs');
const path = require('path');

const { GameEnvironment } = require('../models/GameEnvironment');
const { GameLogic } = require('../services/GameLogic');
const { CardDatabaseManager } = require('../models/CardSystem');
const { AttackPreparationManager } = require('../services/AttackPreparationManager');
const { AllowAttackTargetPermissionResolver } = require('../services/attack/AllowAttackTargetPermissionResolver');
const { TestStatePairingRehydrationService } = require('../services/testState/TestStatePairingRehydrationService');
const { createUnitZoneCard, createPilotZoneCard } = require('./helpers/zoneCardFactory');

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function fieldCardValueZero() {
    return {
        totalOriginalAP: 0,
        totalOriginalHP: 0,
        totalTempModifyAP: 0,
        totalTempModifyHP: 0,
        totalContinueModifyAP: 0,
        totalContinueModifyHP: 0,
        totalDamageReceived: 0,
        totalAP: 0,
        totalHP: 0
    };
}

function makeUnit(carduid, cardId, extraZone = {}) {
    const card = CardDatabaseManager.getCardDetails(cardId);
    if (!card) throw new Error(`Missing card data for ${cardId}`);
    return createUnitZoneCard({
        carduid,
        cardId,
        name: card.name,
        ap: card.ap,
        hp: card.hp,
        traits: Array.isArray(card.traits) ? [...card.traits] : [],
        link: Array.isArray(card.link) ? [...card.link] : [],
        effectsRules: Array.isArray(card?.effects?.rules) ? clone(card.effects.rules) : [],
        cardDataExtras: {
            color: card.color,
            level: card.level,
            cost: card.cost,
            zone: Array.isArray(card.zone) ? [...card.zone] : [],
            effects: clone(card.effects || { description: [], rules: [] })
        },
        zoneExtras: {
            placedAt: 0,
            placedBy: extraZone.placedBy,
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            isFirstPlay: false,
            ...extraZone
        }
    });
}

function makePilot(carduid, cardId, extraZone = {}) {
    const card = CardDatabaseManager.getCardDetails(cardId);
    if (!card) throw new Error(`Missing card data for ${cardId}`);
    return createPilotZoneCard({
        carduid,
        cardId,
        name: card.name,
        ap: card.ap,
        hp: card.hp,
        traits: Array.isArray(card.traits) ? [...card.traits] : [],
        cardDataExtras: clone(card),
        zoneExtras: {
            placedAt: 0,
            placedBy: extraZone.placedBy,
            isRested: false,
            ...extraZone
        }
    });
}

function buildSeededPairedEnv({ pilotTraitsOverride } = {}) {
    const gameEnv = new GameEnvironment();
    const p1 = gameEnv.addPlayer('playerId_1', 'Player 1');
    const p2 = gameEnv.addPlayer('playerId_2', 'Player 2');

    gameEnv.phase = 'MAIN_PHASE';
    gameEnv.currentPlayer = 'playerId_1';
    gameEnv.currentTurn = 1;
    gameEnv.gameStarted = true;
    gameEnv.hasChosenFirstPlayer = true;
    gameEnv.playersReady = { playerId_1: true, playerId_2: true };

    p1.zones.slot1.unit = makeUnit('GD03-017_unit_0001', 'GD03-017', { placedBy: 'playerId_1' });
    p1.zones.slot1.pilot = makePilot('GD03-090_pilot_0001', 'GD03-090', { placedBy: 'playerId_1' });
    if (Array.isArray(pilotTraitsOverride)) {
        p1.zones.slot1.pilot.cardData.traits = [...pilotTraitsOverride];
    }
    p1.zones.slot1.fieldCardValue = fieldCardValueZero();

    p2.zones.slot2.unit = makeUnit('GD01-020_unit_0001', 'GD01-020', { placedBy: 'playerId_2' }); // AP 3
    p2.zones.slot2.fieldCardValue = fieldCardValueZero();

    p2.zones.slot3.unit = makeUnit('GD03-073_unit_0001', 'GD03-073', { placedBy: 'playerId_2' }); // AP 6
    p2.zones.slot3.fieldCardValue = fieldCardValueZero();

    return gameEnv;
}

function findUnit(gameEnv, playerId, slotId) {
    return gameEnv.players[playerId].zones[slotId].unit;
}

function countAllowAttackTemps(card) {
    return (Array.isArray(card?.temporaryEffects) ? card.temporaryEffects : []).filter((t) => t?.allowAttackTarget).length;
}

function countModifyApTemps(card, value) {
    return (Array.isArray(card?.temporaryEffects) ? card.temporaryEffects : []).filter((t) => t?.modifyAP === value).length;
}

describe('TestStatePairingRehydrationService / GameLogic.injectGameState pairing rehydration', () => {
    const writtenGameIds = new Set();

    afterEach(() => {
        for (const gameId of writtenGameIds) {
            const filePath = path.join(process.cwd(), 'src/gameData', `${gameId}.json`);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch {
                // ignore cleanup failures in tests
            }
        }
        writtenGameIds.clear();
    });

    test('injectGameState rehydrates GD03-017 pairing permission and allows attacking active AP<=5 unit', async () => {
        const logic = new GameLogic();
        const seed = buildSeededPairedEnv();
        const gameId = `test_rehydrate_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        writtenGameIds.add(gameId);

        const result = await logic.injectGameState(gameId, seed.toJSON());
        expect(result.success).toBe(true);
        expect(result.gameEnv).toBeTruthy();

        const reloaded = await logic.loadGameFromFile(gameId);
        expect(reloaded).toBeTruthy();

        const attacker = findUnit(reloaded, 'playerId_1', 'slot1');
        const validTarget = findUnit(reloaded, 'playerId_2', 'slot2');
        const invalidTarget = findUnit(reloaded, 'playerId_2', 'slot3');

        expect(AllowAttackTargetPermissionResolver.canTargetActiveUnit(reloaded, attacker, validTarget)).toBe(true);
        expect(AllowAttackTargetPermissionResolver.canTargetActiveUnit(reloaded, attacker, invalidTarget)).toBe(false);

        const prepAllowed = AttackPreparationManager.prepareUnitAttack(
            reloaded,
            'playerId_1',
            attacker.carduid,
            'playerId_2',
            validTarget.carduid
        );
        expect(prepAllowed.success).toBe(true);

        const prepBlocked = AttackPreparationManager.prepareUnitAttack(
            reloaded,
            'playerId_1',
            attacker.carduid,
            'playerId_2',
            invalidTarget.carduid
        );
        expect(prepBlocked.success).toBe(false);
        expect(prepBlocked.error).toContain('Target unit must be rested');
    });

    test('rehydration requires paired pilot trait condition', () => {
        const gameEnv = buildSeededPairedEnv({ pilotTraitsOverride: ['Zeon'] });
        const result = TestStatePairingRehydrationService.rehydratePairingDerivedEffects(gameEnv);
        expect(result.warnings).toEqual([]);

        const attacker = findUnit(gameEnv, 'playerId_1', 'slot1');
        const validTarget = findUnit(gameEnv, 'playerId_2', 'slot2');
        expect(AllowAttackTargetPermissionResolver.canTargetActiveUnit(gameEnv, attacker, validTarget)).toBe(false);
    });

    test('rehydration is safe when no paired slots exist', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.players.playerId_1.zones.slot1.unit = makeUnit('GD03-017_unit_0001', 'GD03-017', { placedBy: 'playerId_1' });
        gameEnv.players.playerId_1.zones.slot1.fieldCardValue = fieldCardValueZero();

        const result = TestStatePairingRehydrationService.rehydratePairingDerivedEffects(gameEnv);
        expect(result.pairedSlotsScanned).toBe(0);
        expect(result.applied).toBe(0);
        expect(result.warnings).toEqual([]);
    });

    test('rehydration is idempotent for allow_attack_target temporary effects', () => {
        const gameEnv = buildSeededPairedEnv();
        const first = TestStatePairingRehydrationService.rehydratePairingDerivedEffects(gameEnv);
        const second = TestStatePairingRehydrationService.rehydratePairingDerivedEffects(gameEnv);

        expect(first.warnings).toEqual([]);
        expect(second.warnings).toEqual([]);

        const attacker = findUnit(gameEnv, 'playerId_1', 'slot1');
        expect(countAllowAttackTemps(attacker)).toBe(1);
    });

    test('rehydration replays PAIRING_COMPLETE_GLOBAL temporary effects (GD01-065 AP-2)', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.phase = 'MAIN_PHASE';
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.currentTurn = 1;
        gameEnv.gameStarted = true;

        p1.zones.slot1.unit = makeUnit('GD01-065_unit_0001', 'GD01-065', { placedBy: 'playerId_1' });
        p1.zones.slot1.pilot = makePilot('GD01-090_pilot_0001', 'GD01-090', { placedBy: 'playerId_1' });
        p1.zones.slot1.fieldCardValue = fieldCardValueZero();

        p2.zones.slot1.unit = makeUnit('enemy_target_0001', 'GD01-020', { placedBy: 'playerId_2' });
        p2.zones.slot1.fieldCardValue = fieldCardValueZero();

        const result = TestStatePairingRehydrationService.rehydratePairingDerivedEffects(gameEnv);
        expect(result.warnings).toEqual([]);

        const enemy = findUnit(gameEnv, 'playerId_2', 'slot1');
        expect(countModifyApTemps(enemy, -2) > 0 || enemy.modifyAP === -2).toBe(true);
    });

    test('rehydration skips one-shot pairing effects (GD03-019 linked addExtraEnergy)', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.phase = 'MAIN_PHASE';
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.currentTurn = 1;
        gameEnv.gameStarted = true;

        p1.zones.slot1.unit = makeUnit('GD03-019_unit_0001', 'GD03-019', { placedBy: 'playerId_1' });
        p1.zones.slot1.pilot = makePilot('GD03-088_pilot_0001', 'GD03-088', { placedBy: 'playerId_1' });
        p1.zones.slot1.fieldCardValue = fieldCardValueZero();

        const beforeEnergy = Array.isArray(p1.zones.energyArea) ? p1.zones.energyArea.length : 0;
        const result = TestStatePairingRehydrationService.rehydratePairingDerivedEffects(gameEnv);
        const afterEnergy = Array.isArray(p1.zones.energyArea) ? p1.zones.energyArea.length : 0;

        expect(result.warnings.some((w) => w.includes('Skipped') && w.includes('non-derived pairing effect'))).toBe(true);
        expect(afterEnergy).toBe(beforeEnergy);
    });
});
