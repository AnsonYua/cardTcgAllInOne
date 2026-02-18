const crypto = require('crypto');
const topDeckService = require('../services/TopDeckService');
const { gameController } = require('../controllers/gameController');

class MockResponse {
    constructor() {
        this.statusCode = 200;
        this.jsonBody = null;
    }

    status(code) {
        this.statusCode = code;
        return this;
    }

    json(payload) {
        this.jsonBody = payload;
        return this;
    }
}

describe('POST /api/game/player/submitDeck (topDeck override)', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('submits a top deck by name', async () => {
        jest.spyOn(topDeckService, 'loadTopDecksFromFile').mockResolvedValue([
            {
                id: 'rw-providence',
                name: 'RW Providence',
                entries: [{ id: 'GD01-050', qty: 4 }],
                cardCount: 4,
            },
        ]);

        const req = {
            body: {
                gameId: 'g1',
                playerId: 'p1',
                topDeck: 'RW Providence',
            },
        };
        const res = new MockResponse();
        await gameController.submitDeck(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.jsonBody).toBeTruthy();
        expect(res.jsonBody.success).toBe(true);
        expect(res.jsonBody.deckCount).toBe(4);
        expect(typeof res.jsonBody.deckHash).toBe('string');
    });

    test('returns 400 for unknown top deck', async () => {
        jest.spyOn(topDeckService, 'loadTopDecksFromFile').mockResolvedValue([
            {
                id: 'rw-providence',
                name: 'RW Providence',
                entries: [{ id: 'GD01-050', qty: 4 }],
                cardCount: 4,
            },
        ]);

        const req = {
            body: {
                gameId: 'g1',
                playerId: 'p1',
                topDeck: 'does-not-exist',
            },
        };
        const res = new MockResponse();
        await gameController.submitDeck(req, res);

        expect(res.statusCode).toBe(400);
        expect(res.jsonBody).toBeTruthy();
        expect(String(res.jsonBody.error || '')).toMatch(/Unknown top deck/i);
    });

    test('topDeck wins when both topDeck and deck are provided', async () => {
        jest.spyOn(topDeckService, 'loadTopDecksFromFile').mockResolvedValue([
            {
                id: 'rw-providence',
                name: 'RW Providence',
                entries: [{ id: 'GD01-050', qty: 4 }],
                cardCount: 4,
            },
        ]);

        const req = {
            body: {
                gameId: 'g1',
                playerId: 'p1',
                topDeck: 'rw providence', // case-insensitive match
                deck: [{ id: 'GD01-999', qty: 99 }],
            },
        };
        const res = new MockResponse();
        await gameController.submitDeck(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.jsonBody.success).toBe(true);
        expect(res.jsonBody.deckCount).toBe(4);

        const expectedHashPayload = 'GD01-050:4';
        const expectedDeckHash = crypto.createHash('sha1').update(expectedHashPayload).digest('hex');
        expect(res.jsonBody.deckHash).toBe(expectedDeckHash);
    });
});

