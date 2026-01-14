1.call curl 'http://localhost:8080/api/game/player/startGame' \
  -H 'Accept: */*' \
  -H 'Accept-Language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' \
  -H 'Pragma: no-cache' \
  -H 'Referer: http://localhost:5173/' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?1' \
  -H 'sec-ch-ua-platform: "Android"' \
  --data-raw '{"playerId":"playerId_1","gameConfig":{"playerName":"Demo Player"}}'

  to start game as playerId_1
2.call curl 'http://localhost:8080/api/game/test/getTestScenario?scenarioPath=ST01-001%2Fpair_ap_boost_turn' \
  -H 'Accept: */*' \
  -H 'Accept-Language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' \
  -H 'Pragma: no-cache' \
  -H 'Referer: http://localhost:5173/' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?1' \
  -H 'sec-ch-ua-platform: "Android"' 
  to get the scenoria

  3.call curl 'http://localhost:8080/api/game/test/injectGameState' \
  -H 'Accept: */*' \
  -H 'Accept-Language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' \
  -H 'Pragma: no-cache' \
  -H 'Referer: http://localhost:5173/' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?1' \
  -H 'sec-ch-ua-platform: "Android"' \
  --data-raw $'{"gameId":"29c0d2c2-dab9-4796-9f4b-f7d9b49d5e8d","gameEnv":{"phase":"MAIN_PHASE","playerId_1":"playerId_1","playerId_2":"playerId_2","gameStarted":true,"firstPlayer":0,"currentPlayer":"playerId_1","currentTurn":1,"notificationQueue":[{"id":"card_drawn_1768362880422_3bxbxq5uy","type":"CARD_DRAWN","metadata":{"timestamp":1768362880422,"expiresAt":1768362883422,"requiresAcknowledgment":false,"priority":"normal"},"payload":{"playerId":"playerId_1","carduid":"ST01-004_4246f80c-16bc-4841-b2f1-0de546a8d62c","sourceZone":"deck","reason":"draw","timestamp":1768362880422,"drawContext":"turn_start"}}],"playersReady":{"playerId_1":true,"playerId_2":true},"players":{"playerId_1":{"id":"playerId_1","name":"Player 1","deck":{"hand":[{"carduid":"ST01-010_00000000-0000-0000-0000-000000000002","cardId":"ST01-010","cardData":{"id":"ST01-010","name":"Amuro Ray","cardType":"pilot","color":"Blue","level":4,"cost":1,"zone":[],"traits":["Earth Federation","White Base Team","Newtype"],"link":[],"ap":2,"hp":1,"effects":{"description":["【Burst】Add this card to your hand.","【When Paired】Choose 1 enemy Unit with 5 or less HP. Rest it."],"rules":[{"effectId":"burst_add_to_hand","type":"triggered","trigger":"BURST_CONDITION","target":{"type":"card","scope":"self"},"action":"addToHand"},{"effectId":"paired_rest_medium_hp","type":"triggered","trigger":"PAIRING_COMPLETE","target":{"type":"unit","scope":"opponent","filters":{"hp":"<=5"},"count":1},"action":"rest"}]}}}],"handUids":["ST01-010_00000000-0000-0000-0000-000000000002"],"mainDeck":[]},"confirmIsRedraw":false,"isRedraw":false,"playerPoint":0,"isReady":true,"zones":{"slot1":{"unit":{"carduid":"ST01-001_00000000-0000-0000-0000-000000000001","cardId":"ST01-001","cardData":{"id":"ST01-001","name":"Gundam","cardType":"unit","color":"Blue","level":4,"cost":3,"zone":["Space","Earth"],"traits":["Earth Federation","White Base Team"],"link":["Amuro Ray"],"ap":3,"hp":4,"effects":{"description":["<Repair 2> (At the end of your turn, this Unit recovers the specified number of HP.)","【During Pair】During your turn, all your Units get AP+1."],"rules":[{"effectId":"repair_2","type":"keyword","trigger":"END_OF_TURN","action":"heal","parameters":{"value":2},"timing":{"duration":"instant"},"target":{"type":"unit","scope":"self","count":1}},{"effectId":"pair_ap_boost_all","type":"static","trigger":"continuous","sourceConditions":[{"type":"paired"}],"action":"modifyAP","parameters":{"value":1},"timing":{"duration":"continuous","actionTurn":"YOUR_TURN"},"target":{"type":"unit","scope":"self_all_unit","count":1,"filters":{"controller":"self"}}}]}},"placedAt":0,"placedBy":"playerId_1","isRested":false,"originalAP":3,"originalHP":4,"isFirstPlay":false,"damageReceived":0}},"slot2":{"unit":{"carduid":"ST01-005_00000000-0000-0000-0000-000000000003","cardId":"ST01-005","cardData":{"id":"ST01-005","name":"GM","cardType":"unit","color":"Blue","level":2,"cost":1,"zone":["Space","Earth"],"traits":["Earth Federation"],"link":[],"ap":2,"hp":2,"effects":{"description":[],"rules":[]}},"placedAt":0,"placedBy":"playerId_1","isRested":false,"originalAP":2,"originalHP":2,"isFirstPlay":false,"damageReceived":0}},"slot3":{},"slot4":{},"slot5":{},"slot6":{},"base":[],"shieldArea":[],"energyArea":[{"carduid":"energy_basic_test_1","cardId":"energy_basic","placedAt":0,"placedBy":"playerId_1","isRested":false,"isExtraEnergy":false,"cardData":{"cardType":"energy"}},{"carduid":"energy_basic_test_2","cardId":"energy_basic","placedAt":0,"placedBy":"playerId_1","isRested":false,"isExtraEnergy":false,"cardData":{"cardType":"energy"}},{"carduid":"energy_basic_test_3","cardId":"energy_basic","placedAt":0,"placedBy":"playerId_1","isRested":false,"isExtraEnergy":false,"cardData":{"cardType":"energy"}},{"carduid":"energy_basic_test_4","cardId":"energy_basic","placedAt":0,"placedBy":"playerId_1","isRested":false,"isExtraEnergy":false,"cardData":{"cardType":"energy"}}],"trashArea":[],"repairAbilitiesCheckedThisCycle":false}},"playerId_2":{"id":"playerId_2","name":"Player 2","deck":{"hand":[],"handUids":[],"mainDeck":[]},"confirmIsRedraw":false,"isRedraw":false,"playerPoint":0,"isReady":true,"zones":{"slot1":{"unit":{"carduid":"ST01-009_00000000-0000-0000-0000-000000000004","cardId":"ST01-009","cardData":{"id":"ST01-009","name":"Zowort","cardType":"unit","color":"White","level":2,"cost":2,"zone":["Space","Earth"],"traits":["Academy"],"link":[],"ap":3,"hp":2,"effects":{"description":["<Blocker> (Rest this Unit to change the attack target to it.)","This Unit can\'t choose the enemy player as its attack target."],"rules":[{"effectId":"blocker","type":"keyword","trigger":"ATTACK_REDIRECT","target":{"type":"unit","scope":"self"},"action":"redirect_attack","parameters":{"cost":"rest_self"}},{"effectId":"attack_restriction","type":"static","trigger":"continuous","target":{"type":"unit","scope":"self"},"action":"restrict_attack","parameters":{"restriction":"cannot_attack_player"}}]}},"placedAt":0,"placedBy":"playerId_2","isRested":false,"originalAP":3,"originalHP":2,"isFirstPlay":false,"damageReceived":0}},"slot2":{},"slot3":{},"slot4":{},"slot5":{},"slot6":{},"base":[],"shieldArea":[],"energyArea":[],"trashArea":[],"repairAbilitiesCheckedThisCycle":false}}}}}'

  to set the scenoria. 

  4. then call playCard/Attack etc api to trigger player action. 

  5.then call curl 'http://localhost:8080/api/game/player/playerId_1?gameId=29c0d2c2-dab9-4796-9f4b-f7d9b49d5e8d' \
  -H 'Accept: */*' \
  -H 'Accept-Language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' \
  -H 'Pragma: no-cache' \
  -H 'Referer: http://localhost:5173/' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?1' \
  -H 'sec-ch-ua-platform: "Android"' 
  see if the environment is expected.