export const CARD_CONFIG = {
  // Card Dimensions
  width: 120,
  height: 160,
  
  // Card Margins and Spacing
  margin: 10,
  spacing: 15,
  
  // Card Border and Corner Radius
  borderWidth: 3,
  cornerRadius: 8,
  
  // Card Text Settings
  text: {
    title: {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#000000',
      maxWidth: 100
    },
    description: {
      fontSize: '10px',
      fontFamily: 'Arial',
      color: '#333333',
      maxWidth: 100
    },
    cost: {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#000000'
    }
  },
  
  // Card Animation Settings
  animation: {
    hoverScale: 1.1,
    hoverDuration: 200,
    dragScale: 1.05,
    dropScale: 1.0
  },
  
  // Card Zones and Positions
  zones: {
    title: { x: 10, y: 10, width: 100, height: 20 },
    image: { x: 10, y: 35, width: 100, height: 80 },
    description: { x: 10, y: 120, width: 100, height: 40 },
    cost: { x: 10, y: 165, width: 30, height: 15 }
  }
}; 