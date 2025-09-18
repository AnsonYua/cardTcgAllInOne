/**
 * BoardLayoutManager - Handles all game board layout calculations and zone positioning
 * Extracted from GameScene.js to reduce complexity and improve maintainability
 */

export default class BoardLayoutManager {
  constructor(scene) {
    this.scene = scene;
    this.layout = null;
    this.constants = {
      startY: 0,
      cardHeight: 160,
      playerStartX: -50,
      slotSpacing: 70,
      rowOffset: 80
    };
  }

  /**
   * Generate the complete board layout based on camera dimensions
   * @returns {Object} Complete layout configuration
   */
  createLayout() {
    const { width, height } = this.scene.cameras.main;
    const { startY, cardHeight, playerStartX } = this.constants;
    
    this.layout = {
      functionalArea: {
        cardPreview: {
          x: width * 0.5 + 730,
          y: startY + 200 + cardHeight
        },
      },
      
      // Opponent zones (top area) - REVERSED: slot1 displays at rightmost position
      opponent: {
        ...this.generateMainSlots('opponent', playerStartX, width, startY, cardHeight),
        ...this.generateSpecialZones('opponent', width, startY, cardHeight),
        row2: this.generateOpponentRow2Slots(playerStartX, width, startY - 100 -40, cardHeight)
      },
      
      // Player zones (bottom area)
      player: {
        ...this.generateMainSlots('player', playerStartX, width, startY, cardHeight),
        ...this.generateSpecialZones('player', width, startY, cardHeight),
        row2: this.generateRow2Slots(playerStartX, width, startY + 100+40, cardHeight)
      },
      
      // Hand area (bottom)
      hand: { x: width * 0.5, y: height * 0.85 }
    };

    return this.layout;
  }

  /**
   * Generate main slot positions (slot1-slot6)
   * @param {string} playerType - 'player' or 'opponent' 
   * @param {number} playerStartX - Base X offset
   * @param {number} width - Screen width
   * @param {number} startY - Base Y position
   * @param {number} cardHeight - Card height
   */
  generateMainSlots(playerType, playerStartX, width, startY, cardHeight) {
    const baseY = playerType === 'opponent' 
      ? startY + 100 + cardHeight + 10 + 15 -40
      : startY + 100 + cardHeight + 10 + 15 + cardHeight + 60;

    const slots = {};
    const slotPositions = [
      { name: 'slot1', xOffset: playerType === 'opponent' ? 280 + 50  : -320 },
      { name: 'slot2', xOffset: playerType === 'opponent' ? 160 + 40 : -200 + 10 },
      { name: 'slot3', xOffset: playerType === 'opponent' ? 40 + 30 : -80 + 20 },
      { name: 'slot4', xOffset: playerType === 'opponent' ? -80 + 20 : 40 + 30 },
      { name: 'slot5', xOffset: playerType === 'opponent' ? -200 + 10 : 160 + 40 },
      { name: 'slot6', xOffset: playerType === 'opponent' ? -320 : 280 + 50 }
    ];

    slotPositions.forEach(slot => {
      slots[slot.name] = {
        x: playerStartX + width * 0.5 + slot.xOffset,
        y: baseY
      };
    });

    return slots;
  }

  /**
   * Generate special zones (deck, leaderDeck, base)
   * @param {string} playerType - 'player' or 'opponent'
   * @param {number} width - Screen width
   * @param {number} startY - Base Y position
   * @param {number} cardHeight - Card height
   */
  generateSpecialZones(playerType, width, startY, cardHeight) {

    console.log("dafdsadssfd 111 ",startY)
    if (playerType === 'opponent') {
      return {
        deck: {
          x: width * 0.5 - 500,
          y: startY + 100 + cardHeight + 10 + 15
        },
        leaderDeck: { 
          x: width * 0.5 + 430, 
          y: startY + 100 + cardHeight + 10 + 15 
        },
        base: { 
          x: width * 0.5 + 430, 
          y: startY + 130 + cardHeight + 10 + 15 
        }
      };
    } else {
      return {
        deck: {
          x: width * 0.5 + 420,
          y: startY + 100 + cardHeight + 10 + 15 + cardHeight + 60 + 50
        },
        leaderDeck: {
          x: width * 0.5 - 550,
          y: startY + 100 + cardHeight + 10 + 15 + cardHeight + 60 + 50+ 50
        },
        base: {
          x: width * 0.5 - 550,
          y: startY + 70 + cardHeight + 10 + 15 + cardHeight + 60 + 50+ 50
        }
      };
    }
  }

  /**
   * Generate player row2 slots (12 positions below main zones)
   * @param {number} playerStartX - Base X offset
   * @param {number} width - Screen width 
   * @param {number} startY - Base Y position
   * @param {number} cardHeight - Card height
   */
  generateRow2Slots(playerStartX, width, startY, cardHeight) {
    const slots = [];
    const slotCount = 12;
    const { slotSpacing, rowOffset } = this.constants;
    const rowY = startY + 100 + cardHeight + 10 + 15 + cardHeight + 70 + rowOffset;

    // Calculate starting X to center the slots
    const totalWidth = (slotCount - 1) * slotSpacing;
    const startX = (width * 0.5) - (totalWidth / 2) - 10;

    // Generate slot positions
    for (let i = 0; i < slotCount; i++) {
      slots.push({
        x: startX + (i * slotSpacing),
        y: rowY,
        index: i
      });
    }

    return slots;
  }

  /**
   * Generate opponent row2 slots (12 positions above main zones, reversed)
   * @param {number} playerStartX - Base X offset
   * @param {number} width - Screen width
   * @param {number} startY - Base Y position  
   * @param {number} cardHeight - Card height
   */
  generateOpponentRow2Slots(playerStartX, width, startY, cardHeight) {
    const slots = [];
    const slotCount = 12;
    const { slotSpacing, rowOffset } = this.constants;
    const rowY = startY + 100 + cardHeight + 10 + 15 - rowOffset;

    // Calculate starting X to center the slots
    const totalWidth = (slotCount - 1) * slotSpacing;
    const startX = (width * 0.5) - (totalWidth / 2) - 80;

    // Generate slot positions - REVERSED for opponent (right to left display)
    for (let i = 0; i < slotCount; i++) {
      slots.push({
        x: startX + ((slotCount - 1 - i) * slotSpacing), // Reverse the X position
        y: rowY,
        index: i
      });
    }

    return slots;
  }

  /**
   * Get the current layout
   * @returns {Object} Current layout configuration
   */
  getLayout() {
    return this.layout;
  }

  /**
   * Update layout constants (for responsive design or config changes)
   * @param {Object} newConstants - Updated constants
   */
  updateConstants(newConstants) {
    this.constants = { ...this.constants, ...newConstants };
  }

  /**
   * Get zone position by player type and zone name
   * @param {string} playerType - 'player' or 'opponent'
   * @param {string} zoneName - Zone identifier
   * @returns {Object} Position {x, y} or null if not found
   */
  getZonePosition(playerType, zoneName) {
    if (!this.layout || !this.layout[playerType]) {
      console.warn(`[BoardLayoutManager] Layout not initialized or player type '${playerType}' not found`);
      return null;
    }

    const zone = this.layout[playerType][zoneName];
    if (!zone) {
      console.warn(`[BoardLayoutManager] Zone '${zoneName}' not found for ${playerType}`);
      return null;
    }

    return { x: zone.x, y: zone.y };
  }

  /**
   * Recalculate layout (useful for screen resize events)
   * @returns {Object} Updated layout
   */
  recalculateLayout() {
    return this.createLayout();
  }

  /**
   * Get all slot positions for a player type
   * @param {string} playerType - 'player' or 'opponent'
   * @returns {Object} All slot positions
   */
  getPlayerSlots(playerType) {
    if (!this.layout || !this.layout[playerType]) {
      return {};
    }

    const slots = {};
    ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'].forEach(slotName => {
      if (this.layout[playerType][slotName]) {
        slots[slotName] = this.layout[playerType][slotName];
      }
    });

    return slots;
  }
}