const mozGamePlay = require('./mozGamePlay');
const mozDeckHelper = require('./mozDeckHelper');
const CardInfoUtils = require('../services/CardInfoUtils');
class mozAIClass {
    constructor() {
        this.mozGamePlay = mozGamePlay;
        this.cardInfoUtils = CardInfoUtils;
    }

    async getAIAction(gameEnv,playerId) {
        var cloneEnv = this.Clone(gameEnv);
        const bestMove = await this.findBestMove(cloneEnv,playerId);
        return cloneEnv;
    }

    async findBestMove(gameState,playerId) {
        this.maxDepth = 3;
        console.log("findBestMove start "+this.getCurrentTime());
        const result = await this.minimax(
            gameState, 
            this.maxDepth,
            true, 
            -Infinity,
            Infinity,
            playerId);
        console.log("findBestMove end "+this.getCurrentTime());
        return result;
    }

    getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString();
    }

    evaluate(gameState, playerId) {
        var returnVal = 0;
        return returnVal;
    }

    async minimax(gameState, depth, isMaximizing, alpha, beta, treePlayerId) {
        if (depth === 0 || this.mozGamePlay.isSummonBattleEnd(gameState)) {
            return {
                score: this.evaluate(gameState, treePlayerId),
                move: null
            };
        }
        const playerList = mozGamePlay.getPlayerFromGameEnv(gameState);
        var opponent = playerList[0];
        if(playerList[0] === treePlayerId){
            opponent = playerList[1];
        }

        const actionPlayer = isMaximizing ? treePlayerId : opponent
        const moves = await this.getPossibleMoves(
            gameState, 
            actionPlayer
        );
        let bestMove = null;
        let bestScore = isMaximizing ? -Infinity : Infinity;
        for (const move of moves) {
            var cloneGameState = this.Clone(gameState);
            cloneGameState = await this.mozGamePlay.processAction(cloneGameState,actionPlayer,move);
            const result = await this.minimax(cloneGameState, depth - 1, !isMaximizing, alpha, beta,treePlayerId);
        }
    }

    /*
        "action":{
            "type": "PlayCard",// PlayCard, PlayCardBack
            "card_idx": 1, //0 -20
            "field_idx": 0// 0 =top , 1 = left , 2 = right, 3 = help , 4 = sp
        }
    */ 
    async getPossibleMoves(gameState, playerId) {
        var moves = [];
        const playerHand = gameState[playerId].deck.hand
        const leader = this.cardInfoUtils.getCurrentLeader(gameState,playerId);
        const availableField = this.getAvailableField(gameState,playerId);
        for (let i = 0; i < playerHand.length; i++) {
            for (let j = 0; j < availableField.length; j++) {
                const cardDetails = mozDeckHelper.getDeckCardDetails(playerHand[i]);
                const canPlayToField = mozDeckHelper.isCardEligibleForField(
                    cardDetails,leader,availableField[j]);
                if(canPlayToField && cardDetails["cardType"] == "character"){
                    moves.push({
                        type: "PlayCard",
                        card_idx: i,
                        field_idx: mozDeckHelper.getFieldIdx(availableField[j])
                    });
                }
            }
        }
        for (let i = 0; i < playerHand.length; i++) {
            for (let j = 0; j < availableField.length; j++) {
                moves.push({
                    type: "PlayCardBack",
                    card_idx: i,
                    field_idx: mozDeckHelper.getFieldIdx(availableField[j])
                });
            }
        }
        return moves;
    }

    getAvailableField(gameState,playerId){
        var playerField = gameState[playerId].Field;
        var availableField = [];
        for(let key in playerField){
            if(key == "top" || key == "left" || key == "right" ){
                const isMonster = mozDeckHelper.monsterInField(playerField[key]);
                if(!isMonster){
                    availableField.push(key);
                }
            }
        }
        return availableField;
    }

    Clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
}

module.exports = new mozAIClass();