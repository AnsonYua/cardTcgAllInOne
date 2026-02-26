const { GameEnvironment } = require('../models/GameEnvironment');
const { GameEnvViewBuilder } = require('../services/views/GameEnvViewBuilder');
const { createUnitZoneCard, createPilotZoneCard } = require('./helpers/zoneCardFactory');

const gd01 = require('../data/gd01Card.json');
const gd02 = require('../data/gd02Card.json');
const gd03 = require('../data/gd03Card.json');
const st01 = require('../data/st01Card.json');
const st02 = require('../data/st02Card.json');
const st03 = require('../data/st03Card.json');
const st04 = require('../data/st04Card.json');
const st05 = require('../data/st05Card.json');
const st06 = require('../data/st06Card.json');
const st07 = require('../data/st07Card.json');
const st08 = require('../data/st08Card.json');

const CARD_FILES = [
    { file: 'gd01Card.json', data: gd01 },
    { file: 'gd02Card.json', data: gd02 },
    { file: 'gd03Card.json', data: gd03 },
    { file: 'st01Card.json', data: st01 },
    { file: 'st02Card.json', data: st02 },
    { file: 'st03Card.json', data: st03 },
    { file: 'st04Card.json', data: st04 },
    { file: 'st05Card.json', data: st05 },
    { file: 'st06Card.json', data: st06 },
    { file: 'st07Card.json', data: st07 },
    { file: 'st08Card.json', data: st08 }
];

function collectHandContinuousModifiers(cardFiles) {
    const rows = [];
    for (const { file, data } of cardFiles) {
        const cards = data?.cards || {};
        for (const [cardId, card] of Object.entries(cards)) {
            const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
            for (const rule of rules) {
                const scope = rule?.target?.scope;
                if (rule?.type !== 'continuous') continue;
                if (rule?.trigger !== 'continuous') continue;
                if (!['modifyCost', 'modifyLevel'].includes(rule?.action)) continue;
                if (typeof scope !== 'string' || !scope.includes('hand')) continue;
                rows.push({
                    file,
                    cardId,
                    cardName: card?.name || cardId,
                    effectId: rule?.effectId || 'unknown_effect',
                    action: rule?.action,
                    scope
                });
            }
        }
    }
    return rows.sort((a, b) => {
        if (a.cardId === b.cardId) return String(a.effectId).localeCompare(String(b.effectId));
        return String(a.cardId).localeCompare(String(b.cardId));
    });
}

function buildGameWithViewerHand(cardId, cardData) {
    const gameEnv = new GameEnvironment();
    const p1 = gameEnv.addPlayer('playerId_1', 'P1');
    gameEnv.addPlayer('playerId_2', 'P2');
    gameEnv.currentPlayer = p1.id;
    gameEnv.currentTurn = 1;

    const carduid = `${cardId}_hand_audit_0001`;
    p1.deck.hand = [
        {
            carduid,
            cardId,
            cardData: JSON.parse(JSON.stringify(cardData))
        }
    ];
    p1.deck._handUids = [carduid];
    p1.deck.handUids = [carduid];

    return { gameEnv, p1, carduid };
}

function getViewerHandCard(view, viewerId, carduid) {
    const hand = view?.players?.[viewerId]?.deck?.hand || [];
    return Array.isArray(hand) ? hand.find((c) => c?.carduid === carduid) : undefined;
}

describe('hand continuous modifier view serialization audit (code regression, not schema issue)', () => {
    const affected = collectHandContinuousModifiers(CARD_FILES);

    test('scans listed card files and detects continuous hand modifyCost/modifyLevel cards', () => {
        const detectedCardIds = [...new Set(affected.map((row) => row.cardId))].sort();
        expect(detectedCardIds).toEqual([
            'GD01-016',
            'GD01-070',
            'GD03-014',
            'GD03-030',
            'GD03-082',
            'ST08-001'
        ]);
    });

    test('every detected hand continuous modifier card gets base/effective cost+level fields in viewer hand', () => {
        const seenCardIds = new Set();

        for (const row of affected) {
            if (seenCardIds.has(row.cardId)) continue;
            seenCardIds.add(row.cardId);

            const source = CARD_FILES.find((entry) => entry.file === row.file);
            const cardData = source?.data?.cards?.[row.cardId];
            expect(cardData).toBeTruthy();

            const { gameEnv, carduid } = buildGameWithViewerHand(row.cardId, cardData);
            const view = GameEnvViewBuilder.toPlayerView(gameEnv, 'playerId_1');
            const handCard = getViewerHandCard(view, 'playerId_1', carduid);

            expect(handCard).toBeTruthy();
            expect(typeof handCard.cardData.baseCost).toBe('number');
            expect(typeof handCard.cardData.baseLevel).toBe('number');
            expect(typeof handCard.cardData.effectiveCost).toBe('number');
            expect(typeof handCard.cardData.effectiveLevel).toBe('number');
        }
    });

    test('GD03-030 positive: linked (CB) unit in play reduces effectiveCost in viewer hand serialization', () => {
        const cardId = 'GD03-030';
        const { gameEnv, p1, carduid } = buildGameWithViewerHand(cardId, gd03.cards[cardId]);

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-022_unit_link_0001',
            cardId: 'GD03-022',
            traits: ['CB', 'GN Drive'],
            link: ['Allelujah Haptism', 'Hallelujah Haptism'],
            cardDataExtras: { level: 5, cost: 3 }
        });
        p1.zones.slot1.pilot = createPilotZoneCard({
            carduid: 'ST07-012_pilot_link_0001',
            cardId: 'ST07-012',
            name: 'Allelujah Haptism',
            traits: ['CB', 'Super Soldier'],
            cardDataExtras: { level: 3, cost: 1 }
        });

        const view = GameEnvViewBuilder.toPlayerView(gameEnv, 'playerId_1');
        const handCard = getViewerHandCard(view, 'playerId_1', carduid);

        expect(handCard).toBeTruthy();
        expect(handCard.cardData.baseCost).toBe(3);
        expect(handCard.cardData.effectiveCost).toBe(2);
        expect(handCard.cardData.baseLevel).toBe(3);
        expect(handCard.cardData.effectiveLevel).toBe(3);
    });

    test('GD03-030 negative: no qualifying linked (CB) unit leaves effectiveCost at base', () => {
        const cardId = 'GD03-030';
        const { gameEnv, p1, carduid } = buildGameWithViewerHand(cardId, gd03.cards[cardId]);

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-022_unit_unpaired_0001',
            cardId: 'GD03-022',
            traits: ['CB', 'GN Drive'],
            link: ['Allelujah Haptism', 'Hallelujah Haptism'],
            cardDataExtras: { level: 5, cost: 3 }
        });
        // No pilot in slot => not linked, condition should fail.

        const view = GameEnvViewBuilder.toPlayerView(gameEnv, 'playerId_1');
        const handCard = getViewerHandCard(view, 'playerId_1', carduid);

        expect(handCard).toBeTruthy();
        expect(handCard.cardData.baseCost).toBe(3);
        expect(handCard.cardData.effectiveCost).toBe(3);
    });

    test('non-viewer opponent hand remains hidden while viewer hand is enriched', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p1.deck.hand = [{
            carduid: 'GD03-030_hand_hiddencheck_0001',
            cardId: 'GD03-030',
            cardData: JSON.parse(JSON.stringify(gd03.cards['GD03-030']))
        }];
        p1.deck._handUids = ['GD03-030_hand_hiddencheck_0001'];
        p1.deck.handUids = ['GD03-030_hand_hiddencheck_0001'];

        p2.deck.hand = [{
            carduid: 'GD01-016_opponent_hidden_0001',
            cardId: 'GD01-016',
            cardData: JSON.parse(JSON.stringify(gd01.cards['GD01-016']))
        }];
        p2.deck._handUids = ['GD01-016_opponent_hidden_0001'];
        p2.deck.handUids = ['GD01-016_opponent_hidden_0001'];

        const view = GameEnvViewBuilder.toPlayerView(gameEnv, 'playerId_1');
        const viewerHand = view?.players?.playerId_1?.deck?.hand;
        const opponentHand = view?.players?.playerId_2?.deck?.hand;

        expect(Array.isArray(viewerHand)).toBe(true);
        expect(viewerHand[0]?.cardData?.effectiveCost).toBeDefined();
        expect(Array.isArray(opponentHand)).toBe(true);
        expect(opponentHand).toHaveLength(0);
    });
});
