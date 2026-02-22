const path = require('path');
const {
  sharedGameStatesRoot,
  listScenarioFiles,
  loadJson,
  validateScenarioShape
} = require('./testScenarioUtils');
const {
  validateBurstChoiceDoesNotOverrideCurrentPlayer
} = require('./validators/burstChoiceTurnSnapshotValidation');
const {
  validateBurstChoiceGroupNotification
} = require('./validators/burstChoiceGroupNotificationValidation');
const {
  validateUnitPairingRestrictions
} = require('./validators/unitPairingRestrictionValidation');
const {
  validateBlockerDetection
} = require('./validators/blockerDetectionValidation');
const {
  validateSetActiveDoesNotRequireChoice
} = require('./validators/setActiveChoicePolicyValidation');
const {
  validateSt06013AllowsOneToTwoTargets
} = require('./validators/st06013TargetChoiceValidation');
const {
  validateTargetChoiceNotificationIncludesTargetCount
} = require('./validators/targetChoiceCountRangeNotificationValidation');
const {
  validateTargetChoiceResolvedUpdatesExistingNotification
} = require('./validators/targetChoiceResolvedNotificationMergeValidation');
const {
  validateNormalizeEffectRulePreservesCountRange
} = require('./validators/normalizeTargetCountRangeValidation');
const {
  validateActionStepTargetScan
} = require('./validators/actionStepTargetScanValidation');
const {
  validateDestroyedDrawNotificationsComeAfterBattleResolved
} = require('./validators/battleDestroyedNotificationOrderingValidation');
const {
  validateDelayedSetActiveExcludesDestroyedUnit
} = require('./validators/delayedSetActiveExcludesDestroyedUnitValidation');
const {
  validateGd02069DuringLinkActivatedAbility
} = require('./validators/gd02069DuringLinkActivatedAbilityValidation');
const {
  validateGd03079RestBaseReplacement
} = require('./validators/gd03079RestBaseReplacementValidation');
const {
  validateAllowAttackTargetSchema
} = require('./validators/allowAttackTargetSchemaValidation');
const {
  validateEffectSchemaCanonical
} = require('./validators/effectSchemaCanonicalValidation');
const {
  validateBattleSimultaneousDestroyOrder
} = require('./validators/battleSimultaneousDestroyOrderValidation');
const {
  validateEffectDamageImmediateDestroyed
} = require('./validators/effectDamageImmediateDestroyedValidation');
const {
  validateEffectDestroyImmediate
} = require('./validators/effectDestroyImmediateValidation');
const {
  validateSlotTotalHpLethal
} = require('./validators/slotTotalHpLethalValidation');

function main() {
  const root = sharedGameStatesRoot();
  const files = listScenarioFiles(root);

  for (const file of files) {
    const scenario = loadJson(file);
    if (scenario && scenario.testType === 'action') {
      validateScenarioShape(scenario, path.relative(process.cwd(), file));
    }
  }

  validateBurstChoiceDoesNotOverrideCurrentPlayer();
  validateBurstChoiceGroupNotification();
  validateUnitPairingRestrictions();
  validateBlockerDetection();
  validateSetActiveDoesNotRequireChoice();
  validateSt06013AllowsOneToTwoTargets();
  validateTargetChoiceNotificationIncludesTargetCount();
  validateTargetChoiceResolvedUpdatesExistingNotification();
  validateNormalizeEffectRulePreservesCountRange();
  validateActionStepTargetScan();
  validateDestroyedDrawNotificationsComeAfterBattleResolved();
  validateDelayedSetActiveExcludesDestroyedUnit();
  validateGd02069DuringLinkActivatedAbility();
  validateGd03079RestBaseReplacement();
  validateAllowAttackTargetSchema();
  validateBattleSimultaneousDestroyOrder();
  validateEffectDamageImmediateDestroyed();
  validateEffectDestroyImmediate();
  validateSlotTotalHpLethal();
  validateEffectSchemaCanonical();

  console.log('OK: action scenarios validated');
}

try {
  main();
} catch (err) {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
