const { spawn } = require('child_process');

// Use native fetch for Node.js 18+ or fallback to node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
    fetch = globalThis.fetch;
} else {
    try {
        fetch = require('node-fetch');
    } catch (error) {
        throw new Error('fetch is not available. Please use Node.js 18+ or install node-fetch');
    }
}

let serverProcess;

// Setup function to start the server before running tests
async function setupTestServer() {
    console.log('Starting test server...');
    
    // Start the server in a separate process using TypeScript
    serverProcess = spawn('npx', ['ts-node', 'server.ts'], {
        cwd: process.cwd(),
        stdio: 'pipe', // Capture stdout/stderr
        env: {
            ...process.env,
            NODE_ENV: 'test',
            PORT: '8080'
        }
    });

    // Handle server output
    serverProcess.stdout.on('data', (data) => {
        if (process.env.VERBOSE_TESTS) {
            console.log(`Server: ${data}`);
        }
    });

    serverProcess.stderr.on('data', (data) => {
        if (process.env.VERBOSE_TESTS) {
            console.error(`Server Error: ${data}`);
        }
    });

    // Handle server exit
    serverProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Server process exited with code ${code}`);
        }
    });

    // Wait for the server to be ready
    await waitForServer('http://localhost:8080/api/game/health', 30000);
    console.log('Test server started successfully');
}

// Function to wait for the server to be ready
async function waitForServer(url, timeoutMs = 30000) {
    const startTime = Date.now();
    const checkInterval = 500; // Check every 500ms
    
    while (Date.now() - startTime < timeoutMs) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return true;
            }
        } catch (error) {
            // Server not ready yet, continue waiting
        }
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error(`Server did not start within ${timeoutMs}ms`);
}

// Teardown function to stop the server after tests
async function teardownTestServer() {
    if (serverProcess) {
        console.log('Stopping test server...');
        serverProcess.kill('SIGTERM');
        
        // Wait for the process to exit
        await new Promise((resolve) => {
            serverProcess.on('close', resolve);
            
            // Force kill if it doesn't exit gracefully
            setTimeout(() => {
                serverProcess.kill('SIGKILL');
                resolve();
            }, 5000);
        });
        
        console.log('Test server stopped');
    }
}

module.exports = setupTestServer;
module.exports.setupTestServer = setupTestServer;
module.exports.teardownTestServer = teardownTestServer;