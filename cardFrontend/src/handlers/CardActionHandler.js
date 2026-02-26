// CardActionHandler.js
// Dedicated handler for all card action buttons and related functionality

import HandUtils from '../utils/HandUtils.js';

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
                this.handlePlayCardAction(selectedCard, 'unit', effectData);
                break;
            case 'playCommand':
                this.handlePlayCardAction(selectedCard, 'command', effectData);
                break;
            case 'playPilot':
                this.handlePlayCardAction(selectedCard, 'pilot', effectData);
                break;
            case 'playBase':
                this.handlePlayCardAction(selectedCard, 'base', effectData);
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
            case 'activateCardAbility':
                this.handleActivateBaseAbility(selectedCard, effectData);
                break;
            case 'generateResource':
                this.handleGenerateResource(selectedCard);
                break;
            case 'upgradeBase':
                this.handleUpgradeBase(selectedCard);
                break;
            
            // Slot-specific actions for command cards
            case 'useCommand':
                this.handleUseCommand(selectedCard, effectData);
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
    async handlePlayCardAction(selectedCard, playAs, effectData = null) {
        const actionName = `${playAs} play`;
        
        if (!this.validateSelectedCard(selectedCard, actionName)) {
            return;
        }
        
        console.log(`Playing card as ${playAs.charAt(0).toUpperCase() + playAs.slice(1)}:`, selectedCard.fullCardData.carduid);
        this.gameScene.actionButtonManager.hide();
        
        // Special handling for pilot cards - show unit selection dialog
        if (playAs === 'pilot') {
            this.handlePilotCardSelection(selectedCard);
            return;
        }

        if (playAs === 'command') {
            this.handleUseCommand(selectedCard, effectData || null);
            return;
        }
        
        try {
            const carduid = selectedCard.fullCardData.carduid;
            
            if (!carduid) {
                this.showErrorMessage('Card not found in hand.');
                return;
            }
            
            const gameState = this.gameStateManager.getGameState();
            this.setUILoadingState(true);
            
            // Create structured action with playAs specification
            const action = {
                type: 'PlayCard',
                carduid: carduid,
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
                    this.showErrorMessage(this.buildPlayFailureMessage(response?.error || `Failed to play ${playAs} card`, selectedCard));
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
     * Show error message to user
     */
    showErrorMessage(message) {
        this.gameScene.showErrorMessage(message);
    }


    buildPlayFailureMessage(baseError, selectedCard) {
        const message = baseError || 'Failed to play card';
        const cardData = selectedCard?.fullCardData?.cardData || selectedCard?.cardData;
        if (!cardData) {
            return message;
        }

        const effectiveLevel = Number.isFinite(Number(cardData.effectiveLevel)) ? Number(cardData.effectiveLevel) : Number(cardData.level || 0);
        const effectiveCost = Number.isFinite(Number(cardData.effectiveCost)) ? Number(cardData.effectiveCost) : Number(cardData.cost || 0);
        const energyArea = this.gameStateManager?.getMyEnergyAreaCard?.() || [];
        const totalEnergy = Array.isArray(energyArea) ? energyArea.length : 0;
        const activeEnergy = Array.isArray(energyArea) ? energyArea.filter(card => !card?.isRested).length : 0;

        return `${message} (need Lv${effectiveLevel}/Cost${effectiveCost}, have ${activeEnergy} active / ${totalEnergy} total energy)`;
    }

    /**
     * Set UI loading state during API calls
     */
    setUILoadingState(isLoading) {
        this.gameScene.setUILoadingState(isLoading);
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
     * Find the first activated effect on a command card (fallback helper)
     */
    findFirstActivatedEffect(cardData) {
        const rules = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
        return rules.find(rule => rule?.type === 'activated') || null;
    }

    isCardRested(card) {
        if (!card) {
            return false;
        }

        const sources = [
            card.fullCardData?.isRested,
            card.fullCardData?.cardData?.isRested,
            card.cardData?.isRested,
            card.fullCardData?.status,
            card.cardData?.status
        ];

        for (const value of sources) {
            if (typeof value === 'boolean') {
                return value;
            }
            if (typeof value === 'string') {
                const normalized = value.toLowerCase();
                if (normalized === 'rested' || normalized === 'tapped') {
                    return true;
                }
                if (normalized === 'active' || normalized === 'ready') {
                    return false;
                }
            }
        }

        return false;
    }

    /**
     * Build a slot filter function that applies effect target filters to unit slots
     */
    buildUnitSlotFilter(filters = {}) {
        const normalizedFilters = filters || {};
        const statusFilter = typeof normalizedFilters.status === 'string'
            ? normalizedFilters.status.toLowerCase()
            : null;
        const traitFilters = Array.isArray(normalizedFilters.traits) ? normalizedFilters.traits : [];

        return (slot) => {
            const unit = slot?.unit;
            if (!unit?.carduid) {
                return false;
            }

            if (statusFilter) {
                const currentStatus = unit.isRested ? 'rested' : 'active';
                if (currentStatus !== statusFilter) {
                    return false;
                }
            }

            if (traitFilters.length > 0) {
                const unitTraits = Array.isArray(unit.cardData?.traits) ? unit.cardData.traits : [];
                const hasTrait = traitFilters.some(requiredTrait => unitTraits.includes(requiredTrait));
                if (!hasTrait) {
                    return false;
                }
            }

            return true;
        };
    }

    /**
     * Construct a normalized payload for command abilities so backend managers
     * receive the full context without extra conversions.
     */
    buildCommandActionPayload(selectedCard, effect, target, gameState) {
        const carduid = selectedCard.fullCardData?.carduid;
        const payload = {
            actionType: 'useCommandCard',
            carduid,
            effectId: effect.effectId || effect.action,
            effectMetadata: {
                type: effect.type,
                action: effect.action,
                optional: Boolean(effect.optional),
                timing: effect.timing,
                target: effect.target,
                parameters: effect.parameters,
                trigger: effect.trigger
            }
        };

        if (target) {
            const targetEntry = {
                carduid: target.carduid,
                zone: target.zone,
                playerId: target.playerId
            };

            payload.targetCarduid = target.carduid;
            payload.targetPlayerId = target.playerId;
            payload.targets = [targetEntry];
        }

        const currentBattle = gameState?.gameEnv?.currentBattle;
        if (currentBattle) {
            payload.battleContext = {
                status: currentBattle.status,
                attackingPlayerId: currentBattle.attackingPlayerId,
                defendingPlayerId: currentBattle.defendingPlayerId
            };
        }

        return payload;
    }

    /**
     * Execute useCommandCard action via API
     */
    async executeUseCommand(selectedCard, effect, target) {
        const gameState = this.gameStateManager.getGameState();
        const playerId = gameState.playerId;
        const gameId = gameState.gameId;
        const carduid = selectedCard.fullCardData?.carduid;

        if (!carduid) {
            this.showErrorMessage('指令卡信息缺失');
            return;
        }

        const actionData = this.buildCommandActionPayload(selectedCard, effect, target, gameState);

        try {
            this.setUILoadingState(true);
            const response = await this.gameScene.apiManager.playerAction(playerId, gameId, actionData);

            if (response?.success) {
                console.log('UseCommandCard successful:', response);
                this.gameStateManager.updateGameEnv(response.gameEnv);
                this.updateGameState();
                this.updatePlayerHand();
                this.gameScene.deselectAllCards(true);
                const nextBattleState = response.gameEnv?.currentBattle;
                if (nextBattleState && nextBattleState.status === 'ACTION_STEP') {
                    this.showSuccessMessage('指令执行成功，战斗仍在行动步骤');
                } else {
                    this.showSuccessMessage('指令已使用');
                }
            } else {
                const errorMessage = response?.error || '使用指令失败';
                console.error('UseCommandCard failed:', errorMessage);
                this.showErrorMessage(errorMessage);
            }
        } catch (error) {
            console.error('Error calling useCommandCard API:', error);
            this.showErrorMessage('网络错误，请稍后重试');
        } finally {
            this.setUILoadingState(false);
        }
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
        
        // Use DialogManager's specialized pilot selection dialog
        if (this.gameScene.dialogManager) {
            this.gameScene.deselectAllCards(true);
            const dialogId = this.gameScene.dialogManager.showPilotSelectionDialog(
                playerId,
                selectedCard,
                (pilotCard, targetUnit) => {
                    console.log('CardActionHandler: Pilot target selected via DialogManager');
                    this.executePilotCardPlay(pilotCard, targetUnit);
                }
            );
            
            // Handle case where no valid targets were found
            if (!dialogId) {
                this.showErrorMessage('No available units to pilot (need units without pilots)');
            }
        } else {
            console.error('DialogManager not available');
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
            const carduid = selectedCard.fullCardData.carduid;
            const targetUnit = selectedUnit.carduid; // Use the unit's carduid as targetUnit
            console.log("call api for piliot", selectedCard , " ",selectedUnit)
            if (!carduid) {
                this.showErrorMessage('Card not found in hand.');
                return;
            }
            
            const gameState = this.gameStateManager.getGameState();
            this.setUILoadingState(true);
            
            // Create structured action with playAs and targetUnit
            const action = {
                type: 'PlayCard',
                carduid: carduid,
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
                    console.log(`✅ Pilot card played successfully on unit ${selectedUnit.carduid}`);
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
        
        // Use DialogManager's specialized attack selection dialog
        if (this.gameScene.dialogManager) {
            this.gameScene.deselectAllCards(true);
            const dialogId = this.gameScene.dialogManager.showAttackSelectionDialog(
                playerId,
                opponentId,
                selectedCard,
                (attackingCard, targetUnit) => {
                    console.log('CardActionHandler: Attack target selected via DialogManager');
                    this.executeAttackAction(attackingCard, targetUnit);
                }
            );
            
            // Handle case where no valid targets were found
            if (!dialogId) {
                this.showErrorMessage('没有可攻击的对手机体');
            }
        } else {
            console.error('DialogManager not available');
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
    async handleActivateBaseAbility(selectedCard, effectData = null) {
        if (!selectedCard) {
            this.showErrorMessage('未选中基地');
            return;
        }

        const carduid = selectedCard.fullCardData?.carduid;
        const cardData = selectedCard.fullCardData?.cardData || selectedCard.cardData;

        if (!carduid || !cardData) {
            this.showErrorMessage('无法读取基地信息');
            return;
        }

        if (this.isCardRested(selectedCard)) {
            this.showErrorMessage('基地已处于休息状态');
            return;
        }

        const effect = effectData || this.findFirstActivatedEffect(cardData);
        if (!effect) {
            this.showErrorMessage('该基地没有可发动的能力');
            return;
        }

        const gameState = this.gameStateManager.getGameState();
        const playerId = gameState.playerId;
        const gameId = gameState.gameId;

        if (!playerId || !gameId) {
            this.showErrorMessage('缺少玩家或对局信息');
            return;
        }

        const actionData = {
            actionType: 'activateCardAbility',
            carduid,
            effectId: effect.effectId
        };

        try {
            this.setUILoadingState(true);
            this.gameScene.actionButtonManager.hide();

            const response = await this.gameScene.apiManager.playerAction(playerId, gameId, actionData);

            if (response?.success) {
                if (response.gameEnv) {
                    this.gameStateManager.updateGameEnv(response.gameEnv);
                }
                this.updateGameState();
                this.showSuccessMessage('基地能力已发动');
                this.gameScene.deselectAllCards?.(true);
            } else {
                const errorMessage = response?.error || '基地能力发动失败';
                console.error('activateCardAbility failed:', errorMessage);
                this.showErrorMessage(errorMessage);
            }
        } catch (error) {
            console.error('Error calling activateCardAbility API:', error);
            this.showErrorMessage('网络错误，请稍后重试');
        } finally {
            this.setUILoadingState(false);
        }
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
    handleUseCommand(selectedCard, effectData = null) {
        if (!selectedCard) {
            this.showErrorMessage('未选中指令卡');
            return;
        }

        const carduid = selectedCard.fullCardData?.carduid;
        const cardData = selectedCard.fullCardData?.cardData;

        if (!carduid || !cardData) {
            this.showErrorMessage('无法读取指令卡信息');
            return;
        }

        const effect = effectData || this.findFirstActivatedEffect(cardData);
        if (!effect) {
            this.showErrorMessage('该指令没有可用的效果');
            return;
        }

        const targetConfig = effect.target || {};
        const targetType = (targetConfig.type || '').toLowerCase();
        const targetScope = (targetConfig.scope || 'self').toLowerCase();
        const effectFilters = targetConfig.filters || {};
        const unitSlotFilter = this.buildUnitSlotFilter(effectFilters);

        const gameState = this.gameStateManager.getGameState();
        const playerId = gameState.playerId;
        const opponentId = this.gameStateManager.getOpponent();

        const executeWithTarget = (target) => {
            this.executeUseCommand(selectedCard, effect, target);
        };

        if (targetType === 'unit') {
            if (targetScope.startsWith('opponent')) {
                if (!opponentId) {
                    this.showErrorMessage('无法找到对手');
                    return;
                }

                if (this.gameScene.dialogManager) {
                    this.gameScene.deselectAllCards(true);
                    this.gameScene.actionButtonManager.hideDynamicActionButtons();
                    const dialogId = this.gameScene.dialogManager.showAttackSelectionDialog(
                        playerId,
                        opponentId,
                        selectedCard,
                        (_card, targetUnit) => {
                            if (!targetUnit) return;
                            executeWithTarget({
                                carduid: targetUnit.carduid || targetUnit.unit?.carduid,
                                zone: targetUnit.zone || targetUnit.slotName,
                                playerId: targetUnit.playerId
                            });
                        },
                        {
                            slotFilter: unitSlotFilter,
                            title: '选择目标单位',
                            description: effectFilters.status === 'rested'
                                ? '请选择1个已休息的敌方单位'
                                : '选择要作为目标的敌方单位',
                            emptyMessage: effectFilters.status === 'rested'
                                ? '没有已休息的敌方单位可选'
                                : '没有可选的敌方单位'
                        }
                    );

                    if (!dialogId) {
                        const emptyMessage = effectFilters.status === 'rested'
                            ? '没有已休息的敌方单位可选'
                            : '没有可选的敌方单位';
                        this.showErrorMessage(emptyMessage);
                    }
                } else {
                    this.showErrorMessage('目标选择界面不可用');
                }
                return;
            }

            // Default to friendly unit selection
            if (this.gameScene.dialogManager) {
                this.gameScene.deselectAllCards(true);
                this.gameScene.actionButtonManager.hideDynamicActionButtons();
                const dialogId = this.gameScene.dialogManager.showFriendlyUnitSelectionDialog(
                    playerId,
                    {
                        title: '选择友方单位',
                        description: '选择要作为目标的我方单位',
                        emptyMessage: effectFilters.status === 'rested'
                            ? '没有已休息的友方单位可选'
                            : '没有可选择的友方单位',
                        slotFilter: unitSlotFilter
                    },
                    (targetUnit) => {
                        if (!targetUnit) return;
                        executeWithTarget({
                            carduid: targetUnit.carduid || targetUnit.unit?.carduid,
                            zone: targetUnit.zone || targetUnit.slotName,
                            playerId: targetUnit.playerId || playerId
                        });
                    }
                );

                if (!dialogId) {
                    const emptyMessage = effectFilters.status === 'rested'
                        ? '没有已休息的友方单位可选'
                        : '没有可选择的友方单位';
                    this.showErrorMessage(emptyMessage);
                }
            } else {
                this.showErrorMessage('目标选择界面不可用');
            }
            return;
        }

        // No target required - execute immediately
        this.gameScene.deselectAllCards(true);
        this.gameScene.actionButtonManager.hideDynamicActionButtons();
        this.executeUseCommand(selectedCard, effect, null);
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
            const attackerCarduid = attackerCard.fullCardData?.carduid || attackerCard.fullCardData?.cardData?.carduid;
            if (!attackerCarduid) {
                console.error('Cannot get attacker card UID:', attackerCard);
                this.showErrorMessage('无法获取攻击者卡片信息');
                return;
            }

            // Simple action data - backend handles target selection automatically
            const actionData = {
                actionType: 'attackShieldArea',
                attackerCarduid: attackerCarduid
            };

            console.log('Calling attackShieldArea API:', actionData);

            // Call the API through APIManager
            const response = await this.gameScene.apiManager.playerAction(playerId, gameId, actionData);

            if (response.success) {
                console.log('AttackShieldArea successful:', response);
                this.gameStateManager.updateGameEnv(response.gameEnv);
                this.updateGameState();
                if (response.needsPlayerInput) {
                    this.showSuccessMessage('进入行动步骤，等待指令。');
                } else {
                    this.showSuccessMessage('盾牌区域攻击成功!');
                }
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
            const attackerCarduid = attackerCard.fullCardData?.carduid || attackerCard.fullCardData?.cardData?.carduid;
            if (!attackerCarduid) {
                console.error('Cannot get attacker card UID:', attackerCard);
                this.showErrorMessage('无法获取攻击者卡片信息');
                return;
            }

            // Prepare action data for attackUnit
            let actionData;
            
            if (actionType === 'attackUnit') {
                // Target is a slot with unit (and possibly pilot)
                const targetUnitUid = target.unit?.carduid || target.unit?.id;
                if (!targetUnitUid) {
                    console.error('Cannot get target unit UID:', target);
                    this.showErrorMessage('无法获取目标机体信息');
                    return;
                }

                actionData = {
                    actionType: 'attackUnit',
                    attackerCarduid: attackerCarduid,
                    targetType: 'unit',
                    targetUnitUid: targetUnitUid,
                    targetSlotName: target.slotName,
                    targetPlayerId: target.playerId,
                    // Include pilot information if present
                    targetPilotUid: target.pilot?.carduid || target.pilot?.id || null
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
                if (response.needsPlayerInput) {
                    this.showSuccessMessage('进入行动步骤，等待指令。');
                } else {
                    this.showSuccessMessage(`${actionType} 执行成功!`);
                }
            } else {
                console.error('PlayerAction failed:', response.error);
                this.showErrorMessage(`行动失败: ${response.error || '未知错误'}`);
            }

        } catch (error) {
            console.error('Error calling playerAction API:', error);
            this.showErrorMessage('网络错误，请稍后重试');
        }
    }

    async handleConfirmBattle() {
        const gameState = this.gameStateManager.getGameState();
        const currentBattle = gameState.gameEnv?.currentBattle;

        if (!currentBattle) {
            this.showErrorMessage('当前没有待确认的战斗');
            return;
        }

        const playerId = gameState.playerId;
        if (!playerId) {
            this.showErrorMessage('无法确认：缺少玩家信息');
            return;
        }

        try {
            this.setUILoadingState(true);
            this.gameScene.confirmBattleButton?.disableInteractive();

            const response = await this.gameScene.apiManager.playerAction(playerId, gameState.gameId, {
                actionType: 'confirmBattle'
            });

            if (response?.success) {
                if (response.gameEnv) {
                    this.gameStateManager.updateGameEnv(response.gameEnv);
                }
                this.updateGameState();

                const updatedState = this.gameStateManager.getGameState();
                const updatedBattle = updatedState.gameEnv?.currentBattle;
                const confirmations = updatedBattle?.confirmations || {};
                const opponentId = updatedBattle
                    ? updatedBattle.attackingPlayerId === playerId
                        ? updatedBattle.defendingPlayerId
                        : updatedBattle.attackingPlayerId
                    : undefined;
                const playerConfirmed = confirmations[playerId] === true;
                const opponentConfirmed = opponentId ? confirmations[opponentId] === true : false;

                if (playerConfirmed && opponentConfirmed) {
                    this.showSuccessMessage('双方已确认，可以结算战斗');
                } else if (playerConfirmed) {
                    this.showSuccessMessage('已确认，等待对手完成行动');
                }
            } else {
                const errorMessage = response?.error || '战斗确认失败';
                console.error('ConfirmBattle failed:', errorMessage);
                this.showErrorMessage(errorMessage);
                this.gameScene.confirmBattleButton?.setInteractive({ useHandCursor: true });
            }
        } catch (error) {
            console.error('Error calling confirmBattle API:', error);
            this.showErrorMessage('网络错误，请稍后重试');
            this.gameScene.confirmBattleButton?.setInteractive({ useHandCursor: true });
        } finally {
            this.setUILoadingState(false);
            this.gameScene.updateBattlePrompt();
        }
    }

    async handleResolveBattle() {
        const gameState = this.gameStateManager.getGameState();
        const currentBattle = gameState.gameEnv?.currentBattle;

        if (!currentBattle) {
            this.showErrorMessage('当前没有待结算的战斗');
            return;
        }

        try {
            this.setUILoadingState(true);
            this.gameScene.resolveBattleButton?.disableInteractive();
            const response = await this.gameScene.apiManager.playerAction(
                gameState.playerId,
                gameState.gameId,
                {
                    actionType: 'resolveBattle',
                    battleContext: {
                        status: currentBattle.status,
                        attackingPlayerId: currentBattle.attackingPlayerId,
                        defendingPlayerId: currentBattle.defendingPlayerId
                    }
                }
            );

            if (response?.success) {
                console.log('ResolveBattle successful:', response);
                this.gameStateManager.updateGameEnv(response.gameEnv);
                this.updateGameState();
                const remainingBattle = response.gameEnv?.currentBattle;
                if (remainingBattle && remainingBattle.status === 'ACTION_STEP') {
                    this.showSuccessMessage('等待对手完成行动步骤');
                } else {
                    this.showSuccessMessage('战斗已结算');
                }
            } else {
                const errorMessage = response?.error || '战斗结算失败';
                console.error('ResolveBattle failed:', errorMessage);
                this.showErrorMessage(errorMessage);
            }
        } catch (error) {
            console.error('Error calling resolveBattle API:', error);
            this.showErrorMessage('网络错误，请稍后重试');
        } finally {
            this.setUILoadingState(false);
            this.gameScene.updateBattlePrompt();
        }
    }

    /**
     * Show success message (similar to showErrorMessage but with success styling)
     */
    showSuccessMessage(message) {
        this.gameScene.showSuccessMessage(message);
    }

}
