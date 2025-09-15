// DialogManager.js
// Centralized dialog management system for game UI

import GameSceneUtils from '../utils/GameSceneUtils.js';
import Card from '../components/Card.js';

/**
 * DialogManager - Centralized dialog handling for all UI dialogs in the game
 * 
 * Features:
 * - Multiple dialog type support (card selection, confirmation, info)
 * - Automatic cleanup and memory management
 * - Dialog state tracking and prevention of duplicates
 * - Consistent styling and behavior across all dialogs
 * - Queue system for managing multiple dialogs
 */
export default class DialogManager {
  constructor(scene) {
    this.scene = scene;
    this.activeDialogs = new Map(); // Track active dialogs by ID
    this.dialogQueue = []; // Queue for pending dialogs
    this.nextDialogId = 1; // Auto-incrementing dialog ID
    
    // Dialog type configurations
    this.dialogTypes = {
      CARD_SELECTION: 'card_selection',
      CONFIRMATION: 'confirmation', 
      INFORMATION: 'information',
      REDRAW_CONFIRMATION: 'redraw_confirmation',
      BURST_EFFECT_CHOICE: 'burst_effect_choice'
    };
  }

  /**
   * Show a card selection dialog (main use case for game mechanics)
   * @param {string} selectionId - Unique identifier for the selection
   * @param {Object} selection - Selection configuration object
   * @param {Function} onConfirm - Callback when user confirms selection
   * @returns {string} Dialog ID for tracking/cleanup
   */
  showCardSelectionDialog(selectionId, selection, onConfirm) {
    console.log('DialogManager: Showing card selection dialog:', selectionId, selection);
    
    // Check if this selection dialog is already active
    const existingDialogId = this.findDialogBySelectionId(selectionId);
    if (existingDialogId) {
      console.log('DialogManager: Card selection dialog already active for:', selectionId);
      return existingDialogId;
    }
    
    // Generate unique dialog ID
    const dialogId = `card_selection_${this.nextDialogId++}`;
    
    // Clean up any existing card selection dialogs (prevent multiple card selection dialogs)
    this.closeDialogsByType(this.dialogTypes.CARD_SELECTION);
    
    // Create dialog using existing GameSceneUtils
    const dialogInterface = GameSceneUtils.createCardSelectionDialog(
      selectionId, 
      selection, 
      this.scene, 
      (selectedId, selectedCards, elements) => {
        this.handleCardSelectionComplete(dialogId, selectionId, selectedCards, onConfirm);
      }
    );
    
    // Store dialog in active dialogs map
    this.activeDialogs.set(dialogId, {
      id: dialogId,
      type: this.dialogTypes.CARD_SELECTION,
      selectionId: selectionId,
      interface: dialogInterface,
      createdAt: Date.now()
    });
    
    console.log(`DialogManager: Created card selection dialog with ID: ${dialogId}`);
    return dialogId;
  }

  /**
   * Show a confirmation dialog (for redraw, quit, etc.)
   * @param {Object} config - Dialog configuration
   * @param {Function} onConfirm - Callback for confirm action
   * @param {Function} onCancel - Callback for cancel action
   * @returns {string} Dialog ID
   */
  showConfirmationDialog(config, onConfirm, onCancel) {
    console.log('DialogManager: Showing confirmation dialog:', config);
    
    const dialogId = `confirmation_${this.nextDialogId++}`;
    
    // Create dialog elements
    const { width, height } = this.scene.cameras.main;
    
    // Semi-transparent overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(1500);
    
    // Dialog background
    const dialogWidth = config.width || 400;
    const dialogHeight = config.height || 200;
    const dialogX = width / 2;
    const dialogY = height / 2;
    
    const dialogBg = this.scene.add.graphics();
    dialogBg.fillStyle(0x2a2a2a);
    dialogBg.fillRoundedRect(dialogX - dialogWidth/2, dialogY - dialogHeight/2, dialogWidth, dialogHeight, 15);
    dialogBg.lineStyle(3, 0x4a4a4a);
    dialogBg.strokeRoundedRect(dialogX - dialogWidth/2, dialogY - dialogHeight/2, dialogWidth, dialogHeight, 15);
    dialogBg.setDepth(1501);
    
    // Title text
    const titleText = this.scene.add.text(dialogX, dialogY - 40, config.title || 'Confirmation', {
      fontSize: '20px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff',
      align: 'center'
    });
    titleText.setOrigin(0.5);
    titleText.setDepth(1503);
    
    // Message text
    const messageText = this.scene.add.text(dialogX, dialogY, config.message || 'Are you sure?', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#cccccc',
      align: 'center',
      wordWrap: { width: dialogWidth - 40 }
    });
    messageText.setOrigin(0.5);
    messageText.setDepth(1503);
    
    // Buttons
    const buttonY = dialogY + 50;
    const buttonWidth = 100;
    const buttonHeight = 35;
    const buttonSpacing = 20; // Gap between buttons to prevent overlap
    
    // Confirm button (left side with proper spacing)
    const confirmButton = this.scene.add.graphics();
    confirmButton.fillStyle(0x4CAF50);
    confirmButton.fillRoundedRect(dialogX - buttonWidth - buttonSpacing/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight, 8);
    confirmButton.setDepth(1502);
    confirmButton.setInteractive(new Phaser.Geom.Rectangle(dialogX - buttonWidth - buttonSpacing/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
    
    const confirmText = this.scene.add.text(dialogX - buttonWidth/2 - buttonSpacing/2, buttonY, config.confirmText || 'Yes', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    });
    confirmText.setOrigin(0.5);
    confirmText.setDepth(1503);
    
    // Cancel button (right side with proper spacing)
    const cancelButton = this.scene.add.graphics();
    cancelButton.fillStyle(0xf44336);
    cancelButton.fillRoundedRect(dialogX + buttonSpacing/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight, 8);
    cancelButton.setDepth(1502);
    cancelButton.setInteractive(new Phaser.Geom.Rectangle(dialogX + buttonSpacing/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
    
    const cancelText = this.scene.add.text(dialogX + buttonWidth/2 + buttonSpacing/2, buttonY, config.cancelText || 'No', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    });
    cancelText.setOrigin(0.5);
    cancelText.setDepth(1503);
    
    // Dialog elements for cleanup
    const elements = [overlay, dialogBg, titleText, messageText, confirmButton, confirmText, cancelButton, cancelText];
    
    // Button event handlers
    confirmButton.on('pointerdown', () => {
      this.closeDialog(dialogId);
      if (onConfirm) onConfirm();
    });
    
    cancelButton.on('pointerdown', () => {
      this.closeDialog(dialogId);
      if (onCancel) onCancel();
    });
    
    // Store dialog
    this.activeDialogs.set(dialogId, {
      id: dialogId,
      type: this.dialogTypes.CONFIRMATION,
      interface: { elements: elements, cleanup: () => this.cleanupElements(elements) },
      createdAt: Date.now()
    });
    
    console.log(`DialogManager: Created confirmation dialog with ID: ${dialogId}`);
    return dialogId;
  }

  /**
   * Show a simple information dialog
   * @param {Object} config - Dialog configuration
   * @param {Function} onClose - Callback when dialog is closed
   * @returns {string} Dialog ID
   */
  showInformationDialog(config, onClose) {
    console.log('DialogManager: Showing information dialog:', config);
    
    const dialogId = `info_${this.nextDialogId++}`;
    
    // Create simple info dialog
    const { width, height } = this.scene.cameras.main;
    
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.5);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(1500);
    
    const dialogWidth = config.width || 350;
    const dialogHeight = config.height || 150;
    const dialogX = width / 2;
    const dialogY = height / 2;
    
    const dialogBg = this.scene.add.graphics();
    dialogBg.fillStyle(0x2a2a2a);
    dialogBg.fillRoundedRect(dialogX - dialogWidth/2, dialogY - dialogHeight/2, dialogWidth, dialogHeight, 15);
    dialogBg.setDepth(1501);
    
    const titleText = this.scene.add.text(dialogX, dialogY - 30, config.title || 'Information', {
      fontSize: '18px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff',
      align: 'center'
    });
    titleText.setOrigin(0.5);
    titleText.setDepth(1503);
    
    const messageText = this.scene.add.text(dialogX, dialogY + 10, config.message || '', {
      fontSize: '14px',
      fontFamily: 'Arial',
      fill: '#cccccc',
      align: 'center',
      wordWrap: { width: dialogWidth - 40 }
    });
    messageText.setOrigin(0.5);
    messageText.setDepth(1503);
    
    const okButton = this.scene.add.graphics();
    okButton.fillStyle(0x2196F3);
    okButton.fillRoundedRect(dialogX - 40, dialogY + 45, 80, 30, 8);
    okButton.setDepth(1502);
    okButton.setInteractive(new Phaser.Geom.Rectangle(dialogX - 40, dialogY + 45, 80, 30), Phaser.Geom.Rectangle.Contains);
    
    const okText = this.scene.add.text(dialogX, dialogY + 60, 'OK', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    });
    okText.setOrigin(0.5);
    okText.setDepth(1503);
    
    const elements = [overlay, dialogBg, titleText, messageText, okButton, okText];
    
    okButton.on('pointerdown', () => {
      this.closeDialog(dialogId);
      if (onClose) onClose();
    });
    
    this.activeDialogs.set(dialogId, {
      id: dialogId,
      type: this.dialogTypes.INFORMATION,
      interface: { elements: elements, cleanup: () => this.cleanupElements(elements) },
      createdAt: Date.now()
    });
    
    console.log(`DialogManager: Created information dialog with ID: ${dialogId}`);
    return dialogId;
  }

  /**
   * Show a burst effect confirmation dialog using select dialog style
   * @param {Object} event - BURST_EFFECT_CHOICE event from processingQueue
   * @param {Function} onConfirm - Callback when user confirms (true/false)
   * @returns {string} Dialog ID
   */
  showBurstEffectDialog(event, onConfirm) {
    console.log('DialogManager: Showing burst effect confirmation dialog:', event);
    
    const dialogId = `burst_effect_${this.nextDialogId++}`;
    
    // Clean up any existing burst effect dialogs (prevent multiple burst dialogs)
    this.closeDialogsByType(this.dialogTypes.BURST_EFFECT_CHOICE);
    
    // Extract card and effect information from event
    const cardData = event.data.cardData;
    const burstEffect = event.data.burstEffect;
    const cardName = cardData.name || `Card ${event.data.cardId}`;
    
    console.log('Burst effect card data:', cardData);
    console.log('Burst effect details:', burstEffect);
    
    // Create a fake selection object that matches the card selection dialog format
    const burstSelection = {
      selectionId: `burst_${event.id}`,
      title: '💥 Burst Effect Available',
      description: `Effect: ${burstEffect.description || `Activate ${burstEffect.type} effect`}`,
      selectCount: 1, // Always select the one card
      eligibleCards: [{
        cardData: cardData,
        cardId: cardData.id || event.data.cardId,
        cardUid: event.data.cardId,
        preSelected: true // Mark this card as pre-selected
      }],
      dialogType: 'BURST_EFFECT_CHOICE',
      autoSelectFirst: true // Flag to indicate first card should be auto-selected
    };
    
    // Create dialog using existing GameSceneUtils with burst effect styling
    const dialogInterface = GameSceneUtils.createCardSelectionDialog(
      burstSelection.selectionId,
      burstSelection,
      this.scene,
      (selectedId, selectedCards, elements) => {
        // Handle burst effect confirmation
        console.log('DialogManager: Burst effect card selected:', selectedCards);
        
        // Create custom confirmation for burst effect
        this.showBurstConfirmation(selectedCards[0], burstEffect, dialogId, onConfirm);
      }
    );
    
    // Auto-select the first (and only) card after dialog is created
    this.autoSelectFirstCard(dialogInterface, burstSelection.eligibleCards[0]);
    
    // Override the dialog styling to add orange burst effect theme
    this.applyBurstStyling(dialogInterface);
    
    // Store dialog with GameSceneUtils interface
    this.activeDialogs.set(dialogId, {
      id: dialogId,
      type: this.dialogTypes.BURST_EFFECT_CHOICE,
      eventId: event.id,
      interface: dialogInterface,
      createdAt: Date.now()
    });
    
    console.log(`DialogManager: Created burst effect dialog with ID: ${dialogId}`);
    return dialogId;
  }
  
  /**
   * Auto-select the first card in the dialog for burst effects
   * @private
   */
  autoSelectFirstCard(dialogInterface, cardToSelect) {
    // Use scene events to auto-select the first card once dialog is ready
    const autoSelectListener = () => {
      try {
        console.log('Auto-selecting first card for burst effect:', cardToSelect);
        
        // Look for Card components in the dialog elements
        if (dialogInterface.elements) {
          for (let element of dialogInterface.elements) {
            // Check if this is a Card component
            if (element.cardData || element.type === 'Container') {
              // Simulate a click event on the card
              const fakePointer = { 
                leftButtonDown: () => true,
                rightButtonDown: () => false 
              };
              
              // Try different ways to trigger selection
              if (element.handlePointerDown) {
                element.handlePointerDown(fakePointer, 0, 0, {});
                break;
              } else if (element.events && element.events.emit) {
                element.events.emit('pointerdown', fakePointer, 0, 0, {});
                break;
              }
            }
          }
        }
      } catch (error) {
        console.log('Auto-select failed, user can select manually:', error);
      }
      
      // Remove the listener after one attempt
      this.scene.events.off('postupdate', autoSelectListener);
    };
    
    // Wait for next frame to ensure dialog is fully created
    this.scene.events.once('postupdate', autoSelectListener);
  }
  
  /**
   * Apply burst effect styling to the select dialog
   * @private
   */
  applyBurstStyling(dialogInterface) {
    // Find and modify dialog elements to add orange burst effect styling
    if (dialogInterface.elements) {
      dialogInterface.elements.forEach(element => {
        // Add orange glow to dialog background
        if (element.type === 'Graphics' && element.lineStyle) {
          try {
            // Try to add orange stroke to existing graphics
            element.lineStyle(3, 0xff6b35);
          } catch (e) {
            // Ignore errors for elements that can't be modified
          }
        }
      });
    }
  }
  
  /**
   * Show burst effect confirmation after card is selected
   * @private
   */
  showBurstConfirmation(selectedCard, burstEffect, originalDialogId, onConfirm) {
    // Close the original card selection dialog
    this.closeDialog(originalDialogId);
    
    // Show simple confirmation dialog for burst effect
    this.showConfirmationDialog({
      title: '💥 Activate Burst Effect?',
      message: `Do you want to activate the burst effect on ${selectedCard.cardData?.name || 'this card'}?\n\nEffect: ${burstEffect.description || `${burstEffect.type} effect`}`,
      width: 450,
      height: 200,
      confirmText: 'Activate',
      cancelText: 'Skip'
    }, 
    () => {
      // User confirmed
      console.log('DialogManager: User confirmed burst effect');
      if (onConfirm) onConfirm(true);
    },
    () => {
      // User cancelled  
      console.log('DialogManager: User declined burst effect');
      if (onConfirm) onConfirm(false);
    });
  }

  /**
   * Close a specific dialog by ID
   * @param {string} dialogId - Dialog ID to close
   */
  closeDialog(dialogId) {
    const dialog = this.activeDialogs.get(dialogId);
    if (!dialog) {
      console.warn(`DialogManager: Dialog ${dialogId} not found for closing`);
      return;
    }
    
    console.log(`DialogManager: Closing dialog ${dialogId}`);
    
    // Clean up dialog interface
    if (dialog.interface) {
      if (dialog.interface.cleanup) {
        dialog.interface.cleanup();
      } else if (Array.isArray(dialog.interface)) {
        dialog.interface.forEach(element => element.destroy());
      } else if (dialog.interface.elements) {
        this.cleanupElements(dialog.interface.elements);
      }
    }
    
    // Remove from active dialogs
    this.activeDialogs.delete(dialogId);
    
    console.log(`DialogManager: Dialog ${dialogId} closed successfully`);
  }

  /**
   * Close all dialogs of a specific type
   * @param {string} dialogType - Type of dialogs to close
   */
  closeDialogsByType(dialogType) {
    const dialogsToClose = [];
    this.activeDialogs.forEach((dialog, id) => {
      if (dialog.type === dialogType) {
        dialogsToClose.push(id);
      }
    });
    
    dialogsToClose.forEach(dialogId => this.closeDialog(dialogId));
    console.log(`DialogManager: Closed ${dialogsToClose.length} dialogs of type ${dialogType}`);
  }

  /**
   * Close all active dialogs
   */
  closeAllDialogs() {
    const dialogIds = Array.from(this.activeDialogs.keys());
    dialogIds.forEach(dialogId => this.closeDialog(dialogId));
    console.log(`DialogManager: Closed all ${dialogIds.length} active dialogs`);
  }

  /**
   * Check if any dialogs are currently active
   * @returns {boolean} True if dialogs are active
   */
  hasActiveDialogs() {
    return this.activeDialogs.size > 0;
  }

  /**
   * Get information about active dialogs
   * @returns {Array} Array of dialog info objects
   */
  getActiveDialogs() {
    return Array.from(this.activeDialogs.values()).map(dialog => ({
      id: dialog.id,
      type: dialog.type,
      selectionId: dialog.selectionId,
      createdAt: dialog.createdAt
    }));
  }

  /**
   * Find dialog by selection ID (for card selection dialogs)
   * @param {string} selectionId - Selection ID to find
   * @returns {string|null} Dialog ID if found
   */
  findDialogBySelectionId(selectionId) {
    for (let [dialogId, dialog] of this.activeDialogs) {
      if (dialog.selectionId === selectionId) {
        return dialogId;
      }
    }
    return null;
  }

  /**
   * Handle completion of card selection (internal callback)
   * @param {string} dialogId - Dialog ID
   * @param {string} selectionId - Selection ID 
   * @param {Array} selectedCards - Selected cards
   * @param {Function} onConfirm - Original callback
   */
  handleCardSelectionComplete(dialogId, selectionId, selectedCards, onConfirm) {
    console.log('DialogManager: Card selection completed:', dialogId, selectionId, selectedCards);
    
    // Close the dialog (cleanup already handled by GameSceneUtils)
    this.activeDialogs.delete(dialogId);
    
    // Call the original callback
    if (onConfirm) {
      onConfirm(selectionId, selectedCards);
    }
  }

  /**
   * Cleanup dialog elements (utility method)
   * @param {Array} elements - Array of Phaser objects to destroy
   */
  cleanupElements(elements) {
    if (Array.isArray(elements)) {
      elements.forEach(element => {
        if (element && element.destroy) {
          element.destroy();
        }
      });
    }
  }

  /**
   * Cleanup all dialogs and resources (called when scene is destroyed)
   */
  destroy() {
    console.log('DialogManager: Destroying all dialogs and resources');
    this.closeAllDialogs();
    this.dialogQueue.length = 0;
    this.activeDialogs.clear();
  }

  /**
   * Debug method to log current state
   */
  debugState() {
    console.log('DialogManager Debug State:');
    console.log('Active dialogs:', this.activeDialogs.size);
    console.log('Dialog queue:', this.dialogQueue.length);
    this.activeDialogs.forEach((dialog, id) => {
      console.log(`  Dialog ${id}: type=${dialog.type}, created=${new Date(dialog.createdAt).toLocaleTimeString()}`);
    });
  }
}