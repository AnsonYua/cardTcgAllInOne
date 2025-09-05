// CardActionHandler.js
// Dedicated handler for all card action buttons and related functionality

export default class CardActionHandler {
    constructor(gameScene, gameStateManager, apiManager) {
        this.gameScene = gameScene;
        this.gameStateManager = gameStateManager;
        this.apiManager = apiManager;
    }

    /**
     * Main action dispatcher - routes to specific action handlers
     */
    handleAction(action, selectedCard, effectData = null) {
        console.log(`Action button clicked: ${action}`, selectedCard, effectData);

        switch (action) {
            case 'cancel':
                this.handleCancelAction();
                break;
            case 'playUnit':
                this.handlePlayAction(selectedCard);
                break;
            case 'playCommand':
                this.handlePlayCommandAction(selectedCard);
                break;
            case 'playPilot':
                this.handlePlayPilotAction(selectedCard);
                break;
            case 'playBase':
                this.handleDeployBaseAction(selectedCard);
                break;
            default:
                console.log(`Unknown action: ${action}`);
        }
    }

    /**
     * Handle normal card play action
     */
    async handlePlayAction(selectedCard) {
        if (!this.validateSelectedCard(selectedCard, 'play action')) {
            return;
        }
        
        console.log('Playing card normally:', selectedCard.fullCardData.cardUid);
        this.gameScene.actionButtonManager.hide();
        
        try {
            // Get cardUID from the selected card
            const cardUID = selectedCard.fullCardData.cardUid;
            
            if (!cardUID) {
                this.showErrorMessage('Card not found in hand.');
                return;
            }
            
            const gameState = this.gameStateManager.getGameState();
            
            // Set loading state
            this.setUILoadingState(true);
            
            // Call backend API - it will automatically find first empty unit slot
            console.log('Calling backend playCard API with cardUID:', cardUID);
            
            if (this.apiManager) {
                const response = await this.apiManager.playCard(
                    gameState.playerId,
                    gameState.gameId,
                    cardUID
                );
                
                console.log('Play card response:', response);
                
                if (response && response.success) {
                    console.log('✅ Card played successfully - backend will update game state via polling');
                    this.gameStateManager.updateGameEnv(response.gameEnv);
                    this.updateGameState();
                    this.updatePlayerHand();
                    this.clearZoneHighlights();
                } else {
                    console.error('❌ Failed to play card:', response?.error);
                    this.showErrorMessage(response?.error || 'Failed to play card');
                }
            } else {
                // Demo mode - show that this would place the card
                console.log('Demo mode: Would call backend API to play card');
                this.showErrorMessage('Demo mode - Backend API not available');
            }
            
        } catch (error) {
            console.error('Error playing card:', error);
            this.showErrorMessage('Failed to play card. Please try again.');
        } finally {
            // Clear loading state
            this.setUILoadingState(false);
        }
    }




    /**
     * Handle cancel selection action
     */
    handleCancelAction() {
        // Implementation for canceling selection
        console.log('Canceling card selection');
        
        // Get currently selected card to deselect it visually
        const selectedCard = this.gameStateManager.getSelectedCard();
        if (selectedCard) {
            selectedCard.deselect();
        }
        
        // Clear selection from state manager
        this.gameStateManager.setSelectedCard(null);
        
        // Clear zone highlights and hide buttons
        this.clearZoneHighlights();
        this.gameScene.actionButtonManager.hide();
    }



    /**
     * Handle base deployment action
     */
    handleDeployBaseAction(selectedCard) {
        if (!this.validateSelectedCard(selectedCard, 'deploy base')) {
            return;
        }
        
        console.log('Deploying base card:', selectedCard.cardId);
        this.gameScene.actionButtonManager.hide();
        
        // TODO: Implement base deployment logic
        console.log('🚧 [PLACEHOLDER] Base deployment logic needed');
    }


    /**
     * Validate that a card is selected and show error if not
     */
    validateSelectedCard(selectedCard, actionName) {
        if (!selectedCard) {
            console.log(`No card selected for ${actionName}`);
            return false;
        }
        return true;
    }

    /**
     * Get card UID from hand for backend API calls
     */
    getCardUIDFromHand(cardData) {
        // Get the current hand from game state to find card UID
        const hand = this.gameStateManager.getPlayerHand();
        
        // Find the actual UID of this card in the player's hand
        // Backend hand contains UID strings like "c-1_1754551822157_24"
        // Frontend cardData.id is the base ID like "c-1"
        // We need to find the actual UID that matches this base ID
        const cardUID = hand.find(handCardUID => {
            // Extract base card ID from UID (before first underscore)
            const baseCardId = typeof handCardUID === 'string' 
                ? handCardUID.split('_')[0] 
                : handCardUID.id;
            return baseCardId === cardData.id;
        });
        
        if (!cardUID) {
            console.error(`Card ${cardData.id} not found in player hand`);
            console.log('Available hand cards (UIDs):', hand);
            console.log('Looking for base card ID:', cardData.id);
            return null;
        }
        
        return cardUID;
    }

    /**
     * Show error message to user
     */
    showErrorMessage(message) {
        // Remove existing error message
        if (this.gameScene.errorMessageText) {
            this.gameScene.errorMessageText.destroy();
        }
        
        // Create new error message text
        const { width } = this.gameScene.cameras.main;
        this.gameScene.errorMessageText = this.gameScene.add.text(width / 2, 120, message, {
            fontSize: '18px',
            fontFamily: 'Arial',
            fill: '#FF6B6B',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 2
        });
        this.gameScene.errorMessageText.setOrigin(0.5);
        
        // Set high depth to ensure error messages appear above all game elements (leader cards use depth 1001)
        this.gameScene.errorMessageText.setDepth(2000);
        
        // Auto-hide after 4 seconds
        this.gameScene.time.delayedCall(4000, () => {
            if (this.gameScene.errorMessageText) {
                this.gameScene.errorMessageText.destroy();
                this.gameScene.errorMessageText = null;
            }
        });
    }

    /**
     * Set UI loading state during API calls
     */
    setUILoadingState(isLoading) {
        if (isLoading) {
            // Create loading indicator if it doesn't exist
            if (!this.gameScene.loadingIndicator) {
                const { width, height } = this.gameScene.cameras.main;
                this.gameScene.loadingIndicator = this.gameScene.add.text(width / 2, height / 2, 'Processing...', {
                    fontSize: '24px',
                    fontFamily: 'Arial',
                    fill: '#FFD700',
                    align: 'center',
                    stroke: '#000000',
                    strokeThickness: 3
                });
                this.gameScene.loadingIndicator.setOrigin(0.5);
                this.gameScene.loadingIndicator.setDepth(1000); // Ensure it's on top
            }
            this.gameScene.loadingIndicator.setVisible(true);
            
            // Disable input during loading
            this.gameScene.input.enabled = false;
        } else {
            // Hide loading indicator
            if (this.gameScene.loadingIndicator) {
                this.gameScene.loadingIndicator.setVisible(false);
            }
            
            // Re-enable input
            this.gameScene.input.enabled = true;
        }
    }

    /**
     * Delegate method calls to GameScene for methods we don't want to duplicate
     */
    updateGameState() {
        this.gameScene.updateGameState();
    }

    updatePlayerHand() {
        this.gameScene.updatePlayerHand();
    }

    clearZoneHighlights() {
        this.gameScene.clearZoneHighlights();
    }

    /**
     * Handle play command action for dual-purpose command cards
     */
    async handlePlayCommandAction(selectedCard) {
        if (!this.validateSelectedCard(selectedCard, 'play command action')) {
            return;
        }
        
        console.log('Playing command card as Command:', selectedCard.fullCardData.cardData.id);
        this.gameScene.actionButtonManager.hide();
        
        try {
            const cardUID = selectedCard.fullCardData.cardUid;
            
            if (!cardUID) {
                this.showErrorMessage('Card not found in hand.');
                return;
            }
            
            const gameState = this.gameStateManager.getGameState();
            this.setUILoadingState(true);
            
            console.log('Calling backend playCard API as Command with cardUID:', cardUID);
            
            if (this.apiManager) {
                const response = await this.apiManager.playCard(
                    gameState.playerId,
                    gameState.gameId,
                    cardUID,
                    { playAs: 'command' }
                );
                
                console.log('Play command response:', response);
                
                if (response && response.success) {
                    console.log('✅ Command card played successfully');
                    this.gameStateManager.updateGameEnv(response.gameEnv);
                    this.updateGameState();
                    this.updatePlayerHand();
                    this.clearZoneHighlights();
                } else {
                    console.error('❌ Failed to play command card:', response?.error);
                    this.showErrorMessage(response?.error || 'Failed to play command card');
                }
            } else {
                console.log('Demo mode: Would call backend API to play command card');
                this.showErrorMessage('Demo mode - Backend API not available');
            }
            
        } catch (error) {
            console.error('Error playing command card:', error);
            this.showErrorMessage('Failed to play command card. Please try again.');
        } finally {
            this.setUILoadingState(false);
        }
    }

    /**
     * Handle play pilot action for dual-purpose command cards
     */
    async handlePlayPilotAction(selectedCard) {
        if (!this.validateSelectedCard(selectedCard, 'play pilot action')) {
            return;
        }
        
        console.log('Playing command card as Pilot:', selectedCard.fullCardData.cardData.id);
        this.gameScene.actionButtonManager.hide();
        
        try {
            const cardUID = selectedCard.fullCardData.cardUid;
            
            if (!cardUID) {
                this.showErrorMessage('Card not found in hand.');
                return;
            }
            
            const gameState = this.gameStateManager.getGameState();
            this.setUILoadingState(true);
            
            console.log('Calling backend playCard API as Pilot with cardUID:', cardUID);
            
            if (this.apiManager) {
                const response = await this.apiManager.playCard(
                    gameState.playerId,
                    gameState.gameId,
                    cardUID,
                    { playAs: 'pilot' }
                );
                
                console.log('Play pilot response:', response);
                
                if (response && response.success) {
                    console.log('✅ Pilot card played successfully');
                    this.gameStateManager.updateGameEnv(response.gameEnv);
                    this.updateGameState();
                    this.updatePlayerHand();
                    this.clearZoneHighlights();
                } else {
                    console.error('❌ Failed to play pilot card:', response?.error);
                    this.showErrorMessage(response?.error || 'Failed to play pilot card');
                }
            } else {
                console.log('Demo mode: Would call backend API to play pilot card');
                this.showErrorMessage('Demo mode - Backend API not available');
            }
            
        } catch (error) {
            console.error('Error playing pilot card:', error);
            this.showErrorMessage('Failed to play pilot card. Please try again.');
        } finally {
            this.setUILoadingState(false);
        }
    }
}