const fs = require('fs');
const path = require('path');

function repoRootFromBackend() {
  return path.resolve(__dirname, '../../..');
}

function sharedGameStatesRoot() {
  return path.join(repoRootFromBackend(), 'shared', 'testScenarios', 'gameStates');
}

function resolveScenarioFilePath(relativeScenarioPath) {
  if (!relativeScenarioPath || typeof relativeScenarioPath !== 'string') {
    throw new Error('scenarioPath is required');
  }

  const normalized = relativeScenarioPath.replace(/^\/+/, '');
  const candidate = path.join(sharedGameStatesRoot(), normalized);
  return candidate;
}

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function validateScenarioShape(scenario, filePathForErrors) {
  const fileLabel = filePathForErrors || 'scenario';

  if (!scenario || typeof scenario !== 'object') {
    throw new Error(`${fileLabel}: expected JSON object`);
  }
  if (typeof scenario.description !== 'string') {
    throw new Error(`${fileLabel}: missing description`);
  }
  if (typeof scenario.gameId !== 'string') {
    throw new Error(`${fileLabel}: missing gameId`);
  }
  if (scenario.testType !== 'action') {
    throw new Error(`${fileLabel}: expected testType="action"`);
  }
  if (!scenario.initialGameEnv || typeof scenario.initialGameEnv !== 'object') {
    throw new Error(`${fileLabel}: missing initialGameEnv`);
  }

  const env = scenario.initialGameEnv;
  if (typeof env.currentPlayer !== 'string') {
    throw new Error(`${fileLabel}: initialGameEnv.currentPlayer must be a string`);
  }
  if (!Array.isArray(env.processingQueue)) {
    throw new Error(`${fileLabel}: initialGameEnv.processingQueue must be an array`);
  }
  if (!Array.isArray(env.notificationQueue)) {
    throw new Error(`${fileLabel}: initialGameEnv.notificationQueue must be an array`);
  }

  if (process.env.STRICT_NOTIFICATION_SEED === '1') {
    const seed = env.notificationQueue.find(e => e && e.type === 'CARD_DRAWN');
    if (!seed || !seed.payload || seed.payload.playerId !== env.currentPlayer) {
      throw new Error(`${fileLabel}: notificationQueue must include a CARD_DRAWN seed where payload.playerId === currentPlayer`);
    }
  }
}

function listScenarioFiles(rootDir) {
  const out = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const dir = stack.pop();
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.json')) {
        out.push(abs);
      }
    }
  }

  out.sort();
  return out;
}

module.exports = {
  sharedGameStatesRoot,
  resolveScenarioFilePath,
  loadJson,
  validateScenarioShape,
  listScenarioFiles
};
