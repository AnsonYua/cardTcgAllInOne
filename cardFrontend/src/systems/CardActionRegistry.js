// CardActionRegistry.js
// Registry system for dynamic card actions based on type and effects

export default class CardActionRegistry {
    /**
     * Get available actions for a card based on its type and effects
     */
    static getAvailableActions(card, gameContext = {}) {
        if (!card || !card.fullCardData) {
            return this.getDefaultActions();
        }

        const cardData = card.fullCardData.cardData || card.fullCardData;
        const cardType = cardData.cardType || 'unit';
        const effects = cardData.effects || {};
        const currentPhase = gameContext.phase || 'MAIN_PHASE';
        
        console.log(`🎯 Getting actions for ${cardType} card in ${currentPhase}`);
        
        // Base actions for card type
        let actions = this.getBaseActionsForType(cardType);
        
        // Add effect-based actions
        actions = this.addEffectBasedActions(actions, effects, currentPhase);
        
        // Apply context restrictions
        actions = this.applyContextRestrictions(actions, cardData, gameContext);
        
        console.log(`📋 Available actions for ${cardData.id}:`, actions.map(a => a.action));
        return actions;
    }
    
    /**
     * Get base actions for each card type
     */
    static getBaseActionsForType(cardType) {
        const actionMap = {
            'unit': [
                { action: 'play', text: 'Play Unit', color: 0x4a90e2, primary: true },
                { action: 'facedown', text: 'Face Down', color: 0x7b68ee },
                { action: 'inspect', text: 'Inspect', color: 0x50c878 },
                { action: 'return', text: 'Return', color: 0xffa500 },
                { action: 'cancel', text: 'Cancel', color: 0xe74c3c }
            ],
            
            'pilot': [
                { action: 'attach-to-unit', text: 'Attach to Unit', color: 0x9b59b6, primary: true },
                { action: 'facedown', text: 'Face Down', color: 0x7b68ee },
                { action: 'inspect', text: 'Inspect', color: 0x50c878 },
                { action: 'return', text: 'Return', color: 0xffa500 },
                { action: 'cancel', text: 'Cancel', color: 0xe74c3c }
            ],
            
            'command': [
                { action: 'play', text: 'Play Command', color: 0xf39c12, primary: true },
                { action: 'facedown', text: 'Face Down', color: 0x7b68ee },
                { action: 'inspect', text: 'Inspect', color: 0x50c878 },
                { action: 'return', text: 'Return', color: 0xffa500 },
                { action: 'cancel', text: 'Cancel', color: 0xe74c3c }
            ],
            
            'base': [
                { action: 'deploy-base', text: 'Deploy Base', color: 0x2ecc71, primary: true },
                { action: 'facedown', text: 'Face Down', color: 0x7b68ee },
                { action: 'inspect', text: 'Inspect', color: 0x50c878 },
                { action: 'return', text: 'Return', color: 0xffa500 },
                { action: 'cancel', text: 'Cancel', color: 0xe74c3c }
            ]
        };
        
        return actionMap[cardType] || this.getDefaultActions();
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
                    // Check if there are units available to attach to
                    return gameContext.hasAvailableUnits !== false; // Default to true
                    
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
            { action: 'facedown', text: 'Face Down', color: 0x7b68ee },
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
}