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
            
            // Slot-specific actions for units
            case 'attackUnit':
                this.handleAttackUnit(selectedCard);
                break;
            case 'attackShieldArea':
                this.handleAttackShieldArea(selectedCard);
                break;
            
            // Slot-specific actions for pilots
            case 'activatePilot':
                this.handleActivatePilot(selectedCard);
                break;
            case 'pilotSkill':
                this.handlePilotSkill(selectedCard);
                break;
            case 'ejectPilot':
                this.handleEjectPilot(selectedCard);
                break;
            
            // Slot-specific actions for bases
            case 'useBaseAbility':
                this.handleUseBaseAbility(selectedCard);
                break;
            case 'generateResource':
                this.handleGenerateResource(selectedCard);
                break;
            case 'upgradeBase':
                this.handleUpgradeBase(selectedCard);
                break;
            
            // Slot-specific actions for command cards
            case 'useCommand':
                this.handleUseCommand(selectedCard);
                break;
            case 'commandBonus':
                this.handleCommandBonus(selectedCard);
                break;
            case 'revertCommand':
                this.handleRevertCommand(selectedCard);
                break;
            
            // General slot actions
            case 'viewCard':
                this.handleViewCard(selectedCard);
                break;
            case 'genericAbility':
                this.handleGenericAbility(selectedCard);
                break;
            case 'combat':
                this.handleCombat(selectedCard);
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
        
        // Hide buttons
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
        // Only include units that don't already have pilots attached
        const eligibleCards = [];
        for (let i = 1; i <= 6; i++) {
            const slotName = `slot${i}`;
            const slot = playerData.zones[slotName];
            // Also check frontend slot manager to be extra sure pilot status is consistent
            const hasUnitInSlot = this.gameScene.slotAreaManager.hasUnitInSlot('player', slotName);
            const hasPilotInSlot = this.gameScene.slotAreaManager.hasPilotInSlot('player', slotName);
            
            if (slot && slot.unit && !slot.pilot && hasUnitInSlot && !hasPilotInSlot) {
                // Use the unit directly with minimal metadata additions
                const unit = slot.unit;
                unit.slot = slotName; // Add slot info directly to existing unit object
                eligibleCards.push(unit);
            }
        }
        
        if (eligibleCards.length === 0) {
            this.showErrorMessage('No units available to pilot. Units either need to be placed first or already have pilots attached.');
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
            numberOfSections: 1,  // Single section for pilot selection
            title: 'Select Unit to Pilot',
            description: 'Choose which unit this pilot card should attach to',
            callback: (selectionId, selectedCards) => {
                console.log('CardActionHandler: Unit selected for piloting:', selectionId, selectedCards);
                // Ensure selectedCards is always an array
                const cardsArray = Array.isArray(selectedCards) ? selectedCards : [selectedCards];
                if (cardsArray && cardsArray.length > 0) {
                    const selectedUnit = cardsArray[0];
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
            this.gameScene.deselectAllCards(true);
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
            console.log("call api for piliot", selectedCard , " ",selectedUnit)
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

    // ============ SLOT-SPECIFIC ACTION HANDLERS ============

    /**
     * Unit-specific actions in slots
     */
    handleAttackUnit(selectedCard) {
        console.log('🗡️ Initiating unit attack:', selectedCard.fullCardData?.cardData?.id);
        
        // Get current game state
        const gameState = this.gameStateManager.getGameState();
        const playerId = gameState.playerId;
        
        // Get opponent's zones to find all opponent units
        const opponentId = Object.keys(gameState.gameEnv?.players || {}).find(id => id !== playerId);
        if (!opponentId) {
            this.showErrorMessage('无法找到对手');
            return;
        }
        
        const opponentData = gameState.gameEnv?.players?.[opponentId];
        if (!opponentData || !opponentData.zones) {
            this.showErrorMessage('无法访问对手区域');
            return;
        }
        
        // Find all opponent units in slots (slot1-slot6)
        // Pass whole slot data to reduce object conversion
        const eligibleTargets = [];
        for (let i = 1; i <= 6; i++) {
            const slotName = `slot${i}`;
            const slot = opponentData.zones[slotName];
            
            if (slot && slot.unit) {
                // Pass the whole slot data with metadata
                const slotTarget = {
                    ...slot, // Includes unit, pilot, and any other slot data
                    slotName: slotName,
                    playerId: opponentId,
                    isSlotTarget: true // Mark for special dialog handling
                };
                eligibleTargets.push(slotTarget);
            }
        }
        
        if (eligibleTargets.length === 0) {
            this.showErrorMessage('没有可攻击的对手机体');
            return;
        }
        
        // Create a unique selection ID
        const selectionId = `attack_target_${Date.now()}`;
        
        // Create selection data compatible with existing system
        const selectionData = {
            playerId: playerId,
            eligibleCards: eligibleTargets,
            dialogType: "SELECT_ATTACK_TARGET",
            selectCount: 1,
            numberOfSections: 1,
            title: '选择攻击目标',
            description: '选择要攻击的对手机体',
            callback: (selectionId, selectedCards) => {
                console.log('CardActionHandler: Attack target selected:', selectionId, selectedCards);
                const cardsArray = Array.isArray(selectedCards) ? selectedCards : [selectedCards];
                if (cardsArray && cardsArray.length > 0) {
                    const targetUnit = cardsArray[0];
                    this.executeAttackAction(selectedCard, targetUnit);
                }
            },
            onCancel: () => {
                console.log('Attack target selection cancelled');
            }
        };
        
        // Use the existing showCardSelectionDialog method
        if (this.gameScene.showCardSelectionDialog) {
            this.gameScene.deselectAllCards(true);
            this.gameScene.showCardSelectionDialog(selectionId, selectionData);
        } else {
            console.error('showCardSelectionDialog method not available');
            this.showErrorMessage('无法显示目标选择对话框');
        }
    }


    /**
     * Pilot-specific actions in slots
     */
    handleActivatePilot(selectedCard) {
        console.log('🚁 Activating pilot:', selectedCard.fullCardData?.cardData?.id);
        this.showErrorMessage('激活驾驶员功能开发中...');
        this.gameScene.actionButtonManager.hide();
    }

    handlePilotSkill(selectedCard) {
        console.log('🎯 Using pilot skill:', selectedCard.fullCardData?.cardData?.id);
        this.showErrorMessage('驾驶员技能功能开发中...');
        this.gameScene.actionButtonManager.hide();
    }

    handleEjectPilot(selectedCard) {
        console.log('💺 Ejecting pilot:', selectedCard.fullCardData?.cardData?.id);
        this.showErrorMessage('弹射驾驶员功能开发中...');
        this.gameScene.actionButtonManager.hide();
    }

    /**
     * Base-specific actions in slots
     */
    handleUseBaseAbility(selectedCard) {
        console.log('🏭 Using base ability:', selectedCard.fullCardData?.cardData?.id);
        this.showErrorMessage('基地能力功能开发中...');
        this.gameScene.actionButtonManager.hide();
    }

    handleGenerateResource(selectedCard) {
        console.log('💎 Generating resources:', selectedCard.fullCardData?.cardData?.id);
        this.showErrorMessage('产生资源功能开发中...');
        this.gameScene.actionButtonManager.hide();
    }

    handleUpgradeBase(selectedCard) {
        console.log('⬆️ Upgrading base:', selectedCard.fullCardData?.cardData?.id);
        this.showErrorMessage('升级基地功能开发中...');
        this.gameScene.actionButtonManager.hide();
    }

    /**
     * Command card actions in slots
     */
    handleUseCommand(selectedCard) {
        console.log('📜 Using command:', selectedCard.fullCardData?.cardData?.id);
        this.showErrorMessage('使用指令功能开发中...');
        this.gameScene.actionButtonManager.hide();
    }

    handleCommandBonus(selectedCard) {
        console.log('🎁 Using command bonus:', selectedCard.fullCardData?.cardData?.id);
        this.showErrorMessage('指令奖励功能开发中...');
        this.gameScene.actionButtonManager.hide();
    }

    handleRevertCommand(selectedCard) {
        console.log('↩️ Reverting command to pilot:', selectedCard.fullCardData?.cardData?.id);
        this.showErrorMessage('恢复指令牌功能开发中...');
        this.gameScene.actionButtonManager.hide();
    }

    /**
     * General slot actions
     */
    handleViewCard(selectedCard) {
        console.log('👁️ Viewing card details:', selectedCard.fullCardData?.cardData?.id);
        // For now, just show card info in console
        console.log('Card details:', JSON.stringify(selectedCard.fullCardData, null, 2));
        this.showErrorMessage('查看卡牌详情功能开发中...');
        this.gameScene.actionButtonManager.hide();
    }

    handleGenericAbility(selectedCard) {
        console.log('⚙️ Using generic ability:', selectedCard.fullCardData?.cardData?.id);
        this.showErrorMessage('通用能力功能开发中...');
        this.gameScene.actionButtonManager.hide();
    }

    handleCombat(selectedCard) {
        console.log('⚔️ Entering combat with:', selectedCard.fullCardData?.cardData?.id);
        this.showErrorMessage('参与战斗功能开发中...');
        this.gameScene.actionButtonManager.hide();
    }

    /**
     * Execute attack action after target selection
     */
    executeAttackAction(attackerCard, targetSlot) {
        console.log('⚔️ Executing attack:', {
            attacker: attackerCard.fullCardData?.cardData?.id,
            targetUnit: targetSlot.unit?.id,
            targetPilot: targetSlot.pilot?.id,
            targetSlotName: targetSlot.slotName
        });
        
        // For now, show a placeholder message with attack details
        const attackerName = attackerCard.fullCardData?.cardData?.name || 'Unknown Unit';
        const targetUnitName = targetSlot.unit?.name || targetSlot.unit?.id || 'Unknown Unit';
        const targetDescription = targetSlot.pilot 
            ? `${targetUnitName} + ${targetSlot.pilot.name || targetSlot.pilot.id}`
            : targetUnitName;
        
        // Call the playerAction API for unit attack
        this.callPlayerActionAPI('attackUnit', attackerCard, targetSlot);
        
        // Hide action buttons
        this.gameScene.actionButtonManager.hide();
    }

    /**
     * Handle attack on shield/base area
     */
    handleAttackShieldArea(selectedCard) {
        this.gameScene.deselectAllCards();
        console.log('🏰 Initiating shield/base attack:', selectedCard.fullCardData?.cardData?.id);
        
        // Backend automatically determines target (base first, then top shield)
        // No target selection needed - just call the API directly
        this.callAttackShieldAreaAPI(selectedCard);
        this.gameScene.actionButtonManager.hide();
    }

    /**
     * Call attackShieldArea API directly (no target selection needed)
     */
    async callAttackShieldAreaAPI(attackerCard) {
        const gameState = this.gameStateManager.getGameState();
        const playerId = gameState.playerId;
        const gameId = gameState.gameId;

        try {
            // Extract attacker card UID
            const attackerCardUid = attackerCard.fullCardData?.cardUid || attackerCard.fullCardData?.cardData?.cardUid;
            if (!attackerCardUid) {
                console.error('Cannot get attacker card UID:', attackerCard);
                this.showErrorMessage('无法获取攻击者卡片信息');
                return;
            }

            // Simple action data - backend handles target selection automatically
            const actionData = {
                actionType: 'attackShieldArea',
                attackerCardUid: attackerCardUid
            };

            console.log('Calling attackShieldArea API:', actionData);

            // Call the API through APIManager
            const response = await this.gameScene.apiManager.playerAction(playerId, gameId, actionData);

            if (response.success) {
                console.log('AttackShieldArea successful:', response);
                this.gameStateManager.updateGameEnv(response.gameEnv);
                this.updateGameState();
                this.showSuccessMessage('盾牌区域攻击成功!');
            } else {
                console.error('AttackShieldArea failed:', response.error);
                this.showErrorMessage(`攻击失败: ${response.error || '未知错误'}`);
            }

        } catch (error) {
            console.error('Error calling attackShieldArea API:', error);
            this.showErrorMessage('网络错误，请稍后重试');
        }
    }

    /**
     * Call the playerAction API endpoint for attackUnit actions
     * @param {string} actionType - Type of action ('attackUnit')
     * @param {Object} attackerCard - The attacking card
     * @param {Object} target - The target unit slot
     */
    async callPlayerActionAPI(actionType, attackerCard, target) {
        const gameState = this.gameStateManager.getGameState();
        const playerId = gameState.playerId;
        const gameId = gameState.gameId;

        try {
            // Extract attacker card UID
            const attackerCardUid = attackerCard.fullCardData?.cardUid || attackerCard.fullCardData?.cardData?.cardUid;
            if (!attackerCardUid) {
                console.error('Cannot get attacker card UID:', attackerCard);
                this.showErrorMessage('无法获取攻击者卡片信息');
                return;
            }

            // Prepare action data for attackUnit
            let actionData;
            
            if (actionType === 'attackUnit') {
                // Target is a slot with unit (and possibly pilot)
                const targetUnitUid = target.unit?.cardUid || target.unit?.id;
                if (!targetUnitUid) {
                    console.error('Cannot get target unit UID:', target);
                    this.showErrorMessage('无法获取目标机体信息');
                    return;
                }

                actionData = {
                    actionType: 'attackUnit',
                    attackerCardUid: attackerCardUid,
                    targetType: 'unit',
                    targetUnitUid: targetUnitUid,
                    targetSlotName: target.slotName,
                    targetPlayerId: target.playerId,
                    // Include pilot information if present
                    targetPilotUid: target.pilot?.cardUid || target.pilot?.id || null
                };
            } else {
                console.error('Unknown action type:', actionType);
                this.showErrorMessage('未知的行动类型');
                return;
            }

            console.log('Calling playerAction API:', actionData);

            // Call the API through APIManager
            const response = await this.gameScene.apiManager.playerAction(playerId, gameId, actionData);

            if (response.success) {
                console.log('PlayerAction successful:', response);
                this.gameStateManager.updateGameEnv(response.gameEnv);
                this.updateGameState();
                this.showSuccessMessage(`${actionType} 执行成功!`);
            } else {
                console.error('PlayerAction failed:', response.error);
                this.showErrorMessage(`行动失败: ${response.error || '未知错误'}`);
            }

        } catch (error) {
            console.error('Error calling playerAction API:', error);
            this.showErrorMessage('网络错误，请稍后重试');
        }
    }

    /**
     * Show success message (similar to showErrorMessage but with success styling)
     */
    showSuccessMessage(message) {
        console.log('SUCCESS:', message);
        // TODO: Implement success message UI similar to error message
        // For now, use the existing error message system but with success styling
        this.showErrorMessage(message);
    }

}