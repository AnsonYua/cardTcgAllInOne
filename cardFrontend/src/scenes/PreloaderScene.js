import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';

export default class PreloaderScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloaderScene' });
  }

  preload() {
    this.createLoadingBar();
    this.loadAssets();
    
    this.load.on('progress', (value) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(GAME_CONFIG.colors.highlight);
      this.progressBar.fillRect(
        this.cameras.main.width / 2 - 200,
        this.cameras.main.height / 2 - 10,
        400 * value,
        20
      );
    });

    this.load.on('complete', () => {
      // Set better texture filtering for all loaded textures
      this.textures.each((texture) => {
        texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      });
      
      this.progressBar.destroy();
      this.progressBox.destroy();
      this.loadingText.destroy();
      this.scene.start('MenuScene');
    });
    
  }

  createLoadingBar() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222222);
    this.progressBox.fillRect(width / 2 - 210, height / 2 - 20, 420, 40);

    this.progressBar = this.add.graphics();

    this.loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      font: '20px Arial',
      fill: '#ffffff'
    });
    this.loadingText.setOrigin(0.5, 0.5);
  }

  loadAssets() {
    // Load actual card back image
    this.load.image('card-back', 'src/assets/cardBack.png');
    
    // Load leader card back image
    this.load.image('card-back-leader', 'src/assets/cardBackLeader.png');
    
    // Load all card images
    this.loadCardImages();
    
    // Create placeholder card textures
    this.createCardTextures();
    
    // Create UI textures
    this.createUITextures();
  }

  loadCardImages() {
    // Load character cards (c-1 to c-28) - both original and preview versions
    for (let i = 1; i <= 28; i++) {
      this.load.image(`c-${i}`, `src/assets/character/c-${i}.png`);
      this.load.image(`c-${i}-preview`, `src/assets/character/c-${i}-preview.png`);
    }
    
    // Load leader cards (s-1 to s-6) - both original and preview versions
    for (let i = 1; i <= 6; i++) {
      this.load.image(`s-${i}`, `src/assets/leader/s-${i}.png`);
      this.load.image(`s-${i}-preview`, `src/assets/leader/s-${i}-preview.png`);
    }
    
    // Load help cards (h-1 to h-15) - both original and preview versions
    for (let i = 1; i <= 15; i++) {
      this.load.image(`h-${i}`, `src/assets/utilityCard/h-${i}.png`);
      this.load.image(`h-${i}-preview`, `src/assets/utilityCard/h-${i}-preview.png`);
    }
    
    // Load SP cards (sp-1 to sp-10) - both original and preview versions
    for (let i = 1; i <= 10; i++) {
      this.load.image(`sp-${i}`, `src/assets/utilityCard/sp-${i}.png`);
      this.load.image(`sp-${i}-preview`, `src/assets/utilityCard/sp-${i}-preview.png`);
    }
  }

  createCardTextures() {
    // Create card frames for different types
    Object.entries(GAME_CONFIG.colors).forEach(([type, color]) => {
      if (['character', 'help', 'sp', 'leader'].includes(type)) {
        const frameGraphics = this.add.graphics();
        frameGraphics.fillStyle(0xffffff);
        frameGraphics.fillRoundedRect(0, 0, GAME_CONFIG.card.width, GAME_CONFIG.card.height, GAME_CONFIG.card.cornerRadius);
        frameGraphics.lineStyle(GAME_CONFIG.card.borderWidth, color);
        frameGraphics.strokeRoundedRect(0, 0, GAME_CONFIG.card.width, GAME_CONFIG.card.height, GAME_CONFIG.card.cornerRadius);
        frameGraphics.generateTexture(`${type}-frame`, GAME_CONFIG.card.width, GAME_CONFIG.card.height);
        frameGraphics.destroy();
      }
    });
  }

  createUITextures() {
    // Create zone placeholder
    const zoneGraphics = this.add.graphics();
    zoneGraphics.lineStyle(2, 0x666666, 1);
    zoneGraphics.strokeRoundedRect(0, 0, GAME_CONFIG.card.width - 10, GAME_CONFIG.card.height , GAME_CONFIG.card.cornerRadius);
    zoneGraphics.setAlpha(1);
    zoneGraphics.generateTexture('zone-placeholder', GAME_CONFIG.card.width - 10, GAME_CONFIG.card.height );
    zoneGraphics.destroy();

    // Create zone highlight
    const highlightGraphics = this.add.graphics();
    highlightGraphics.lineStyle(3, GAME_CONFIG.colors.highlight, 1);
    highlightGraphics.strokeRoundedRect(0, 0, GAME_CONFIG.card.width + 10, GAME_CONFIG.card.height + 10, GAME_CONFIG.card.cornerRadius);
    highlightGraphics.generateTexture('zone-highlight', GAME_CONFIG.card.width + 10, GAME_CONFIG.card.height + 10);
    highlightGraphics.destroy();

    // Create button texture
    const buttonGraphics = this.add.graphics();
    buttonGraphics.fillStyle(0x4A90E2);
    buttonGraphics.fillRoundedRect(0, 0, 200, 50, 8);
    buttonGraphics.lineStyle(2, 0x357ABD);
    buttonGraphics.strokeRoundedRect(0, 0, 200, 50, 8);
    buttonGraphics.generateTexture('button', 200, 50);
    buttonGraphics.destroy();
  }
}