// server.ts - TypeScript version of the Express server

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Server } from 'http';

// Import configurations and routes (keeping JS imports for now)
const config = require('./src/config/config');
const gameRoutes = require('./src/routes/gameRoutes');

// Import TypeScript DeckManager
import DeckManager from './src/services/DeckManager';

const app: Express = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/game', gameRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' });
});

let server: Server | undefined;

// Start server (DeckManager is already initialized synchronously)
function startServer(): Server {
    try {
        console.log('DeckManager already initialized synchronously');

        // Verify DeckManager is properly initialized
        const initStatus = DeckManager.getInitializationStatus();
        console.log('DeckManager status:', initStatus);

        // Start the server
        server = app.listen(config.port, () => {
            console.log(`Server is running on port ${config.port}`);
        });

        // Handle server errors
        server.on('error', (error: Error) => {
            console.error('Server error:', error);
            process.exit(1);
        });

        return server;
    } catch (error) {
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