/**
 * ZoneManager - Handles zone creation, highlighting, and interaction logic
 * Extracted from GameScene.js to improve modularity and maintainability
 */

import GameSceneUtils from '../utils/GameSceneUtils.js';

export default class ZoneManager {
  constructor(scene, layout) {
    this.scene = scene;
    this.layout = layout;
    this.playerZones = {};
    this.opponentZones = {};
    this.zoneHighlights = [];
    this.cardPreviewZone = null;
  }

  /**
   * Create all game zones based on the layout
   */
  createZones() {
    this.createPlayerZones();
    this.createOpponentZones(); 
    this.createCardPreviewZone();
    
    // Call legacy setup methods that haven't been refactored yet
    if (this.scene.createZones) {
      this.scene.createZones();
    }
    
    console.log('[ZoneManager] All zones created successfully');
  }

  /**
   * Create player zones (slots, deck, etc.)
   */
  createPlayerZones() {
    const playerLayout = this.layout.player;
    
    // Create main slot zones using GameSceneUtils
    ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'].forEach(slotName => {
      if (playerLayout[slotName]) {
        const pos = playerLayout[slotName];
        this.playerZones[slotName] = GameSceneUtils.createZone(
          this.scene, pos.x, pos.y, slotName, true
        );
      }
    });

    // Create special zones using GameSceneUtils
    if (playerLayout.deck) {
      this.playerZones.deck = GameSceneUtils.createZone(
        this.scene, playerLayout.deck.x, playerLayout.deck.y, 'deck', true
      );
    }
    
    if (playerLayout.leaderDeck) {
      this.playerZones.leaderDeck = GameSceneUtils.createZone(
        this.scene, playerLayout.leaderDeck.x, playerLayout.leaderDeck.y, 'leaderDeck', true
      );
    }
    
    if (playerLayout.base) {
      this.playerZones.base = GameSceneUtils.createZone(
        this.scene, playerLayout.base.x, playerLayout.base.y, 'base', true
      );
    }

    // Create row2 zones if they exist
    if (playerLayout.row2 && Array.isArray(playerLayout.row2)) {
      this.playerZones.row2 = playerLayout.row2.map((slotData, index) => {
        return GameSceneUtils.createZone(
          this.scene, slotData.x, slotData.y, `row2_${index}`, true
        );
      });
    }

    console.log(`[ZoneManager] Created ${Object.keys(this.playerZones).length} player zones`);
  }

  /**
   * Create opponent zones (slots, deck, etc.)
   */
  createOpponentZones() {
    const opponentLayout = this.layout.opponent;
    
    // Create main slot zones using GameSceneUtils
    ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'].forEach(slotName => {
      if (opponentLayout[slotName]) {
        const pos = opponentLayout[slotName];
        this.opponentZones[slotName] = GameSceneUtils.createZone(
          this.scene, pos.x, pos.y, slotName, false
        );
      }
    });

    // Create special zones using GameSceneUtils
    if (opponentLayout.deck) {
      this.opponentZones.deck = GameSceneUtils.createZone(
        this.scene, opponentLayout.deck.x, opponentLayout.deck.y, 'deck', false
      );
    }
    
    if (opponentLayout.leaderDeck) {
      this.opponentZones.leaderDeck = GameSceneUtils.createZone(
        this.scene, opponentLayout.leaderDeck.x, opponentLayout.leaderDeck.y, 'leaderDeck', false
      );
    }
    
    if (opponentLayout.base) {
      this.opponentZones.base = GameSceneUtils.createZone(
        this.scene, opponentLayout.base.x, opponentLayout.base.y, 'base', false
      );
    }

    // Create row2 zones if they exist
    if (opponentLayout.row2 && Array.isArray(opponentLayout.row2)) {
      this.opponentZones.row2 = opponentLayout.row2.map((slotData, index) => {
        return GameSceneUtils.createZone(
          this.scene, slotData.x, slotData.y, `row2_${index}`, false
        );
      });
    }

    console.log(`[ZoneManager] Created ${Object.keys(this.opponentZones).length} opponent zones`);
  }

  /**
   * Create card preview zone
   */
  createCardPreviewZone() {
    const previewPos = this.layout.functionalArea?.cardPreview;
    if (previewPos) {
      this.cardPreviewZone = GameSceneUtils.createZone(
        this.scene, previewPos.x, previewPos.y, 'cardPreview', false
      );
      console.log('[ZoneManager] Card preview zone created');
    }
  }

  // Note: createSpecialZone and createInteractiveZone methods removed
  // Now using GameSceneUtils.createZone for all zone creation

  /**
   * Highlight zones that can accept a card
   * @param {Object} card - Card being dragged
   * @param {Array} validZones - Array of valid zone names
   */
  highlightValidZones(card, validZones = []) {
    // Clear existing highlights
    this.clearZoneHighlights();

    if (!validZones.length) {
      console.log('[ZoneManager] No valid zones to highlight');
      return;
    }

    // Highlight valid zones
    validZones.forEach(zoneName => {
      const zone = this.getZone(zoneName);
      if (zone) {
        const highlight = this.createZoneHighlight(zone.x, zone.y, 120, 160);
        this.zoneHighlights.push(highlight);
      }
    });

    console.log(`[ZoneManager] Highlighted ${this.zoneHighlights.length} valid zones`);
  }

  /**
   * Create a zone highlight rectangle
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Highlight width
   * @param {number} height - Highlight height
   * @returns {Phaser.GameObjects.Rectangle} Highlight rectangle
   */
  createZoneHighlight(x, y, width, height) {
    const highlight = this.scene.add.rectangle(x, y, width, height);
    highlight.setStrokeStyle(3, 0x00ff00, 0.8); // Green highlight
    highlight.setFillStyle(0x00ff00, 0.1); // Semi-transparent green fill
    highlight.setDepth(50); // Above cards but below UI
    return highlight;
  }

  /**
   * Clear all zone highlights
   */
  clearZoneHighlights() {
    this.zoneHighlights.forEach(highlight => {
      if (highlight && highlight.destroy) {
        highlight.destroy();
      }
    });
    this.zoneHighlights = [];
  }

  /**
   * Get a zone by name (searches both player and opponent zones)
   * @param {string} zoneName - Zone name to find  
   * @returns {Object|null} Found zone object or null
   */
  getZone(zoneName) {
    // Check player zones
    if (this.playerZones[zoneName]) {
      return this.playerZones[zoneName];
    }

    // Check opponent zones  
    if (this.opponentZones[zoneName]) {
      return this.opponentZones[zoneName];
    }

    // Check special zones
    if (zoneName === 'cardPreview' && this.cardPreviewZone) {
      return this.cardPreviewZone;
    }

    console.warn(`[ZoneManager] Zone '${zoneName}' not found`);
    return null;
  }

  /**
   * Get all player zones
   * @returns {Object} Player zones
   */
  getPlayerZones() {
    return this.playerZones;
  }

  /**
   * Get all opponent zones  
   * @returns {Object} Opponent zones
   */
  getOpponentZones() {
    return this.opponentZones;
  }

  /**
   * Get zone position by name
   * @param {string} zoneName - Zone name
   * @returns {Object|null} Position {x, y} or null if not found
   */
  getZonePosition(zoneName) {
    const zone = this.getZone(zoneName);
    return zone ? { x: zone.x, y: zone.y } : null;
  }

  /**
   * Check if a zone is valid for card placement
   * @param {string} zoneName - Zone name to check
   * @param {Object} card - Card to validate
   * @returns {boolean} True if zone is valid for the card
   */
  isValidZoneForCard(zoneName, card) {
    // This would integrate with existing card validation logic
    // For now, return true - extend based on game rules
    const zone = this.getZone(zoneName);
    return zone !== null;
  }

  /**
   * Get zones by type
   * @param {string} type - Zone type to filter by
   * @param {string} playerType - 'player', 'opponent', or 'all'
   * @returns {Array} Array of zones matching the type
   */
  getZonesByType(type, playerType = 'all') {
    const zones = [];
    
    if (playerType === 'player' || playerType === 'all') {
      Object.entries(this.playerZones).forEach(([name, zone]) => {
        if (zone.zoneType === type) {
          zones.push({ name, zone, playerType: 'player' });
        }
      });
    }

    if (playerType === 'opponent' || playerType === 'all') {
      Object.entries(this.opponentZones).forEach(([name, zone]) => {
        if (zone.zoneType === type) {
          zones.push({ name, zone, playerType: 'opponent' });
        }
      });
    }

    return zones;
  }

  /**
   * Cleanup all zones and highlights
   */
  destroy() {
    this.clearZoneHighlights();

    // Destroy player zones
    Object.values(this.playerZones).forEach(zone => {
      if (zone && zone.destroy) zone.destroy();
    });

    // Destroy opponent zones
    Object.values(this.opponentZones).forEach(zone => {
      if (zone && zone.destroy) zone.destroy();
    });

    // Destroy card preview zone
    if (this.cardPreviewZone && this.cardPreviewZone.destroy) {
      this.cardPreviewZone.destroy();
    }

    // Clear references
    this.playerZones = {};
    this.opponentZones = {};
    this.cardPreviewZone = null;

    console.log('[ZoneManager] All zones destroyed and cleaned up');
  }
}