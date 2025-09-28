import Phaser from 'phaser';

/**
 * PowerOverlay renders the printed AP/HP alongside the live totals that include
 * modifiers coming from the game state. The overlay keeps the original values
 * static (apText/hpText) and updates the total labels independently.
 */
export default class PowerOverlay extends Phaser.GameObjects.Container {
  constructor(scene, x = 0, y = 0, options = {}) {
    super(scene, x, y);

    this.parentCardScale = options.parentCardScale || 1;
    this.isPreviewMode = this.parentCardScale > 2;
    this.cardType = options.cardType || 'unit';

    const offsets = this.getCardTypeOffsets(this.cardType);

    this.config = {
      apOffsetX: this.isPreviewMode ? offsets.preview.apOffsetX : offsets.normal.apOffsetX,
      apOffsetY: this.isPreviewMode ? offsets.preview.apOffsetY : offsets.normal.apOffsetY,
      hpOffsetX: this.isPreviewMode ? offsets.preview.hpOffsetX : offsets.normal.hpOffsetX,
      hpOffsetY: this.isPreviewMode ? offsets.preview.hpOffsetY : offsets.normal.hpOffsetY,
      totalLabelOffsetY: 87,
      fontSize: options.fontSize ?? 14,
      fontFamily: 'Arial Bold',
      showBackground: !!options.showBackground,
      apColors: {
        base: { text: '#FFFFFF' }
      },
      hpColors: {
        base: { text: '#FFFFFF' }
      }
    };

    this.originalAP = 0;
    this.originalHP = 0;
    this.totalAP = 0;
    this.totalHP = 0;
    this.isVisible = false;

    this.createTexts();
    scene.add.existing(this);
  }

  getCardTypeOffsets(cardType) {
    const defaults = {
      unit: {
        normal: { apOffsetX: 36.5, apOffsetY: 73, hpOffsetX: 50, hpOffsetY: 73 },
        preview: { apOffsetX: 36.5, apOffsetY: 73, hpOffsetX: 50, hpOffsetY: 73 }
      },
      pilot: {
        normal: { apOffsetX: 36.5, apOffsetY: 47, hpOffsetX: 50, hpOffsetY: 47 },
        preview: { apOffsetX: 36.5, apOffsetY: 47, hpOffsetX: 50, hpOffsetY: 47 }
      },
      base: {
        normal: { apOffsetX: 36.5, apOffsetY: 73, hpOffsetX: 50, hpOffsetY: 73 },
        preview: { apOffsetX: 36.5, apOffsetY: 73, hpOffsetX: 50, hpOffsetY: 73 }
      },
      command: {
        normal: { apOffsetX: 36.5, apOffsetY: 70, hpOffsetX: 50, hpOffsetY: 70 },
        preview: { apOffsetX: 36.5, apOffsetY: 70, hpOffsetX: 50, hpOffsetY: 70 }
      }
    };

    return defaults[cardType] || defaults.unit;
  }

  createTexts() {
    const baseStyle = {
      fontSize: `${this.config.fontSize}px`,
      fontFamily: this.config.fontFamily,
      fill: this.config.apColors.base.text,
      align: 'center'
    };

    const textResolution = Math.max(1, Math.ceil(this.parentCardScale));
    const applyResolution = text => text.setResolution(textResolution);

    this.apText = this.scene.add.text(this.config.apOffsetX, this.config.apOffsetY, '0', baseStyle);
    this.apText.setOrigin(0.5);
    applyResolution(this.apText);
    this.add(this.apText);

    this.totalApText = this.scene.add.text(
      this.config.apOffsetX,
      this.config.totalLabelOffsetY,
      '0',
      baseStyle
    );
    this.totalApText.setOrigin(0.5);
    applyResolution(this.totalApText);
    this.add(this.totalApText);

    const hpStyle = {
      ...baseStyle,
      fill: this.config.hpColors.base.text
    };

    this.hpText = this.scene.add.text(this.config.hpOffsetX, this.config.hpOffsetY, '0', hpStyle);
    this.hpText.setOrigin(0.5);
    applyResolution(this.hpText);
    this.add(this.hpText);

    this.totalHpText = this.scene.add.text(
      this.config.hpOffsetX,
      this.config.totalLabelOffsetY,
      '0',
      hpStyle
    );
    this.totalHpText.setOrigin(0.5);
    applyResolution(this.totalHpText);
    this.add(this.totalHpText);

    this.cardStatusText = this.scene.add.text(
      -45,
      this.config.totalLabelOffsetY,
      '',
      {
        fontSize: `${this.config.fontSize}px`,
        fontFamily: this.config.fontFamily,
        fill: this.config.apColors.base.text,
        align: 'center'
      }
    );
    this.cardStatusText.setOrigin(0.5);
    applyResolution(this.cardStatusText);
    this.add(this.cardStatusText);

    this.totalApText.setVisible(false);
    this.totalHpText.setVisible(false);
    this.cardStatusText.setVisible(false);
    this.setVisible(false);

    this.setShowBackground(this.config.showBackground);
  }

  setBaseStats(originalAP = 0, originalHP = 0) {
    this.originalAP = originalAP;
    this.originalHP = originalHP;
    this.apText.setText(originalAP.toString());
    this.hpText.setText(originalHP.toString());
    this.updateTotalTextColors();
  }

  setCardTotalAPandHP(totalAP = 0, totalHP = 0) {
    this.totalAP = totalAP;
    this.totalHP = totalHP;
    this.totalApText.setText(totalAP.toString());
    this.totalHpText.setText(totalHP.toString());
    this.updateTotalTextColors();
  }

  setCardStatus(totalAP = 0, totalHP = 0) {
    if (typeof isRested === 'boolean') {
      this.cardStatusText.setText(isRested ? 'Rested' : 'Active');
    }
  }


  updateTotalStats(totalAP = 0, totalHP = 0, isRested, originalAP, originalHP) {
    if (typeof originalAP === 'number') {
      this.originalAP = originalAP;
      this.apText.setText(originalAP.toString());
    }
    if (typeof originalHP === 'number') {
      this.originalHP = originalHP;
      this.hpText.setText(originalHP.toString());
    }

    this.totalAP = totalAP;
    this.totalHP = totalHP;

    this.totalApText.setText(totalAP.toString());
    this.totalHpText.setText(totalHP.toString());

    if (typeof isRested === 'boolean') {
      this.cardStatusText.setText(isRested ? 'Rested' : 'Active');
    }

    this.updateTotalTextColors();

    if (totalAP > 0 || totalHP > 0 || this.originalAP > 0 || this.originalHP > 0) {
      this.show();
    } else {
      this.hide();
    }
  }

  updateTotalTextColors() {
    const apColor = this.totalAP !== this.originalAP ? '#FF6B6B' : this.config.apColors.base.text;
    const hpColor = this.totalHP !== this.originalHP ? '#FF6B6B' : this.config.hpColors.base.text;

    this.totalApText.setColor(apColor);
    this.totalHpText.setColor(hpColor);
  }

  show() {
    if (this.isVisible) {
      return;
    }
    this.isVisible = true;
    this.setVisible(true);
  }

  hide() {
    if (!this.isVisible) {
      return;
    }
    this.isVisible = false;
    this.setVisible(false);
  }

  setOverlayVisible(visible) {
    if (visible) {
      this.show();
    } else {
      this.hide();
    }
  }

  setTotalLabelsVisibility(cardZone) {
    const isInSlot = cardZone && cardZone.startsWith('slot');
    const isInBase = cardZone === 'base';
    const shouldShowTotals = isInSlot || isInBase;

    this.totalApText.setVisible(shouldShowTotals);
    this.totalHpText.setVisible(shouldShowTotals);
    this.cardStatusText.setVisible(shouldShowTotals);
  }

  setShowBackground(showBackground) {
    this.config.showBackground = showBackground;
    const strokeThickness = showBackground ? 0 : Math.max(0.5, 2 / this.parentCardScale);

    const applyStyle = text => {
      text.setStroke('#000000', strokeThickness);
    };

    applyStyle(this.apText);
    applyStyle(this.hpText);
    applyStyle(this.totalApText);
    applyStyle(this.totalHpText);
    applyStyle(this.cardStatusText);
  }

  destroy(fromScene = false) {
    super.destroy(fromScene);
  }
}
