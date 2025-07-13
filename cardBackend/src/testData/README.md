# Test Cases Documentation

## All Attribute Effect Test Case

### Scenario: Summoner S109 with "all" Native Addition

This test case verifies the attribute effect system where a summoner has a native addition that applies to all attributes.

### Test Setup
- **Summoner**: S109
  - Has a native addition of "all" with value = 70
  - This means any monster card played will receive a +70 power bonus regardless of its attribute

### Effect Application Rules
1. Card Effects:
   - Applied first through `applyCardEffect`
   - Modifies the monster's power based on card-specific rules
   - Updates `valueOnField` property

2. Summoner Effects:
   - Applied after card effects through `applySummonerEffect`
   - Checks summoner's native addition in order:
     1. If summoner has "all" type: adds value to all monsters and stops processing
     2. If no "all" type: checks for matching attributes between monster and summoner
   - Note: If a monster has "all" attribute, it will still only get one bonus (either from summoner's "all" type or from matching attributes)
   - Updates `valueOnField` with the total value

### Expected Behavior
1. When a monster card (S109) is played in the sky field:
   - Original value (cardDetails[0].value): 60 (this is the monster's base power)
   - Card effects applied (if any)
   - Summoner native addition bonus: +70 (applies to all monsters)
   - Final value (valueOnField): 130 (this is the value used for power calculation)

### Test Steps
1. Start game with summoner S109
2. Play monster card S109 in sky field
3. Verify the monster's total power is 130

### Technical Details
- Card effects are applied through `applyCardEffect` in `CardEffectManager.js`
- Summoner effects are applied through `applySummonerEffect` in `mozGamePlay.js`
- The "all" attribute in native addition means it applies to any monster card, regardless of its attributes
- This test ensures the attribute effect system correctly handles universal attribute bonuses
- The monster's original value is stored in `cardDetails[0].value` and remains unchanged
- The calculated total power (including all effects) is stored in `valueOnField` and is used for all power calculations
- To prevent duplicate counting, if a summoner has "all" type in native addition, it's applied first and no other attribute bonuses are checked

### Expected Game State
```json
{
  "gameEnv": {
    "playerId_1": {
      "Field": {
        "sky": [{
          "cardDetails": [{
            "type": "monster",
            "value": 60,        // Original base value
            "attribute": ["any"]
          }],
          "isBack": [false],
          "valueOnField": 130   // Final value after all effects (60 + 70)
        }]
      }
    }
  }
}
```

### Verification
- Check that the monster's original value (cardDetails[0].value) remains 60
- Verify card effects are applied correctly (if any)
- Verify the summoner's native addition is correctly applied
- Ensure the power calculation works for any attribute type
- Confirm that `valueOnField` is set to 130 (original value + summoner effect)
- Verify that all power calculations use `valueOnField` instead of the original value
- Verify that monsters with "all" attribute don't get duplicate bonuses 