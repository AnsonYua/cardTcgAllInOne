const path = require('path');
const {
  sharedGameStatesRoot,
  listScenarioFiles,
  loadJson,
  validateScenarioShape
} = require('./testScenarioUtils');

function usage() {
  console.log('Usage: node src/tests/runSingleTest.js <list|all|run> [scenarioPath]');
  console.log('Examples:');
  console.log('  node src/tests/runSingleTest.js list');
  console.log('  node src/tests/runSingleTest.js run ActionCase/GD03-015/activate_exile_3_titans_then_grant_breach_4.json');
  console.log('  node src/tests/runSingleTest.js all');
}

function listAll() {
  const files = listScenarioFiles(sharedGameStatesRoot());
  for (const file of files) {
    console.log(path.relative(sharedGameStatesRoot(), file));
  }
}

function runAll() {
  const files = listScenarioFiles(sharedGameStatesRoot());
  const failures = [];

  for (const file of files) {
    try {
      const scenario = loadJson(file);
      if (scenario && scenario.testType === 'action') {
        validateScenarioShape(scenario, path.relative(process.cwd(), file));
      }
    } catch (e) {
      failures.push({ file, error: e && e.message ? e.message : String(e) });
    }
  }

  if (failures.length > 0) {
    for (const f of failures) {
      console.error(`FAIL: ${path.relative(process.cwd(), f.file)}: ${f.error}`);
    }
    process.exit(1);
  }

  console.log('OK: all scenarios validated');
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'list') {
    listAll();
    return;
  }
  if (cmd === 'all') {
    runAll();
    return;
  }
  if (cmd === 'run') {
    const scenarioPath = args[1];
    // Delegate to dynamicTest with a consistent CLI shape.
    process.argv = [process.argv[0], process.argv[1], 'run', scenarioPath].concat(args.slice(2));
    require('./dynamicTest.js');
    return;
  }

  usage();
  process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
