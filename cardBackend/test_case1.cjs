// Back-compat entrypoint for older scripts.
// Usage: node test_case1.cjs ActionCase/GD03-015/activate_exile_3_titans_then_grant_breach_4.json

const scenarioPath = process.argv[2];
if (!scenarioPath) {
  console.error('Usage: node test_case1.cjs <scenarioPath>');
  process.exit(1);
}

process.argv = [process.argv[0], process.argv[1], 'run', scenarioPath].concat(process.argv.slice(3));
require('./src/tests/dynamicTest.js');

