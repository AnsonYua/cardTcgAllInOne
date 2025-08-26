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
    
    // Loading progress events
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
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222222);
    this.progressBox.fillRect(width / 2 - 210, height / 2 - 20, 420, 40);

    this.progressBar = this.add.graphics();

    this.loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading Game Resources...', {
      font: '20px Arial',
      fill: '#ffffff'
    });
    this.loadingText.setOrigin(0.5, 0.5);
  }

  async fetchResourceList() {
    // TODO: Replace this placeholder with actual API call when backend is ready
    const placeholderApiUrl = "http://localhost:8080/api/game/resources";
    
    this.updateLoadingText('Fetching resource list from server...');
    
    try {
      console.log('[CardResourcePreloader] [PLACEHOLDER] Would fetch from:', placeholderApiUrl);
      
      // PLACEHOLDER: Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // PLACEHOLDER: Use fallback resources for now
      const resourceData = this.getFallbackResources();
      resourceData.source = 'placeholder'; // Mark as placeholder data
      
      console.log('[CardResourcePreloader] [PLACEHOLDER] Using fallback resource list:', resourceData);
      
      // Store the resource list
      this.dynamicResources = resourceData;
      
      return resourceData;
      
    } catch (error) {
      console.error('[CardResourcePreloader] [PLACEHOLDER] Error in placeholder:', error);
      // Set fallback resources if something fails
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
        "ST01-001.png",
        "ST01-002.png",
        "ST01-003.png",
        "ST01-004.png"
      ],
      rootPath: "http://localhost:8080/api/game/image/",
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
    console.log(`[CardResourcePreloader] [PLACEHOLDER] Loading backend images from: ${rootPath} (previews: ${loadPreviews})`);
    
    imageList.forEach(imageName => {
      const imageKey = this.getImageKey(imageName);
      
      // TODO: Replace with actual backend image URLs when backend is ready
      // Load full-size image: http://localhost:8080/api/game/image/cardback.png
      const fullImageUrl = `${rootPath}${imageName}`;
      this.load.image(imageKey, fullImageUrl);
      console.log(`[CardResourcePreloader] [PLACEHOLDER] Queuing: ${imageKey} from ${fullImageUrl}`);
      
      // Load preview image if enabled: http://localhost:8080/api/game/image/previews/cardback.png
      if (loadPreviews) {
        const previewKey = `${imageKey}-preview`;
        const previewImageUrl = `${rootPath}previews/${imageName}`;
        this.load.image(previewKey, previewImageUrl);
        console.log(`[CardResourcePreloader] [PLACEHOLDER] Queuing: ${previewKey} from ${previewImageUrl}`);
      }
    });
  }

  updateProgressBar(value) {
    this.progressBar.clear();
    this.progressBar.fillStyle(GAME_CONFIG.colors.highlight);
    this.progressBar.fillRect(
      this.cameras.main.width / 2 - 200,
      this.cameras.main.height / 2 - 10,
      400 * value,
      20
    );
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

  onLoadingComplete() {
    // Set better texture filtering for all loaded textures
    this.textures.each((texture) => {
      texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    });
    
    // Clean up loading interface
    this.progressBar.destroy();
    this.progressBox.destroy();
    this.loadingText.destroy();
    
    // Transition to target scene with scene data
    console.log(`[CardResourcePreloader] Loading complete, transitioning to: ${this.targetScene}`);
    this.scene.start(this.targetScene, this.sceneData);
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