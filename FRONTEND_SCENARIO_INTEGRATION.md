# Frontend Scenario Integration Guide

## Overview

This guide shows how to integrate the scenario testing system into the existing GameScene demo controls. The integration replaces the "P2 Redraw" button with scenario testing controls.

## Implementation Steps

### 1. Import Scenario Loader

Add to the top of `GameScene.js`:

```javascript
// Add to existing imports
import FrontendScenarioLoader from '../mock/scenarioLoader.js';
```

### 2. Enhance Demo Controls

Replace the existing "P2 Redraw" button section with scenario testing controls:

```javascript
// Replace the testPlayer2RedrawButton section (around line 637) with:
if (this.isManualPollingMode) {
  // Scenario Selection Dropdown
  this.createScenarioDropdown();
  
  // Set Environment button (replaces P2 Redraw)
  this.testSetEnvButton = this.add.image(0+130, height - 420, 'button');
  this.testSetEnvButton.setScale(0.8);
  this.testSetEnvButton.setInteractive();

  const testSetEnvButtonText = this.add.text(0+130, height - 420, 'Set Environment', {
    fontSize: '14px',
    fill: '#ffffff'
  });
  testSetEnvButtonText.setOrigin(0.5);

  this.testSetEnvButton.on('pointerdown', () => {
    this.testSetEnvButton.setTint(0x888888);
    this.testSetEnvButton.setScale(0.76);
    testSetEnvButtonText.setScale(0.95);

    this.time.delayedCall(100, () => {
      this.testSetEnvButton.clearTint();
      this.testSetEnvButton.setScale(0.8);
      testSetEnvButtonText.setScale(1);
    });

    this.time.delayedCall(50, () => this.loadSelectedScenario());
  });

  // Validate Results button
  this.testValidateButton = this.add.image(0+130, height - 480, 'button');
  this.testValidateButton.setScale(0.8);
  this.testValidateButton.setInteractive();

  const testValidateButtonText = this.add.text(0+130, height - 480, 'Validate Results', {
    fontSize: '14px',
    fill: '#ffffff'
  });
  testValidateButtonText.setOrigin(0.5);

  this.testValidateButton.on('pointerdown', () => {
    this.testValidateButton.setTint(0x888888);
    this.testValidateButton.setScale(0.76);
    testValidateButtonText.setScale(0.95);

    this.time.delayedCall(100, () => {
      this.testValidateButton.clearTint();
      this.testValidateButton.setScale(0.8);
      testValidateButtonText.setScale(1);
    });

    this.time.delayedCall(50, () => this.showValidationResults());
  });
}
```

### 3. Add Scenario Dropdown Method

Add this method to the GameScene class:

```javascript
createScenarioDropdown() {
  const { width, height } = this.cameras.main;
  const scenarios = FrontendScenarioLoader.getAllScenarios();
  
  // Create DOM element for scenario selection
  const dropdown = document.createElement('select');
  dropdown.style.position = 'absolute';
  dropdown.style.left = '60px';
  dropdown.style.top = (height - 540) + 'px';
  dropdown.style.width = '200px';
  dropdown.style.fontSize = '14px';
  dropdown.style.backgroundColor = '#333';
  dropdown.style.color = '#fff';
  dropdown.style.border = '1px solid #555';
  dropdown.style.borderRadius = '4px';
  dropdown.style.padding = '4px';
  dropdown.style.zIndex = '1000';
  
  // Add scenarios grouped by category
  const categories = {};
  for (const [id, scenario] of Object.entries(scenarios)) {
    const category = scenario.category || 'misc';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push({ id, ...scenario });
  }
  
  for (const [category, items] of Object.entries(categories)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = category.replace('_', ' ').toUpperCase();
    
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      optgroup.appendChild(option);
    });
    
    dropdown.appendChild(optgroup);
  }
  
  // Set default selection
  dropdown.value = FrontendScenarioLoader.getCurrentScenarioId();
  
  // Add to DOM
  document.body.appendChild(dropdown);
  
  // Store reference for cleanup
  this.scenarioDropdown = dropdown;
}
```

### 4. Add Scenario Loading Method

Add this method to the GameScene class:

```javascript
async loadSelectedScenario() {
  if (!this.scenarioDropdown) {
    console.warn('No scenario dropdown found');
    return;
  }
  
  const selectedScenario = this.scenarioDropdown.value;
  console.log(`🎯 Loading scenario: ${selectedScenario}`);
  
  try {
    // Load scenario into game state manager
    await this.gameStateManager.setCompleteGameEnvironment(selectedScenario, FrontendScenarioLoader);
    
    // Update UI to reflect new game state
    this.updateGameState();
    
    // Show success notification
    this.showNotification(`Loaded: ${selectedScenario}`, 'success');
    
  } catch (error) {
    console.error('Failed to load scenario:', error);
    this.showNotification(`Error: ${error.message}`, 'error');
  }
}
```

### 5. Add Validation Results Method

Add this method to the GameScene class:

```javascript
showValidationResults() {
  const validation = this.gameStateManager.validateCompleteScenario();
  
  if (!validation) {
    this.showNotification('No scenario loaded for validation', 'warning');
    return;
  }
  
  // Create validation modal
  const { width, height } = this.cameras.main;
  
  // Background overlay
  const overlay = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.7);
  overlay.setDepth(1000);
  
  // Modal background
  const modalBg = this.add.rectangle(width/2, height/2, 600, 400, 0x2c3e50, 0.95);
  modalBg.setDepth(1001);
  modalBg.setStrokeStyle(2, 0x3498db);
  
  // Title
  const title = this.add.text(width/2, height/2 - 180, 'Scenario Validation Results', {
    fontSize: '24px',
    fill: '#ffffff',
    fontFamily: 'Arial'
  });
  title.setOrigin(0.5);
  title.setDepth(1002);
  
  // Overall result
  const overallResult = validation.passed ? '✅ PASSED' : '❌ FAILED';
  const resultColor = validation.passed ? '#27ae60' : '#e74c3c';
  const overallText = this.add.text(width/2, height/2 - 140, overallResult, {
    fontSize: '20px',
    fill: resultColor,
    fontFamily: 'Arial'
  });
  overallText.setOrigin(0.5);
  overallText.setDepth(1002);
  
  // Detailed results
  let yOffset = height/2 - 100;
  for (const [testId, testResult] of Object.entries(validation.results)) {
    const testStatus = testResult.passed ? '✅' : '❌';
    const testText = this.add.text(width/2 - 280, yOffset, `${testStatus} ${testResult.description}`, {
      fontSize: '14px',
      fill: '#ffffff',
      fontFamily: 'Arial',
      wordWrap: { width: 500 }
    });
    testText.setDepth(1002);
    
    yOffset += 30;
    
    // Show card details if failed
    if (!testResult.passed) {
      for (const [cardId, cardResult] of Object.entries(testResult.cards)) {
        if (!cardResult.passed) {
          const cardText = this.add.text(width/2 - 260, yOffset, 
            `  ${cardId}: Expected ${cardResult.expected}, got ${cardResult.actual}`, {
            fontSize: '12px',
            fill: '#e74c3c',
            fontFamily: 'Arial'
          });
          cardText.setDepth(1002);
          yOffset += 20;
        }
      }
    }
  }
  
  // Close button
  const closeButton = this.add.rectangle(width/2, height/2 + 160, 100, 40, 0x3498db, 0.8);
  closeButton.setDepth(1002);
  closeButton.setStrokeStyle(1, 0x2980b9);
  closeButton.setInteractive();
  
  const closeText = this.add.text(width/2, height/2 + 160, 'Close', {
    fontSize: '16px',
    fill: '#ffffff',
    fontFamily: 'Arial'
  });
  closeText.setOrigin(0.5);
  closeText.setDepth(1003);
  
  // Handle close button click
  closeButton.on('pointerdown', () => {
    overlay.destroy();
    modalBg.destroy();
    title.destroy();
    overallText.destroy();
    closeButton.destroy();
    closeText.destroy();
    // Clean up all text elements
    this.children.list.forEach(child => {
      if (child.depth >= 1002 && child !== closeButton && child !== closeText) {
        child.destroy();
      }
    });
  });
}
```

### 6. Add Notification Method

Add this method to the GameScene class:

```javascript
showNotification(message, type = 'info') {
  const colors = {
    success: '#27ae60',
    error: '#e74c3c',
    warning: '#f39c12',
    info: '#3498db'
  };
  
  const color = colors[type] || colors.info;
  
  // Create notification
  const notification = this.add.text(10, 10, message, {
    fontSize: '14px',
    fill: color,
    fontFamily: 'Arial',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: { x: 10, y: 5 }
  });
  notification.setDepth(2000);
  
  // Auto-remove after 3 seconds
  this.time.delayedCall(3000, () => {
    notification.destroy();
  });
}
```

### 7. Add Cleanup in Destroy Method

Add this to the scene's destroy method:

```javascript
destroy() {
  // Clean up scenario dropdown
  if (this.scenarioDropdown) {
    document.body.removeChild(this.scenarioDropdown);
    this.scenarioDropdown = null;
  }
  
  // Clear scenario from game state manager
  this.gameStateManager?.clearScenario();
  
  // Call parent destroy
  super.destroy();
}
```

### 8. Add GameStateManager Event Listeners

Add to the setupEventListeners method:

```javascript
setupEventListeners() {
  // ... existing event listeners ...
  
  // Scenario testing event listeners
  this.gameStateManager.addEventListener('scenario-loaded', (data) => {
    console.log('Scenario loaded:', data.scenarioId);
    this.showNotification(`Scenario loaded: ${data.scenario.name}`, 'success');
  });
  
  this.gameStateManager.addEventListener('scenario-cleared', () => {
    console.log('Scenario cleared');
    this.showNotification('Scenario cleared', 'info');
  });
}
```

## Usage Instructions

### For Developers

1. **Start Demo Mode**: Run frontend with manual polling mode
2. **Select Scenario**: Use dropdown to choose a test scenario
3. **Set Environment**: Click "Set Environment" to load the scenario
4. **Observe UI**: Check that the game state reflects the scenario
5. **Validate Results**: Click "Validate Results" to see effect validation
6. **Export State**: Use existing export functionality if needed

### For Testing

1. **Create Scenarios**: Add new scenarios to `shared/testScenarios/`
2. **Update Config**: Add scenario to `testConfig.json`
3. **Test Frontend**: Load scenario and validate UI behavior
4. **Test Backend**: Run automated tests with same scenario
5. **Document Results**: Update test documentation

## Integration Benefits

1. **Visual Testing**: See effects in real-time UI
2. **Interactive Development**: Quickly test different scenarios
3. **Consistent Data**: Same scenarios used in frontend and backend
4. **Effect Validation**: Immediate feedback on card effect calculations
5. **Development Speed**: Rapid iteration on card effects and game logic

This integration provides a powerful testing interface that bridges the gap between automated backend testing and visual frontend validation, enabling comprehensive testing of the card game's complex effect system.