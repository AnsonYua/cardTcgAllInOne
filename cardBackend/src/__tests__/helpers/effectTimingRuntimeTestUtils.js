const {
    applyCompiledTimingBridgeToCardData,
    applyCompiledTimingBridgeToRule
} = require('../../services/effects/timing/EffectTimingBridge');

function bridgeRule(rule) {
    return applyCompiledTimingBridgeToRule(rule);
}

function bridgeCardData(cardData) {
    return applyCompiledTimingBridgeToCardData(cardData);
}

module.exports = {
    bridgeRule,
    bridgeCardData
};
