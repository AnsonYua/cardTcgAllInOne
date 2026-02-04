require('ts-node/register/transpile-only');

const { TargetChoicePolicy } = require('../../services/choices/TargetChoicePolicy');

function validateSetActiveDoesNotRequireChoice() {
  const effect = {
    effectId: 'end_of_turn_set_active_resource_if_cb_trash_ge_7',
    trigger: 'END_OF_TURN',
    action: 'setActive',
    target: { type: 'energy', scope: 'self_resource', count: 1 }
  };

  const targetConfig = {
    type: 'energy',
    scope: 'self_resource',
    count: 1,
    filters: {}
  };

  const availableTargets = [
    { carduid: 'energy_1', zone: 'energy', playerId: 'playerId_1' },
    { carduid: 'energy_2', zone: 'energy', playerId: 'playerId_1' }
  ];

  const requiresChoice = TargetChoicePolicy.requiresChoice(targetConfig, availableTargets, effect);
  if (requiresChoice) {
    throw new Error('Expected setActive self_resource to auto-select and skip TARGET_CHOICE');
  }

  console.log('OK: setActive choice policy validation');
}

module.exports = {
  validateSetActiveDoesNotRequireChoice
};
