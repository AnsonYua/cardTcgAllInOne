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
    // Load all card files from each folder
    this.scanAndLoadFolder('character', 'c-');
    this.scanAndLoadFolder('leader', 's-');
    this.scanAndLoadFolder('utilityCard', 'h-');
    this.scanAndLoadFolder('utilityCard', 'sp-');
  }

  scanAndLoadFolder(folderName, prefix) {
    console.log(`[PreloaderScene] Loading ${folderName} files with prefix ${prefix}`);
    
    // Use a predefined list of known card ranges to avoid 404 scanning
    let cardRange;
    if (prefix === 'c-') cardRange = 28;      // Character cards c-1 to c-28
    else if (prefix === 's-') cardRange = 6;  // Leader cards s-1 to s-6  
    else if (prefix === 'h-') cardRange = 15; // Help cards h-1 to h-15
    else if (prefix === 'sp-') cardRange = 10; // SP cards sp-1 to sp-10
    else cardRange = 10;
    
    const foundFiles = [];
    
    // Load images and let Phaser handle missing files gracefully
    for (let i = 1; i <= cardRange; i++) {
      const cardId = `${prefix}${i}`;
      const imagePath = `src/assets/${folderName}/${cardId}.png`;
      const previewPath = `src/assets/${folderName}/${cardId}-preview.png`;
      
      foundFiles.push(cardId);
      
      // Load main image
      this.load.image(cardId, imagePath);
      
      // Load preview image  
      this.load.image(`${cardId}-preview`, previewPath);
      
      // Handle successful loads
      this.load.once(`filecomplete-image-${cardId}`, () => {
        console.log(`[PreloaderScene] Successfully loaded: ${cardId}`);
      });
      
      this.load.once(`filecomplete-image-${cardId}-preview`, () => {
        console.log(`[PreloaderScene] Successfully loaded: ${cardId}-preview`);
      });
    }
    
    // Handle load errors silently
    this.load.on('loaderror', (fileObj) => {
      if (fileObj.key.startsWith(prefix)) {
        // Don't log errors, just handle them silently
      }
    });
    
    console.log(`[PreloaderScene] Queued ${foundFiles.length} ${folderName} files for loading`);
    return foundFiles;
  }

  createPreviewFallback(cardId) {
    // Create a preview version from the main image after it loads
    this.load.once('filecomplete-image-' + cardId, () => {
      if (!this.textures.exists(`${cardId}-preview`)) {
        // Use the main image as preview with slight modification
        this.textures.addImage(`${cardId}-preview`, this.textures.get(cardId).source[0]);
        console.log(`[PreloaderScene] Created preview fallback for ${cardId}`);
      }
    });
  }

  getCardInfo(cardId) {
    if (cardId.startsWith('c-')) return { folder: 'character' };
    if (cardId.startsWith('h-') || cardId.startsWith('sp-')) return { folder: 'utilityCard' };
    if (cardId.startsWith('s-')) return { folder: 'leader' };
    return null;
  }

  createFallbackTexture(cardId) {
    // Create a simple colored rectangle as fallback
    this.load.once('complete', () => {
      if (!this.textures.exists(cardId)) {
        console.log(`Creating fallback texture for ${cardId}`);
        const graphics = this.add.graphics();
        graphics.fillStyle(0x4444ff);
        graphics.fillRoundedRect(0, 0, 130, 190, 10);
        graphics.generateTexture(cardId, 130, 190);
        graphics.destroy();
      }
      
      if (!this.textures.exists(`${cardId}-preview`)) {
        console.log(`Creating fallback preview texture for ${cardId}-preview`);
        const graphics = this.add.graphics();
        graphics.fillStyle(0x6666ff);
        graphics.fillRoundedRect(0, 0, 130, 190, 10);
        graphics.generateTexture(`${cardId}-preview`, 130, 190);
        graphics.destroy();
      }
    });
  }

  loadImagesFromFolder(folderName, prefix) {
    // Since we can't dynamically scan folders in the browser, we'll load a reasonable range
    // and handle missing files gracefully
    let maxCards;
    
    // Set reasonable limits based on card type to reduce 404 errors
    if (prefix === 'c-') maxCards = 28; // Character cards
    else if (prefix === 's-') maxCards = 6; // Leader cards  
    else if (prefix === 'h-') maxCards = 15; // Help cards
    else if (prefix === 'sp-') maxCards = 10; // SP cards
    else maxCards = 10; // Default
    
    console.log(`[PreloaderScene] Loading ${folderName} images with prefix ${prefix} (max: ${maxCards})`);
    
    for (let i = 1; i <= maxCards; i++) {
      const cardId = `${prefix}${i}`;
      
      // Load original image
      this.load.image(cardId, `src/assets/${folderName}/${cardId}.png`);
      console.log(`[PreloaderScene] Queuing load: ${cardId} from src/assets/${folderName}/${cardId}.png`);
      
      // Load preview image
      this.load.image(`${cardId}-preview`, `src/assets/${folderName}/${cardId}-preview.png`);
      console.log(`[PreloaderScene] Queuing load: ${cardId}-preview from src/assets/${folderName}/${cardId}-preview.png`);
    }
    
    // Handle load success
    this.load.on('filecomplete', (key, type, data) => {
      if (key.startsWith(prefix)) {
        console.log(`[PreloaderScene] Successfully loaded: ${key}`);
      }
    });
    
    // Handle load errors gracefully (files that don't exist)
    this.load.on('loaderror', (fileObj) => {
      if (fileObj.key.startsWith(prefix)) {
        console.log(`[PreloaderScene] Card image not found: ${fileObj.src} (this is normal for unused card slots)`);
      }
    });
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