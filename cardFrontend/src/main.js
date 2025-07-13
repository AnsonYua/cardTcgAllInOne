import Phaser from 'phaser';
import { GAME_CONFIG } from './config/gameConfig.js';
import PreloaderScene from './scenes/PreloaderScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import CardSelectionScene from './scenes/CardSelectionScene.js';
import BattleResultScene from './scenes/BattleResultScene.js';
import GameOverScene from './scenes/GameOverScene.js';

const config = {
  type: Phaser.AUTO,
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  parent: 'game-container',
  backgroundColor: GAME_CONFIG.colors.background,
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: false,  // Changed to false for better high-res image quality
    powerPreference: 'high-performance'
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: {
      width: GAME_CONFIG.minWidth,
      height: GAME_CONFIG.minHeight
    },
    max: {
      width: GAME_CONFIG.width,
      height: GAME_CONFIG.height
    }
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [
    PreloaderScene,
    MenuScene,
    GameScene,
    CardSelectionScene,
    BattleResultScene,
    GameOverScene
  ]
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  game.scale.refresh();
});

export default game;