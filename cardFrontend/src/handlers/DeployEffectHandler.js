// DeployEffectHandler.js
// Centralized handler for deploy effect interactions and API calls

/**
 * DeployEffectHandler - Handles all deploy effect-related interactions
 * 
 * Features:
 * - Deploy target selection dialog management
 * - API communication for deploy effect actions
 * - Game state updates after deploy effect completion
 * - Error handling and user feedback
 */
export default class DeployEffectHandler {
  constructor(scene, gameStateManager, apiManager) {
    this.scene = scene;
    this.gameStateManager = gameStateManager;
    this.apiManager = apiManager;
  }

  /**
   * Show deploy target selection dialog
   * @param {Object} event - DEPLOY_TARGET_CHOICE event from processingQueue
   */
  showDeployTargetDialog(event) {
    console.log('DeployEffectHandler: Showing deploy target dialog for event:', event);
    
    // Use DialogManager to show deploy target dialog
    this.scene.dialogManager.showDeployTargetDialog(event, async (selectedTarget) => {
      console.log('DeployEffectHandler: User selected deploy target:', selectedTarget);
      
      try {
        const gameState = this.gameStateManager.getGameState();
        
        if (selectedTarget === null) {
          // User cancelled - need to handle cancellation
          console.log('DeployEffectHandler: Deploy target selection cancelled');
          this.scene.showRoomStatus('Deploy target selection cancelled');
          return;
        }
        
        // Call GameApiService to submit the selected target
        const result = await this.scene.gameApiService.confirmDeployChoice(event.id, {
          cardUid: selectedTarget.cardUid,
          zone: selectedTarget.zone,
          playerId: selectedTarget.playerId
        });

        if (result.gameEnvUpdated) {
          // Set scenario flag for hand update
          this.scene.isSetScenoria = true;
          this.scene.updateGameState();
        }
        
        console.log('DeployEffectHandler: Deploy target selection successful');
        // GameApiService already handles gameEnv updates and UI feedback
        
      } catch (error) {
        console.error('DeployEffectHandler: Failed to submit deploy target selection:', error);
        this.scene.showRoomStatus('Failed to process deploy target: ' + error.message);
      }
    });
  }


  /**
   * Handle deploy effect completion (for future extension)
   * @param {Object} deployResult - Result from deploy effect execution
   */
  handleDeployEffectCompletion(deployResult) {
    console.log('DeployEffectHandler: Deploy effect completed:', deployResult);
    
    // Future extensions:
    // - Animation effects
    // - Sound effects
    // - Visual feedback
    // - Statistics tracking
  }

  /**
   * Validate deploy target selection (for future extension)
   * @param {Object} selectedTarget - Target selected by user
   * @param {Object} event - Original deploy event
   * @returns {boolean} Whether target is valid
   */
  validateTargetSelection(selectedTarget, event) {
    if (!selectedTarget) {
      console.warn('DeployEffectHandler: No target selected');
      return false;
    }

    if (!selectedTarget.cardUid || !selectedTarget.zone || !selectedTarget.playerId) {
      console.warn('DeployEffectHandler: Invalid target structure:', selectedTarget);
      return false;
    }

    // Future validation logic:
    // - Check if target still exists
    // - Validate target meets effect requirements
    // - Check game state consistency

    return true;
  }

  /**
   * Get available deploy actions for UI (for future extension)
   * @returns {Array} Available deploy actions
   */
  getAvailableDeployActions() {
    // Future implementation:
    // - Scan for deploy effects that can be manually triggered
    // - Check player permissions and game state
    // - Return actionable deploy effects

    return [];
  }

  /**
   * Cleanup handler resources
   */
  destroy() {
    console.log('DeployEffectHandler: Cleaning up resources');
    this.scene = null;
    this.gameStateManager = null;
    this.apiManager = null;
  }
}