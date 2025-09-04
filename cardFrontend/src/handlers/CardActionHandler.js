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
    handleAction(action, selectedCard) {
        console.log(`Action button clicked: ${action}`, selectedCard);
        
        switch (action) {
            case 'play':
                this.handlePlayAction(selectedCard);
                break;
            case 'facedown':
                this.handleFaceDownAction(selectedCard);
                break;
            case 'inspect':
                this.handleInspectAction(selectedCard);
                break;
            case 'return':
                this.handleReturnAction(selectedCard);
                break;
            case 'cancel':
                this.handleCancelAction();
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
        this.gameScene.hideActionButtons();
        
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
     * Handle face-down card play action
     */
    handleFaceDownAction(selectedCard) {
        if (!this.validateSelectedCard(selectedCard, 'face down action')) {
            return;
        }
        
        // Implementation for playing card face down
        console.log('Playing card face down:', selectedCard.cardId);
        this.gameScene.hideActionButtons();
        
        // TODO: Add face down placement logic here
        console.log('🚧 [PLACEHOLDER] Face down placement logic needed');
    }

    /**
     * Handle card inspection action
     */
    handleInspectAction(selectedCard) {
        if (!this.validateSelectedCard(selectedCard, 'inspect action')) {
            return;
        }
        
        // Implementation for inspecting card details
        console.log('Inspecting card:', selectedCard.cardId);
        // Keep buttons visible for inspect action
        
        // TODO: Add card detail view logic here
        console.log('🚧 [PLACEHOLDER] Card detail view logic needed');
    }

    /**
     * Handle return card to hand action
     */
    handleReturnAction(selectedCard) {
        if (!this.validateSelectedCard(selectedCard, 'return action')) {
            return;
        }
        
        // Implementation for returning card to original position
        console.log('Returning card to original position:', selectedCard.cardId);
        this.gameStateManager.clearSelectedCard();
        this.gameScene.hideActionButtons();
        
        // TODO: Add return logic here
        console.log('🚧 [PLACEHOLDER] Return card logic needed');
    }

    /**
     * Handle cancel selection action
     */
    handleCancelAction() {
        // Implementation for canceling selection
        console.log('Canceling card selection');
        this.gameStateManager.clearSelectedCard();
        this.gameScene.hideActionButtons();
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
}