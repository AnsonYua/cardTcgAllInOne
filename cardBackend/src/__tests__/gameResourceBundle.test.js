const fs = require("fs");
const path = require("path");
const { gameController } = require("../controllers/gameController");
const { signResourceBundleToken } = require("../utils/ResourceBundleToken");

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
    this.body = Buffer.from(JSON.stringify(payload), "utf8");
    return this;
  }

  send(payload) {
    this.body = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), "utf8");
    return this;
  }
}

const TEST_SECRET = "resource-bundle-test-secret";

function parseMultipartManifest(buffer, boundary) {
  const text = buffer.toString("utf8");
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

function makeGameId() {
  return `bundle-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function loadScenarioEnv() {
  const scenarioPath = path.resolve(
    __dirname,
    "../../shared/testScenarios/gameStates/ST03/ST03-008/attack_ap_boost_self_only.json",
  );
  const raw = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));
  return raw?.initialGameEnv || raw?.gameEnv || raw?.scenario?.initialGameEnv || raw?.scenario?.gameEnv || raw;
}

async function injectScenario(gameId) {
  const req = { body: { gameId, gameEnv: loadScenarioEnv() } };
  const res = new MockResponse();
  await gameController.injectGameState(req, res);
  expect(res.statusCode).toBe(200);
}

async function getBundleToken(gameId, playerId = "playerId_1") {
  const req = {
    params: { playerId },
    query: { gameId },
  };
  const res = new MockResponse();
  await gameController.getPlayerData(req, res);
  expect(res.statusCode).toBe(200);
  expect(typeof res.jsonBody?.resourceBundleToken).toBe("string");
  return res.jsonBody.resourceBundleToken;
}

describe("Game resource bundle endpoint", () => {
  beforeAll(() => {
    process.env.RESOURCE_BUNDLE_SECRET = TEST_SECRET;
  });

  test("returns 409 when includeBothDecks is requested without submissions and fallback is disabled", async () => {
    const gameId = makeGameId();
    await injectScenario(gameId);
    const token = await getBundleToken(gameId);

    const req = {
      headers: { authorization: `Bearer ${token}` },
      body: { includePreviews: true, includeBothDecks: true, allowEnvScanFallback: false },
    };
    const res = new MockResponse();
    await gameController.getGameResourceBundle(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.jsonBody?.error).toBe("Deck data incomplete");
    expect(res.jsonBody?.pending).toBe(true);
    expect(Array.isArray(res.jsonBody?.missingPlayers)).toBe(true);
  });

  test("returns multipart bundle when includeBothDecks is pending but env-scan fallback is enabled", async () => {
    const gameId = makeGameId();
    await injectScenario(gameId);
    const token = await getBundleToken(gameId);

    const req = {
      headers: { authorization: `Bearer ${token}` },
      body: { includePreviews: false, includeBothDecks: true, allowEnvScanFallback: true },
    };
    const res = new MockResponse();
    await gameController.getGameResourceBundle(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^multipart\/mixed; boundary=/);
    expect(Buffer.isBuffer(res.body)).toBe(true);

    const boundary = res.headers["content-type"].split("boundary=")[1];
    const manifest = parseMultipartManifest(res.body, boundary);
    expect(manifest).toHaveProperty("version", 1);
    expect(Array.isArray(manifest.images)).toBe(true);
    expect(manifest.images.length).toBeGreaterThan(0);
  });

  test("returns 401 for invalid resource bundle token", async () => {
    const req = {
      headers: { authorization: "Bearer invalid.token.value" },
      body: { includeBothDecks: true, allowEnvScanFallback: true },
    };
    const res = new MockResponse();
    await gameController.getGameResourceBundle(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.jsonBody?.error).toBe("Invalid or expired resource bundle token");
  });

  test("returns 404 when token is valid but game does not exist", async () => {
    const token = signResourceBundleToken(
      {
        gameId: `missing-${Date.now()}`,
        playerId: "playerId_1",
        exp: Math.floor(Date.now() / 1000) + 600,
      },
      TEST_SECRET,
    );

    const req = {
      headers: { authorization: `Bearer ${token}` },
      body: { includeBothDecks: true, allowEnvScanFallback: true },
    };
    const res = new MockResponse();
    await gameController.getGameResourceBundle(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.jsonBody?.error).toBe("Game not found");
  });
});
