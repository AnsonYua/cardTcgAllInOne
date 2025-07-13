
// Class to manage turn phases
class mozPhaseManager {
    constructor() {
        this.currentPhase = "";
        this.turnCount = 1;
    }

    getCurrentPhase() {
        return this.currentPhase;
    }

    setCurrentPhase(phase) {
        this.currentPhase = phase;
    }
}

module.exports = new mozPhaseManager();