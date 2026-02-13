const { gameController } = require('../controllers/gameController');

class MockResponse {
    constructor() {
        this.statusCode = 200;
        this.headers = {};
        this.jsonBody = null;
        this.body = null;
    }

    status(code) {
        this.statusCode = code;
        return this;
    }

    setHeader(name, value) {
        this.headers[String(name).toLowerCase()] = value;
    }

    json(payload) {
        this.jsonBody = payload;
        this.body = Buffer.from(JSON.stringify(payload), 'utf8');
        return this;
    }

    send(payload) {
        this.body = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
        return this;
    }
}

function parseMultipartManifest(buffer, boundary) {
    const text = buffer.toString('utf8');
    const start = `--${boundary}\r\n`;
    expect(text.startsWith(start)).toBe(true);

    const manifestHeaderMarker = `Content-Type: application/json\r\nContent-Disposition: inline; name="manifest"\r\n\r\n`;
    const manifestStartIndex = text.indexOf(manifestHeaderMarker);
    expect(manifestStartIndex).toBeGreaterThanOrEqual(0);

    const manifestBodyStart = manifestStartIndex + manifestHeaderMarker.length;
    const nextBoundary = `\r\n--${boundary}\r\n`;
    const manifestEndIndex = text.indexOf(nextBoundary, manifestBodyStart);
    expect(manifestEndIndex).toBeGreaterThan(manifestBodyStart);

    const manifestJson = text.slice(manifestBodyStart, manifestEndIndex);
    return JSON.parse(manifestJson);
}

describe('Game resource bundle endpoint', () => {
    test('returns multipart bundle with manifest', async () => {
        const req = {
            headers: {},
            body: { includePreviews: false },
        };
        const res = new MockResponse();

        await gameController.getGameResourceBundle(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toMatch(/^multipart\/mixed; boundary=/);
        expect(Buffer.isBuffer(res.body)).toBe(true);

        const boundary = res.headers['content-type'].split('boundary=')[1];
        expect(boundary).toBeTruthy();

        const manifest = parseMultipartManifest(res.body, boundary);
        expect(manifest).toHaveProperty('version', 1);
        expect(Array.isArray(manifest.images)).toBe(true);
        expect(manifest.images.length).toBeGreaterThan(0);
    });
});

