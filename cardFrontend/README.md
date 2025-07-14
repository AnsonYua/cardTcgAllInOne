# Revolution and Rebellion TCG - Frontend

This is the web-based frontend for the "Revolution and Rebellion" trading card game, built with Phaser 3.

## Getting Started

For a complete overview of the project architecture, data models, and setup instructions, please see the main [README.md](../../README.md) in the root directory.

### Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser to** `http://localhost:3000`

## Project Structure

The frontend is organized into the following main directories:

- `src/scenes/`: Contains the different Phaser scenes that make up the game (e.g., `MenuScene`, `GameScene`).
- `src/components/`: Reusable game components, such as the `Card.js` component.
- `src/managers/`: Handles game state (`GameStateManager.js`) and API communication (`APIManager.js`).
- `src/config/`: Contains the game's configuration files.
