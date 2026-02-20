const path = require('path');
const { buildUnresolvedCatalog } = require('../tests/review/unresolvedEffectCatalog');

describe('unresolved effect catalog', () => {
  test('catalog generation is deterministic and includes all target files', () => {
    const baseDir = path.resolve(__dirname, '..', '..');
    const first = buildUnresolvedCatalog(baseDir);
    const second = buildUnresolvedCatalog(baseDir);

    expect(first.total).toBe(second.total);
    expect(first.filesScanned).toHaveLength(11);
    if (first.entries.length > 0) {
      expect(first.entries[0].issueId).toBe(second.entries[0].issueId);
    } else {
      expect(second.entries).toHaveLength(0);
    }
  });

  test('catalog entries include owner module and feature family', () => {
    const baseDir = path.resolve(__dirname, '..', '..');
    const catalog = buildUnresolvedCatalog(baseDir);

    expect(catalog.total).toBeGreaterThanOrEqual(0);
    for (const entry of catalog.entries.slice(0, 30)) {
      expect(typeof entry.ownerModule).toBe('string');
      expect(entry.ownerModule.length).toBeGreaterThan(0);
      expect(typeof entry.featureFamily).toBe('string');
      expect(entry.featureFamily.length).toBeGreaterThan(0);
    }
  });
});
