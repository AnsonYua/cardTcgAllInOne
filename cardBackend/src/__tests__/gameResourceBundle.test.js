const fs = require("fs");
const path = require("path");
const { gameController } = require("../controllers/gameController");
const { signResourceBundleToken } = require("../utils/ResourceBundleToken");
const { deckSubmissionService } = require("../services/DeckSubmissionService");

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

function imageKeysFromManifest(manifest) {
  return Array.isArray(manifest?.images) ? manifest.images.map((entry) => entry?.key).filter(Boolean) : [];
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

function loadTokenFallbackEnv() {
  const env = JSON.parse(JSON.stringify(loadScenarioEnv()));
  env.players = env.players || {};
  env.players.playerId_1 = env.players.playerId_1 || { zones: {} };
  env.players.playerId_1.zones = env.players.playerId_1.zones || {};
  env.players.playerId_1.zones.slot1 = env.players.playerId_1.zones.slot1 || {};
  env.players.playerId_1.zones.slot1.unit = {
    carduid: "T-006_token_test_0001",
    cardId: "T-006",
    cardData: {
      id: "T-006",
      name: "Char’s Zaku II",
      cardType: "unit",
      color: "Token",
      ap: 3,
      hp: 1,
    },
  };
  return env;
}

function loadGd03LinkedHyGoggEnv() {
  const scenarioPath = path.resolve(
    __dirname,
    "../../shared/testScenarios/gameStates/GD03/GD03-024/when_linked_deploy_hy_gogg_token_if_cyclops_ge_2.json",
  );
  const raw = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));
  return raw?.initialGameEnv || raw?.gameEnv || raw?.scenario?.initialGameEnv || raw?.scenario?.gameEnv || raw;
}

async function injectScenario(gameId, gameEnv = loadScenarioEnv()) {
  const req = { body: { gameId, gameEnv } };
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

  test("includes token textures (with previews) and avoids marking token missing when token is in play", async () => {
    const gameId = makeGameId();
    await injectScenario(gameId, loadTokenFallbackEnv());
    const token = await getBundleToken(gameId);

    const req = {
      headers: { authorization: `Bearer ${token}` },
      body: { includePreviews: true, includeBothDecks: true, allowEnvScanFallback: true },
    };
    const res = new MockResponse();
    await gameController.getGameResourceBundle(req, res);

    expect(res.statusCode).toBe(200);
    const boundary = res.headers["content-type"].split("boundary=")[1];
    const manifest = parseMultipartManifest(res.body, boundary);
    const imageKeys = imageKeysFromManifest(manifest);
    expect(imageKeys).toContain("T-006");
    expect(imageKeys).toContain("T-006-preview");
    expect(Array.isArray(manifest.missing)).toBe(true);
    expect(manifest.missing.some((entry) => entry?.key === "T-006")).toBe(false);
  });

  test("discovers T-022 from GD03-024 effect in current env even when includeBothDecks uses submitted decks", async () => {
    const gameId = makeGameId();
    await injectScenario(gameId, loadGd03LinkedHyGoggEnv());

    // Submit complete decks that intentionally do not include GD03-024 so the endpoint
    // would miss T-022 without env-resource unioning.
    deckSubmissionService.submitDeck(gameId, "playerId_1", [
      { id: "ST03-001", qty: 1 },
      { id: "ST03-002", qty: 1 },
    ]);
    deckSubmissionService.submitDeck(gameId, "playerId_2", [
      { id: "ST03-003", qty: 1 },
      { id: "ST03-004", qty: 1 },
    ]);

    const token = await getBundleToken(gameId);
    const req = {
      headers: { authorization: `Bearer ${token}` },
      body: { includePreviews: false, includeBothDecks: true, allowEnvScanFallback: true },
    };
    const res = new MockResponse();
    await gameController.getGameResourceBundle(req, res);

    expect(res.statusCode).toBe(200);
    const boundary = res.headers["content-type"].split("boundary=")[1];
    const manifest = parseMultipartManifest(res.body, boundary);
    const imageKeys = imageKeysFromManifest(manifest);

    // T-022 art may be absent in this repo; verify discovery via either image inclusion or missing manifest entry.
    const missingKeys = Array.isArray(manifest.missing) ? manifest.missing.map((entry) => entry?.key).filter(Boolean) : [];
    expect(imageKeys.includes("T-022") || missingKeys.includes("T-022")).toBe(true);
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
