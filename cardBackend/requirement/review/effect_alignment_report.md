# Effect Alignment Review Report

Generated at: 2026-02-20T11:53:50.549Z
Files scanned: 11
Cards scanned: 446
Rules scanned: 672
Issues: 112

## Summary by Severity

- P1: 6
- P2: 106

## Summary by Category

- duplicate-overlap: 1
- missing-condition: 5
- trigger-window-drift: 61
- target-constraint-drift: 44
- source-exclusion-consistency: 1

## Top Issues

### duplicate_overlap_gd03Card.json_GD03-106_0_1
- Severity: P1
- Confidence: 0.98
- Category: duplicate-overlap
- Card: gd03Card.json:GD03-106
- Rule Path: cards.GD03-106.effects.rules[0] <-> cards.GD03-106.effects.rules[1]
- Behavioral Risk: Effect can resolve more than once in the same timing window.
- Recommended Fix: Remove duplicate overlapping play rule and keep one canonical rule definition.

### missing_condition_gd01Card.json_GD01-027
- Severity: P1
- Confidence: 0.86
- Category: missing-condition
- Card: gd01Card.json:GD01-027
- Rule Path: cards.GD01-027.effects.rules[0], cards.GD01-027.effects.rules[1]
- Behavioral Risk: Text-declared conditional effect is not represented in executable schema.
- Recommended Fix: Model the text-declared IF branch using canonical condition objects and sequence conditional steps.

### missing_condition_gd03Card.json_GD03-101
- Severity: P1
- Confidence: 0.86
- Category: missing-condition
- Card: gd03Card.json:GD03-101
- Rule Path: cards.GD03-101.effects.rules[0]
- Behavioral Risk: Text-declared conditional effect is not represented in executable schema.
- Recommended Fix: Model the text-declared IF branch using canonical condition objects and sequence conditional steps.

### missing_condition_gd03Card.json_GD03-118
- Severity: P1
- Confidence: 0.86
- Category: missing-condition
- Card: gd03Card.json:GD03-118
- Rule Path: cards.GD03-118.effects.rules[0], cards.GD03-118.effects.rules[1]
- Behavioral Risk: Text-declared conditional effect is not represented in executable schema.
- Recommended Fix: Model the text-declared IF branch using canonical condition objects and sequence conditional steps.

### missing_condition_st02Card.json_ST02-016
- Severity: P1
- Confidence: 0.86
- Category: missing-condition
- Card: st02Card.json:ST02-016
- Rule Path: cards.ST02-016.effects.rules[0], cards.ST02-016.effects.rules[1]
- Behavioral Risk: Text-declared conditional effect is not represented in executable schema.
- Recommended Fix: Model the text-declared IF branch using canonical condition objects and sequence conditional steps.

### missing_condition_st07Card.json_ST07-009
- Severity: P1
- Confidence: 0.86
- Category: missing-condition
- Card: st07Card.json:ST07-009
- Rule Path: cards.ST07-009.effects.rules[0], cards.ST07-009.effects.rules[1]
- Behavioral Risk: Text-declared conditional effect is not represented in executable schema.
- Recommended Fix: Model the text-declared IF branch using canonical condition objects and sequence conditional steps.

### trigger_window_drift_gd01Card.json_GD01-002_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd01Card.json:GD01-002
- Rule Path: cards.GD01-002.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd01Card.json_GD01-002_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd01Card.json:GD01-002
- Rule Path: cards.GD01-002.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### target_constraint_drift_gd01Card.json_GD01-004_1
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd01Card.json:GD01-004
- Rule Path: cards.GD01-004.effects.rules[1]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd01Card.json_GD01-099_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd01Card.json:GD01-099
- Rule Path: cards.GD01-099.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd01Card.json_GD01-099_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd01Card.json:GD01-099
- Rule Path: cards.GD01-099.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd01Card.json_GD01-123_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd01Card.json:GD01-123
- Rule Path: cards.GD01-123.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd02Card.json_GD02-005_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd02Card.json:GD02-005
- Rule Path: cards.GD02-005.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd02Card.json_GD02-005_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd02Card.json:GD02-005
- Rule Path: cards.GD02-005.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd03Card.json_GD03-004_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-004
- Rule Path: cards.GD03-004.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd03Card.json_GD03-004_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd03Card.json:GD03-004
- Rule Path: cards.GD03-004.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd03Card.json_GD03-006_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-006
- Rule Path: cards.GD03-006.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd03Card.json_GD03-039_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-039
- Rule Path: cards.GD03-039.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd03Card.json_GD03-039_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd03Card.json:GD03-039
- Rule Path: cards.GD03-039.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd03Card.json_GD03-124_2
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-124
- Rule Path: cards.GD03-124.effects.rules[2]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_st01Card.json_ST01-004_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: st01Card.json:ST01-004
- Rule Path: cards.ST01-004.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_st01Card.json_ST01-004_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: st01Card.json:ST01-004
- Rule Path: cards.ST01-004.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### target_constraint_drift_st01Card.json_ST01-010_1
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: st01Card.json:ST01-010
- Rule Path: cards.ST01-010.effects.rules[1]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_st05Card.json_ST05-005_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: st05Card.json:ST05-005
- Rule Path: cards.ST05-005.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_st05Card.json_ST05-005_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: st05Card.json:ST05-005
- Rule Path: cards.ST05-005.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_st07Card.json_ST07-005_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: st07Card.json:ST07-005
- Rule Path: cards.ST07-005.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd01Card.json_GD01-008_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd01Card.json:GD01-008
- Rule Path: cards.GD01-008.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### target_constraint_drift_gd01Card.json_GD01-020_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd01Card.json:GD01-020
- Rule Path: cards.GD01-020.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd01Card.json_GD01-056_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd01Card.json:GD01-056
- Rule Path: cards.GD01-056.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd01Card.json_GD01-056_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd01Card.json:GD01-056
- Rule Path: cards.GD01-056.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd01Card.json_GD01-111_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd01Card.json:GD01-111
- Rule Path: cards.GD01-111.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd02Card.json_GD02-009_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd02Card.json:GD02-009
- Rule Path: cards.GD02-009.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd02Card.json_GD02-009_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd02Card.json:GD02-009
- Rule Path: cards.GD02-009.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### target_constraint_drift_gd02Card.json_GD02-046_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd02Card.json:GD02-046
- Rule Path: cards.GD02-046.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd03Card.json_GD03-018_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-018
- Rule Path: cards.GD03-018.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd03Card.json_GD03-018_1
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd03Card.json:GD03-018
- Rule Path: cards.GD03-018.effects.rules[1]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd03Card.json_GD03-033_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-033
- Rule Path: cards.GD03-033.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_st03Card.json_ST03-001_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: st03Card.json:ST03-001
- Rule Path: cards.ST03-001.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_st05Card.json_ST05-014_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: st05Card.json:ST05-014
- Rule Path: cards.ST05-014.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd01Card.json_GD01-049_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd01Card.json:GD01-049
- Rule Path: cards.GD01-049.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd03Card.json_GD03-023_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-023
- Rule Path: cards.GD03-023.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd03Card.json_GD03-023_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd03Card.json:GD03-023
- Rule Path: cards.GD03-023.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd01Card.json_GD01-124_2
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd01Card.json:GD01-124
- Rule Path: cards.GD01-124.effects.rules[2]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd01Card.json_GD01-027_1
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd01Card.json:GD01-027
- Rule Path: cards.GD01-027.effects.rules[1]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_st03Card.json_ST03-010_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: st03Card.json:ST03-010
- Rule Path: cards.ST03-010.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_st03Card.json_ST03-010_1
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: st03Card.json:ST03-010
- Rule Path: cards.ST03-010.effects.rules[1]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### target_constraint_drift_st06Card.json_ST06-007_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: st06Card.json:ST06-007
- Rule Path: cards.ST06-007.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd02Card.json_GD02-094_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd02Card.json:GD02-094
- Rule Path: cards.GD02-094.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_st03Card.json_ST03-006_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: st03Card.json:ST03-006
- Rule Path: cards.ST03-006.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd02Card.json_GD02-047_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd02Card.json:GD02-047
- Rule Path: cards.GD02-047.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd02Card.json_GD02-044_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd02Card.json:GD02-044
- Rule Path: cards.GD02-044.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd03Card.json_GD03-048_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-048
- Rule Path: cards.GD03-048.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd03Card.json_GD03-060_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-060
- Rule Path: cards.GD03-060.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd01Card.json_GD01-080_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd01Card.json:GD01-080
- Rule Path: cards.GD01-080.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd01Card.json_GD01-080_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd01Card.json:GD01-080
- Rule Path: cards.GD01-080.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### target_constraint_drift_gd03Card.json_GD03-075_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd03Card.json:GD03-075
- Rule Path: cards.GD03-075.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_st04Card.json_ST04-002_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: st04Card.json:ST04-002
- Rule Path: cards.ST04-002.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd01Card.json_GD01-120_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd01Card.json:GD01-120
- Rule Path: cards.GD01-120.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd03Card.json_GD03-095_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-095
- Rule Path: cards.GD03-095.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_st01Card.json_ST01-006_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: st01Card.json:ST01-006
- Rule Path: cards.ST01-006.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_st01Card.json_ST01-006_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: st01Card.json:ST01-006
- Rule Path: cards.ST01-006.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_st04Card.json_ST04-010_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: st04Card.json:ST04-010
- Rule Path: cards.ST04-010.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_st05Card.json_ST05-007_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: st05Card.json:ST05-007
- Rule Path: cards.ST05-007.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_st05Card.json_ST05-007_1
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: st05Card.json:ST05-007
- Rule Path: cards.ST05-007.effects.rules[1]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd03Card.json_GD03-096_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-096
- Rule Path: cards.GD03-096.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd02Card.json_GD02-008_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd02Card.json:GD02-008
- Rule Path: cards.GD02-008.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd02Card.json_GD02-008_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd02Card.json:GD02-008
- Rule Path: cards.GD02-008.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd01Card.json_GD01-103_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd01Card.json:GD01-103
- Rule Path: cards.GD01-103.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd01Card.json_GD01-103_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd01Card.json:GD01-103
- Rule Path: cards.GD01-103.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### target_constraint_drift_st02Card.json_ST02-014_1
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: st02Card.json:ST02-014
- Rule Path: cards.ST02-014.effects.rules[1]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_st01Card.json_ST01-013_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: st01Card.json:ST01-013
- Rule Path: cards.ST01-013.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_st01Card.json_ST01-013_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: st01Card.json:ST01-013
- Rule Path: cards.ST01-013.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd02Card.json_GD02-010_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd02Card.json:GD02-010
- Rule Path: cards.GD02-010.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd03Card.json_GD03-005_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-005
- Rule Path: cards.GD03-005.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd01Card.json_GD01-104_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd01Card.json:GD01-104
- Rule Path: cards.GD01-104.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd01Card.json_GD01-104_1
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd01Card.json:GD01-104
- Rule Path: cards.GD01-104.effects.rules[1]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### target_constraint_drift_gd01Card.json_GD01-111_1
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd01Card.json:GD01-111
- Rule Path: cards.GD01-111.effects.rules[1]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### target_constraint_drift_gd01Card.json_GD01-116_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd01Card.json:GD01-116
- Rule Path: cards.GD01-116.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd03Card.json_GD03-107_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-107
- Rule Path: cards.GD03-107.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd03Card.json_GD03-107_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd03Card.json:GD03-107
- Rule Path: cards.GD03-107.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_st01Card.json_ST01-012_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: st01Card.json:ST01-012
- Rule Path: cards.ST01-012.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_st01Card.json_ST01-012_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: st01Card.json:ST01-012
- Rule Path: cards.ST01-012.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_st02Card.json_ST02-002_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: st02Card.json:ST02-002
- Rule Path: cards.ST02-002.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd01Card.json_GD01-113_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd01Card.json:GD01-113
- Rule Path: cards.GD01-113.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### target_constraint_drift_gd02Card.json_GD02-102_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd02Card.json:GD02-102
- Rule Path: cards.GD02-102.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### target_constraint_drift_gd02Card.json_GD02-115_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd02Card.json:GD02-115
- Rule Path: cards.GD02-115.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd02Card.json_GD02-118_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd02Card.json:GD02-118
- Rule Path: cards.GD02-118.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd02Card.json_GD02-118_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd02Card.json:GD02-118
- Rule Path: cards.GD02-118.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### target_constraint_drift_st04Card.json_ST04-013_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: st04Card.json:ST04-013
- Rule Path: cards.ST04-013.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd02Card.json_GD02-119_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd02Card.json:GD02-119
- Rule Path: cards.GD02-119.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd02Card.json_GD02-119_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd02Card.json:GD02-119
- Rule Path: cards.GD02-119.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### target_constraint_drift_st01Card.json_ST01-014_1
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: st01Card.json:ST01-014
- Rule Path: cards.ST01-014.effects.rules[1]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_st08Card.json_ST08-013_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: st08Card.json:ST08-013
- Rule Path: cards.ST08-013.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd03Card.json_GD03-100_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-100
- Rule Path: cards.GD03-100.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd02Card.json_GD02-089_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd02Card.json:GD02-089
- Rule Path: cards.GD02-089.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd02Card.json_GD02-089_1
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd02Card.json:GD02-089
- Rule Path: cards.GD02-089.effects.rules[1]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd02Card.json_GD02-039_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd02Card.json:GD02-039
- Rule Path: cards.GD02-039.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd02Card.json_GD02-107_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd02Card.json:GD02-107
- Rule Path: cards.GD02-107.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd02Card.json_GD02-111_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd02Card.json:GD02-111
- Rule Path: cards.GD02-111.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd02Card.json_GD02-126_2
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd02Card.json:GD02-126
- Rule Path: cards.GD02-126.effects.rules[2]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd03Card.json_GD03-001_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-001
- Rule Path: cards.GD03-001.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd03Card.json_GD03-043_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-043
- Rule Path: cards.GD03-043.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd03Card.json_GD03-037_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-037
- Rule Path: cards.GD03-037.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_st05Card.json_ST05-010_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: st05Card.json:ST05-010
- Rule Path: cards.ST05-010.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd03Card.json_GD03-123_1
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-123
- Rule Path: cards.GD03-123.effects.rules[1]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_gd03Card.json_GD03-123_1
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: gd03Card.json:GD03-123
- Rule Path: cards.GD03-123.effects.rules[1]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### trigger_window_drift_gd02Card.json_GD02-103_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd02Card.json:GD02-103
- Rule Path: cards.GD02-103.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd02Card.json_GD02-117_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd02Card.json:GD02-117
- Rule Path: cards.GD02-117.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd03Card.json_GD03-017_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-017
- Rule Path: cards.GD03-017.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### trigger_window_drift_gd03Card.json_GD03-103_0
- Severity: P2
- Confidence: 0.73
- Category: trigger-window-drift
- Card: gd03Card.json:GD03-103
- Rule Path: cards.GD03-103.effects.rules[0]
- Behavioral Risk: Behavior-equivalent rules execute in different phases/timings.
- Recommended Fix: Align trigger/timing windows with canonical family variant unless text requires divergence.

### target_constraint_drift_st06Card.json_ST06-003_0
- Severity: P2
- Confidence: 0.76
- Category: target-constraint-drift
- Card: st06Card.json:ST06-003
- Rule Path: cards.ST06-003.effects.rules[0]
- Behavioral Risk: Equivalent behavior family has inconsistent target constraints.
- Recommended Fix: Align target filter constraints or explicitly document intentional difference.

### source_exclusion_consistency_gd02Card.json_GD02-116_0
- Severity: P2
- Confidence: 0.74
- Category: source-exclusion-consistency
- Card: gd02Card.json:GD02-116
- Rule Path: cards.GD02-116.effects.rules[0]
- Behavioral Risk: Similar trash-count effects may count source card inconsistently.
- Recommended Fix: Standardize excludeSourceCard usage within the same behavior family.

