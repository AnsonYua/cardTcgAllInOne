#!/usr/bin/env node

/**
 * Test Scenario Creator Helper
 *
 * This script helps create test scenarios in the correct path and optionally updates DebugControls.ts
 *
 * Usage:
 *   node createTestScenario.js --cardId GD03-038 --scenarioName rest_trigger_ap_boost
 *
 * Or interactively:
 *   node createTestScenario.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const TEST_SCENARIOS_BASE = path.join(__dirname, 'gameStates');
const DEBUG_CONTROLS_PATH = path.join(__dirname, '../../../cardGameFrontend/src/phaser/controllers/DebugControls.ts');

// Card energy requirements by level
const LEVEL_ENERGY_REQUIREMENTS = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7
};

// Default test scenario template
const DEFAULT_TEMPLATE = {
  description: "",
  gameId: "",
  testType: "action",
  category: "ActionCase",
  tags: [],
  notes: [],
  initialGameEnv: {
    phase: "MAIN_PHASE",
    playerId_1: "playerId_1",
    playerId_2: "playerId_2",
    gameStarted: true,
    firstPlayer: 0,
    firstPlayerChooser: null,
    firstPlayerDecision: null,
    hasChosenFirstPlayer: false,
    currentPlayer: "playerId_1",
    currentTurn: 1,
    playersReady: { playerId_1: true, playerId_2: true },
    currentBattle: null,
    players: {
      playerId_1: {
        id: "playerId_1",
        name: "Player 1",
        deck: { hand: [], handUids: [], mainDeck: [] },
        confirmIsRedraw: false,
        isRedraw: false,
        playerPoint: 0,
        isReady: true,
        zones: {
          slot1: {}, slot2: {}, slot3: {}, slot4: {}, slot5: {}, slot6: {},
          base: [], shieldArea: [], energyArea: [], trashArea: [],
          repairAbilitiesCheckedThisCycle: false
        },
        effectRegistry: {},
        delayedTriggers: []
      },
      playerId_2: {
        id: "playerId_2",
        name: "Player 2",
        deck: { hand: [], handUids: [], mainDeck: [] },
        confirmIsRedraw: false,
        isRedraw: false,
        playerPoint: 0,
        isReady: true,
        zones: {
          slot1: {}, slot2: {}, slot3: {}, slot4: {}, slot5: {}, slot6: {},
          base: [], shieldArea: [], energyArea: [], trashArea: [],
          repairAbilitiesCheckedThisCycle: false
        },
        effectRegistry: {},
        delayedTriggers: []
      }
    },
    processingQueue: [],
    processingEnabled: true,
    maxEventsPerCycle: 50,
    notificationQueue: [],
    lastEventId: 0,
    pendingPhaseTransition: null
  }
};

/**
 * Parse card ID to extract set and level info
 */
function parseCardId(cardId) {
  const match = cardId.match(/^([A-Z]{2})(\d+)-(\d+)$/);
  if (!match) {
    throw new Error(`Invalid card ID format: ${cardId}. Expected format: SET-### (e.g., GD03-038)`);
  }
  return { set: match[1], series: match[2], number: match[3] };
}

/**
 * Get the energy required for a card level
 */
function getEnergyForLevel(level) {
  return LEVEL_ENERGY_REQUIREMENTS[level] || 0;
}

/**
 * Create energy cards array
 */
function createEnergyCards(count, playerPrefix) {
  const energies = [];
  for (let i = 1; i <= count; i++) {
    energies.push({
      carduid: `energy_basic_${playerPrefix}_${i}`,
      cardId: "energy_basic",
      placedAt: 0,
      placedBy: "playerId_1",
      isRested: false,
      isExtraEnergy: false
    });
  }
  return energies;
}

/**
 * Create test scenario file path
 */
function getScenarioPath(cardId, scenarioName) {
  const { set } = parseCardId(cardId);
  const folder = path.join(TEST_SCENARIOS_BASE, set, cardId);
  return {
    folder,
    filePath: path.join(folder, `${scenarioName}.json`)
  };
}

/**
 * Ensure directory exists
 */
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

/**
 * Update DebugControls.ts with new scenario
 */
function updateDebugControls(cardId, scenarioName) {
  if (!fs.existsSync(DEBUG_CONTROLS_PATH)) {
    console.warn(`DebugControls.ts not found at: ${DEBUG_CONTROLS_PATH}`);
    return false;
  }

  const { set } = parseCardId(cardId);
  const scenarioPath = `${set}/${cardId}/${scenarioName}`;

  try {
    let content = fs.readFileSync(DEBUG_CONTROLS_PATH, 'utf8');

    // Check if scenario already exists
    if (content.includes(scenarioPath)) {
      console.log(`Scenario "${scenarioPath}" already exists in DebugControls.ts`);
      return true;
    }

    // Find the GD## array and add the new scenario
    const arrayPattern = new RegExp(`(${set}:\\s*\\[)`, 'g');
    const match = arrayPattern.exec(content);
    if (!match) {
      console.warn(`Could not find ${set} array in DebugControls.ts`);
      return false;
    }

    const insertPos = content.indexOf(']', content.indexOf(match[1]));
    const newEntry = `    "${scenarioPath}",\n`;

    const before = content.slice(0, insertPos);
    const after = content.slice(insertPos);

    content = before + newEntry + after;
    fs.writeFileSync(DEBUG_CONTROLS_PATH, content);
    console.log(`✅ Updated DebugControls.ts with: "${scenarioPath}"`);
    return true;
  } catch (err) {
    console.error(`Error updating DebugControls.ts: ${err.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    cardId: null,
    scenarioName: null,
    description: null,
    level: null,
    cost: null,
    updateDebug: false
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--cardId':
      case '-c':
        options.cardId = args[++i];
        break;
      case '--scenarioName':
      case '-n':
        options.scenarioName = args[++i];
        break;
      case '--description':
      case '-d':
        options.description = args[++i];
        break;
      case '--level':
      case '-l':
        options.level = parseInt(args[++i]);
        break;
      case '--cost':
        options.cost = parseInt(args[++i]);
        break;
      case '--updateDebug':
      case '-u':
        options.updateDebug = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        return;
    }
  }

  // Interactive mode if no card ID provided
  if (!options.cardId) {
    console.log('Test Scenario Creator - Interactive Mode\n');
    options.cardId = await prompt('Card ID (e.g., GD03-038): ');
    options.scenarioName = await prompt('Scenario name (e.g., rest_trigger_ap_boost): ') || 'test_scenario';
    options.description = await prompt('Description: ') || 'Test scenario';
    options.level = parseInt(await prompt('Card Level (1-7): ') || '4');
    options.cost = parseInt(await prompt('Card Cost: ') || '3');
    options.updateDebug = (await prompt('Update DebugControls.ts? (y/n): ')).toLowerCase() === 'y';
  }

  // Validate card ID
  if (!options.cardId || !options.cardId.match(/^[A-Z]{2}\d+-\d+$/)) {
    console.error('Invalid card ID. Use format: SET-### (e.g., GD03-038)');
    process.exit(1);
  }

  const { set, number } = parseCardId(options.cardId);

  // Set defaults
  if (!options.scenarioName) {
    options.scenarioName = `${set.toLowerCase()}_${number}_test`;
  }
  if (!options.description) {
    options.description = `${options.cardId} test scenario`;
  }

  // Calculate required energy
  const requiredEnergy = options.level || getEnergyForLevel(4);

  // Generate scenario
  const scenario = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE));
  scenario.description = `${options.cardId}_${options.scenarioName}`;
  scenario.gameId = `${options.cardId}_${options.scenarioName}`;
  scenario.tags = [options.cardId, 'test'];
  scenario.notes = [
    `Setup: Player has ${options.cardId} in hand.`,
    `Setup: Player has ${requiredEnergy} energy cards (sufficient for Level ${options.level || 4}, Cost ${options.cost || 3}).`,
    `Action: Test the card effect.`
  ];

  // Add energy cards
  scenario.initialGameEnv.players.playerId_1.zones.energyArea = createEnergyCards(requiredEnergy, 'p1');

  // Add card to hand
  scenario.initialGameEnv.players.playerId_1.deck.hand.push({
    carduid: `${options.cardId}_hand_0001`,
    cardId: options.cardId
  });
  scenario.initialGameEnv.players.playerId_1.deck.handUids.push(`${options.cardId}_hand_0001`);

  // Create file path
  const { folder, filePath } = getScenarioPath(options.cardId, options.scenarioName);

  // Ensure directory exists
  ensureDirectory(folder);

  // Write scenario file
  fs.writeFileSync(filePath, JSON.stringify(scenario, null, 2));
  console.log(`✅ Created test scenario: ${filePath}`);

  // Update DebugControls.ts if requested
  if (options.updateDebug) {
    updateDebugControls(options.cardId, options.scenarioName);
  }

  console.log('\n✅ Test scenario creation complete!');
  console.log(`   File: ${filePath}`);
  console.log(`   Card: ${options.cardId}`);
  console.log(`   Energy: ${requiredEnergy} cards`);
}

function showHelp() {
  console.log(`
Test Scenario Creator

Usage:
  node createTestScenario.js [options]

Options:
  -c, --cardId <id>       Card ID (e.g., GD03-038)
  -n, --scenarioName <name>  Scenario file name (e.g., rest_trigger_ap_boost)
  -d, --description <desc>  Test description
  -l, --level <1-7>        Card level (determines required energy)
  -u, --updateDebug        Update DebugControls.ts with new scenario
  -h, --help               Show this help message

Examples:
  # Create test for GD03-038
  node createTestScenario.js --cardId GD03-038 --scenarioName rest_trigger --level 4 --updateDebug

  # Interactive mode
  node createTestScenario.js

Energy Requirements (by card level):
  Level 1: 1 energy card
  Level 2: 2 energy cards
  Level 3: 3 energy cards
  Level 4: 4 energy cards  ← Current card
  Level 5: 5 energy cards
  Level 6: 6 energy cards
  Level 7: 7 energy cards
`);
}

function prompt(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

// Run
if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  parseCardId,
  getEnergyForLevel,
  createEnergyCards,
  updateDebugControls
};
