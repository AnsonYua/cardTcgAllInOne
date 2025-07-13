const { stopServer } = require('./setup');

module.exports = async () => {
    console.log('Test suite finished. Cleaning up server...');
    try {
        await stopServer();
        console.log('Server cleanup completed successfully.');
    } catch (error) {
        console.error('Error during server cleanup:', error);
        // Don't throw here as it might mask test failures
    }
}; 