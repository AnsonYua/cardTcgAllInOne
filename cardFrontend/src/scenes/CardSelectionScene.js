import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';
import Card from '../components/Card.js';

export default class CardSelectionScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CardSelectionScene' });
    
    this.availableCards = [];
    this.selectedCards = [];
    this.maxSelections = 1;
    this.minSelections = 1;
    this.callback = null;
  }

  init(data) {
    this.availableCards = data.availableCards || [];
    this.maxSelections = data.maxSelections || 1;
    this.minSelections = data.minSelections || 1;
    this.callback = data.callback || null;
    this.title = data.title || 'Select Cards';
  }

  create() {
    this.createModalBackground();
    this.createSelectionUI();
    this.createCardGrid();
    this.createActionButtons();
  }

  createModalBackground() {
    const { width, height } = this.cameras.main;
    
    // Semi-transparent overlay
    this.overlay = this.add.graphics();
    this.overlay.fillStyle(0x000000, 0.8);
    this.overlay.fillRect(0, 0, width, height);
    
    // Modal background
    this.modalBg = this.add.graphics();
    this.modalBg.fillStyle(0x2d3748);
    this.modalBg.fillRoundedRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8, 20);
    this.modalBg.lineStyle(3, GAME_CONFIG.colors.highlight);
    this.modalBg.strokeRoundedRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8, 20);
  }

  createSelectionUI() {
    const { width, height } = this.cameras.main;
    
    // Title
    this.titleText = this.add.text(width / 2, height * 0.15, this.title, {
      fontSize: '32px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff',
      align: 'center'
    });
    this.titleText.setOrigin(0.5);
    
    // Selection counter
    this.updateSelectionCounter();
  }

  createCardGrid() {
    const { width, height } = this.cameras.main;
    
    if (this.availableCards.length === 0) {
      const noCardsText = this.add.text(width / 2, height / 2, 'No cards available', {
        fontSize: '24px',
        fontFamily: 'Arial',
        fill: '#888888',
        align: 'center'
      });
      noCardsText.setOrigin(0.5);
      return;
    }
    
    // Calculate grid layout
    const cardsPerRow = Math.min(5, Math.ceil(Math.sqrt(this.availableCards.length)));
    const rows = Math.ceil(this.availableCards.length / cardsPerRow);
    
    const gridWidth = width * 0.7;
    const gridHeight = height * 0.5;
    const cardSpacingX = gridWidth / cardsPerRow;
    const cardSpacingY = gridHeight / rows;
    
    const startX = width * 0.15 + cardSpacingX / 2;
    const startY = height * 0.25 + cardSpacingY / 2;
    
    // Create card grid
    this.cardObjects = [];
    this.availableCards.forEach((cardData, index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;
      
      const x = startX + (col * cardSpacingX);
      const y = startY + (row * cardSpacingY);
      
      const card = new Card(this, x, y, cardData, {
        interactive: true,
        draggable: false,
        scale: 0.7
      });
      
      // Selection interaction
      card.on('pointerdown', () => {
        this.toggleCardSelection(card);
      });
      
      this.cardObjects.push(card);
    });
  }

  createActionButtons() {
    const { width, height } = this.cameras.main;
    
    // Confirm button
    this.confirmButton = this.add.image(width * 0.6, height * 0.85, 'button');
    this.confirmButton.setInteractive();
    this.confirmButton.setTint(0x888888); // Start disabled
    
    const confirmText = this.add.text(width * 0.6, height * 0.85, 'Confirm', {
      fontSize: '18px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    confirmText.setOrigin(0.5);
    
    this.confirmButton.on('pointerdown', () => {
      if (this.canConfirm()) {
        this.confirmSelection();
      }
    });
    
    // Cancel button
    this.cancelButton = this.add.image(width * 0.4, height * 0.85, 'button');
    this.cancelButton.setInteractive();
    this.cancelButton.setTint(0xff6b6b);
    
    const cancelText = this.add.text(width * 0.4, height * 0.85, 'Cancel', {
      fontSize: '18px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    cancelText.setOrigin(0.5);
    
    this.cancelButton.on('pointerdown', () => {
      this.cancelSelection();
    });
  }

  toggleCardSelection(card) {
    const index = this.selectedCards.indexOf(card);
    
    if (index > -1) {
      // Deselect card
      this.selectedCards.splice(index, 1);
      card.deselect();
    } else {
      // Select card (if under limit)
      if (this.selectedCards.length < this.maxSelections) {
        this.selectedCards.push(card);
        card.select();
      }
    }
    
    this.updateSelectionCounter();
    this.updateConfirmButton();
  }

  updateSelectionCounter() {
    const { width, height } = this.cameras.main;
    
    if (this.counterText) {
      this.counterText.destroy();
    }
    
    const text = `Selected: ${this.selectedCards.length} / ${this.maxSelections}`;
    this.counterText = this.add.text(width / 2, height * 0.2, text, {
      fontSize: '18px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    });
    this.counterText.setOrigin(0.5);
  }

  updateConfirmButton() {
    const canConfirm = this.canConfirm();
    this.confirmButton.setTint(canConfirm ? 0xffffff : 0x888888);
  }

  canConfirm() {
    return this.selectedCards.length >= this.minSelections && 
           this.selectedCards.length <= this.maxSelections;
  }

  confirmSelection() {
    if (!this.canConfirm()) return;
    
    const selectedCardData = this.selectedCards.map(card => card.getCardData());
    
    if (this.callback) {
      this.callback(selectedCardData);
    }
    
    this.scene.stop();
  }

  cancelSelection() {
    if (this.callback) {
      this.callback(null);
    }
    
    this.scene.stop();
  }
}