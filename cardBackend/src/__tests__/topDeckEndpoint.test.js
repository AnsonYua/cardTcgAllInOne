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

describe('GET /api/game/topDecks', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('returns success with non-empty deck list', async () => {
        jest.spyOn(topDeckService, 'loadTopDecksFromFile').mockResolvedValue([
            {
                id: 'rw-providence',
                name: 'RW Providence',
                entries: [{ id: 'GD01-050', qty: 4 }],
                cardCount: 4,
            },
        ]);

        const res = new MockResponse();
        await gameController.getTopDecks({}, res);

        expect(res.statusCode).toBe(200);
        expect(res.jsonBody).toBeTruthy();
        expect(res.jsonBody.success).toBe(true);
        expect(Array.isArray(res.jsonBody.decks)).toBe(true);
        expect(res.jsonBody.decks.length).toBeGreaterThan(0);
    });
});
