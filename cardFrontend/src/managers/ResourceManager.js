/**
 * ResourceManager - Centralized resource loading and management
 * 
 * Handles all card resource loading, image management, and asset caching
 * for the game. Provides a unified interface for loading deck data, card images,
 * and managing resource lifecycle.
 */
import { GAME_CONFIG } from '../config/gameConfig.js';

export default class ResourceManager {
  constructor(scene) {
    this.scene = scene;
    
    // Resource management state
    this.loadedResources = new Map();
    this.loadingPromises = new Map();
    this.failedResources = new Set();
    
    // Configuration
    this.config = {
      enableLogging: true,
      enableCaching: true,
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: GAME_CONFIG.api.timeout || 10000,
      
      // Image formats and suffixes
      imageExtension: '.png',
      previewSuffix: '-preview',
      
      // Performance settings
      maxConcurrentLoads: 10,
      enableProgressTracking: true
    };
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulLoads: 0,
      failedLoads: 0,
      cachedHits: 0,
      loadStartTime: null,
      loadEndTime: null,
      averageLoadTime: 0
    };
  }

  /**
   * Main method to load all card resources
   * Fetches deck data and loads all associated card images
   * @returns {Promise} Promise that resolves when all resources are loaded
   */
  async loadCardResources() {
    const startTime = Date.now();
    this.stats.loadStartTime = startTime;
    
    try {
      this.log('Starting card resource loading process');
      
      // Fetch deck data from API
      const deckData = await this.fetchDeckData();
      
      // Extract unique card image paths
      const cardPaths = this.extractCardPaths(deckData);
      
      // Load all card images (both full-size and preview)
      await this.loadCardImages(cardPaths);
      
      // Update statistics
      this.stats.loadEndTime = Date.now();
      const totalTime = this.stats.loadEndTime - this.stats.loadStartTime;
      this.stats.averageLoadTime = totalTime / this.stats.totalRequests;
      
      this.log(`Card resource loading complete: ${totalTime}ms total, ${this.stats.successfulLoads} successful, ${this.stats.failedLoads} failed`);
      
      return {
        success: true,
        stats: this.getStats(),
        loadedCount: this.stats.successfulLoads,
        failedCount: this.stats.failedLoads
      };
      
    } catch (error) {
      this.stats.loadEndTime = Date.now();
      this.log('Error loading card resources:', error);
      throw error;
    }
  }

  /**
   * Fetch deck data from the API
   * @returns {Promise<Object>} Deck data from the server
   */
  async fetchDeckData() {
    const apiUrl = GAME_CONFIG.api.getFullUrl(GAME_CONFIG.api.endpoints.gameResource);
    this.log(`Fetching deck data from: ${apiUrl}`);

    const response = await this.makeRequest(apiUrl, {
      method: 'GET',
      headers: GAME_CONFIG.api.headers,
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const deckData = await response.json();
    this.log('Deck data received:', deckData);
    
    return deckData;
  }

  /**
   * Extract unique card image paths from deck data
   * @param {Object} deckData - Deck data from the API
   * @returns {Array<string>} Array of unique card image paths
   */
  extractCardPaths(deckData) {
    const allCardPaths = new Set();

    if (!deckData.decks) {
      this.log('No decks found in deck data');
      return [];
    }

    // Process regular decks
    Object.entries(deckData.decks).forEach(([deckKey, deck]) => {
      if (deck.cards && Array.isArray(deck.cards)) {
        this.log(`Processing deck: ${deckKey} with ${deck.cards.length} cards`);
        deck.cards.forEach(cardPath => {
          const imagePath = cardPath.endsWith(this.config.imageExtension) 
            ? cardPath 
            : `${cardPath}${this.config.imageExtension}`;
          allCardPaths.add(imagePath);
        });
      }
    });

    const uniqueCardPaths = Array.from(allCardPaths);
    this.log(`Found ${uniqueCardPaths.length} unique cards to load:`, uniqueCardPaths);
    
    return uniqueCardPaths;
  }

  /**
   * Load all card images (both full-size and preview versions)
   * @param {Array<string>} cardPaths - Array of card image paths
   * @returns {Promise} Promise that resolves when all images are loaded
   */
  async loadCardImages(cardPaths) {
    if (cardPaths.length === 0) {
      this.log('No card paths to load');
      return;
    }

    const loadPromises = [];
    const timestamp = Date.now();

    // Create loading promises for each card (full-size + preview)
    cardPaths.forEach(imagePath => {
      const imageKey = this.getImageKey(imagePath);
      
      // Load full-size image
      const fullPromise = this.loadSingleImage(imageKey, imagePath, timestamp);
      loadPromises.push(fullPromise);
      
      // Load preview image
      const previewKey = `${imageKey}${this.config.previewSuffix}`;
      const previewPromise = this.loadSingleImage(previewKey, imagePath, timestamp, true);
      loadPromises.push(previewPromise);
    });

    // Start Phaser loader and wait for all images
    this.scene.load.start();
    const results = await Promise.allSettled(loadPromises);
    
    // Process results and update statistics
    this.processLoadResults(results);
    
    return results;
  }

  /**
   * Load a single image with retry logic and error handling
   * @param {string} imageKey - Phaser texture key for the image
   * @param {string} imagePath - Path to the image file
   * @param {number} timestamp - Cache-busting timestamp
   * @param {boolean} isPreview - Whether this is a preview image
   * @returns {Promise} Promise that resolves when the image is loaded
   */
  async loadSingleImage(imageKey, imagePath, timestamp, isPreview = false) {
    // Check if already loaded or loading
    if (this.loadedResources.has(imageKey)) {
      this.stats.cachedHits++;
      return Promise.resolve();
    }

    if (this.loadingPromises.has(imageKey)) {
      return this.loadingPromises.get(imageKey);
    }

    // Create loading promise
    const loadPromise = new Promise((resolve, reject) => {
      const imageUrl = isPreview 
        ? `${GAME_CONFIG.api.getPreviewImageUrl(imagePath)}?t=${timestamp}`
        : `${GAME_CONFIG.api.getImageUrl(imagePath)}?t=${timestamp}`;
      
      let attempts = 0;
      const maxAttempts = this.config.retryAttempts;

      const attemptLoad = () => {
        attempts++;
        this.stats.totalRequests++;
        
        this.scene.load.image(imageKey, imageUrl);
        
        const onComplete = () => {
          this.log(`Loaded${isPreview ? ' preview' : ''}: ${imageKey}`);
          this.loadedResources.set(imageKey, {
            key: imageKey,
            path: imagePath,
            isPreview,
            loadTime: Date.now() - timestamp,
            attempts
          });
          this.stats.successfulLoads++;
          this.loadingPromises.delete(imageKey);
          resolve();
        };

        const onError = (file) => {
          if (file.key === imageKey) {
            if (attempts < maxAttempts) {
              this.log(`Retry ${attempts}/${maxAttempts} for ${imageKey}`);
              setTimeout(() => attemptLoad(), this.config.retryDelay);
            } else {
              this.log(`Failed to load${isPreview ? ' preview' : ''}: ${imageKey}`);
              this.failedResources.add(imageKey);
              this.stats.failedLoads++;
              this.loadingPromises.delete(imageKey);
              reject(new Error(`Failed to load ${imageKey} after ${maxAttempts} attempts`));
            }
          }
        };

        this.scene.load.once(`filecomplete-image-${imageKey}`, onComplete);
        this.scene.load.once(`loaderror`, onError);
      };

      attemptLoad();
    });

    this.loadingPromises.set(imageKey, loadPromise);
    return loadPromise;
  }

  /**
   * Process the results of all loading operations
   * @param {Array} results - Results from Promise.allSettled
   */
  processLoadResults(results) {
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    this.log(`Load results: ${successful} successful, ${failed} failed`);
    
    // Log failed resources for debugging
    if (failed > 0 && this.config.enableLogging) {
      const failedList = Array.from(this.failedResources);
      this.log('Failed resources:', failedList);
    }
  }

  /**
   * Generate a Phaser texture key from an image path
   * @param {string} imagePath - Image file path
   * @returns {string} Phaser texture key
   */
  getImageKey(imagePath) {
    // Extract filename from path and remove extension (matches original GameScene behavior)
    const filename = imagePath.split('/').pop();
    return filename.replace(/\.[^/.]+$/, "");
  }

  /**
   * Check if a resource is already loaded
   * @param {string} imageKey - Phaser texture key
   * @returns {boolean} Whether the resource is loaded
   */
  isResourceLoaded(imageKey) {
    return this.loadedResources.has(imageKey);
  }

  /**
   * Get information about a loaded resource
   * @param {string} imageKey - Phaser texture key
   * @returns {Object|null} Resource information or null if not found
   */
  getResourceInfo(imageKey) {
    return this.loadedResources.get(imageKey) || null;
  }

  /**
   * Preload specific cards that are likely to be needed soon
   * @param {Array<string>} cardPaths - Array of card paths to preload
   * @returns {Promise} Promise that resolves when preloading is complete
   */
  async preloadCards(cardPaths) {
    this.log(`Preloading ${cardPaths.length} specific cards`);
    
    const timestamp = Date.now();
    const preloadPromises = cardPaths.map(path => {
      const imageKey = this.getImageKey(path);
      return this.loadSingleImage(imageKey, path, timestamp);
    });
    
    const results = await Promise.allSettled(preloadPromises);
    this.processLoadResults(results);
    
    return results;
  }

  /**
   * Clear all loaded resources and reset state
   */
  clearResources() {
    this.loadedResources.clear();
    this.loadingPromises.clear();
    this.failedResources.clear();
    
    // Reset statistics
    this.stats = {
      totalRequests: 0,
      successfulLoads: 0,
      failedLoads: 0,
      cachedHits: 0,
      loadStartTime: null,
      loadEndTime: null,
      averageLoadTime: 0
    };
    
    this.log('Resource cache cleared');
  }

  /**
   * Get comprehensive statistics about resource loading
   * @returns {Object} Resource loading statistics
   */
  getStats() {
    return {
      ...this.stats,
      loadedResourcesCount: this.loadedResources.size,
      failedResourcesCount: this.failedResources.size,
      activeLoadingCount: this.loadingPromises.size,
      totalLoadTime: this.stats.loadEndTime - this.stats.loadStartTime,
      successRate: this.stats.totalRequests > 0 
        ? (this.stats.successfulLoads / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Update configuration settings
   * @param {Object} newConfig - Configuration updates
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.log('Configuration updated', newConfig);
  }

  /**
   * Enable or disable logging
   * @param {boolean} enabled - Whether to enable logging
   */
  setLogging(enabled) {
    this.config.enableLogging = enabled;
    this.log(`Resource loading logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Make an HTTP request with retry logic
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Fetch response
   */
  async makeRequest(url, options = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await fetch(url, options);
      } catch (error) {
        lastError = error;
        this.log(`Request attempt ${attempt}/${this.config.retryAttempts} failed:`, error.message);
        
        if (attempt < this.config.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Log messages with consistent formatting
   * @param {string} message - Log message
   * @param {*} data - Additional data to log (optional)
   */
  log(message, data = null) {
    if (this.config.enableLogging) {
      const prefix = '[ResourceManager]';
      if (data) {
        console.log(`${prefix} ${message}`, data);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  }

  /**
   * Cleanup when manager is no longer needed
   */
  destroy() {
    this.clearResources();
    this.scene = null;
    this.log('ResourceManager destroyed');
  }
}