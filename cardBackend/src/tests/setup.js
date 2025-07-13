const { spawn, exec } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

let serverProcess;

// Ensure server is killed on process exit
process.on('exit', () => {
    if (serverProcess) {
        serverProcess.kill('SIGKILL');
    }
});

process.on('SIGINT', () => {
    if (serverProcess) {
        serverProcess.kill('SIGKILL');
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (serverProcess) {
        serverProcess.kill('SIGKILL');
    }
    process.exit(0);
});

async function killExistingServer() {
    try {
        // Kill any existing Node.js processes running on port 3000
        const { stdout } = await execAsync('lsof -ti:3000');
        if (stdout.trim()) {
            const pids = stdout.trim().split('\n');
            for (const pid of pids) {
                try {
                    process.kill(parseInt(pid), 'SIGKILL');
                    console.log(`Killed existing server process: ${pid}`);
                } catch (e) {
                    console.log(`Process ${pid} already terminated`);
                }
            }
            // Wait a moment for processes to fully terminate
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (e) {
        // No processes found on port 3000, which is fine
        console.log('No existing server processes found on port 3000');
    }
}

async function waitForServer() {
    const maxAttempts = 30;
    const delay = 1000;
    
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await axios.get('http://localhost:3000/api/game/health');
            if (response.status === 200) {
                console.log('Server is ready!');
                return true;
            }
        } catch (error) {
            console.log(`Waiting for server... attempt ${i + 1}/${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Server failed to start within timeout');
}

module.exports = async () => {
    console.log('Killing any existing server processes...');
    await killExistingServer();
    
    console.log('Starting server...');
    serverProcess = spawn('node', ['server.js'], {
        stdio: 'inherit',
        detached: true
    });

    // Handle server process errors
    serverProcess.on('error', (error) => {
        console.error('Failed to start server process:', error);
        throw error;
    });

    // Save the server PID for teardown
    fs.writeFileSync(path.join(__dirname, 'server.pid'), String(serverProcess.pid));
    
    try {
        await waitForServer();
    } catch (error) {
        console.error('Server startup failed:', error);
        // Clean up the process if it exists
        if (serverProcess) {
            serverProcess.kill();
        }
        throw error;
    }
};

// For teardown.js
module.exports.stopServer = async () => {
    console.log('Stopping server...');
    
    // First, kill the server process we spawned
    if (serverProcess) {
        try {
            serverProcess.kill('SIGKILL');
            console.log('Server process killed');
        } catch (e) {
            console.log('Server process already terminated');
        }
        serverProcess = null;
    }
    
    const pidPath = path.join(__dirname, 'server.pid');
    if (fs.existsSync(pidPath)) {
        const pid = parseInt(fs.readFileSync(pidPath, 'utf-8'), 10);
        try {
            // Check if process exists before trying to kill it
            process.kill(pid, 0); // This will throw if process doesn't exist
            process.kill(pid, 'SIGKILL'); // Force kill
            console.log('Server stopped successfully');
        } catch (e) {
            if (e.code === 'ESRCH') {
                console.log('Server process already terminated');
            } else {
                console.error('Error stopping server:', e);
            }
        }
        // Clean up PID file regardless of success
        try {
            fs.unlinkSync(pidPath);
        } catch (e) {
            // PID file might already be gone
        }
    }
    
    // Also kill any remaining processes on port 3000
    try {
        await killExistingServer();
    } catch (e) {
        console.log('Cleanup of port 3000 completed');
    }
}; 