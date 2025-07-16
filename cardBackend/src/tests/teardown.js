const { teardownTestServer } = require('./setup');

module.exports = async () => {
    await teardownTestServer();
};