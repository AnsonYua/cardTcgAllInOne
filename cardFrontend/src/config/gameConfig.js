import { CARD_CONFIG } from './cardConfig.js';

export const GAME_CONFIG = {
  width: 1920,
  height: 1080,
  minWidth: 1024,
  minHeight: 768,
  
  // API Configuration
  apiBaseUrl: 'http://localhost:8080/api/game',
  pollInterval: 1000,
  
  // Game Constants
  maxHandSize: 7,
  totalRounds: 4,
  initialVictoryPoints: 0,
  
  // Card Configuration
  card: CARD_CONFIG,
  
  // Card Types
  cardTypes: {
    CHARACTER: 'character',
    HELP: 'help',
    SP: 'sp',
    LEADER: 'leader'
  },
  
  // Zone Types
  zones: {
    TOP: 'top',
    LEFT: 'left', 
    RIGHT: 'right',
    HELP: 'help',
    SP: 'sp'
  },
  
  // Game Phases
  phases: {
    SETUP: 'setup',
    MAIN: 'main',
    SP: 'sp',
    BATTLE: 'battle',
    CLEANUP: 'cleanup'
  },
  
  // Colors
  colors: {
    character: 0x4A90E2,
    help: 0x7ED321,
    sp: 0x9013FE,
    leader: 0xF5A623,
    background: 0x1a1a2e,
    cardBack: 0x2D3748,
    highlight: 0xFFD700,
    error: 0xFF6B6B,
    success: 0x51CF66
  }
};