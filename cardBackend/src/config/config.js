// src/config/config.js
require('dotenv').config();

const config = {
    port: process.env.PORT || 3000,
    // Add other configuration variables here
    environment: process.env.NODE_ENV || 'development',
    // If you plan to add database
    database: {
        url: process.env.DB_URL || 'your_default_db_url',
    }
};

module.exports = config;