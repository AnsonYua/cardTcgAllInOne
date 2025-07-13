import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data) {
    this.gameResults = data.gameResults || {};
  }

  create() {
    this.createBackground();
    this.createGameOverDisplay();
    this.createActionButtons();
  }

  createBackground() {
    const { width, height } = this.cameras.main;
    
    // Create gradient background
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
    graphics.fillRect(0, 0, width, height);
    
    // Add celebration particles for winner
    if (this.gameResults.playerWon) {
      this.createCelebrationEffects();
    }
  }

  createGameOverDisplay() {
    const { width, height } = this.cameras.main;
    
    // Main title
    const titleText = this.gameResults.playerWon ? 'VICTORY!' : 'DEFEAT';
    const titleColor = this.gameResults.playerWon ? '#4CAF50' : '#FF5722';
    
    this.titleText = this.add.text(width / 2, height * 0.2, titleText, {
      fontSize: '72px',
      fontFamily: 'Arial Bold',
      fill: titleColor,
      align: 'center',
      stroke: '#000000',
      strokeThickness: 4
    });
    this.titleText.setOrigin(0.5);
    
    // Animate title
    this.tweens.add({
      targets: this.titleText,
      scaleX: { from: 0, to: 1 },
      scaleY: { from: 0, to: 1 },
      duration: 1000,
      ease: 'Elastic.easeOut'
    });
    
    // Game statistics
    this.createGameStats();
    
    // Final message
    const message = this.gameResults.playerWon ? 
      'Congratulations! You have led your revolution to victory!' :
      'The rebellion has been crushed. Better luck next time!';
    
    this.messageText = this.add.text(width / 2, height * 0.7, message, {
      fontSize: '24px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center',
      wordWrap: { width: width * 0.8 }
    });
    this.messageText.setOrigin(0.5);
    this.messageText.setAlpha(0);
    
    // Fade in message
    this.tweens.add({
      targets: this.messageText,
      alpha: 1,
      duration: 1000,
      delay: 1500
    });
  }

  createGameStats() {
    const { width, height } = this.cameras.main;
    
    // Stats background
    const statsBg = this.add.graphics();
    statsBg.fillStyle(0x2d3748, 0.9);
    statsBg.fillRoundedRect(width * 0.2, height * 0.35, width * 0.6, height * 0.25, 15);
    statsBg.lineStyle(2, GAME_CONFIG.colors.highlight);
    statsBg.strokeRoundedRect(width * 0.2, height * 0.35, width * 0.6, height * 0.25, 15);
    
    // Final scores
    const playerVP = this.gameResults.playerVP || 0;
    const opponentVP = this.gameResults.opponentVP || 0;
    
    this.add.text(width / 2, height * 0.4, 'FINAL SCORES', {
      fontSize: '20px',
      fontFamily: 'Arial Bold',
      fill: GAME_CONFIG.colors.highlight,
      align: 'center'
    }).setOrigin(0.5);
    
    // Player score
    this.playerScoreText = this.add.text(width * 0.35, height * 0.47, `You: ${playerVP} VP`, {
      fontSize: '18px',
      fontFamily: 'Arial',
      fill: '#4CAF50',
      align: 'center'
    });
    this.playerScoreText.setOrigin(0.5);
    
    // Opponent score
    this.opponentScoreText = this.add.text(width * 0.65, height * 0.47, `Opponent: ${opponentVP} VP`, {
      fontSize: '18px',
      fontFamily: 'Arial',
      fill: '#FF5722',
      align: 'center'
    });
    this.opponentScoreText.setOrigin(0.5);
    
    // Game duration
    const duration = this.gameResults.gameDuration || 'Unknown';
    this.add.text(width / 2, height * 0.52, `Game Duration: ${duration}`, {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
    
    // Rounds completed
    const rounds = this.gameResults.roundsCompleted || 4;
    this.add.text(width / 2, height * 0.56, `Rounds Completed: ${rounds}/4`, {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
    
    // Animate score counting
    this.animateScoreCounting();
  }

  animateScoreCounting() {
    const playerVP = this.gameResults.playerVP || 0;
    const opponentVP = this.gameResults.opponentVP || 0;
    
    // Animate player score
    this.tweens.addCounter({
      from: 0,
      to: playerVP,
      duration: 2000,
      delay: 500,
      ease: 'Power2',
      onUpdate: (tween) => {
        const value = Math.floor(tween.getValue());
        this.playerScoreText.setText(`You: ${value} VP`);
      }
    });
    
    // Animate opponent score
    this.tweens.addCounter({
      from: 0,
      to: opponentVP,
      duration: 2000,
      delay: 800,
      ease: 'Power2',
      onUpdate: (tween) => {
        const value = Math.floor(tween.getValue());
        this.opponentScoreText.setText(`Opponent: ${value} VP`);
      }
    });
  }

  createCelebrationEffects() {
    const { width, height } = this.cameras.main;
    
    // Create golden particles
    for (let i = 0; i < 50; i++) {
      const particle = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(-100, -50),
        Phaser.Math.Between(2, 6),
        GAME_CONFIG.colors.highlight
      );
      
      // Animate particles falling
      this.tweens.add({
        targets: particle,
        y: height + 100,
        duration: Phaser.Math.Between(3000, 6000),
        delay: Phaser.Math.Between(0, 2000),
        ease: 'Power1',
        onComplete: () => {
          particle.destroy();
        }
      });
      
      // Add rotation
      this.tweens.add({
        targets: particle,
        rotation: Math.PI * 2,
        duration: Phaser.Math.Between(1000, 3000),
        repeat: -1
      });
    }
  }

  createActionButtons() {
    const { width, height } = this.cameras.main;
    
    // Play Again button
    this.playAgainButton = this.add.image(width * 0.35, height * 0.8, 'button');
    this.playAgainButton.setInteractive();
    this.playAgainButton.setAlpha(0);
    
    const playAgainText = this.add.text(width * 0.35, height * 0.8, 'Play Again', {
      fontSize: '18px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    playAgainText.setOrigin(0.5);
    playAgainText.setAlpha(0);
    
    this.playAgainButton.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });
    
    // Main Menu button
    this.mainMenuButton = this.add.image(width * 0.65, height * 0.8, 'button');
    this.mainMenuButton.setInteractive();
    this.mainMenuButton.setAlpha(0);
    
    const mainMenuText = this.add.text(width * 0.65, height * 0.8, 'Main Menu', {
      fontSize: '18px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    mainMenuText.setOrigin(0.5);
    mainMenuText.setAlpha(0);
    
    this.mainMenuButton.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });
    
    // Fade in buttons
    this.tweens.add({
      targets: [this.playAgainButton, playAgainText, this.mainMenuButton, mainMenuText],
      alpha: 1,
      duration: 500,
      delay: 3000
    });
    
    // Button hover effects
    this.setupButtonHoverEffects(this.playAgainButton);
    this.setupButtonHoverEffects(this.mainMenuButton);
  }

  setupButtonHoverEffects(button) {
    button.on('pointerover', () => {
      button.setTint(0xcccccc);
      this.game.canvas.style.cursor = 'pointer';
    });
    
    button.on('pointerout', () => {
      button.clearTint();
      this.game.canvas.style.cursor = 'default';
    });
  }
}