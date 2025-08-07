"use strict";
// server.ts - TypeScript version of the Express server
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
// Import configurations and routes (dynamic paths for dev/prod)
const isCompiled = __filename.includes('dist');
const configPath = isCompiled ? '../src/config/config' : './src/config/config';
const routesPath = isCompiled ? '../src/routes/gameRoutes' : './src/routes/gameRoutes';
const config = require(configPath);
const gameRoutes = require(routesPath);
// Import TypeScript DeckManager
const DeckManager_1 = __importDefault(require("./src/services/DeckManager"));
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.use('/api/game', gameRoutes);
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('🚨 Global error handler caught:', err);
    console.error('🚨 Error stack:', err.stack);
    console.error('🚨 Request URL:', req.url);
    console.error('🚨 Request method:', req.method);
    console.error('🚨 Request body:', req.body);
    res.status(500).json({
        error: err.message || 'Something went wrong!',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        timestamp: new Date().toISOString(),
        url: req.url,
        method: req.method
    });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
let server;
// Start server (DeckManager is already initialized synchronously)
function startServer() {
    try {
        console.log('DeckManager already initialized synchronously');
        // Verify DeckManager is properly initialized
        const initStatus = DeckManager_1.default.getInitializationStatus();
        console.log('DeckManager status:', initStatus);
        // Start the server
        server = app.listen(config.port, () => {
            console.log(`Server is running on port ${config.port}`);
        });
        // Handle server errors
        server.on('error', (error) => {
            console.error('Server error:', error);
            process.exit(1);
        });
        return server;
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
// Handle process termination
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    if (server) {
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    }
});
process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    if (server) {
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    }
});
startServer();
