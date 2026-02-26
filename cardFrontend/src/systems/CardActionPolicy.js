// CardActionPolicy.js
// Centralized rules for deriving available card actions

import { isActivatedEffect, isPlayOrActivatedEffect } from '../utils/EffectTypeRouter';

export default class CardActionPolicy {
    static getAvailableActions(card, gameContext = {}) {
        const cardData = card.fullCardData.cardData;
        const cardType = cardData.cardType;
        const effects = cardData.effects || {};
        const currentPhase = gameContext.phase || 'MAIN_PHASE';
        const isInSlot = card.isInZone || false;
        const slotInfo = gameContext.slotInfo || null;

        console.log('getAvailable Action ', JSON.stringify(cardData));
        console.log(`🎯 Getting actions for ${cardType} card in ${currentPhase}, inSlot: ${isInSlot}`);

        if (isInSlot && slotInfo) {
            return this.getSlotActions(cardType, cardData, slotInfo, currentPhase, gameContext);
        }

        if (cardType === 'base' && card.isInZone) {
            return this.getBaseZoneActions(card, cardData, currentPhase, gameContext);
        }

        let actions = this.getBaseActionsForType(cardType, cardData);

        if (cardType === 'command' && !card.isInZone) {
            const usableEffects = this.getUsableCommandEffects(cardData, gameContext);

            if (usableEffects.length === 0) {
                actions = actions.filter(action => action.action !== 'playCommand');
            } else {
                const primaryEffect = usableEffects[0];
                actions = actions.map(action => {
                    if (action.action === 'playCommand') {
                        return {
                            ...action,
                            effectData: primaryEffect,
                            extraEffects: usableEffects
                        };
                    }
                    return action;
                });
            }
        }

        console.log(`📋 Available actions for ${cardData.id}:`, actions.map(a => a.action));
        return actions;
    }

    static getBaseActionsForType(cardType, cardData = null) {
        const actionMap = {
            unit: [
                { action: 'playUnit', text: '打出[Unit]', primary: true },
                { action: 'cancel', text: '取消' }
            ],

            pilot: [
                { action: 'playPilot', text: '打出[Pilot]', primary: true },
                { action: 'cancel', text: '取消' }
            ],

            command: [
                { action: 'playCommand', text: '打出[Command]', primary: true },
                { action: 'cancel', text: '取消' }
            ],

            base: [
                { action: 'playBase', text: '打出[Base]', primary: true },
                { action: 'cancel', text: '取消' }
            ],

            commandAndUnit: [
                { action: 'playCommand', text: '打出[Command]', primary: true },
                { action: 'playPilot', text: '打出[Pilot]', primary: true },
                { action: 'cancel', text: '取消' }
            ]
        };

        if (cardType === 'command' && cardData) {
            const hasDesignatePilot = cardData.effects?.rules?.some(rule =>
                rule?.action === 'designate_pilot'
            );

            if (hasDesignatePilot) {
                return actionMap.commandAndUnit;
            }
        }

        return actionMap[cardType] || this.getDefaultActions();
    }

    static getUsableCommandEffects(cardData, gameContext = {}) {
        const effects = Array.isArray(cardData.effects?.rules) ? cardData.effects.rules : [];
        if (effects.length === 0) {
            return [];
        }

        const gameEnv = gameContext.gameEnv || {};
        const currentBattle = gameEnv.currentBattle;
        const isActionWindowOpen = Boolean(currentBattle && currentBattle.status === 'ACTION_STEP');
        const currentPlayerId = gameContext.currentPlayerId;
        const isTurnPlayer = currentPlayerId && gameEnv.currentPlayer === currentPlayerId;
        const currentPhase = (gameContext.phase || 'MAIN_PHASE').toUpperCase();

        const isBattleParticipant = Boolean(
            isActionWindowOpen &&
            currentPlayerId &&
            (currentBattle.attackingPlayerId === currentPlayerId || currentBattle.defendingPlayerId === currentPlayerId)
        );

        return effects.filter(effect => {
            if (!effect || !isPlayOrActivatedEffect(effect)) {
                return false;
            }

            const timingWindows = this.getTimingWindows(effect);
            const allowsActionStep = timingWindows.has('ACTION_STEP') || timingWindows.has('ACTION');
            const allowsMainPhase = timingWindows.has('MAIN_PHASE') || timingWindows.size === 0;

            if (isActionWindowOpen) {
                return allowsActionStep && isBattleParticipant;
            }

            return allowsMainPhase && isTurnPlayer && currentPhase === 'MAIN_PHASE';
        });
    }

    static getTimingWindows(effect) {
        const windows = new Set();
        const rawTiming = effect?.timing;

        if (rawTiming && typeof rawTiming === 'object') {
            const windowValues = rawTiming.windows;
            if (Array.isArray(windowValues)) {
                windowValues.forEach(value => {
                    if (typeof value === 'string') {
                        windows.add(value.toUpperCase());
                    }
                });
            }

            if (typeof rawTiming.duration === 'string') {
                windows.add(rawTiming.duration.toUpperCase());
            }

            if (typeof rawTiming.actionTurn === 'string') {
                windows.add(rawTiming.actionTurn.toUpperCase());
            }
        }

        if (typeof effect?.trigger === 'string') {
            windows.add(effect.trigger.toUpperCase());
        }

        return windows;
    }

    static getSlotActions(cardType, cardData, slotInfo, currentPhase, gameContext = {}) {
        console.log(`🎯 Getting slot actions for ${cardType} in slot ${slotInfo.slotName}, cardType in slot: ${slotInfo.cardType}`);

        const actions = [];
        const ownerId = this.resolveSlotOwnerId(slotInfo, gameContext);
        const slotData = ownerId && gameContext?.gameEnv?.players?.[ownerId]?.zones?.[slotInfo.slotName];
        const unitState = slotData?.unit || null;

        switch (cardType) {
            case 'unit':
                actions.push({ action: 'attackUnit', text: '攻擊機體', primary: true });

                const canAttackPlayer = !this.unitHasRestriction(unitState, 'cannot_attack_player', gameContext);
                if (canAttackPlayer) {
                    actions.push({ action: 'attackShieldArea', text: '攻擊基地/盾', primary: true });
                }
                break;

            case 'pilot':
                actions.push(
                    { action: 'activatePilot', text: '激活驾驶员', primary: true },
                    { action: 'pilotSkill', text: '驾驶员技能', primary: false },
                    { action: 'ejectPilot', text: '弹射驾驶员', primary: false }
                );
                break;

            case 'base':
                return this.getBaseZoneActions({ fullCardData: { cardData } }, cardData, currentPhase, gameContext);

            case 'command':
                if (slotInfo.cardType === 'pilot') {
                    actions.push(
                        { action: 'activatePilot', text: '激活驾驶员', primary: true },
                        { action: 'pilotSkill', text: '驾驶员技能', primary: false },
                        { action: 'revertCommand', text: '恢复指令牌', primary: false }
                    );
                } else {
                    actions.push(
                        { action: 'commandBonus', text: '指令奖励', primary: false }
                    );
                }
                break;

            default:
                actions.push({ action: 'genericAbility', text: '使用能力', primary: true });
        }

        if (currentPhase === 'BATTLE_PHASE') {
            actions.push({ action: 'combat', text: '参与战斗', primary: true });
        }

        actions.push({ action: 'cancel', text: '关闭' });

        console.log(`📋 Slot actions for ${cardData.id}:`, actions.map(a => a.action));
        return actions;
    }

    static getBaseZoneActions(card, cardData, currentPhase, gameContext = {}) {
        if (!card || !cardData) {
            return [];
        }

        const isPlayerZone = card.zoneContext?.isPlayerZone ?? card.isPlayerZone ?? true;
        if (!isPlayerZone) {
            return [];
        }

        const usableEffects = this.getUsableBaseEffects(cardData, gameContext);
        if (usableEffects.length === 0) {
            return [];
        }

        const baseRested = this.isCardRested(card);
        if (baseRested) {
            return [];
        }

        const primaryEffect = usableEffects[0];
        const actions = [
            {
                action: 'activateCardAbility',
                text: '发动基地能力',
                primary: true,
                effectData: primaryEffect,
                extraEffects: usableEffects
            },
            { action: 'cancel', text: '关闭' }
        ];

        console.log(`📋 Base zone actions for ${cardData.id}:`, actions.map(a => a.action));
        return actions;
    }

    static getUsableBaseEffects(cardData, gameContext = {}) {
        const effects = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
        if (effects.length === 0) {
            return [];
        }

        const gameEnv = gameContext.gameEnv || {};
        const currentPhase = (gameContext.phase || 'MAIN_PHASE').toUpperCase();
        const currentPlayerId = gameContext.currentPlayerId;
        const isTurnPlayer = currentPlayerId && gameEnv.currentPlayer === currentPlayerId;

        if (!isTurnPlayer || currentPhase !== 'MAIN_PHASE') {
            return [];
        }

        return effects.filter(effect => {
            if (!effect || !isActivatedEffect(effect)) {
                return false;
            }

            const windows = this.getTimingWindows(effect);
            return windows.size === 0 || windows.has('MAIN_PHASE');
        });
    }

    static isCardRested(card) {
        if (!card) {
            return false;
        }

        const candidates = [
            card.fullCardData?.isRested,
            card.fullCardData?.cardData?.isRested,
            card.cardData?.isRested,
            card.fullCardData?.status,
            card.cardData?.status
        ];

        for (const value of candidates) {
            if (typeof value === 'boolean') {
                return value;
            }
            if (typeof value === 'string') {
                const normalized = value.toLowerCase();
                if (normalized === 'rested' || normalized === 'tapped') {
                    return true;
                }
                if (normalized === 'active' || normalized === 'ready') {
                    return false;
                }
            }
        }

        return false;
    }

    static addEffectBasedActions(baseActions, effects, currentPhase) {
        let actions = [...baseActions];

        if (!effects.rules) {
            return actions;
        }

        const phaseUpper = typeof currentPhase === 'string' ? currentPhase.toUpperCase() : 'MAIN_PHASE';
        const activatedEffects = effects.rules.filter(rule => {
            if (!isActivatedEffect(rule)) {
                return false;
            }
            const windows = this.getTimingWindows(rule);
            return windows.has(phaseUpper);
        });

        if (activatedEffects.length > 0) {
            activatedEffects.forEach((effect, index) => {
                actions.unshift({
                    action: 'activate-effect',
                    text: `Activate Effect${activatedEffects.length > 1 ? ` ${index + 1}` : ''}`,
                    color: 0xe67e22,
                    primary: true,
                    effectData: effect
                });
            });
        }

        if (effects.description && effects.description.some(desc => desc.includes('【Pilot】'))) {
            const pilotLinkAction = {
                action: 'pilot-link',
                text: 'Pilot Link',
                color: 0x8e44ad,
                effectData: { type: 'pilot-link' }
            };

            const primaryIndex = actions.findIndex(a => a.primary);
            actions.splice(primaryIndex + 1, 0, pilotLinkAction);
        }

        return actions;
    }

    static applyContextRestrictions(actions, cardData, gameContext) {
        return actions.filter(action => {
            switch (action.action) {
                case 'activate-effect':
                    if (!action.effectData) {
                        return false;
                    }
                    const actionWindows = this.getTimingWindows(action.effectData);
                    const phaseUpper = typeof gameContext.phase === 'string'
                        ? gameContext.phase.toUpperCase()
                        : 'MAIN_PHASE';
                    return actionWindows.has(phaseUpper);

                case 'attach-to-unit':
                    return true;

                case 'deploy-base':
                    return gameContext.baseZoneAvailable !== false;

                case 'play':
                case 'playUnit':
                case 'playPilot':
                case 'playCommand':
                case 'playBase':
                    return gameContext.canPlayNormally !== false;

                default:
                    return true;
            }
        });
    }

    static getDefaultActions() {
        return [
            { action: 'play', text: 'Play', color: 0x4a90e2, primary: true },
            { action: 'inspect', text: 'Inspect', color: 0x50c878 },
            { action: 'return', text: 'Return', color: 0xffa500 },
            { action: 'cancel', text: 'Cancel', color: 0xe74c3c }
        ];
    }

    static getActionConfig(actionName) {
        const allActions = [
            ...this.getBaseActionsForType('unit'),
            ...this.getBaseActionsForType('pilot'),
            ...this.getBaseActionsForType('command'),
            ...this.getBaseActionsForType('base'),
            { action: 'activate-effect', text: 'Activate Effect', color: 0xe67e22 },
            { action: 'activateCardAbility', text: '发动基地能力', color: 0xe67e22 },
            { action: 'attach-to-unit', text: 'Attach to Unit', color: 0x9b59b6 },
            { action: 'deploy-base', text: 'Deploy Base', color: 0x2ecc71 },
            { action: 'pilot-link', text: 'Pilot Link', color: 0x8e44ad }
        ];

        return allActions.find(action => action.action === actionName) ||
               { action: actionName, text: actionName, color: 0x95a5a6 };
    }

    static resolveSlotOwnerId(slotInfo, gameContext) {
        if (!slotInfo || !gameContext) {
            return null;
        }

        if (slotInfo.playerType === 'player') {
            return gameContext.currentPlayerId || null;
        }

        if (slotInfo.playerType === 'opponent') {
            return gameContext.opponentId || null;
        }

        return null;
    }

    static unitHasRestriction(unitCard, restriction, gameContext) {
        if (!unitCard) {
            return false;
        }

        if (this.restrictionMatches(unitCard.attackRestrictions, restriction)) {
            return true;
        }

        if (this.restrictionMatches(unitCard.activeRestrictions, restriction)) {
            return true;
        }

        const computedRestrictions = gameContext?.gameEnv?.computedState?.activeRestrictions || {};
        const computedForUnit = computedRestrictions?.[unitCard.carduid];
        if (this.restrictionMatches(computedForUnit, restriction)) {
            return true;
        }

        const cardRules = unitCard.cardData?.effects?.rules || [];
        return cardRules.some(rule => {
            if (!rule || rule.action !== 'restrict_attack') {
                return false;
            }

            const parameters = rule.parameters || {};
            return this.restrictionMatches(parameters.restriction || parameters.restrictions, restriction);
        });
    }

    static restrictionMatches(value, restriction) {
        if (!value) {
            return false;
        }

        if (typeof value === 'string') {
            return value === restriction;
        }

        if (Array.isArray(value)) {
            return value.some(item => this.restrictionMatches(item, restriction));
        }

        if (typeof value === 'object') {
            if (value.restriction || value.restrictions) {
                return this.restrictionMatches(value.restriction || value.restrictions, restriction);
            }

            if (typeof value.type === 'string') {
                return value.type === restriction;
            }

            return Object.values(value).some(item => this.restrictionMatches(item, restriction));
        }

        return false;
    }
}
