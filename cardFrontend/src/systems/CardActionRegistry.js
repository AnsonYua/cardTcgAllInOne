// CardActionRegistry.js
// Registry system for dynamic card actions based on type and effects

export default class CardActionRegistry {
    /**
     * Get available actions for a card based on its type and effects
     */
    static getAvailableActions(card, gameContext = {}) {
        const cardData = card.fullCardData.cardData;
        const cardType = cardData.cardType ;
        const effects = cardData.effects || {};
        const currentPhase = gameContext.phase || 'MAIN_PHASE';
        const isInSlot = card.isInZone || false;  // Use existing card property
        const slotInfo = gameContext.slotInfo || null;
        
        console.log("getAvailable Action ", JSON.stringify(cardData))
        console.log(`🎯 Getting actions for ${cardType} card in ${currentPhase}, inSlot: ${isInSlot}`);
        
        // If card is in slot, show slot-specific actions
        if (isInSlot && slotInfo) {
            return this.getSlotActions(cardType, cardData, slotInfo, currentPhase, gameContext);
        }
        
        // Base actions for card type (hand cards)
        let actions = this.getBaseActionsForType(cardType, cardData);

        // Inject command ability actions when available
        actions = this.addCommandAbilityActions(card, actions, gameContext);
        
        // Add effect-based actions
        // actions = this.addEffectBasedActions(actions, effects, currentPhase);
        
        // Apply context restrictions
        // actions = this.applyContextRestrictions(actions, cardData, gameContext);
        
        console.log(`📋 Available actions for ${cardData.id}:`, actions.map(a => a.action));
        return actions;
    }

    /**
     * Get base actions for each card type
     */
    static getBaseActionsForType(cardType, cardData = null) {
        const actionMap = {
            'unit': [
                { action: 'playUnit', text: '打出[Unit]', primary: true },
                { action: 'cancel', text: '取消' }
            ],
            
            'pilot': [
                { action: 'playPilot', text: '打出[Pilot]', primary: true },
                { action: 'cancel', text: '取消' }
            ],
            
            'command': [
                { action: 'playCommand', text: '打出[Command]', primary: true },
                { action: 'cancel', text: '取消' }
            ],
            
            'base': [
                { action: 'playBase', text: '打出[Base]', primary: true },
                { action: 'cancel', text: '取消' }
            ],

            'commandAndUnit':[
                { action: 'playCommand', text: '打出[Command]', primary: true },
                { action: 'playPilot', text: '打出[Pilot]', primary: true },
                { action: 'cancel', text: '取消' }
            ]
        };
        
        // Special logic for command cards with pilot designation
        if (cardType === 'command' && cardData) {
            const hasDesignatePilot = cardData.effects?.rules?.some(rule => 
                rule?.action === 'designate_pilot'
            );
            
            if (hasDesignatePilot) {
                return actionMap['commandAndUnit'];
            }
        }
        
        return actionMap[cardType] || this.getDefaultActions();
    }

    static addCommandAbilityActions(card, actions, gameContext) {
        const cardData = card?.fullCardData?.cardData;
        if (!cardData || cardData.cardType !== 'command') {
            return actions;
        }

        // Only allow command abilities while the card is in hand
        if (card.isInZone) {
            return actions;
        }

        const usableEffects = this.getUsableCommandEffects(cardData, gameContext);
        if (usableEffects.length === 0) {
            return actions;
        }

        const abilityActions = usableEffects.map((effect, index) => ({
            action: 'useCommand',
            text: usableEffects.length > 1 && effect.effectId
                ? `使用指令 (${effect.effectId})`
                : '使用指令',
            primary: true,
            effectData: effect
        }));

        // Prepend ability buttons so they appear before standard play options
        return [...abilityActions, ...actions];
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
            if (!effect || effect.type !== 'activated') {
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

        if (Array.isArray(rawTiming)) {
            rawTiming.forEach(value => {
                if (typeof value === 'string') {
                    windows.add(value.toUpperCase());
                }
            });
        } else if (typeof rawTiming === 'string') {
            windows.add(rawTiming.toUpperCase());
        }

        if (rawTiming && typeof rawTiming === 'object') {
            const durationValue = rawTiming.duration;
            if (typeof durationValue === 'string') {
                windows.add(durationValue.toUpperCase());
            }

            const actionTurnValue = rawTiming.actionTurn;
            if (typeof actionTurnValue === 'string') {
                windows.add(actionTurnValue.toUpperCase());
            }
        }

        if (typeof effect?.trigger === 'string') {
            windows.add(effect.trigger.toUpperCase());
        }

        return windows;
    }

    /**
     * Get actions for cards that are already placed in slots
     */
    static getSlotActions(cardType, cardData, slotInfo, currentPhase, gameContext = {}) {
        console.log(`🎯 Getting slot actions for ${cardType} in slot ${slotInfo.slotName}, cardType in slot: ${slotInfo.cardType}`);
        
        const actions = [];
        const ownerId = this.resolveSlotOwnerId(slotInfo, gameContext);
        const slotData = ownerId && gameContext?.gameEnv?.players?.[ownerId]?.zones?.[slotInfo.slotName];
        const unitState = slotData?.unit || null;

        
        // Card type specific slot actions
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
                actions.push(
                    { action: 'useBaseAbility', text: '基地能力', primary: true },
                    { action: 'generateResource', text: '产生资源', primary: false },
                    { action: 'upgradeBase', text: '升级基地', primary: false }
                );
                break;
                
            case 'command':
                // Command cards in slots might have been played as pilots
                if (slotInfo.cardType === 'pilot') {
                    actions.push(
                        { action: 'activatePilot', text: '激活驾驶员', primary: true },
                        { action: 'pilotSkill', text: '驾驶员技能', primary: false },
                        { action: 'revertCommand', text: '恢复指令牌', primary: false }
                    );
                } else {
                    actions.push(
                        { action: 'useCommand', text: '使用指令', primary: true },
                        { action: 'commandBonus', text: '指令奖励', primary: false }
                    );
                }
                break;
                
            default:
                actions.push({ action: 'genericAbility', text: '使用能力', primary: true });
        }
        
        // Phase-specific actions
        if (currentPhase === 'BATTLE_PHASE') {
            actions.push({ action: 'combat', text: '参与战斗', primary: true });
        }
        
        // Always add cancel/close option
        actions.push({ action: 'cancel', text: '关闭' });
        
        console.log(`📋 Slot actions for ${cardData.id}:`, actions.map(a => a.action));
        return actions;
    }
    
    /**
     * Add actions based on card effects
     */
    static addEffectBasedActions(baseActions, effects, currentPhase) {
        let actions = [...baseActions];
        
        if (!effects.rules) {
            return actions;
        }
        
        // Check for activated effects
        const activatedEffects = effects.rules.filter(rule => 
            rule.type === 'activated' && 
            rule.timing && 
            rule.timing.includes(currentPhase)
        );
        
        if (activatedEffects.length > 0) {
            // Add activate effect action for each activated effect
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
        
        // Check for special pilot linking effects
        if (effects.description && effects.description.some(desc => desc.includes('【Pilot】'))) {
            const pilotLinkAction = {
                action: 'pilot-link',
                text: 'Pilot Link',
                color: 0x8e44ad,
                effectData: { type: 'pilot-link' }
            };
            
            // Insert after primary action
            const primaryIndex = actions.findIndex(a => a.primary);
            actions.splice(primaryIndex + 1, 0, pilotLinkAction);
        }
        
        return actions;
    }
    
    /**
     * Apply context restrictions to filter invalid actions
     */
    static applyContextRestrictions(actions, cardData, gameContext) {
        return actions.filter(action => {
            switch (action.action) {
                case 'activate-effect':
                    // Check if we're in the correct phase
                    return action.effectData && 
                           action.effectData.timing && 
                           action.effectData.timing.includes(gameContext.phase);
                           
                case 'attach-to-unit':
                    // Always show pilot action - CardActionHandler will handle validation
                    return true;
                    
                case 'deploy-base':
                    // Check if base zone is available
                    return gameContext.baseZoneAvailable !== false; // Default to true
                    
                case 'play':
                    // Check basic play restrictions
                    return gameContext.canPlayNormally !== false; // Default to true
                    
                default:
                    return true; // Allow other actions by default
            }
        });
    }
    
    /**
     * Default actions for unknown card types
     */
    static getDefaultActions() {
        return [
            { action: 'play', text: 'Play', color: 0x4a90e2, primary: true },
            { action: 'inspect', text: 'Inspect', color: 0x50c878 },
            { action: 'return', text: 'Return', color: 0xffa500 },
            { action: 'cancel', text: 'Cancel', color: 0xe74c3c }
        ];
    }
    
    /**
     * Get action configuration by action name
     */
    static getActionConfig(actionName) {
        const allActions = [
            ...this.getBaseActionsForType('unit'),
            ...this.getBaseActionsForType('pilot'),
            ...this.getBaseActionsForType('command'),
            ...this.getBaseActionsForType('base'),
            { action: 'activate-effect', text: 'Activate Effect', color: 0xe67e22 },
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
