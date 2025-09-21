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
   * Helper function to create slot items based on filter conditions
   * @param {Object} playerData - Player data from game state
   * @param {string} playerId - Player ID
   * @param {Function} filterFn - Function to filter slots (slot, slotName) => boolean
   * @returns {Array} Array of slot items
   */
  _createSlotItems(playerData, playerId, filterFn) {
    if (!playerData?.zones) {
      return [];
    }

    const items = [];
    for (let i = 1; i <= 6; i++) {
      const slotName = `slot${i}`;
      const slot = playerData.zones[slotName];

      if (filterFn(slot, slotName)) {
        items.push({
          dialogDisplayType: 'slot',
          playerId: playerId,
          zone: slotName,
          cardUid: slot.unit.cardUid
        });
      }
    }
    return items;
  }

  /**
   * Helper function to create selection data object
   * @param {string} playerId - Player ID
   * @param {Array} eligibleCards - Eligible cards array (already resolved)
   * @param {string} dialogType - Dialog type
   * @param {string} title - Dialog title
   * @param {string} description - Dialog description
   * @param {Function} callback - Selection callback
   * @returns {Object} Selection data object
   */
  _createSelectionData(playerId, eligibleCards, dialogType, title, description, callback) {
    return {
      playerId: playerId,
      eligibleCards: eligibleCards, // Pass eligibleCards directly
      dialogType: dialogType,
      selectCount: 1,
      numberOfSections: 1,
      title: title,
      description: description,
      callback: callback,
      onCancel: () => {
        console.log(`DialogManager: ${dialogType} selection cancelled`);
      }
    };
  }

  /**
   * Helper function to validate eligible cards and show dialog
   * @param {Array} eligibleCards - Eligible cards array to validate
   * @param {string} errorMessage - Error message if no eligible cards found
   * @param {string} selectionId - Selection ID
   * @param {Object} selectionData - Selection data object
   * @returns {string|null} Dialog ID or null if no valid eligible cards
   */
  _validateAndShowDialog(eligibleCards, errorMessage, selectionId, selectionData) {
    if (eligibleCards.length === 0) {
      console.warn(`DialogManager: ${errorMessage}`);
      return null;
    }
    return this.showCardSelectionDialog(selectionId, selectionData, selectionData.callback);
  }

  /**
   * Show a card selection dialog (main use case for game mechanics)
   * @param {string} selectionId - Unique identifier for the selection
   * @param {Object} selection - Selection configuration object
   * @param {Function} onConfirm - Callback when user confirms selection
   * @returns {string} Dialog ID for tracking/cleanup
   */
  /*
   SlotSelection, items should look like this
     {
          "cardUid": "ST01-009_d0276af7-b917-45ba-8e16-692d241a7360",
          "zone": "slot1",
          "playerId": "playerId_1"
          "type":"slow"
     }
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
      },
      // ✅ SIMPLIFIED: Optional onCancel callback parameter
      (cancelInfo) => {
        console.log('DialogManager: Card selection dialog cancelled:', cancelInfo);
        
        // Close the dialog
        this.closeDialog(dialogId);
        
        // Optional: Add any specific cancel handling logic here
        // For example, analytics tracking, user feedback, state reset, etc.
        this.handleCardSelectionCancelled(dialogId, selectionId, cancelInfo);
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
   * @param {Function} onCancel - Optional callback when user cancels (receives cancelInfo)
   * @returns {string} Dialog ID
   */
  showBurstEffectDialog(event, onConfirm, onCancel = null) {
    console.log('DialogManager: Showing burst effect confirmation dialog:', event);

    const dialogId = `burst_effect_${this.nextDialogId++}`;

    // Clean up any existing burst effect dialogs (prevent multiple burst dialogs)
    this.closeDialogsByType(this.dialogTypes.BURST_EFFECT_CHOICE);


    // Create selection object with items format (DialogUIManager will resolve internally)
    const burstSelection = {
      selectionId: `burst_${event.id}`,
      title: '💥 Burst Effect Available',
      description: `burst Effect`,
      selectCount: 1, // Always select the one card
      eligibleCards:event.data.availableTargets,
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

        // DialogUIManager handles dialog cleanup automatically
        // Directly activate the burst effect (call onConfirm with true)
        console.log('DialogManager: Activating burst effect directly');
        if (onConfirm) onConfirm(true);
      },
      // ✅ SIMPLIFIED: Use onCancel parameter instead of event listener
      (cancelInfo) => {
        console.log('DialogManager: Burst effect SKIP clicked via onCancel:', cancelInfo);

        // DialogUIManager handles dialog cleanup automatically
        // Call the onCancel callback if provided, otherwise default to onConfirm(false)
        if (onCancel) {
          console.log('DialogManager: Calling onCancel with cancelInfo');
          onCancel(cancelInfo);
        } else {
          console.log('DialogManager: No onCancel provided, falling back to onConfirm(false)');
          if (onConfirm) onConfirm(false);
        }
      }
    );

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

    // Create eligible cards only for slots that actually contain units
    const eligibleCards = this._createSlotItems(opponentData, opponentId, (slot) => {
      return slot?.unit?.cardUid; // Only slots with units
    });

    // Create selection data and validate
    const selectionId = `attack_target_${Date.now()}`;
    const selectionData = this._createSelectionData(
      attackerId,
      eligibleCards,
      "SELECT_ATTACK_TARGET",
      '选择攻击目标',
      '选择要攻击的对手机体',
      (selectionId, selectedCards) => {
        console.log('DialogManager: Attack target selected:', selectionId, selectedCards);
        const cardsArray = Array.isArray(selectedCards) ? selectedCards : [selectedCards];
        if (cardsArray && cardsArray.length > 0) {
          const targetUnit = cardsArray[0];
          if (onAttackConfirm) {
            onAttackConfirm(selectedCard, targetUnit);
          }
        }
      }
    );

    return this._validateAndShowDialog(eligibleCards, 'No valid attack targets found', selectionId, selectionData);
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

    // Create eligible cards only for slots that contain units but no pilots
    const eligibleCards = this._createSlotItems(playerData, playerId, (slot) => {
      return slot?.unit?.cardUid && !slot.pilot; // Units without pilots
    });

    // Create selection data and validate
    const selectionId = `pilot_target_${Date.now()}`;
    const selectionData = this._createSelectionData(
      playerId,
      eligibleCards,
      "SELECT_UNIT_FOR_PILOT",
      'Select Unit to Pilot',
      'Choose which unit this pilot card should attach to',
      (selectionId, selectedCards) => {
        console.log('DialogManager: Pilot target selected:', selectionId, selectedCards);
        const cardsArray = Array.isArray(selectedCards) ? selectedCards : [selectedCards];
        if (cardsArray && cardsArray.length > 0) {
          const selectedUnit = cardsArray[0];
          if (onPilotConfirm) {
            onPilotConfirm(pilotCard, selectedUnit);
          }
        }
      }
    );

    return this._validateAndShowDialog(eligibleCards, 'No valid pilot targets found (need units without pilots)', selectionId, selectionData);
  }


  showDeployTargetDialog(event, onConfirm) {
    console.log('DialogManager: Redirecting deploy target dialog to unified slot selection');

    // Extract deploy effect and target information from event
    const { deployEffect, availableTargets, sourceCardUid, cardId } = event.data;
    const effectDescription = deployEffect?.effect?.action || 'Select Target';

    // Convert backend availableTargets to eligibleCards format
    const eligibleCards = availableTargets.map(target => ({
      dialogDisplayType: 'slot',
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
      eligibleCards: eligibleCards, // Pass eligibleCards directly
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