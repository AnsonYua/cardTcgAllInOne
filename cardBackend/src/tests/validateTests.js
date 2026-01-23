const path = require('path');
const {
  sharedGameStatesRoot,
  listScenarioFiles,
  loadJson,
  validateScenarioShape
} = require('./testScenarioUtils');

function main() {
  const root = sharedGameStatesRoot();
  const files = listScenarioFiles(root);

  for (const file of files) {
    const scenario = loadJson(file);
    if (scenario && scenario.testType === 'action') {
      validateScenarioShape(scenario, path.relative(process.cwd(), file));
    }
  }

  console.log('OK: action scenarios validated');
}

try {
  main();
} catch (err) {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}

