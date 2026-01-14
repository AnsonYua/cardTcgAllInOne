currently , i am want to grant a lobby in my frontend.
when we call curl 'http://localhost:8080/api/game/player/startGame' \
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

  now it create a room and save a json in gameData with gameId. i want to have a rooms.json, storing a gameID and createtime.

  then there is a api /lobbylist. returning this json and then whenever it is call , it will remove the gameID/record in rooms.json if the createtime is >1mins

  after you file ,write a requirement + spec how frontend should do, i expect frontend will show a list of the available room according to rooms.json and sort by createtime. when click the items it redirect and join the rooms