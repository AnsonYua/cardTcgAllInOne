const path = require('path');
const {
  extractRuleFeatures,
  buildInventory,
  clusterInventory,
  generateEffectAlignmentReport
} = require('../tests/review/effectAlignmentReview');

describe('Effect alignment review tooling', () => {
  test('extractRuleFeatures is deterministic for equivalent rule objects', () => {
    const ruleA = {
      effectId: 'play_effect',
      type: 'play',
      trigger: 'MAIN_PHASE',
      action: 'sequence',
      timing: { windows: ['MAIN_PHASE', 'ACTION_STEP'] },
      target: {
        type: 'unit',
        scope: 'opponent',
        count: 1,
        filters: { level: '<=4', status: 'active' }
      },
      parameters: {
        steps: [
          {
            action: 'conditional',
            parameters: {
              if: [{ type: 'cardsInTrash', value: '>=10' }],
              then: [{ action: 'destroy' }],
              else: [{ action: 'destroy' }]
            }
          }
        ]
      }
    };

    const ruleB = JSON.parse(JSON.stringify(ruleA));
    const left = extractRuleFeatures(ruleA);
    const right = extractRuleFeatures(ruleB);

    expect(left.behaviorCoreKey).toBe(right.behaviorCoreKey);
    expect(left.schemaVariantKey).toBe(right.schemaVariantKey);
    expect(left.sequenceShapeKey).toBe(right.sequenceShapeKey);
  });

  test('clusterInventory groups members by behavior core and tracks variant count', () => {
    const rows = [
      {
        behaviorCoreKey: 'A',
        schemaVariantKey: 'A1',
        file: 'f1',
        cardId: 'C1',
        cardName: 'Name1',
        rulePath: 'cards.C1.effects.rules[0]',
        effectId: 'play_effect'
      },
      {
        behaviorCoreKey: 'A',
        schemaVariantKey: 'A2',
        file: 'f2',
        cardId: 'C2',
        cardName: 'Name2',
        rulePath: 'cards.C2.effects.rules[0]',
        effectId: 'play_effect'
      },
      {
        behaviorCoreKey: 'B',
        schemaVariantKey: 'B1',
        file: 'f3',
        cardId: 'C3',
        cardName: 'Name3',
        rulePath: 'cards.C3.effects.rules[0]',
        effectId: 'play_effect'
      }
    ];

    const clusters = clusterInventory(rows);
    const clusterA = clusters.find((cluster) => cluster.coreKey === 'A');
    const clusterB = clusters.find((cluster) => cluster.coreKey === 'B');

    expect(clusterA).toBeDefined();
    expect(clusterA.memberCount).toBe(2);
    expect(clusterA.variantCount).toBe(2);
    expect(clusterB).toBeDefined();
    expect(clusterB.memberCount).toBe(1);
    expect(clusterB.variantCount).toBe(1);
  });

  test('generateEffectAlignmentReport scans all target files and reports seeded mismatches', () => {
    const baseDir = path.resolve(__dirname, '..', '..');
    const report = generateEffectAlignmentReport(baseDir);

    expect(report.filesScanned.length).toBe(11);
    expect(report.cardsScanned).toBeGreaterThan(0);
    expect(report.rulesScanned).toBeGreaterThan(0);
    expect(Array.isArray(report.issues)).toBe(true);

    const hasP1 = report.issues.some((issue) => issue.severity === 'P1' || issue.severity === 'P0');
    expect(hasP1).toBe(false);
    expect(report.manifest).toBeDefined();
  });

  test('buildInventory is deterministic across repeated scans', () => {
    const baseDir = path.resolve(__dirname, '..', '..');
    const first = buildInventory(baseDir);
    const second = buildInventory(baseDir);
    expect(first.length).toBe(second.length);
    expect(first[0].behaviorCoreKey).toBe(second[0].behaviorCoreKey);
    expect(first[first.length - 1].schemaVariantKey).toBe(second[second.length - 1].schemaVariantKey);
  });

  test('missing-condition detector does not flag conditional branches represented by branches/conditionalTokenDeploy', () => {
    const baseDir = path.resolve(__dirname, '..', '..');
    const report = generateEffectAlignmentReport(baseDir);
    const missingConditionCards = new Set(
      report.issues
        .filter((issue) => issue.category === 'missing-condition')
        .map((issue) => issue.cardId)
    );

    expect(missingConditionCards.has('ST07-009')).toBe(false);
    expect(missingConditionCards.has('ST02-016')).toBe(false);
  });
});
