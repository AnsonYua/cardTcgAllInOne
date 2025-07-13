const express = require('express');
const cors = require('cors');
const config = require('./src/config/config');
const gameRoutes = require('./src/routes/gameRoutes');
const deckManager = require('./src/services/DeckManager');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/game', gameRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
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