// UIHelper Usage Examples
// This file demonstrates how to use the enhanced UIHelper class

import UIHelper from '../src/utils/UIHelper.js';

// Example Scene using UIHelper
export default class ExampleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ExampleScene' });
  }

  create() {
    // Initialize UIHelper
    this.uiHelper = new UIHelper(this);
    
    // Example 1: Simple button creation
    this.createSimpleButtons();
    
    // Example 2: Test buttons (DemoScene pattern)
    this.createTestButtonsExample();
    
    // Example 3: Dialog creation
    this.createDialogExample();
    
    // Example 4: Button rows and columns
    this.createLayoutExamples();
    
    // Example 5: Standard positions
    this.createPositionExamples();
  }

  createSimpleButtons() {
    // Basic button
    const playButton = this.uiHelper.createButton(
      400, 300, 
      'Play Game', 
      () => console.log('Play clicked!')
    );

    // Button with hover effects
    const settingsButton = this.uiHelper.createButton(
      400, 350, 
      'Settings', 
      () => console.log('Settings clicked!'),
      {
        enableHover: true,
        fontSize: '16px',
        scale: 0.9
      }
    );

    // Disabled button example
    const lockedButton = this.uiHelper.createButton(
      400, 400, 
      'Locked Feature', 
      () => console.log('This should not fire'),
      {
        disabled: true,
        fontSize: '14px'
      }
    );

    // Enable the locked button after 3 seconds
    this.time.delayedCall(3000, () => {
      lockedButton.setEnabled(true);
      lockedButton.setText('Now Unlocked!');
    });
  }

  createTestButtonsExample() {
    // Using the createTestButtons method (DemoScene pattern)
    const testConfigs = [
      {
        text: 'Test 1',
        onClick: () => console.log('Test 1 clicked'),
        options: { enableHover: true }
      },
      {
        text: 'Test 2', 
        onClick: () => console.log('Test 2 clicked'),
        options: { enableHover: true, fontSize: '12px' }
      },
      {
        text: 'Test 3',
        onClick: () => console.log('Test 3 clicked'),
        options: { enableHover: true, fontSize: '12px' }
      }
    ];

    this.testButtons = this.uiHelper.createTestButtons(testConfigs);
  }

  createDialogExample() {
    // Create a button that opens a dialog
    this.uiHelper.createButton(
      400, 500,
      'Open Dialog',
      () => this.showExampleDialog(),
      { enableHover: true }
    );
  }

  showExampleDialog() {
    const dialogButtons = [
      {
        text: 'Confirm',
        onClick: () => console.log('Confirmed!'),
        tint: 0x00ff00
      },
      {
        text: 'Cancel',
        onClick: () => console.log('Cancelled!'),
        tint: 0xff0000
      }
    ];

    this.uiHelper.createDialog(
      'Example Dialog',
      'This is an example dialog with two buttons.',
      dialogButtons
    );
  }

  createLayoutExamples() {
    // Button row example
    const menuButtons = [
      {
        text: 'New Game',
        onClick: () => console.log('New Game'),
        options: { enableHover: true }
      },
      {
        text: 'Load Game',
        onClick: () => console.log('Load Game'),
        options: { enableHover: true }
      },
      {
        text: 'Options',
        onClick: () => console.log('Options'),
        options: { enableHover: true }
      }
    ];

    this.uiHelper.createButtonRow(400, 150, menuButtons, 140);

    // Button column example
    const sidebarButtons = [
      {
        text: 'Inventory',
        onClick: () => console.log('Inventory'),
        options: { fontSize: '12px', enableHover: true }
      },
      {
        text: 'Character',
        onClick: () => console.log('Character'),
        options: { fontSize: '12px', enableHover: true }
      },
      {
        text: 'Skills',
        onClick: () => console.log('Skills'),
        options: { fontSize: '12px', enableHover: true }
      }
    ];

    this.uiHelper.createButtonColumn(100, 300, sidebarButtons, 50);
  }

  createPositionExamples() {
    const positions = this.uiHelper.getStandardPositions();

    // Use standard positions
    this.uiHelper.createButton(
      positions.topLeft.x,
      positions.topLeft.y,
      'Top Left',
      () => console.log('Top Left'),
      { fontSize: '12px', enableHover: true }
    );

    this.uiHelper.createButton(
      positions.bottomRight.x,
      positions.bottomRight.y,
      'Bottom Right',
      () => console.log('Bottom Right'),
      { fontSize: '12px', enableHover: true }
    );

    this.uiHelper.createButton(
      positions.center.x,
      positions.center.y,
      'Center',
      () => console.log('Center'),
      { fontSize: '16px', enableHover: true, scale: 1.0 }
    );
  }
}

// Usage patterns summary:

/*
1. BASIC BUTTON CREATION:
   const button = uiHelper.createButton(x, y, 'Text', callback, options);
   
2. TEST BUTTONS (DemoScene pattern):
   const buttons = uiHelper.createTestButtons(buttonConfigs);
   
3. BUTTON LAYOUTS:
   const rowButtons = uiHelper.createButtonRow(x, y, configs, spacing);
   const colButtons = uiHelper.createButtonColumn(x, y, configs, spacing);
   
4. STANDARD POSITIONS:
   const positions = uiHelper.getStandardPositions();
   // Use positions.bottomRight, positions.center, etc.
   
5. DIALOGS:
   uiHelper.createDialog(title, message, buttonConfigs);
   
6. BUTTON CONTROL:
   button.setVisible(false);
   button.setEnabled(false);
   button.setText('New Text');
   button.destroy();

OPTIONS AVAILABLE:
- scale: 0.8 (default button scale)
- fontSize: '14px' 
- enableHover: false (enable hover effects)
- disabled: false (start disabled)
- clickScale: 0.76 (scale during click)
- clickDelay: 50 (ms delay before callback)
- tint: 0xffffff (button tint color)
- hoverTint: 0xcccccc (hover tint color)
- disabledTint: 0x666666 (disabled tint color)
- textColor: '#ffffff' (text color)
*/