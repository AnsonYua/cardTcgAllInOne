// ActionButtonManager.js
// Dynamic action button creation and management system

import CardActionRegistry from './CardActionRegistry.js';

export default class ActionButtonManager {
    constructor(gameScene) {
        this.gameScene = gameScene;
        this.actionButtonContainer = null;
        this.actionButtons = [];
        this.isVisible = false;
    }

    /**
     * Initialize the action button container
     */
    initialize() {
        const width = this.gameScene.scale.width;
        const height = this.gameScene.scale.height;
        
        // Create container for action buttons, positioned above hand area
        this.actionButtonContainer = this.gameScene.add.container(width / 2, height - 250);
        this.actionButtonContainer.setDepth(500);
        this.actionButtonContainer.setVisible(false); // Hidden by default
        
        console.log('ActionButtonManager initialized');
    }

    /**
     * Show dynamic actions for selected card
     */
    showActionsForCard(selectedCard, gameContext = {}) {
        if (!selectedCard) {
            this.hide();
            return;
        }

        // Get available actions for this specific card
        const availableActions = CardActionRegistry.getAvailableActions(selectedCard, gameContext);
        
        // Clear existing buttons
        this.clearButtons();
        
        // Create buttons for available actions
        this.createButtons(availableActions);
        
        // Show the container
        this.show();
        
        console.log(`🎮 Showing ${availableActions.length} actions for card ${selectedCard.fullCardData?.cardData?.id}`);
    }

    /**
     * Create buttons dynamically based on available actions
     */
    createButtons(actions) {
        if (!actions || actions.length === 0) {
            return;
        }

        const buttonWidth = 80;
        const buttonHeight = 35;
        const buttonSpacing = 90;
        const startX = -(actions.length - 1) * buttonSpacing / 2 - 50;
        
        this.actionButtons = [];
        
        actions.forEach((actionConfig, index) => {
            const x = startX + index * buttonSpacing;
            const y = 0;
            
            // Create button background with special styling for primary actions
            const buttonColor = actionConfig.primary ? 
                this.brightenColor(actionConfig.color, 0.2) : actionConfig.color;
                
            const button = this.gameScene.add.rectangle(x, y, buttonWidth, buttonHeight, buttonColor, 0.8);
            button.setStrokeStyle(actionConfig.primary ? 3 : 2, 0xffffff, actionConfig.primary ? 0.9 : 0.6);
            button.setInteractive();
            
            // Create button text
            const buttonText = this.gameScene.add.text(x, y, actionConfig.text, {
                fontSize: actionConfig.primary ? '13px' : '12px',
                fill: '#ffffff',
                fontFamily: actionConfig.primary ? 'Arial Bold' : 'Arial'
            });
            buttonText.setOrigin(0.5);
            
            // Store button data with effect data
            const buttonData = {
                background: button,
                text: buttonText,
                action: actionConfig.action,
                config: actionConfig,
                effectData: actionConfig.effectData || null
            };
            
            // Add hover effects
            button.on('pointerover', () => {
                button.setFillStyle(buttonColor, 1.0);
                button.setStrokeStyle(actionConfig.primary ? 3 : 2, 0xffffff, 1.0);
            });
            
            button.on('pointerout', () => {
                button.setFillStyle(buttonColor, 0.8);
                button.setStrokeStyle(actionConfig.primary ? 3 : 2, 0xffffff, actionConfig.primary ? 0.9 : 0.6);
            });
            
            // Add click handler with effect data
            button.on('pointerdown', () => {
                this.gameScene.handleActionButtonClick(actionConfig.action, buttonData.effectData);
            });
            
            // Add to container and store reference
            this.actionButtonContainer.add([button, buttonText]);
            this.actionButtons.push(buttonData);
        });
        
        console.log(`📋 Created ${actions.length} dynamic action buttons`);
    }

    /**
     * Clear all existing buttons
     */
    clearButtons() {
        if (this.actionButtons && this.actionButtons.length > 0) {
            this.actionButtons.forEach(buttonData => {
                if (buttonData.background) {
                    buttonData.background.destroy();
                }
                if (buttonData.text) {
                    buttonData.text.destroy();
                }
            });
            this.actionButtons = [];
        }
        
        if (this.actionButtonContainer) {
            this.actionButtonContainer.removeAll();
        }
    }

    /**
     * Show the action button container
     */
    show() {
        if (this.actionButtonContainer && !this.isVisible) {
            this.actionButtonContainer.setVisible(true);
            this.isVisible = true;
            console.log('Dynamic action buttons shown');
        }
    }

    /**
     * Hide the action button container
     */
    hide() {
        if (this.actionButtonContainer && this.isVisible) {
            this.actionButtonContainer.setVisible(false);
            this.isVisible = false;
            console.log('Dynamic action buttons hidden');
        }
    }

    /**
     * Update actions for currently selected card (e.g., when game state changes)
     */
    updateActionsForCurrentCard(selectedCard, gameContext = {}) {
        if (this.isVisible) {
            this.showActionsForCard(selectedCard, gameContext);
        }
    }

    /**
     * Utility: Brighten color for primary actions
     */
    brightenColor(color, factor) {
        const r = Math.min(255, ((color >> 16) & 0xFF) + (255 * factor));
        const g = Math.min(255, ((color >> 8) & 0xFF) + (255 * factor));
        const b = Math.min(255, (color & 0xFF) + (255 * factor));
        
        return (r << 16) + (g << 8) + b;
    }

    /**
     * Get current action button count
     */
    getButtonCount() {
        return this.actionButtons.length;
    }

    /**
     * Check if buttons are currently visible
     */
    isButtonsVisible() {
        return this.isVisible;
    }

    /**
     * Destroy the button manager and clean up
     */
    destroy() {
        this.clearButtons();
        if (this.actionButtonContainer) {
            this.actionButtonContainer.destroy();
            this.actionButtonContainer = null;
        }
        this.isVisible = false;
    }
}