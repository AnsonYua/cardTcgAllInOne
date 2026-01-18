// CardActionRegistry.js
// Registry system for dynamic card actions based on type and effects

import CardActionPolicy from './CardActionPolicy';

export default class CardActionRegistry {
    static getAvailableActions(card, gameContext = {}) {
        return CardActionPolicy.getAvailableActions(card, gameContext);
    }

    static getBaseActionsForType(cardType, cardData = null) {
        return CardActionPolicy.getBaseActionsForType(cardType, cardData);
    }

    static getUsableCommandEffects(cardData, gameContext = {}) {
        return CardActionPolicy.getUsableCommandEffects(cardData, gameContext);
    }

    static getTimingWindows(effect) {
        return CardActionPolicy.getTimingWindows(effect);
    }

    static getSlotActions(cardType, cardData, slotInfo, currentPhase, gameContext = {}) {
        return CardActionPolicy.getSlotActions(cardType, cardData, slotInfo, currentPhase, gameContext);
    }

    static getBaseZoneActions(card, cardData, currentPhase, gameContext = {}) {
        return CardActionPolicy.getBaseZoneActions(card, cardData, currentPhase, gameContext);
    }

    static getUsableBaseEffects(cardData, gameContext = {}) {
        return CardActionPolicy.getUsableBaseEffects(cardData, gameContext);
    }

    static isCardRested(card) {
        return CardActionPolicy.isCardRested(card);
    }

    static addEffectBasedActions(baseActions, effects, currentPhase) {
        return CardActionPolicy.addEffectBasedActions(baseActions, effects, currentPhase);
    }

    static applyContextRestrictions(actions, cardData, gameContext) {
        return CardActionPolicy.applyContextRestrictions(actions, cardData, gameContext);
    }

    static getDefaultActions() {
        return CardActionPolicy.getDefaultActions();
    }

    static getActionConfig(actionName) {
        return CardActionPolicy.getActionConfig(actionName);
    }

    static resolveSlotOwnerId(slotInfo, gameContext) {
        return CardActionPolicy.resolveSlotOwnerId(slotInfo, gameContext);
    }

    static unitHasRestriction(unitCard, restriction, gameContext) {
        return CardActionPolicy.unitHasRestriction(unitCard, restriction, gameContext);
    }

    static restrictionMatches(value, restriction) {
        return CardActionPolicy.restrictionMatches(value, restriction);
    }
}
