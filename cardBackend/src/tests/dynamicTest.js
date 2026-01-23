const fs = require('fs');
const path = require('path');
const {
  sharedGameStatesRoot,
  resolveScenarioFilePath,
  loadJson,
  validateScenarioShape
} = require('./testScenarioUtils');

function usage() {
  console.log('Usage: node src/tests/dynamicTest.js run <scenarioPath> [--verbose]');
  console.log('Example: node src/tests/dynamicTest.js run ActionCase/GD03-015/activate_exile_3_titans_then_grant_breach_4.json');
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command !== 'run') {
    usage();
    process.exit(1);
  }

  const scenarioPath = args[1];
  const verbose = args.includes('--verbose');

  const filePath = resolveScenarioFilePath(scenarioPath);
  if (!fs.existsSync(filePath)) {
    console.error(`Scenario not found: ${filePath}`);
    console.error(`Root: ${sharedGameStatesRoot()}`);
    process.exit(1);
  }

  const scenario = loadJson(filePath);
  validateScenarioShape(scenario, path.relative(process.cwd(), filePath));

  if (verbose) {
    console.log(`OK: ${scenario.gameId}`);
    console.log(`File: ${path.relative(process.cwd(), filePath)}`);
    console.log(`Description: ${scenario.description}`);
  } else {
    console.log(`OK: ${scenario.gameId}`);
  }
}

try {
  main();
} catch (err) {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}

