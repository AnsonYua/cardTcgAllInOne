
class GameActionQueue {
    constructor() {
        this.actions = [];
        this.isRunning = false;
        this.currentAction = null;
    }
    add(action) {
        this.actions.push(action);
    }

    async processActions() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        
        while (this.actions.length > 0 && this.isRunning) {
            const action = this.actions.shift();
            try {
                await action();
            } catch (error) {
                console.error('Error executing action:', error);
            }
        }
        
        this.isRunning = false;
    }
}

module.exports = new GameActionQueue();
/* 
class GameActionQueue {
    constructor() {
        this.actions = [];
        this.isRunning = false;
        this.currentAction = null;
    }

    add(action) {
        this.actions.push(action);
    }

    async processActions() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        
        while (this.actions.length > 0 && this.isRunning) {
            this.currentAction = this.actions.shift();
            
            try {
                switch (this.currentAction.type) {
                    case 'DRAW':
                        await this.executeDraw(this.currentAction.data);
                        break;
                    case 'PLAY':
                        await this.executePlay(this.currentAction.data);
                        break;
                    case 'ATTACK':
                        await this.executeAttack(this.currentAction.data);
                        break;
                    default:
                        console.warn('Unknown action type:', this.currentAction.type);
                }
            } catch (error) {
                console.error('Error executing action:', error);
            }
        }
        
        this.isRunning = false;
        this.currentAction = null;
    }

    async executeDraw(data) {
        return new Promise((resolve) => {
            console.log(`Drawing ${data.count} cards...`);
            setTimeout(() => {
                console.log('Draw completed');
                resolve();
            }, 1000);
        });
    }

    async executePlay(data) {
        return new Promise((resolve) => {
            console.log(`Playing card ${data.cardId}...`);
            setTimeout(() => {
                console.log('Play completed');
                resolve();
            }, 1500);
        });
    }

    async executeAttack(data) {
        return new Promise((resolve) => {
            console.log(`${data.attacker} attacking ${data.target}...`);
            setTimeout(() => {
                console.log('Attack completed');
                resolve();
            }, 2000);
        });
    }

    stop() {
        this.isRunning = false;
    }

    clear() {
        this.actions = [];
        this.isRunning = false;
        this.currentAction = null;
    }

    getCurrentAction() {
        return this.currentAction;
    }
}

// Example usage:
const gameQueue = new GameActionQueue();

// Add some game actions
gameQueue.add({
    type: 'DRAW',
    data: { count: 2 }
});

gameQueue.add({
    type: 'PLAY',
    data: { cardId: 'CARD_001' }
});

gameQueue.add({
    type: 'ATTACK',
    data: {
        attacker: 'CARD_001',
        target: 'OPPONENT'
    }
});

// Start processing actions
gameQueue.processActions();

// You can check current action
setTimeout(() => {
    console.log('Current action:', gameQueue.getCurrentAction());
}, 1500);

// Add more actions while running
setTimeout(() => {
    gameQueue.add({
        type: 'DRAW',
        data: { count: 1 }
    });
}, 3000);

*/