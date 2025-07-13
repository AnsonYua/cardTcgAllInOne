import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';

export default class BattleResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BattleResultScene' });
  }

  init(data) {
    this.battleData = data.battleData || {};
    this.callback = data.callback || null;
  }

  create() {
    this.createBackground();
    this.createBattleDisplay();
    this.animateBattleResults();
  }

  createBackground() {
    const { width, height } = this.cameras.main;
    
    // Semi-transparent overlay
    this.overlay = this.add.graphics();
    this.overlay.fillStyle(0x000000, 0.9);
    this.overlay.fillRect(0, 0, width, height);
    
    // Battle arena background
    this.arenaBg = this.add.graphics();
    this.arenaBg.fillStyle(0x1a1a2e);
    this.arenaBg.fillRoundedRect(width * 0.1, height * 0.2, width * 0.8, height * 0.6, 20);
    this.arenaBg.lineStyle(3, GAME_CONFIG.colors.highlight);
    this.arenaBg.strokeRoundedRect(width * 0.1, height * 0.2, width * 0.8, height * 0.6, 20);
  }

  createBattleDisplay() {
    const { width, height } = this.cameras.main;
    
    // Title
    this.titleText = this.add.text(width / 2, height * 0.25, 'BATTLE RESULTS', {
      fontSize: '36px',
      fontFamily: 'Arial Bold',
      fill: GAME_CONFIG.colors.highlight,
      align: 'center'
    });
    this.titleText.setOrigin(0.5);
    
    // Player power display
    this.playerPowerText = this.add.text(width * 0.25, height * 0.4, 'Your Power: 0', {
      fontSize: '24px',
      fontFamily: 'Arial',
      fill: '#4CAF50',
      align: 'center'
    });
    this.playerPowerText.setOrigin(0.5);
    
    // Opponent power display
    this.opponentPowerText = this.add.text(width * 0.75, height * 0.4, 'Opponent Power: 0', {
      fontSize: '24px',
      fontFamily: 'Arial',
      fill: '#FF5722',
      align: 'center'
    });
    this.opponentPowerText.setOrigin(0.5);
    
    // VS indicator
    this.vsText = this.add.text(width / 2, height * 0.4, 'VS', {
      fontSize: '32px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff',
      align: 'center'
    });
    this.vsText.setOrigin(0.5);
    
    // Combo displays
    this.playerComboText = this.add.text(width * 0.25, height * 0.5, '', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#81C784',
      align: 'center'
    });
    this.playerComboText.setOrigin(0.5);
    
    this.opponentComboText = this.add.text(width * 0.75, height * 0.5, '', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#FFAB91',
      align: 'center'
    });
    this.opponentComboText.setOrigin(0.5);
    
    // Winner display (initially hidden)
    this.winnerText = this.add.text(width / 2, height * 0.6, '', {
      fontSize: '28px',
      fontFamily: 'Arial Bold',
      fill: GAME_CONFIG.colors.highlight,
      align: 'center'
    });
    this.winnerText.setOrigin(0.5);
    this.winnerText.setVisible(false);
    
    // Victory points awarded
    this.vpAwardText = this.add.text(width / 2, height * 0.65, '', {
      fontSize: '20px',
      fontFamily: 'Arial',
      fill: '#FFD700',
      align: 'center'
    });
    this.vpAwardText.setOrigin(0.5);
    this.vpAwardText.setVisible(false);
    
    // Continue button (initially hidden)
    this.continueButton = this.add.image(width / 2, height * 0.75, 'button');
    this.continueButton.setInteractive();
    this.continueButton.setVisible(false);
    
    this.continueButtonText = this.add.text(width / 2, height * 0.75, 'Continue', {
      fontSize: '18px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    this.continueButtonText.setOrigin(0.5);
    this.continueButtonText.setVisible(false);
    
    this.continueButton.on('pointerdown', () => {
      // Click visual effect
      this.continueButton.setTint(0x888888);
      this.continueButton.setScale(0.95);
      this.continueButtonText.setScale(0.95);
      
      this.time.delayedCall(100, () => {
        this.continueButton.clearTint();
        this.continueButton.setScale(1);
        this.continueButtonText.setScale(1);
      });
      
      this.time.delayedCall(50, () => this.continueBattle());
    });
  }

  animateBattleResults() {
    // Animate power counting
    this.animatePowerCounting();
    
    // Show combos after power animation
    this.time.delayedCall(2000, () => {
      this.showCombos();
    });
    
    // Show winner after combos
    this.time.delayedCall(3500, () => {
      this.showWinner();
    });
    
    // Show VP award and continue button
    this.time.delayedCall(4500, () => {
      this.showFinalResults();
    });
  }

  animatePowerCounting() {
    const playerPower = this.battleData.playerPower || 0;
    const opponentPower = this.battleData.opponentPower || 0;
    
    // Animate player power
    this.tweens.addCounter({
      from: 0,
      to: playerPower,
      duration: 1500,
      ease: 'Power2',
      onUpdate: (tween) => {
        const value = Math.floor(tween.getValue());
        this.playerPowerText.setText(`Your Power: ${value}`);
      }
    });
    
    // Animate opponent power
    this.tweens.addCounter({
      from: 0,
      to: opponentPower,
      duration: 1500,
      ease: 'Power2',
      onUpdate: (tween) => {
        const value = Math.floor(tween.getValue());
        this.opponentPowerText.setText(`Opponent Power: ${value}`);
      }
    });
  }

  showCombos() {
    const playerCombos = this.battleData.playerCombos || [];
    const opponentCombos = this.battleData.opponentCombos || [];
    
    if (playerCombos.length > 0) {
      const comboText = `Combos: ${playerCombos.join(', ')}`;
      this.playerComboText.setText(comboText);
      
      // Animate combo text
      this.tweens.add({
        targets: this.playerComboText,
        alpha: { from: 0, to: 1 },
        scaleX: { from: 0.5, to: 1 },
        scaleY: { from: 0.5, to: 1 },
        duration: 500,
        ease: 'Back.easeOut'
      });
    }
    
    if (opponentCombos.length > 0) {
      const comboText = `Combos: ${opponentCombos.join(', ')}`;
      this.opponentComboText.setText(comboText);
      
      // Animate combo text
      this.tweens.add({
        targets: this.opponentComboText,
        alpha: { from: 0, to: 1 },
        scaleX: { from: 0.5, to: 1 },
        scaleY: { from: 0.5, to: 1 },
        duration: 500,
        ease: 'Back.easeOut'
      });
    }
  }

  showWinner() {
    const winner = this.battleData.winner;
    const playerWon = winner === 'player';
    
    let winnerMessage = '';
    let winnerColor = '#ffffff';
    
    if (playerWon) {
      winnerMessage = 'YOU WIN!';
      winnerColor = '#4CAF50';
    } else if (winner === 'opponent') {
      winnerMessage = 'OPPONENT WINS!';
      winnerColor = '#FF5722';
    } else {
      winnerMessage = 'TIE!';
      winnerColor = '#FFC107';
    }
    
    this.winnerText.setText(winnerMessage);
    this.winnerText.setStyle({ fill: winnerColor });
    this.winnerText.setVisible(true);
    
    // Animate winner text
    this.tweens.add({
      targets: this.winnerText,
      alpha: { from: 0, to: 1 },
      scaleX: { from: 0, to: 1.2 },
      scaleY: { from: 0, to: 1.2 },
      duration: 800,
      ease: 'Elastic.easeOut'
    });
    
    // Add screen shake for dramatic effect
    this.cameras.main.shake(500, 0.01);
  }

  showFinalResults() {
    const vpAwarded = this.battleData.vpAwarded || 0;
    
    if (vpAwarded > 0) {
      this.vpAwardText.setText(`+${vpAwarded} Victory Points!`);
      this.vpAwardText.setVisible(true);
      
      // Animate VP award
      this.tweens.add({
        targets: this.vpAwardText,
        alpha: { from: 0, to: 1 },
        y: { from: this.vpAwardText.y + 20, to: this.vpAwardText.y },
        duration: 500,
        ease: 'Power2'
      });
    }
    
    // Show continue button
    this.continueButton.setVisible(true);
    this.continueButtonText.setVisible(true);
    
    this.tweens.add({
      targets: [this.continueButton, this.continueButtonText],
      alpha: { from: 0, to: 1 },
      duration: 300
    });
  }

  continueBattle() {
    if (this.callback) {
      this.callback();
    }
    
    this.scene.stop();
  }
}