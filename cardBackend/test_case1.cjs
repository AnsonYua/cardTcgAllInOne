const fs = require('fs').promises;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function makePostRequest(url, body, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;

        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error);

            if (attempt === maxRetries) {
                throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
            }

            // Wait before retrying with exponential backoff
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            console.log(`Retrying... Attempt ${attempt + 1} of ${maxRetries}`);
        }
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
    console.log("gameID :"+gameId);
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
    
    const setCaseResp = await makePostRequest(
        domainPath+'/test/setCase', 
        {
            "caseFile":"case1",
            "gameId": gameId
        });
    const notYourTurnResp =await makePostRequest(
        domainPath+'/player/playerAction',
        {    
            "playerId":"playerId_2",
            "gameId":gameId,
            "action":{
                "type": "PlayCard",// PlayCard, PlayCardBack
                "card_idx": 1, //0 -20
                "field_idx": 0// 0 =sky , 1 = left , 2 = right, 3 = help , 4 = sp
            }
        });
    console.log("not your turn resp")
    console.log(notYourTurnResp)
    
    const attributeNotMatch = await makePostRequest(
        domainPath+'/player/playerAction',
        {    
            "playerId":"playerId_1",
            "gameId":gameId,
            "action":{
                "type": "PlayCard",// PlayCard, PlayCardBack
                "card_idx": 5, //0 -20
                "field_idx": 0// 0 =sky , 1 = left , 2 = right, 3 = help , 4 = sp
            }
        });
    console.log("attr not match resp")
    console.log(attributeNotMatch)

    //play first card for player 1
    var playCardGameEnv = await makePostRequest(
        domainPath+'/player/playerAction',
        {    
            "playerId":"playerId_1",
            "gameId":gameId,
            "action":{
                "type": "PlayCard",// PlayCard, PlayCardBack
                "card_idx": 1, //0 -20
                "field_idx": 0// 0 =sky , 1 = left , 2 = right, 3 = help , 4 = sp
            }
        }
    );
    console.log("after play +50 wind card")
    console.log(playCardGameEnv["gameEnv"]["currentPlayer"]);
    console.log(playCardGameEnv["gameEnv"]["currentTurn"]);

    console.log("-------player 1 turn play card--------")
    console.log("player 1: ")
    console.log("player 1 hand card:"+playCardGameEnv["gameEnv"]["playerId_1"]["deck"]["hand"]);
    console.log("player 1 hand card length:"+playCardGameEnv["gameEnv"]["playerId_1"]["deck"]["hand"].length );
    console.log("player 1 mainDeck length:"+playCardGameEnv["gameEnv"]["playerId_1"]["deck"]["mainDeck"].length );
    console.log("one card deployed on field(sky) total card = 20 + 7 +1 = 28");
    console.log("player 1: (expect 110) :" +playCardGameEnv["gameEnv"]["playerId_1"]["playerPoint"])
    console.log("summoner :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["Field"]["summonner"]));
    console.log("sky :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["Field"]["sky"]));
    console.log("left :"+JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["Field"]["left"]));
    console.log("right :"+JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["Field"]["right"]));

    
    console.log("-------player 2 turn play card--------")
       
    //player 2 play card s50 in left
    playCardGameEnv = await makePostRequest(
        domainPath+'/player/playerAction',
        {    
            "playerId":"playerId_2",
            "gameId":gameId,
            "action":{
                "type": "PlayCard",// PlayCard, PlayCardBack
                "card_idx": 1, //0 -20
                "field_idx": 1// 0 =sky , 1 = left , 2 = right, 3 = help , 4 = sp
            }
        }
    );

 
    console.log("after play +50 wind card")
    console.log("player 2 hand card:"+playCardGameEnv["gameEnv"]["playerId_2"]["deck"]["hand"]);
    console.log("player 2 hand card length:"+playCardGameEnv["gameEnv"]["playerId_2"]["deck"]["hand"].length );
    console.log("player 2 mainDeck length:"+playCardGameEnv["gameEnv"]["playerId_2"]["deck"]["mainDeck"].length );
    console.log("one card deployed on field(left) total card = 20 + 7 +1 = 28");
    console.log("player 2: (expect 90) :" +playCardGameEnv["gameEnv"]["playerId_2"]["playerPoint"])
    console.log("summoner :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_2"]["Field"]["summonner"]));
    console.log("sky :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_2"]["Field"]["sky"]));
    console.log("left :"+JSON.stringify(playCardGameEnv["gameEnv"]["playerId_2"]["Field"]["left"]));
    console.log("right :"+JSON.stringify(playCardGameEnv["gameEnv"]["playerId_2"]["Field"]["right"]));

    console.log("-------player 1 turn play card--------")
       
    playCardGameEnv = await makePostRequest(
        domainPath+'/player/playerAction',
        {    
            "playerId":"playerId_1",
            "gameId":gameId,
            "action":{
                "type": "PlayCard",// PlayCard, PlayCardBack
                "card_idx": 3, //0 -20
                "field_idx": 0// 0 =sky , 1 = left , 2 = right, 3 = help , 4 = sp
            }
        }
    );
    
    console.log("play monster in already position :"+JSON.stringify(playCardGameEnv))
    playCardGameEnv = await makePostRequest(
        domainPath+'/player/playerAction',
        {    
            "playerId":"playerId_1",
            "gameId":gameId,
            "action":{
                "type": "PlayCard",// PlayCard, PlayCardBack
                "card_idx": 2, //0 -20
                "field_idx": 1// 0 =sky , 1 = left , 2 = right, 3 = help , 4 = sp
            }
        }
    );
    console.log("player 1:  + 100 /all")
    console.log("player 1 hand card:"+playCardGameEnv["gameEnv"]["playerId_1"]["deck"]["hand"]);
    console.log("player 1 hand card length:"+playCardGameEnv["gameEnv"]["playerId_1"]["deck"]["hand"].length );
    console.log("player 1 mainDeck length:"+playCardGameEnv["gameEnv"]["playerId_1"]["deck"]["mainDeck"].length );
    console.log("two card deployed on field(sky) total card = 19 + 7 +2 = 28");
    console.log("player 1: (expect 210) :" +playCardGameEnv["gameEnv"]["playerId_1"]["playerPoint"])
    console.log("summoner :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["Field"]["summonner"]));
    console.log("sky :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["Field"]["sky"]));
    console.log("left :"+JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["Field"]["left"]));
    console.log("right :"+JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["Field"]["right"]));

    console.log("-------player 2 turn play card--------")
    playCardGameEnv = await makePostRequest(
        domainPath+'/player/playerAction',
        {    
            "playerId":"playerId_2",
            "gameId":gameId,
            "action":{
                "type": "PlayCard",// PlayCard, PlayCardBack
                "card_idx": 1, //0 -20
                "field_idx": 1// 0 =sky , 1 = left , 2 = right, 3 = help , 4 = sp
            }
        }
    );
    console.log("play monster in already position :"+JSON.stringify(playCardGameEnv))
    playCardGameEnv = await makePostRequest(
        domainPath+'/player/playerAction',
        {    
            "playerId":"playerId_2",
            "gameId":gameId,
            "action":{
                "type": "PlayCard",// PlayCard, PlayCardBack
                "card_idx": 7, //0 -20
                "field_idx": 5// 0 =sky , 1 = left , 2 = right, 3 = help , 4 = sp
            }
        }
    );
    console.log("hand card out of range :"+JSON.stringify(playCardGameEnv))

    playCardGameEnv = await makePostRequest(
        domainPath+'/player/playerAction',
        {    
            "playerId":"playerId_2",
            "gameId":gameId,
            "action":{
                "type": "PlayCard",// PlayCard, PlayCardBack
                "card_idx": 8, //0 -20
                "field_idx": 0// 0 =sky , 1 = left , 2 = right, 3 = help , 4 = sp
            }
        }
    );
    console.log("hand card out of range :"+JSON.stringify(playCardGameEnv))
    playCardGameEnv = await makePostRequest(
        domainPath+'/player/playerAction',
        {    
            "playerId":"playerId_2",
            "gameId":gameId,
            "action":{
                "type": "PlayCard",// PlayCard, PlayCardBack
                "card_idx": 6, //0 -20
                "field_idx": 0// 0 =sky , 1 = left , 2 = right, 3 = help , 4 = sp
            }
        }
    );
    console.log("after play +20 shell card")
    console.log("player 2 hand card:"+playCardGameEnv["gameEnv"]["playerId_2"]["deck"]["hand"]);
    console.log("player 2 hand card length:"+playCardGameEnv["gameEnv"]["playerId_2"]["deck"]["hand"].length );
    console.log("player 2 mainDeck length:"+playCardGameEnv["gameEnv"]["playerId_2"]["deck"]["mainDeck"].length );
    console.log("two card deployed on field(sky) total card = 19 + 7 +2 = 28");
    console.log("player 2: (expect 110) :" +playCardGameEnv["gameEnv"]["playerId_2"]["playerPoint"])
    console.log("summoner :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_2"]["Field"]["summonner"]));
    console.log("sky :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_2"]["Field"]["sky"]));
    console.log("left :"+JSON.stringify(playCardGameEnv["gameEnv"]["playerId_2"]["Field"]["left"]));
    console.log("right :"+JSON.stringify(playCardGameEnv["gameEnv"]["playerId_2"]["Field"]["right"]));
    
    console.log("-------player 1 turn play card--------")
       
    playCardGameEnv = await makePostRequest(
        domainPath+'/player/playerAction',
        {    
            "playerId":"playerId_1",
            "gameId":gameId,
            "action":{
                "type": "PlayCardBack",// PlayCard, PlayCardBack
                "card_idx": 5, //0 -20
                "field_idx": 0// 0 =sky , 1 = left , 2 = right, 3 = help , 4 = sp
            }
        }
    );
    console.log("play card back :" + JSON.stringify(playCardGameEnv))
    playCardGameEnv = await makePostRequest(
        domainPath+'/player/playerAction',
        {    
            "playerId":"playerId_1",
            "gameId":gameId,
            "action":{
                "type": "PlayCardBack",// PlayCard, PlayCardBack
                "card_idx": 5, //0 -20
                "field_idx": 2// 0 =sky , 1 = left , 2 = right, 3 = help , 4 = sp
            }
        }
    );
    console.log("player 1:  + CardBack")
    console.log("player 1 hand card:"+playCardGameEnv["gameEnv"]["playerId_1"]["deck"]["hand"]);
    console.log("player 1 hand card length:"+playCardGameEnv["gameEnv"]["playerId_1"]["deck"]["hand"].length );
    console.log("player 1 mainDeck length:"+playCardGameEnv["gameEnv"]["playerId_1"]["deck"]["mainDeck"].length );
    console.log("player 1: (expect 210) :" +playCardGameEnv["gameEnv"]["playerId_1"]["playerPoint"])
    console.log("summoner :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["Field"]["summonner"]));
    console.log("sky :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["Field"]["sky"]));
    console.log("left :"+JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["Field"]["left"]));
    console.log("right :"+JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["Field"]["right"]));
    //console.log("sp :"+JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["Field"]["sp"]));
    //console.log("help :"+JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["Field"]["help"]));
    
    
    console.log("-------player 2 turn play card--------")
    playCardGameEnv = await makePostRequest(
        domainPath+'/player/playerAction',
        {    
            "playerId":"playerId_2",
            "gameId":gameId,
            "action":{
                "type": "PlayCard",// PlayCard, PlayCardBack
                "card_idx": 5, //0 -20
                "field_idx": 2// 0 =sky , 1 = left , 2 = right, 3 = help , 4 = sp
            }
        }
    );
    console.log("game end");
    console.log("player 1 expected summoner(S045)  :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["Field"]["summonner"]));
    console.log("player 2 expected summoner(S109)  :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_2"]["Field"]["summonner"]));
    console.log("player 1 playerPoint  :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["playerPoint"]));
    console.log("player 2 playerPoint  :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_2"]["playerPoint"]));
    console.log("player 1 overallGamePoint  :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["overallGamePoint"]));
    console.log("player 2 overallGamePoint  :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_2"]["overallGamePoint"]));
    const lastAction = playCardGameEnv["gameEnv"]["playerId_1"]["turnAction"].length
    console.log("player 1 turn action  :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_1"]["turnAction"][lastAction-1]));
    
    
    /*
    Player 1 : 
        S051 - sky : s47  (50)
                [fire , wind, mountain]
               left : s688 (100)
                [all]
               right : s49 (back)
                [all]
        wind + 60
        100 + 50 + 60 = 210
        S045 - sky :
                [all,mountain,tree]
               left :
                [wind,water]
               right :
                [wind,tree]
    Player 2 :
        S045 - sky : s228 (shell 20)
                [all,mountain,tree]
               left : s50 (wind 60)
                [wind,water]
               right :s190 (wind 40)
                [wind,tree]
            wind + 30
            20 + 60 + 30 +40 +30 = 180

        Player 1 :overallGamePoint  : 30
        Player 2 :overallGamePoint  : 0
        S109 - sky :
    */
    
    /*
    console.log("player 2:  + 40 shell")
    console.log("player 2 hand card:"+playCardGameEnv["gameEnv"]["playerId_2"]["deck"]["hand"]);
    console.log("player 2 hand card length:"+playCardGameEnv["gameEnv"]["playerId_2"]["deck"]["hand"].length );
    console.log("player 2 mainDeck length:"+playCardGameEnv["gameEnv"]["playerId_2"]["deck"]["mainDeck"].length );
    console.log("player 2: (expect 180) :" +playCardGameEnv["gameEnv"]["playerId_2"]["playerPoint"])
    console.log("summoner :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_2"]["Field"]["summonner"]));
    console.log("sky :" +JSON.stringify(playCardGameEnv["gameEnv"]["playerId_2"]["Field"]["sky"]));
    console.log("left :"+JSON.stringify(playCardGameEnv["gameEnv"]["playerId_2"]["Field"]["left"]));
    console.log("right :"+JSON.stringify(playCardGameEnv["gameEnv"]["playerId_2"]["Field"]["right"]));
    */

})();