const fs = require('fs').promises;



async function makePostRequest(url,body) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        return data
    } catch (error) {
        console.error('Error:', error);
    }
}


(async () => {
    const domainPath = "http://localhost:3000/api/game"
    //make start request
    const startGameResp = await makePostRequest(
        domainPath+'/player/startGame', 
        {
            playerId: "playerId_1",
            players: ["playerId_1", "playerId_2"]
        });
    const gameId = startGameResp["gameId"];
    const p1_summoner = startGameResp["gameEnv"]["playerId_1"]["deck"]["summoner"];
    const p2_summoner = startGameResp["gameEnv"]["playerId_2"]["deck"]["summoner"];
    console.log(gameId);
    console.log("player 1:")
    console.log(p1_summoner);
    console.log("player 2:")
    console.log(p2_summoner);
    const p1_startReadyResp = await makePostRequest(
        domainPath+'/player/startReady', 
        {
            "gameId": gameId,
            "playerId": "playerId_1",
            "redraw":false
        });
    const p2_startReadyResp = await makePostRequest(
        domainPath+'/player/startReady', 
        {
            "gameId": gameId,
            "playerId": "playerId_2",
            "redraw":false
        });
    console.log(gameId);
    console.log("first start "+p2_startReadyResp["gameEnv"]['firstPlayer']);
    console.log("current Player: "+p2_startReadyResp["gameEnv"]['currentPlayer']);
    console.log("player 1:")
    console.log("hand :"+JSON.stringify(p2_startReadyResp["gameEnv"]["playerId_1"]["deck"]["hand"]));
    console.log("deck length :"+p2_startReadyResp["gameEnv"]["playerId_1"]["deck"]["mainDeck"].length);
    console.log("summoner :"+JSON.stringify(p2_startReadyResp["gameEnv"]["playerId_1"]["Field"]["summonner"]));
    console.log("player 2:")
    console.log(p2_summoner);
    console.log("hand : "+JSON.stringify(p2_startReadyResp["gameEnv"]["playerId_2"]["deck"]["hand"]));
    console.log("deck length :"+p2_startReadyResp["gameEnv"]["playerId_2"]["deck"]["mainDeck"].length);
    console.log("summoner :"+JSON.stringify(p2_startReadyResp["gameEnv"]["playerId_2"]["Field"]["summonner"]));

    const path = require('path');
    console.log("path "+path)
    const cardsPath = path.join(__dirname, './src/data/cards.json');
    const summonerCardPath = path.join(__dirname, './src/data/summonerCards.json');
    const decksPath = path.join(__dirname, './src/data/decks.json');

    //verify json and deck 
    console.log("verify source json")
    var [cardsData, summonerCards, decksData] = await Promise.all([
        fs.readFile(cardsPath, 'utf8'),
        fs.readFile(summonerCardPath, 'utf8'),
        fs.readFile(decksPath, 'utf8')
    ]);
    cardsData = JSON.parse(cardsData);
    summonerCards = JSON.parse(summonerCards);
    decksData = JSON.parse(decksData);
    p1_deck = decksData["playerDecks"]["playerId_1"].decks["deck001"].cards;
    console.log("player 1 deck length :"+p1_deck.length);
    p1_hand = p2_startReadyResp["gameEnv"]["playerId_1"]["deck"]["hand"];
    p1_mainDeck = p2_startReadyResp["gameEnv"]["playerId_1"]["deck"]["mainDeck"];
    console.log("player 1 hand + MainDeck :"+p1_hand.length+" + "+p1_mainDeck.length);


    p2_deck = decksData["playerDecks"]["playerId_2"].decks["deck001"].cards;
    console.log("player 2 deck length :"+p2_deck.length);
    p2_hand = p2_startReadyResp["gameEnv"]["playerId_2"]["deck"]["hand"];
    p2_mainDeck = p2_startReadyResp["gameEnv"]["playerId_2"]["deck"]["mainDeck"];
    console.log("player 2 hand + MainDeck :"+p2_hand.length+" + "+p2_mainDeck.length);

    const player = ["playerId_1","playerId_2"]
    const handArr =[p1_hand,p2_hand]
    for(let k=0; k<handArr.length; k++){
        var allHandInDeck = true
        for (let i = 0; i < handArr[k].length; i++) {
            var cardInDeck = false
            for(let j = 0; j < p1_deck.length; j++){
                if(handArr[k][i] == p1_deck[j]){
                    cardInDeck = true
                    break
                }
            }
            if(!cardInDeck){
                allHandInDeck = false
                break
            }
        }
        console.log(player[k]+" all hand in deck :"+allHandInDeck);

        var allHandWithDetails = true
        for(let i=0; i<handArr[k].length; i++){
            if(!cardsData["cards"].hasOwnProperty(handArr[k][i])){
                allHandWithDetails = false
                break
            }
        }
        console.log(player[k]+" all hand with details :"+allHandWithDetails);
    }
    
    const mainDeckArr =[p1_mainDeck,p2_mainDeck]
    for(let k=0; k<mainDeckArr.length; k++){
        var allMainCardInDeck = true
        for (let i = 0; i < mainDeckArr[k].length; i++) {
            var cardInDeck = false
            for(let j = 0; j < p1_deck.length; j++){
                if(mainDeckArr[k][i] == p1_deck[j]){
                    cardInDeck = true
                    break
                }
            }
            if(!cardInDeck){
                allMainCardInDeck = false
                break
            }
        }
        console.log(player[k]+" all mainCard in deck :"+allMainCardInDeck);
        var allMainDeckWithDetails = true
        for(let i=0; i<mainDeckArr[k].length; i++){
            if(!cardsData["cards"].hasOwnProperty(mainDeckArr[k][i])){
                allMainDeckWithDetails = false
                break
            }
        }
        console.log(player[k]+" all mainDeck with details :"+allMainDeckWithDetails);
    }
    

})();