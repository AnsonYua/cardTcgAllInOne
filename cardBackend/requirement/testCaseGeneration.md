 Imagine you are an expert for playing trading card game, 
 
 refering /Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/requirement/testDoc/st01-01.md help me draft similar test case for card ST01-016 and create similar file in the folder.

 the test case format is 
1.first design  a gameEnv, what card should be in hand ,slot ,base ,shield etc.
2.also consider what action will player do (play card, end turn , attack etc)
3.then think what observation will be noted in gameEnv.

Use Action/Expect pairs in sequence. For multi-step flows, alternate Action and Expect lines to capture intermediate states:
  - Action: (step 1)
  - Expect: (result of step 1)
  - Action: (step 2)
  - Expect: (result of step 2)

when play card , make sure you have enough energy, also add a proper 
      {
        "id": "card_drawn_1768362880422_3bxbxq5uy",
        "type": "CARD_DRAWN",
        "metadata": {
          "timestamp": 1768362880422,
          "expiresAt": 1768362883422,
          "requiresAcknowledgment": false,
          "priority": "normal"
        },
        "payload": {
          "playerId": "playerId_1",
          "carduid": "ST01-004_4246f80c-16bc-4841-b2f1-0de546a8d62c",
          "sourceZone": "deck",
          "reason": "draw",
          "timestamp": 1768362880422,
          "drawContext": "turn_start"
        }
      }
      in notificationQueue for frontend to trigger (currentplayer should = payload.playerId)
If you are not clear about the game rules do ask me to confirm before you complete the test case




look at src/data/st01Card.json , the test case, please review effect.description and effect.rules is properly implemented and any field of effect.rules is meaning less . for reviewing implementation make sure all subflow is correctly included in implementation. also looking at st01Card.json , if other card have similer effect, please align it also. indeed ,not limit to the test case, but please ensure all effect is properly implemented, if you have any question ask me


look at src/data/st01Card.json , and the test case, please review
    effect.description and effect.rules is properly implemented and any field of effect.rules is
  meaning
    less . for reviewing implementation make sure all subflow is correctly included in implementation.
    also looking at st01Card.json , if other card have similer effect, please align it also.
  indeed ,not
    limit to the test case, but please ensure all effect is properly implemented, if you have any
    question ask me


    codex resume 019bbd44-80c1-7332-8d59-45f97e9faaf4