import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';

export default class PreloaderScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloaderScene' });
  }

  preload() {
    this.createLoadingBar();
    
    // Start by fetching the resource list from API
    this.fetchResourceList()
      .then(() => {
        // After getting resource list, load all assets
        this.loadAssets();
      })
      .catch((error) => {
        console.error('[PreloaderScene] Failed to fetch resource list, using fallback:', error);
        // Fallback to static loading if API fails
        this.loadAssets();
      });
    
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

  async fetchResourceList() {
    const apiUrl = "http://localhost:8080/api/game/resources";
    
    this.updateLoadingText('Fetching resource list...');
    
    try {
      console.log('[PreloaderScene] Fetching resource list from:', apiUrl);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const resourceData = await response.json();
      console.log('[PreloaderScene] Resource list received:', resourceData);
      
      // Store the dynamic resource list
      this.dynamicResources = resourceData;
      
      return resourceData;
      
    } catch (error) {
      console.error('[PreloaderScene] API call failed:', error);
      // Set fallback resources if API fails
      this.dynamicResources = this.getFallbackResources();
      throw error;
    }
  }

  getFallbackResources() {
    // Fallback resource list if API is unavailable
    return {
      images: [
        "cardback.png",
        "EXB-001.png", 
        "EXR-001.png",
        "R-001.png",
      ],
      rootPath: "http://localhost:8080/api/game/image/",
      loadPreviews: true
    };
  }

  loadAssets() {
    this.updateLoadingText('Loading game assets...');
    
    // Use dynamic resources if available, otherwise use fallback
    const resources = this.dynamicResources || this.getFallbackResources();
    const { images, rootPath, loadPreviews = true } = resources;

    console.log('[PreloaderScene] Loading assets with resources:', resources);

    // Load dynamic backend images (both full-size and previews)
    this.loadBackendImages(rootPath, images, loadPreviews);
    
    // Load static local assets
    this.load.image('card-back', 'src/assets/cardBack.png');
    this.load.image('card-back-leader', 'src/assets/cardBackLeader.png');
    
    // Create placeholder card textures
    this.createCardTextures();
    
    // Create UI textures
    this.createUITextures();
  }

  loadBackendImages(rootPath, imageList, loadPreviews = true) {
    console.log(`[PreloaderScene] Loading backend images from: ${rootPath} (previews: ${loadPreviews})`);
    
    imageList.forEach(imageName => {
      const imageKey = this.getImageKey(imageName);
      
      // Load full-size image: http://localhost:8080/api/game/image/cardback.png
      const fullImageUrl = `${rootPath}${imageName}`;
      this.load.image(imageKey, fullImageUrl);
      console.log(`[PreloaderScene] Queuing: ${imageKey} from ${fullImageUrl}`);
      
      // Load preview image if enabled: http://localhost:8080/api/game/image/previews/cardback.png
      if (loadPreviews) {
        const previewKey = `${imageKey}-preview`;
        const previewImageUrl = `${rootPath}previews/${imageName}`;
        this.load.image(previewKey, previewImageUrl);
        console.log(`[PreloaderScene] Queuing: ${previewKey} from ${previewImageUrl}`);
      }
    });
    
    // Handle successful loads
    this.load.on('filecomplete', (key, type) => {
      if (type === 'image') {
        console.log(`[PreloaderScene] ✅ Successfully loaded: ${key}`);
      }
    });
    
    // Handle load errors gracefully
    this.load.on('loaderror', (fileObj) => {
      console.warn(`[PreloaderScene] ❌ Failed to load: ${fileObj.key} from ${fileObj.src}`);
    });
  }

  updateLoadingText(text) {
    if (this.loadingText) {
      this.loadingText.setText(text);
    }
  }

  getImageKey(imageName) {
    // Convert filename to appropriate key (remove extension)
    return imageName.replace(/\.[^/.]+$/, "");
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