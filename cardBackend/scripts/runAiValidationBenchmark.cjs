const { runAiValidationBenchmark } = require('../src/tests/aiValidationHarness');

async function main() {
    const benchmark = await runAiValidationBenchmark({
        starterSetIds: ['ST01', 'ST04', 'ST08']
    });

    process.stdout.write(`${JSON.stringify(benchmark, null, 2)}\n`);
}

main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
        error: error instanceof Error ? error.message : String(error)
    }, null, 2)}\n`);
    process.exit(1);
});
