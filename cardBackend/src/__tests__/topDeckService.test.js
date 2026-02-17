const { parseTopDeckMarkdown } = require('../services/TopDeckService');

describe('TopDeckService.parseTopDeckMarkdown', () => {
    test('parses deck blocks and computes cardCount', () => {
        const input = `
RW Providence
4xGD01-050
2xST04-006

PB Barbatos
1xGD01-100
4xST02-016
`;
        const decks = parseTopDeckMarkdown(input);

        expect(decks).toHaveLength(2);
        expect(decks[0].name).toBe('RW Providence');
        expect(decks[0].id).toBe('rw-providence');
        expect(decks[0].cardCount).toBe(6);
        expect(decks[0].entries).toEqual([
            { id: 'GD01-050', qty: 4 },
            { id: 'ST04-006', qty: 2 },
        ]);
    });

    test('merges duplicate ids and ignores malformed lines', () => {
        const input = `
Deck A
1xGD01-050
BAD-LINE
2xGD01-050
3xst04-006

Deck B
invalid
`;
        const decks = parseTopDeckMarkdown(input);

        expect(decks).toHaveLength(1);
        expect(decks[0].name).toBe('Deck A');
        expect(decks[0].cardCount).toBe(6);
        expect(decks[0].entries).toEqual([
            { id: 'GD01-050', qty: 3 },
            { id: 'ST04-006', qty: 3 },
        ]);
    });
});
