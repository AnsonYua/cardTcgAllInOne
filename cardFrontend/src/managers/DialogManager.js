// DialogManager.js
// Centralized dialog management system for game UI

import DialogUIManager from './DialogUIManager.js';
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
      BURST_EFFECT_CHOICE: 'burst_effect_choice',
      DEPLOY_TARGET_CHOICE: 'deploy_target_choice'
    };
  }

  /**
   * Show a card selection dialog (main use case for game mechanics)
   * @param {string} selectionId - Unique identifier for the selection
   * @param {Object} selection - Selection configuration object
   * @param {Function} onConfirm - Callback when user confirms selection
   * @returns {string} Dialog ID for tracking/cleanup
   */
  /**
   * Unified card selection dialog (handles slots, carduid, and trash selections)
   * This is the main dialog method that can handle all types of card selections
   */
  showCardSelectionDialog(selectionId, selection, onConfirm) {
    console.log('DialogManager: Showing unified card selection dialog:', JSON.stringify(selection));

    // Check if this selection dialog is already active
    const existingDialogId = this.findDialogBySelectionId(selectionId);
    if (existingDialogId) {
      console.log('DialogManager: Card selection dialog already active for:', selectionId);
      return existingDialogId;
    }

    // Generate unique dialog ID
    const dialogId = `card_selection_${this.nextDialogId++}`;

    // Clean up any existing card selection dialogs (prevent multiple dialogs)
    this.closeDialogsByType(this.dialogTypes.CARD_SELECTION);
    this.closeDialogsByType(this.dialogTypes.DEPLOY_TARGET_CHOICE);

    // Create dialog using DialogUIManager directly
    const dialogInterface = DialogUIManager.createCardSelectionDialog(
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
      type: selection.dialogType || this.dialogTypes.CARD_SELECTION,
      selectionId: selectionId,
      interface: dialogInterface,
      createdAt: Date.now()
    });

    console.log(`DialogManager: Created card selection dialog with ID: ${dialogId}`);
    return dialogId;
  }

  /*
  add a comment here to describe the structure of selection show is it can trigger
    SlotSelection, items should look like this
     {
          "cardUid": "ST01-009_d0276af7-b917-45ba-8e16-692d241a7360",
          "zone": "slot1",
          "playerId": "playerId_1"
     }
  */


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
    dialogBg.fillRoundedRect(dialogX - dialogWidth / 2, dialogY - dialogHeight / 2, dialogWidth, dialogHeight, 15);
    dialogBg.lineStyle(3, 0x4a4a4a);
    dialogBg.strokeRoundedRect(dialogX - dialogWidth / 2, dialogY - dialogHeight / 2, dialogWidth, dialogHeight, 15);
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
    confirmButton.fillRoundedRect(dialogX - buttonWidth - buttonSpacing / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
    confirmButton.setDepth(1502);
    confirmButton.setInteractive(new Phaser.Geom.Rectangle(dialogX - buttonWidth - buttonSpacing / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);

    const confirmText = this.scene.add.text(dialogX - buttonWidth / 2 - buttonSpacing / 2, buttonY, config.confirmText || 'Yes', {
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
    cancelButton.fillRoundedRect(dialogX + buttonSpacing / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 8);
    cancelButton.setDepth(1502);
    cancelButton.setInteractive(new Phaser.Geom.Rectangle(dialogX + buttonSpacing / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);

    const cancelText = this.scene.add.text(dialogX + buttonWidth / 2 + buttonSpacing / 2, buttonY, config.cancelText || 'No', {
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
    dialogBg.fillRoundedRect(dialogX - dialogWidth / 2, dialogY - dialogHeight / 2, dialogWidth, dialogHeight, 15);
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

    // Create selection object with new items format
    const burstSelection = {
      selectionId: `burst_${event.id}`,
      title: '💥 Burst Effect Available',
      description: `Effect: ${burstEffect.description || `Activate ${burstEffect.type} effect`}`,
      selectCount: 1, // Always select the one card
      items: [{
        type: 'carduid',
        cardUid: event.data.cardId,
        preSelected: true // Mark this card as pre-selected
      }],
      dialogType: 'BURST_EFFECT_CHOICE',
      autoSelectFirst: true // Flag to indicate first card should be auto-selected
    };

    // Create dialog using DialogUIManager directly with burst effect styling
    const dialogInterface = DialogUIManager.createCardSelectionDialog(
      burstSelection.selectionId,
      burstSelection,
      this.scene,
      (selectedId, selectedCards, elements) => {
        // Handle burst effect activation - directly call API
        console.log('DialogManager: Burst effect ACTIVATE clicked:', selectedCards);

        // Close the current dialog
        this.closeDialog(dialogId);

        // Directly activate the burst effect (call onConfirm with true)
        console.log('DialogManager: Activating burst effect directly');
        if (onConfirm) onConfirm(true);
      }
    );

    // Handle SKIP button (cancel action) - listen for dialog-cancelled event
    const handleSkip = (eventSelectionId) => {
      if (eventSelectionId === burstSelection.selectionId) {
        console.log('DialogManager: Burst effect SKIP clicked');

        // Close the current dialog  
        this.closeDialog(dialogId);

        // Skip the burst effect (call onConfirm with false)
        console.log('DialogManager: Skipping burst effect');
        if (onConfirm) onConfirm(false);

        // Remove the event listener
        this.scene.events.off('dialog-cancelled', handleSkip);
      }
    };

    // Listen for cancel events (SKIP button)
    this.scene.events.on('dialog-cancelled', handleSkip);

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
   * Show a deploy target selection dialog using select dialog style
   * @param {Object} event - DEPLOY_TARGET_CHOICE event from processingQueue
   * @param {Function} onConfirm - Callback when user confirms target selection
   * @returns {string} Dialog ID
   */
  /**
   * Show attack target selection dialog
   * Specialized method for selecting opponent units to attack
   * 
   * @param {string} attackerId - ID of the attacking player
   * @param {string} opponentId - ID of the opponent player
   * @param {Object} selectedCard - The attacking card/unit
   * @param {Function} onAttackConfirm - Callback when attack target is selected
   * @returns {string} Dialog ID for tracking/cleanup
   */
  showAttackSelectionDialog(attackerId, opponentId, selectedCard, onAttackConfirm) {
    console.log('DialogManager: Showing attack target selection dialog');

    // Get game state to check which slots actually contain units
    const gameState = this.scene.gameStateManager.getGameState();
    const opponentData = gameState.gameEnv?.players?.[opponentId];

    if (!opponentData?.zones) {
      console.error('DialogManager: Opponent data or zones not found');
      return null;
    }

    // Create items only for slots that actually contain units
    const items = [];
    for (let i = 1; i <= 6; i++) {
      const slotName = `slot${i}`;
      const slot = opponentData.zones[slotName];

      // Only add item if slot contains a unit
      if (slot?.unit?.cardUid) {
        items.push({
          type: 'slot',
          playerId: opponentId,
          zone: slotName,
          cardUid: slot.unit.cardUid // Include the actual unit cardUid
        });
      }
    }

    // Check if there are any valid targets
    if (items.length === 0) {
      console.warn('DialogManager: No valid attack targets found');
      // Could show an error message or handle this case
      return null;
    }

    // Create a unique selection ID
    const selectionId = `attack_target_${Date.now()}`;

    // Create selection data with items format
    const selectionData = {
      playerId: attackerId,
      items: items,
      dialogType: "SELECT_ATTACK_TARGET",
      selectCount: 1,
      numberOfSections: 1,
      title: '选择攻击目标',
      description: '选择要攻击的对手机体',
      callback: (selectionId, selectedCards) => {
        console.log('DialogManager: Attack target selected:', selectionId, selectedCards);
        const cardsArray = Array.isArray(selectedCards) ? selectedCards : [selectedCards];
        if (cardsArray && cardsArray.length > 0) {
          const targetUnit = cardsArray[0];
          if (onAttackConfirm) {
            onAttackConfirm(selectedCard, targetUnit);
          }
        }
      },
      onCancel: () => {
        console.log('DialogManager: Attack target selection cancelled');
      }
    };

    // Use unified card selection dialog
    return this.showCardSelectionDialog(selectionId, selectionData, selectionData.callback);
  }

  /**
   * Show pilot target selection dialog
   * Specialized method for selecting player units to attach pilots to
   * 
   * @param {string} playerId - ID of the player placing the pilot
   * @param {Object} pilotCard - The pilot card to be played
   * @param {Function} onPilotConfirm - Callback when pilot target is selected
   * @returns {string} Dialog ID for tracking/cleanup
   */
  showPilotSelectionDialog(playerId, pilotCard, onPilotConfirm) {
    console.log('DialogManager: Showing pilot target selection dialog');

    // Get game state to check which slots actually contain units without pilots
    const gameState = this.scene.gameStateManager.getGameState();
    const playerData = gameState.gameEnv?.players?.[playerId];

    if (!playerData?.zones) {
      console.error('DialogManager: Player data or zones not found');
      return null;
    }

    // Create items only for slots that contain units but no pilots
    const items = [];
    for (let i = 1; i <= 6; i++) {
      const slotName = `slot${i}`;
      const slot = playerData.zones[slotName];

      // Only add item if slot contains a unit but no pilot
      if (slot?.unit?.cardUid && !slot.pilot) {
        items.push({
          type: 'slot',
          playerId: playerId,
          zone: slotName,
          cardUid: slot.unit.cardUid // Include the actual unit cardUid
        });
      }
    }

    // Check if there are any valid targets
    if (items.length === 0) {
      console.warn('DialogManager: No valid pilot targets found (need units without pilots)');
      // Could show an error message or handle this case
      return null;
    }

    // Create a unique selection ID
    const selectionId = `pilot_target_${Date.now()}`;

    // Create selection data with items format
    const selectionData = {
      playerId: playerId,
      items: items,
      dialogType: "SELECT_UNIT_FOR_PILOT",
      selectCount: 1,
      numberOfSections: 1,
      title: 'Select Unit to Pilot',
      description: 'Choose which unit this pilot card should attach to',
      callback: (selectionId, selectedCards) => {
        console.log('DialogManager: Pilot target selected:', selectionId, selectedCards);
        const cardsArray = Array.isArray(selectedCards) ? selectedCards : [selectedCards];
        if (cardsArray && cardsArray.length > 0) {
          const selectedUnit = cardsArray[0];
          if (onPilotConfirm) {
            onPilotConfirm(pilotCard, selectedUnit);
          }
        }
      },
      onCancel: () => {
        console.log('DialogManager: Pilot target selection cancelled');
      }
    };

    // Use unified card selection dialog
    return this.showCardSelectionDialog(selectionId, selectionData, selectionData.callback);
  }


  showDeployTargetDialog(event, onConfirm) {
    console.log('DialogManager: Redirecting deploy target dialog to unified slot selection');

    // Extract deploy effect and target information from event
    const { deployEffect, availableTargets, sourceCardUid, cardId } = event.data;
    const effectDescription = deployEffect?.effect?.action || 'Select Target';

    // Convert backend availableTargets to items format
    const items = availableTargets.map(target => ({
      type: 'slot',
      playerId: target.playerId,
      zone: target.zone,
      cardUid: target.cardUid // Optional constraint for specific card
    }));

    // Create a selection object using unified format
    const deploySelection = {
      selectionId: `deploy_target_${event.id}`,
      title: '🎯 Deploy Effect Target Selection',
      description: `Effect: ${effectDescription} - Choose a target`,
      selectCount: 1, // Always select one target
      items: items,
      dialogType: 'DEPLOY_TARGET_CHOICE',
      autoSelectFirst: false // User must actively select target
    };

    // Use unified card selection dialog
    return this.showCardSelectionDialog(deploySelection.selectionId, deploySelection, (selectionId, selectedCards) => {
      if (selectedCards && selectedCards.length > 0) {
        const selectedTarget = selectedCards[0];
        console.log('DialogManager: Deploy target selected via unified dialog:', selectedTarget);
        if (onConfirm) onConfirm(selectedTarget);
      } else {
        console.log('DialogManager: Deploy target selection cancelled');
        if (onConfirm) onConfirm(null); // Pass null to indicate cancellation
      }
    });
  }



  /**
   * Apply deploy effect styling to the select dialog
   * @private
   */
  applyDeployStyling(dialogInterface) {
    // Find and modify dialog elements to add blue deploy effect styling
    if (dialogInterface.elements) {
      dialogInterface.elements.forEach(element => {
        // Add blue glow to dialog background
        if (element.type === 'Graphics' && element.lineStyle) {
          try {
            // Try to add blue stroke to existing graphics
            element.lineStyle(3, 0x2196F3);
          } catch (e) {
            // Ignore errors for elements that can't be modified
          }
        }
      });
    }
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
  /**
   * Handle unified slot selection completion and cleanup
   * @param {string} dialogId - Dialog ID
   * @param {string} selectionId - Selection ID
   * @param {Array} selectedCards - Selected cards/slots
   * @param {Function} onConfirm - Original callback
   */
  /**
   * Handle unified card selection completion and cleanup
   * @param {string} dialogId - Dialog ID
   * @param {string} selectionId - Selection ID
   * @param {Array} selectedCards - Selected cards (slots, carduid, trash)
   * @param {Function} onConfirm - Original callback
   */
  handleCardSelectionComplete(dialogId, selectionId, selectedCards, onConfirm) {
    console.log('DialogManager: Card selection completed:', dialogId, selectionId, selectedCards);

    // Close the dialog (cleanup already handled by DialogUIManager)
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