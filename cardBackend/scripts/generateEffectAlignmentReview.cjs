const fs = require('fs');
const path = require('path');
const {
  generateEffectAlignmentReport,
  renderMarkdown,
  renderFixMap
} = require('../src/tests/review/effectAlignmentReview');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function main() {
  const baseDir = process.cwd();
  const outDir = path.join(baseDir, 'requirement', 'review');
  ensureDir(outDir);

  const report = generateEffectAlignmentReport(baseDir);
  const reportJsonPath = path.join(outDir, 'effect_alignment_report.json');
  const reportMdPath = path.join(outDir, 'effect_alignment_report.md');
  const fixMapPath = path.join(outDir, 'effect_alignment_fixmap.md');

  fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(reportMdPath, renderMarkdown(report), 'utf8');
  fs.writeFileSync(fixMapPath, renderFixMap(report), 'utf8');

  console.log(`Generated: ${reportJsonPath}`);
  console.log(`Generated: ${reportMdPath}`);
  console.log(`Generated: ${fixMapPath}`);
  console.log(`Issues: ${report.issues.length}`);
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
