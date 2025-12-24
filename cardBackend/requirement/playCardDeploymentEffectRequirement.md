1.when playing a card, it will check the deployment effect of that card. to detect the deployment effect , you should following the below criteria.

1.1.
when u see type = triggered and trigger = ENTERS_PLAY, it can regard as deployment effect
{
    "effectId": "deploy_shield_to_hand",
    "type": "triggered",
    "trigger": "ENTERS_PLAY",
    "target": {
        "type": "card",
        "scope": "self_shield"
    },
    "action": "addToHand",
    "parameters": {
        "value": 1,
        "from": "shield"
    }
},


1.2.when u see  type = activated, 
timing.windows contain MAIN_PHASE
and gameEnv.phase = MAIN_PHASE , we will take this effect. (remember we must be in main_phase)
{
    "effectId": "activate_conditional_token_deploy",
    "type": "activated",
    "timing": {
        "windows": [
            "MAIN_PHASE"
        ]
    },
    "cost": {
        "resource": 2,
        "oncePerTurn": true
    },
    "conditions": [
        "boardStateCheck"
    ],
    "action": "conditionalTokenDeploy",
    "parameters": {
        "condition1": {
            "unitsInPlay": 0,
            "token": {
                "name": "Gundam",
                "traits": [
                    "White Base Team"
                ],
                "ap": 3,
                "hp": 3
            }
        },
        "condition2": {
            "unitsInPlay": 1,
            "token": {
                "name": "Guncannon",
                "traits": [
                    "White Base Team"
                ],
                "ap": 2,
                "hp": 2
            }
        },
        "condition3": {
            "unitsInPlay": ">=2",
            "token": {
                "name": "Guntank",
                "traits": [
                    "White Base Team"
                ],
                "ap": 1,
                "hp": 1
            }
        }
    }
}


1.3.when u see  type = activated, 
timing.windows contain ACTION_STEP
and gameEnv.phase = action_step_phase , we will take this effect. (remember we must be in action_step_phase)
{
    "effectId": "main_action_ap_reduction",
    "type": "activated",
    "timing": {
        "windows": [
            "MAIN_PHASE",
            "ACTION_STEP"
        ],
        "duration": "UNTIL_END_OF_TURN"
    },
    "target": {
        "type": "unit",
        "scope": "opponent",
        "count": 1
    },
    "action": "modifyAP",
    "parameters": {
        "value": -3
    }
}