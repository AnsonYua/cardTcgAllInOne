const { GameEnvironment } = require('../models/GameEnvironment');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const { GameNotificationManager } = require('../services/GameNotificationManager');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');

const gd01 = require('../data/gd01Card.json');
const gd02 = require('../data/gd02Card.json');
const gd03 = require('../data/gd03Card.json');
const st04 = require('../data/st04Card.json');
const st08 = require('../data/st08Card.json');

function getCard(fileKey, cardId) {
    const maps = {
        gd01,
        gd02,
        gd03,
        st04,
        st08
    };
    return maps[fileKey]?.cards?.[cardId];
}

function createUnitFromCard(carduid, cardData, zoneExtras = {}) {
    return createUnitZoneCard({
        carduid,
        cardId: cardData.id,
        name: cardData.name,
        ap: cardData.ap || 0,
        hp: cardData.hp || 1,
        traits: Array.isArray(cardData.traits) ? cardData.traits : [],
        link: Array.isArray(cardData.link) ? cardData.link : [],
        effectsRules: Array.isArray(cardData.effects?.rules) ? cardData.effects.rules : [],
        cardDataExtras: {
            color: cardData.color,
            level: cardData.level,
            cost: cardData.cost,
            zone: Array.isArray(cardData.zone) ? cardData.zone : []
        },
        zoneExtras: {
            placedAt: 0,
            placedBy: 'seed',
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            isFirstPlay: false,
            ...zoneExtras
        }
    });
}

function latestBattleResolved(gameEnv) {
    const list = (gameEnv.notificationQueue || []).filter((event) => event && event.type === 'BATTLE_RESOLVED');
    return list[list.length - 1] || null;
}

const riskCards = [
    { file: 'gd01', cardId: 'GD01-029' },
    { file: 'gd01', cardId: 'GD01-047' },
    { file: 'gd01', cardId: 'GD01-050' },
    { file: 'gd01', cardId: 'GD01-073' },
    { file: 'gd01', cardId: 'GD01-093' },
    { file: 'gd02', cardId: 'GD02-036' },
    { file: 'gd02', cardId: 'GD02-057' },
    { file: 'gd03', cardId: 'GD03-018' },
    { file: 'gd03', cardId: 'GD03-033' },
    { file: 'st04', cardId: 'ST04-006' },
    { file: 'st08', cardId: 'ST08-004' }
];

describe('ATTACK_PHASE pre-battle removal risk matrix', () => {
    test.each(riskCards)('$cardId removal effect aborts ACTION_STEP battle consistently', ({ file, cardId }) => {
        const cardData = getCard(file, cardId);
        expect(cardData).toBeTruthy();

        const attackRule = (cardData.effects?.rules || []).find((rule) =>
            rule.timing?.eventTrigger === 'ATTACK_PHASE' && ['damage', 'destroy', 'returnToHand'].includes(rule.action)
        );
        expect(attackRule).toBeTruthy();

        const gameEnv = new GameEnvironment();
        const attackerPlayerId = 'playerId_1';
        const defenderPlayerId = 'playerId_2';
        const attacker = gameEnv.addPlayer(attackerPlayerId, 'P1');
        const defender = gameEnv.addPlayer(defenderPlayerId, 'P2');
        gameEnv.currentPlayer = attackerPlayerId;
        gameEnv.currentTurn = 1;
        gameEnv.phase = 'ACTION_STEP';

        const attackerUnit = createUnitFromCard(`${cardId}_attacker_uid`, cardData, {
            modifyAP: 8,
            continueModifyAP: 0
        });
        const targetCardData = getCard('gd03', 'GD03-083') || {
            id: 'DUMMY-TGT',
            name: 'Dummy Target',
            ap: 1,
            hp: 1,
            level: 1,
            color: 'White',
            traits: [],
            link: [],
            effects: { rules: [] }
        };
        const targetUnit = createUnitFromCard(`${cardId}_target_uid`, targetCardData, {
            originalHP: 1,
            damageReceived: 0,
            modifyHP: 0,
            continueModifyHP: 0
        });

        attacker.zones.slot1.unit = attackerUnit;
        defender.zones.slot1.unit = targetUnit;

        const notificationManager = new GameNotificationManager(gameEnv);
        const attackNotificationId = notificationManager.addNotificationEvent('UNIT_ATTACK_DECLARED', {
            attackingPlayerId: attackerPlayerId,
            defendingPlayerId: defenderPlayerId,
            attackerCarduid: attackerUnit.carduid,
            attackerSlot: 'slot1',
            targetCarduid: targetUnit.carduid,
            targetSlotName: 'slot1'
        });

        gameEnv.setCurrentBattle({
            actionType: 'attackUnit',
            attackingPlayerId: attackerPlayerId,
            defendingPlayerId: defenderPlayerId,
            attackerCarduid: attackerUnit.carduid,
            targetCarduid: targetUnit.carduid,
            targetPlayerId: defenderPlayerId,
            status: 'ACTION_STEP',
            openedAt: Date.now(),
            attackNotificationId
        });

        const effectToApply = {
            ...attackRule,
            // This matrix validates removal/abort consistency, not per-card trigger condition semantics.
            conditions: [],
            sourceConditions: [],
            optional: false,
            cost: undefined
        };

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            effectToApply,
            [{ carduid: targetUnit.carduid, zone: 'slot1', playerId: defenderPlayerId }],
            attackerPlayerId,
            attackerUnit.carduid
        );

        expect(result.success).toBe(true);
        expect(gameEnv.currentBattle).toBeUndefined();
        expect(defender.zones.slot1.unit).toBeFalsy();

        const resolution = latestBattleResolved(gameEnv);
        expect(resolution).toBeTruthy();
        expect(resolution.payload?.result?.aborted).toBe(true);
        expect(resolution.payload?.result?.battleEndedEarly).toBe(true);
        expect(resolution.payload?.result?.abortReason).toBe('TARGET_NOT_ON_BOARD');
        expect(resolution.payload?.result?.targetMissing).toBe(true);

        if (cardId === 'GD01-050') {
            expect(resolution.payload?.result?.attackerDamageTaken).toBe(0);

            const declaredIndex = (gameEnv.notificationQueue || []).findIndex((event) => event?.id === attackNotificationId);
            expect(declaredIndex).toBeGreaterThanOrEqual(0);

            const attackerDamagedAfterDeclare = (gameEnv.notificationQueue || [])
                .slice(declaredIndex + 1)
                .filter((event) => event?.type === 'CARD_DAMAGED')
                .some((event) => event?.payload?.carduid === attackerUnit.carduid);
            expect(attackerDamagedAfterDeclare).toBe(false);
        }
    });
});
