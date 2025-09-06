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
                this.handlePlayCardAction(selectedCard, 'unit');
                break;
            case 'playCommand':
                this.handlePlayCardAction(selectedCard, 'command');
                break;
            case 'playPilot':
                this.handlePlayCardAction(selectedCard, 'pilot');
                break;
            case 'playBase':
                this.handlePlayCardAction(selectedCard, 'base');
                break;
            default:
                console.log(`Unknown action: ${action}`);
        }
    }

    /**
     * Unified method to handle all card play actions
     * Consolidates handlePlayAction, handlePlayCommandAction, handlePlayPilotAction, and handleDeployBaseAction
     * 
     * @param {Object} selectedCard - The selected card object
     * @param {string} playAs - How to play the card ('unit', 'command', 'pilot', 'base')
     */
    async handlePlayCardAction(selectedCard, playAs) {
        const actionName = `${playAs} play`;
        
        if (!this.validateSelectedCard(selectedCard, actionName)) {
            return;
        }
        
        console.log(`Playing card as ${playAs.charAt(0).toUpperCase() + playAs.slice(1)}:`, selectedCard.fullCardData.cardUid);
        this.gameScene.actionButtonManager.hide();
        
        // Special handling for pilot cards - show unit selection dialog
        if (playAs === 'pilot') {
            this.handlePilotCardSelection(selectedCard);
            return;
        }
        
        try {
            const cardUID = selectedCard.fullCardData.cardUid;
            
            if (!cardUID) {
                this.showErrorMessage('Card not found in hand.');
                return;
            }
            
            const gameState = this.gameStateManager.getGameState();
            this.setUILoadingState(true);
            
            // Create structured action with playAs specification
            const action = {
                type: 'PlayCard',
                cardUID: cardUID,
                playAs: playAs
            };
            
            console.log(`Calling backend playCard API to play card as ${playAs}:`, action);
            
            if (this.apiManager) {
                const response = await this.apiManager.playCard(
                    gameState.playerId,
                    gameState.gameId,
                    action
                );
                
                console.log('PlayCard response:', response);
                
                if (response && response.success) {
                    console.log(`✅ ${playAs.charAt(0).toUpperCase() + playAs.slice(1)} card played successfully`);
                    this.gameStateManager.updateGameEnv(response.gameEnv);
                    this.updateGameState();
                    this.updatePlayerHand();
                    this.clearZoneHighlights();
                } else {
                    console.error(`❌ Failed to play ${playAs} card:`, response?.error);
                    this.showErrorMessage(response?.error || `Failed to play ${playAs} card`);
                }
            } else {
                console.log('Demo mode: Would call backend playCard API');
                this.showErrorMessage('Demo mode - Backend API not available');
            }
            
        } catch (error) {
            console.error(`Error playing ${playAs} card:`, error);
            this.showErrorMessage(`Failed to play ${playAs} card. Please try again.`);
        } finally {
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
     * Handle pilot card selection by showing unit selection dialog
     * @param {Object} selectedCard - The pilot card to be played
     */
    handlePilotCardSelection(selectedCard) {
        console.log('Handling pilot card selection:', selectedCard);
        
        // Get current game state
        const gameState = this.gameStateManager.getGameState();
        const playerId = gameState.playerId;
        
        // Get player's zones to find available units
        const playerData = gameState.gameEnv?.players?.[playerId];
        if (!playerData || !playerData.zones) {
            this.showErrorMessage('Unable to access player zones');
            return;
        }
        
        // Find all units in slots (slot1-slot6) - use units directly without conversion
        const eligibleCards = [];
        for (let i = 1; i <= 6; i++) {
            const slotName = `slot${i}`;
            const slot = playerData.zones[slotName];
            if (slot && slot.unit) {
                // Use the unit directly with minimal metadata additions
                const unit = slot.unit;
                unit.slot = slotName; // Add slot info directly to existing unit object
                eligibleCards.push(unit);
            }
        }
        
        if (eligibleCards.length === 0) {
            this.showErrorMessage('No units available to pilot. Place unit cards first.');
            return;
        }
        
        // Create a unique selection ID
        const selectionId = `pilot_target_${Date.now()}`;
        
        // Create selection data compatible with existing system
        const selectionData = {
            playerId: playerId,
            eligibleCards: eligibleCards,
            dialogType:"SELECT_UNIT_FOR_PILOT",
            selectCount: 1,
            title: 'Select Unit to Pilot',
            description: 'Choose which unit this pilot card should attach to',
            callback: (selectedCards) => {
                console.log('Unit selected for piloting:', selectedCards);
                if (selectedCards && selectedCards.length > 0) {
                    const selectedUnit = selectedCards[0];
                    // selectedUnit is now the direct unit object, no need to find it
                    this.executePilotCardPlay(selectedCard, selectedUnit);
                }
            },
            onCancel: () => {
                console.log('Pilot card selection cancelled');
                // The existing dialog system will handle cleanup
            }
        };
        
        // Use the existing showCardSelectionDialog method
        if (this.gameScene.showCardSelectionDialog) {
            this.gameScene.showCardSelectionDialog(selectionId, selectionData);
        } else {
            console.error('showCardSelectionDialog method not available');
            this.showErrorMessage('Card selection dialog not available');
        }
    }

    /**
     * Execute pilot card play with selected target unit
     * @param {Object} selectedCard - The pilot card to be played
     * @param {Object} selectedUnit - The unit to attach the pilot to
     */
    async executePilotCardPlay(selectedCard, selectedUnit) {
        try {
            const cardUID = selectedCard.fullCardData.cardUid;
            const targetUnit = selectedUnit.cardUid; // Use the unit's cardUid as targetUnit
            
            if (!cardUID) {
                this.showErrorMessage('Card not found in hand.');
                return;
            }
            
            const gameState = this.gameStateManager.getGameState();
            this.setUILoadingState(true);
            
            // Create structured action with playAs and targetUnit
            const action = {
                type: 'PlayCard',
                cardUID: cardUID,
                playAs: 'pilot',
                targetUnit: targetUnit
            };
            
            console.log(`Calling backend playCard API to play pilot card:`, action);
            
            if (this.apiManager) {
                const response = await this.apiManager.playCard(
                    gameState.playerId,
                    gameState.gameId,
                    action
                );
                
                console.log('PlayCard response:', response);
                
                if (response && response.success) {
                    console.log(`✅ Pilot card played successfully on unit ${selectedUnit.cardId}`);
                    this.gameStateManager.updateGameEnv(response.gameEnv);
                    this.updateGameState();
                    this.updatePlayerHand();
                    this.clearZoneHighlights();
                } else {
                    console.error(`❌ Failed to play pilot card:`, response?.error);
                    this.showErrorMessage(response?.error || `Failed to play pilot card`);
                }
            } else {
                console.log('Demo mode: Would call backend playCard API with pilot target');
                this.showErrorMessage('Demo mode - Backend API not available');
            }
            
        } catch (error) {
            console.error(`Error playing pilot card:`, error);
            this.showErrorMessage(`Failed to play pilot card. Please try again.`);
        } finally {
            this.setUILoadingState(false);
        }
    }

}