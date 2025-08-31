import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';

/**
 * CardResourcePreloader - Handles dynamic loading of card/game resources from backend API
 * This is separate from PreloaderScene which loads default UI components
 */
export default class CardResourcePreloader extends Phaser.Scene {
  constructor() {
    super({ key: 'CardResourcePreloader' });
    this.dynamicResources = null;
    this.targetScene = null; // Scene to transition to after loading
  }

  init(data) {
    // Accept target scene parameter (e.g., 'GameScene', 'DemoScene')
    this.targetScene = data?.targetScene || 'GameScene';
    this.sceneData = data?.sceneData || {};
    console.log(`[CardResourcePreloader] Initialized with target scene: ${this.targetScene}`);
    console.log(`[CardResourcePreloader] Scene data:`, this.sceneData);
  }

  preload() {
    console.log('[CardResourcePreloader] Scene initialized, creating loading interface...');
    this.createLoadingBar();
    
    // Start by fetching the resource list from API
    this.fetchResourceList()
      .then(() => {
        // After getting resource list, load all card resources
        this.loadCardResources();
      })
      .catch((error) => {
        console.error('[CardResourcePreloader] Failed to fetch resource list, using fallback:', error);
        // Fallback to static loading if API fails
        this.loadCardResources();
      });
    
    // Loading progress events - matching PreloaderScene pattern
    this.load.on('progress', (value) => {
      this.updateProgressBar(value);
      this.updateLoadingText(`Loading resources... ${Math.round(value * 100)}%`);
    });

    this.load.on('complete', () => {
      this.onLoadingComplete();
    });
    
    // Handle individual file loading
    this.load.on('filecomplete', (key, type) => {
      if (type === 'image') {
        console.log(`[CardResourcePreloader] ✅ Successfully loaded: ${key}`);
      }
    });
    
    // Handle load errors gracefully
    this.load.on('loaderror', (fileObj) => {
      console.warn(`[CardResourcePreloader] ❌ Failed to load: ${fileObj.key} from ${fileObj.src}`);
    });
  }

  createLoadingBar() {
    // Safe camera access with fallback values - matching PreloaderScene pattern
    const width = this.cameras?.main?.width || this.sys?.game?.config?.width || 1920;
    const height = this.cameras?.main?.height || this.sys?.game?.config?.height || 1080;
    
    console.log(`[CardResourcePreloader] Creating loading bar with dimensions: ${width}x${height}`);

    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222222);
    this.progressBox.fillRect(width / 2 - 210, height / 2 - 20, 420, 40);

    this.progressBar = this.add.graphics();

    this.loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading Game Resources...', {
      font: '20px Arial',
      fill: '#ffffff'
    });
    this.loadingText.setOrigin(0.5, 0.5);
    
    console.log('[CardResourcePreloader] Loading UI created successfully');
  }

  async fetchResourceList() {
    const apiUrl = GAME_CONFIG.api.getFullUrl(GAME_CONFIG.api.endpoints.gameResource);
    
    this.updateLoadingText('Fetching deck data from server...');
    
    try {
      console.log('[CardResourcePreloader] Fetching deck data from:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: GAME_CONFIG.api.headers,
        signal: AbortSignal.timeout(GAME_CONFIG.api.timeout)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const deckData = await response.json();
      console.log('[CardResourcePreloader] Deck data received:', deckData);
      
      // Process the deck data to extract unique card images
      const resourceData = this.processDeckData(deckData);
      
      // Store the resource list
      this.dynamicResources = resourceData;
      
      return resourceData;
      
    } catch (error) {
      console.error('[CardResourcePreloader] API call failed:', error);
      // Set fallback resources if API fails
      this.dynamicResources = this.getFallbackResources();
      throw error;
    }
  }

  processDeckData(deckData) {
    console.log('[CardResourcePreloader] Processing deck data...');
    
    // Extract all card paths from all decks and deduplicate
    const allCardPaths = new Set();
    
    // Loop through all decks in deckData.decks
    if (deckData.decks) {
      Object.keys(deckData.decks).forEach(deckKey => {
        const deck = deckData.decks[deckKey];
        if (deck.cards && Array.isArray(deck.cards)) {
          deck.cards.forEach(cardPath => {
            // Add .png extension if not present
            const imagePath = cardPath.endsWith('.png') ? cardPath : `${cardPath}.png`;
            allCardPaths.add(imagePath);
          });
        }
      });
    }
    
    // Convert set to array
    const uniqueCardPaths = Array.from(allCardPaths);
    
    console.log(`[CardResourcePreloader] Found ${uniqueCardPaths.length} unique cards to load:`, uniqueCardPaths);
    
    return {
      images: uniqueCardPaths,
      rootPath: GAME_CONFIG.api.imageBaseUrl,
      loadPreviews: true,
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      source: 'api'
    };
  }

  getFallbackResources() {
    // Fallback resource list if API is unavailable
    return {
      images: [
        "cardback.png",
        "EXB-001.png", 
        "EXR-001.png",
        "R-001.png",
        "st01/ST01-001.png",
        "st01/ST01-002.png",
        "st01/ST01-003.png",
        "st01/ST01-004.png"
      ],
      rootPath: GAME_CONFIG.api.imageBaseUrl,
      loadPreviews: true,
      version: "fallback",
      timestamp: new Date().toISOString()
    };
  }

  loadCardResources() {
    this.updateLoadingText('Loading card resources...');
    
    // Use dynamic resources if available, otherwise use fallback
    const resources = this.dynamicResources || this.getFallbackResources();
    const { images, rootPath, loadPreviews = true } = resources;

    console.log('[CardResourcePreloader] Loading card resources with:', resources);

    // Load dynamic backend images (both full-size and previews)
    this.loadBackendImages(rootPath, images, loadPreviews);
  }

  loadBackendImages(rootPath, imageList, loadPreviews = true) {
    console.log(`[CardResourcePreloader] Loading backend images from: ${rootPath} (previews: ${loadPreviews})`);
    
    // Generate timestamp for cache busting
    const timestamp = Date.now();
    
    imageList.forEach(imagePath => {
      const imageKey = this.getImageKey(imagePath);
      
      // Load full-size image using GAME_CONFIG helper with timestamp
      const fullImageUrl = `${GAME_CONFIG.api.getImageUrl(imagePath)}?t=${timestamp}`;
      this.load.image(imageKey, fullImageUrl);
      console.log(`[CardResourcePreloader] Queuing: ${imageKey} from ${fullImageUrl}`);
      
      // Load preview image if enabled using GAME_CONFIG helper with timestamp
      if (loadPreviews) {
        const previewKey = `${imageKey}-preview`;
        console.log("loadKey ", previewKey)
        const previewImageUrl = `${GAME_CONFIG.api.getPreviewImageUrl(imagePath)}?t=${timestamp}`;
        this.load.image(previewKey, previewImageUrl);
        console.log(`[CardResourcePreloader] Queuing: ${previewKey} from ${previewImageUrl}`);
      }
    });
  }

  updateProgressBar(value) {
    if (!this.progressBar) return;
    
    // Safe camera access with fallback values - matching PreloaderScene pattern  
    const width = this.cameras?.main?.width || this.sys?.game?.config?.width || 1920;
    const height = this.cameras?.main?.height || this.sys?.game?.config?.height || 1080;
    
    this.progressBar.clear();
    this.progressBar.fillStyle(GAME_CONFIG.colors.highlight);
    this.progressBar.fillRect(
      width / 2 - 200,
      height / 2 - 10,
      400 * value,
      20
    );
  }

  updateLoadingText(text) {
    // Enhanced safety checks
    if (this.loadingText && typeof this.loadingText === 'object' && this.loadingText.active && this.loadingText.setText) {
      try {
        this.loadingText.setText(text);
        console.log(`[CardResourcePreloader] Loading text updated: ${text}`);
      } catch (error) {
        console.warn('[CardResourcePreloader] Could not update loading text:', error);
        // If the text object is corrupted, try to recreate it
        this.recreateLoadingText(text);
      }
    } else {
      console.warn(`[CardResourcePreloader] Loading text not available - state:`, {
        exists: !!this.loadingText,
        type: typeof this.loadingText,
        active: this.loadingText?.active,
        hasSetText: !!this.loadingText?.setText
      });
      // Try to recreate the loading text
      this.recreateLoadingText(text);
    }
  }

  recreateLoadingText(text) {
    try {
      if (this.loadingText && this.loadingText.destroy) {
        this.loadingText.destroy();
      }
      
      // Safe camera access with fallback values
      const width = this.cameras?.main?.width || this.sys?.game?.config?.width || 1920;
      const height = this.cameras?.main?.height || this.sys?.game?.config?.height || 1080;
      
      console.log(`[CardResourcePreloader] Recreating text with dimensions: ${width}x${height}`);
      
      this.loadingText = this.add.text(width / 2, height / 2 - 50, text, {
        fontSize: '18px',
        fill: '#ffffff'
      });
      this.loadingText.setOrigin(0.5, 0.5);
      console.log('[CardResourcePreloader] Loading text recreated successfully');
    } catch (error) {
      console.error('[CardResourcePreloader] Failed to recreate loading text:', error);
      this.loadingText = null;
    }
  }


  getImageKey(imagePath) {
    // Extract filename from path and remove extension
    // Example: "st01/ST01-012" -> "ST01-012"
    const filename = imagePath.split('/').pop(); // Get last part after slash
    return filename.replace(/\.[^/.]+$/, "");     // Remove extension
  }

  onLoadingComplete() {
    // Set better texture filtering for all loaded textures
    this.textures.each((texture) => {
      texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    });
    
    // Clean up loading interface - matching PreloaderScene pattern
    if (this.progressBar) {
      this.progressBar.destroy();
    }
    if (this.progressBox) {
      this.progressBox.destroy();
    }
    if (this.loadingText) {
      this.loadingText.destroy();
    }
    
    // Launch target scene while keeping this scene active to preserve textures
    console.log(`[CardResourcePreloader] Loading complete, launching: ${this.targetScene}`);
    this.scene.launch(this.targetScene, this.sceneData);
    
    // Stop this scene after target scene starts (preserves textures)
    this.scene.stop();
  }

  // Static method to check if card resources are already loaded
  static areCardResourcesLoaded(scene) {
    // Check if key card images are already loaded
    const requiredKeys = ['cardback', 'ST01-001', 'EXB-001'];
    return requiredKeys.every(key => scene.textures.exists(key));
  }

  // Static method to preload card resources before entering a scene
  static preloadBeforeScene(currentScene, targetScene, sceneData = {}) {
    if (CardResourcePreloader.areCardResourcesLoaded(currentScene)) {
      // Resources already loaded, go directly to target scene
      console.log(`[CardResourcePreloader] Resources already loaded, going to: ${targetScene}`);
      currentScene.scene.start(targetScene, sceneData);
    } else {
      // Need to load resources first
      console.log(`[CardResourcePreloader] Resources needed, loading before: ${targetScene}`);
      currentScene.scene.start('CardResourcePreloader', { targetScene, sceneData });
    }
  }
}