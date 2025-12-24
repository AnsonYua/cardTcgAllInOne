after play card success ( with the effect finished execute), if it is in action-step, we should update the currentBattle.actionTargets.(currentplayer) and update confirmations.(currentplayer). then if both player is confirmations. we should trigger resolve battle.
        "currentBattle": {
            "actionType": "attackUnit",
            "attackingPlayerId": "playerId_2",
            "defendingPlayerId": "playerId_1",
            "attackerCarduid": "ST01-007_9b9840b9-2ef1-4f03-953a-c89d8d9cb833",
            "targetCarduid": "ST01-005_be13f9a5-9fc9-4e3b-a9b2-fdf999d9f63d",
            "targetPlayerId": "playerId_1",
            "status": "ACTION_STEP",
            "fromBurst": false,
            "openedAt": 1766585165452,
            "attackNotificationId": "unit_attack_declared_1766585152281_xn6q2wlxi",
            "confirmations": {
                "playerId_2": true,
                "playerId_1": true
            },
            "actionTargets": {
                "playerId_2": [],
                "playerId_1": []
            }
        }