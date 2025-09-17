/**
 * read gameEnv = data/st01-001.json
 * use the gameEnv and to call http://localhost:8080/api/game/test/injectGameState 
 * to set the game env
 * {
 *  gameEnv:...
 *  gameId: "sample_play_card"
 * }
 *  then call 
 * http://localhost:8080/api/game/player/playCard
 * {"playerId":"playerId_2","gameId":"sample_play_card","action":{"type":"PlayCard","cardUID":"ST01-010_3a548657-cf14-4304-ae88-65130fc9b6fb","playAs":"pilot","targetUnit":"ST01-001_a5fcfa44-d212-4400-8c12-9a58fdbcac84"}}
 * 
 * then evaluate and verify the continue effect
 */