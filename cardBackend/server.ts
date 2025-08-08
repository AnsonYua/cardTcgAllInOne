// server.ts - TypeScript version of the Express server

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Server } from 'http';

// Import configurations and routes (TypeScript imports)
import gameRoutes from './src/routes/gameRoutes';
const config = require('./src/config/config');

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