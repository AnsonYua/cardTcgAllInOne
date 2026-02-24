const path = require('path');
const fs = require('fs');
const os = require('os');
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

  test('optional exile "if you do" detector flags missing cost-gated schema', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'effect-alignment-'));
    const dataDir = path.join(tempDir, 'src', 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    const fixture = {
      cards: {
        T001: {
          id: 'T001',
          name: 'Mismatch Fixture',
          cardType: 'unit',
          effects: {
            description: [
              '【Deploy】You may choose 2 (Titans) cards from your trash. Exile them from the game. If you do, choose 1 enemy Unit that is Lv.4 or lower. Rest it.'
            ],
            rules: [
              {
                effectId: 'deploy_rest',
                type: 'triggered',
                trigger: 'ENTERS_PLAY',
                action: 'rest',
                target: {
                  type: 'unit',
                  scope: 'opponent',
                  filters: { level: '<=4', traits: ['Titans'] },
                  count: 2
                }
              }
            ]
          }
        }
      }
    };

    fs.writeFileSync(path.join(dataDir, 'fixtureCard.json'), `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');

    const report = generateEffectAlignmentReport(tempDir, { cardFiles: ['fixtureCard.json'] });
    const optionalIssues = report.issues.filter((issue) => issue.category === 'optional-exile-if-you-do-mismatch');

    expect(optionalIssues.length).toBeGreaterThan(0);
    expect(optionalIssues.some((issue) => issue.cardId === 'T001')).toBe(true);
  });

  test('optional exile "if you do" detector stays clean for fixed GD03-009', () => {
    const baseDir = path.resolve(__dirname, '..', '..');
    const report = generateEffectAlignmentReport(baseDir);
    const optionalIssues = report.issues.filter((issue) => issue.category === 'optional-exile-if-you-do-mismatch');
    const gd03009Issues = optionalIssues.filter((issue) => issue.cardId === 'GD03-009');

    expect(gd03009Issues).toHaveLength(0);
  });

  test('branch-incomplete detector allows optional-step fallback conditional pattern', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'effect-alignment-branch-fallback-'));
    const dataDir = path.join(tempDir, 'src', 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    const fixture = {
      cards: {
        T102: {
          id: 'T102',
          name: 'Optional fallback fixture',
          cardType: 'command',
          effects: {
            description: ['Choose 1 of your Units/Bases. It recovers 2 HP.'],
            rules: [
              {
                effectId: 'play_effect',
                type: 'play',
                action: 'sequence',
                parameters: {
                  steps: [
                    {
                      stepId: 'heal_unit',
                      action: 'heal',
                      optional: true,
                      target: { type: 'unit', scope: 'self', count: 1 },
                      parameters: { value: 2 }
                    },
                    {
                      action: 'conditional',
                      parameters: {
                        if: [{ type: 'stepResolved', stepId: 'heal_unit' }],
                        then: [],
                        else: [
                          {
                            action: 'heal',
                            target: { type: 'base', scope: 'self', count: 1 },
                            parameters: { value: 2 }
                          }
                        ]
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    };

    fs.writeFileSync(path.join(dataDir, 'fixtureCard.json'), `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');

    const report = generateEffectAlignmentReport(tempDir, { cardFiles: ['fixtureCard.json'] });
    const branchIssues = report.issues.filter((issue) => issue.category === 'branch-incomplete');
    expect(branchIssues.some((issue) => issue.cardId === 'T102')).toBe(false);
  });

  test('pilot-level detector flags pilot text mapped to pairedUnitLevel-only schema', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'effect-alignment-pilot-level-'));
    const dataDir = path.join(tempDir, 'src', 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    const fixture = {
      cards: {
        T100: {
          id: 'T100',
          name: 'Pilot Level Mismatch Fixture',
          cardType: 'command',
          effects: {
            description: [
              '【Main】【Action】Choose 1 Pilot that is Lv.5 or lower paired with an enemy Unit. Destroy it.'
            ],
            rules: [
              {
                effectId: 'play_effect',
                type: 'play',
                timing: {
                  windows: ['MAIN_PHASE', 'ACTION_STEP']
                },
                action: 'sequence',
                parameters: {
                  steps: [
                    {
                      action: 'destroy',
                      target: {
                        type: 'card',
                        scope: 'opponent',
                        count: 1,
                        filters: {
                          cardType: 'pilot',
                          pairedUnitLevel: '<=5'
                        }
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    };

    fs.writeFileSync(path.join(dataDir, 'fixtureCard.json'), `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');

    const report = generateEffectAlignmentReport(tempDir, { cardFiles: ['fixtureCard.json'] });
    const pilotIssues = report.issues.filter((issue) => issue.category === 'pilot-level-filter-mismatch');
    expect(pilotIssues.some((issue) => issue.cardId === 'T100')).toBe(true);
  });

  test('pilot-level detector stays clean when description and schema both constrain pilot level', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'effect-alignment-pilot-level-clean-'));
    const dataDir = path.join(tempDir, 'src', 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    const fixture = {
      cards: {
        T101: {
          id: 'T101',
          name: 'Pilot Level Clean Fixture',
          cardType: 'command',
          effects: {
            description: [
              '【Main】【Action】Choose 1 Pilot that is Lv.5 or lower paired with an enemy Unit. Destroy it.'
            ],
            rules: [
              {
                effectId: 'play_effect',
                type: 'play',
                timing: {
                  windows: ['MAIN_PHASE', 'ACTION_STEP']
                },
                action: 'sequence',
                parameters: {
                  steps: [
                    {
                      action: 'destroy',
                      target: {
                        type: 'card',
                        scope: 'opponent',
                        count: 1,
                        filters: {
                          cardType: 'pilot',
                          level: '<=5',
                          pairedUnitLevel: '>=0'
                        }
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    };

    fs.writeFileSync(path.join(dataDir, 'fixtureCard.json'), `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');

    const report = generateEffectAlignmentReport(tempDir, { cardFiles: ['fixtureCard.json'] });
    const pilotIssues = report.issues.filter((issue) => issue.category === 'pilot-level-filter-mismatch');
    expect(pilotIssues).toHaveLength(0);
  });

  test('pilot self-attacker detector flags risky battle-destroy pilot rules when engine support is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'effect-alignment-pilot-self-risk-'));
    const dataDir = path.join(tempDir, 'src', 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    const fixture = {
      cards: {
        T200: {
          id: 'T200',
          name: 'Pilot Self Risk Fixture',
          cardType: 'pilot',
          effects: {
            description: [
              'During your turn, when this Unit destroys an enemy Unit with battle damage, draw 1.'
            ],
            rules: [
              {
                effectId: 'during_battle_destroy',
                type: 'continuous',
                trigger: 'continuous',
                action: 'sequence',
                parameters: {
                  steps: [
                    {
                      action: 'conditional',
                      parameters: {
                        if: [
                          { type: 'eventType', value: 'BATTLE_DESTROY' },
                          { type: 'eventAttacker', value: 'self' }
                        ],
                        then: [{ action: 'draw', parameters: { value: 1 } }]
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    };

    fs.writeFileSync(path.join(dataDir, 'fixtureCard.json'), `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');

    const report = generateEffectAlignmentReport(tempDir, { cardFiles: ['fixtureCard.json'] });
    const riskIssues = report.issues.filter((issue) => issue.category === 'pilot-event-attacker-self-risk');
    expect(riskIssues.some((issue) => issue.cardId === 'T200')).toBe(true);
  });

  test('scry choice destination detector flags risk when interactive scry runtime support is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'effect-alignment-scry-risk-'));
    const dataDir = path.join(tempDir, 'src', 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    const fixture = {
      cards: {
        T201: {
          id: 'T201',
          name: 'Scry Choice Risk Fixture',
          cardType: 'pilot',
          effects: {
            description: [
              'Look at the top 2 cards of your deck, keep 1 on top, and put the other in trash.'
            ],
            rules: [
              {
                effectId: 'scry_risky',
                type: 'continuous',
                trigger: 'continuous',
                action: 'sequence',
                parameters: {
                  steps: [
                    {
                      action: 'scry_top_deck',
                      parameters: {
                        count: 2,
                        keep: 1,
                        choice: 'top_or_trash',
                        rest: 'trash'
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    };

    fs.writeFileSync(path.join(dataDir, 'fixtureCard.json'), `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');

    const report = generateEffectAlignmentReport(tempDir, { cardFiles: ['fixtureCard.json'] });
    const riskIssues = report.issues.filter((issue) => issue.category === 'scry-choice-destination-risk');
    expect(riskIssues.some((issue) => issue.cardId === 'T201')).toBe(true);
  });
});
