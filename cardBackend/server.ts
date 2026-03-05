// server.ts - Custom Trading Card Game Server

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Server } from 'http';
import dotenv from 'dotenv';

// Import routes for custom trading card game
import gameRoutes from './src/routes/gameRoutes';

// ============ SERVER CONFIGURATION ============

dotenv.config();

const app: Express = express();
// Ensure PORT is a number for http.Server.listen overload expectations
const PORT = parseInt(process.env.PORT || '', 10) || 8080;

console.log('🎮 Starting Custom Trading Card Game Server...');

// ============ MIDDLEWARE ============

// CORS configuration for cross-origin requests
const localNetworkOrigin = /^https?:\/\/((10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(192\.168\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}))(:\d+)?$/;
const defaultAllowlistedOrigins = [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:5173',
    'https://plankton-app-hc4oo.ondigitalocean.app'
];

const envAllowlistedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowlistedOrigins = Array.from(new Set([
    ...defaultAllowlistedOrigins,
    ...envAllowlistedOrigins
]));

let envOriginRegex: RegExp | undefined;
if (process.env.CORS_ORIGIN_REGEX) {
    try {
        envOriginRegex = new RegExp(process.env.CORS_ORIGIN_REGEX);
    } catch (error) {
        console.warn('⚠️ Invalid CORS_ORIGIN_REGEX; ignoring.', error);
    }
}

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // Allow server-to-server and tools without an Origin header.
        if (!origin) {
            return callback(null, true);
        }

        if (allowlistedOrigins.includes(origin) || localNetworkOrigin.test(origin) || envOriginRegex?.test(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============ ROUTES ============

// Custom trading card game API routes
app.use('/api/game', gameRoutes);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
    res.json({
        message: 'Custom Trading Card Game Backend',
        status: 'running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        endpoints: {
            health: '/api/game/health',
            cards: '/api/game/cards (st01Card.json)',
            createGame: 'POST /api/game/player/startGame',
            joinGame: 'POST /api/game/player/joinRoom',
            playCard: 'POST /api/game/player/playCard',
            gameData: 'GET /api/game/player/:playerId?gameId=X',
            images: 'GET /api/game/image/:imagePath',
            fileDownload: 'GET /api/game/file/:filePath'
        }
    });
});

// ============ ERROR HANDLING ============

// Global error handling middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
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
app.use((_req: Request, res: Response) => {
    res.status(404).json({ 
        error: 'Route not found',
        timestamp: new Date().toISOString(),
        availableEndpoints: [
            'GET /api/game/health',
            'GET /api/game/cards',
            'POST /api/game/player/startGame',
            'POST /api/game/player/joinRoom',
            'POST /api/game/player/playCard',
            'GET /api/game/player/:playerId?gameId=X'
        ]
    });
});

// ============ SERVER STARTUP ============

let server: Server | undefined;

function startServer(): Server {
    try {
        console.log('🎮 Initializing Custom Trading Card Game Backend...');
        console.log('📋 Card data available: src/data/st01Card.json');
        console.log('🏗️ GameEnvironment with slot1-slot6 zones ready');
        console.log('🎯 Ready for custom game logic implementation');

        // Start the server
        server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Custom Trading Card Game Server running on port ${PORT}`);
            console.log(`🌐 Server URL: http://localhost:${PORT}`);
            console.log(`🏥 Health check: http://localhost:${PORT}/api/game/health`);
            console.log(`📊 API status: http://localhost:${PORT}/api/game/status`);
            console.log('');
            console.log('🚧 PLACEHOLDER SERVER READY FOR CUSTOM DEVELOPMENT');
            console.log('');
            console.log('TODO: Implement your custom trading card game logic:');
            console.log('- Add card play mechanics (unit/pilot/command/base types)');
            console.log('- Implement AP/HP systems');
            console.log('- Add traits and link mechanics');
            console.log('- Set up zone compatibility (slot1-slot6, base)');
            console.log('- Add game phase management');
            console.log('- Implement victory conditions');
            console.log('');
        });

        // Handle server errors
        server.on('error', (error: Error) => {
            console.error('❌ Server error:', error);
            process.exit(1);
        });

        return server;
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// ============ GRACEFUL SHUTDOWN ============

process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    if (server) {
        server.close(() => {
            console.log('🛑 Custom Trading Card Game Server closed');
            process.exit(0);
        });
    }
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    if (server) {
        server.close(() => {
            console.log('🛑 Custom Trading Card Game Server closed');
            process.exit(0);
        });
    }
});

// Start the server
startServer();

// Export for testing
export default app;
