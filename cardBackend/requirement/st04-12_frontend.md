Frontend Requirements: Token Choice Flow (ST04‑012 / choose_one_then_deploy_token)

  1) Listen & render

  - Poll notificationQueue and detect type: "TOKEN_CHOICE".
  - Use event.payload.event.data.availableChoices to render the choice dialog.
  - Each choice shows: token name, AP/HP, traits, count. Use tokenData if provided (fall back to token).

  2) Block UI / wait for decision

  - While a TOKEN_CHOICE is pending, block other actions for that player.
  - The backend pauses processQueue until choice is confirmed.

  3) Confirm choice

  - On selection, call:
      - POST /api/game/player/confirmTokenChoice
      - Body: { gameId, playerId, eventId, selectedChoiceIndex }
  - Use event.id from notificationQueue as eventId.
  - selectedChoiceIndex is the index in availableChoices.

  4) Update UI after decision

  - On success, refresh game state and clear dialog.
  - Optionally acknowledge notifications using /player/acknowledgeEvents for the TOKEN_CHOICE event.

  5) Handle resolution notifications

  - If you receive TOKEN_CHOICE_RESOLVED, close dialog and refresh state.

  6) Handle failure states

  - If you receive TOKEN_CHOICE_ERROR, show an error banner:
      - payload.reason explains why (e.g., “No valid token choices available”).
  - If the API call fails, keep the dialog and show retry.

  7) Edge cases

  - If availableChoices is empty, do not show a dialog; display the error from TOKEN_CHOICE_ERROR if present.
  - If multiple choices have same token but different count, treat them as separate options.

  Event shape reference

  - TOKEN_CHOICE event payload:
      - payload.event.data.availableChoices[] contains:
          - index (number)
          - count (number)
          - token (raw token definition)
          - tokenData (resolved card data; use for UI)



Token Choice Dialog Schema (frontend)

  {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "TokenChoiceDialog",
    "type": "object",
    "required": ["eventId", "playerId", "choices"],
    "properties": {
      "eventId": { "type": "string" },
      "playerId": { "type": "string" },
      "choices": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "object",
          "required": ["index", "count", "display"],
          "properties": {
            "index": { "type": "integer" },
            "count": { "type": "integer", "minimum": 1 },
            "display": {
              "type": "object",
              "required": ["name", "ap", "hp", "traits"],
              "properties": {
                "name": { "type": "string" },
                "ap": { "type": "integer" },
                "hp": { "type": "integer" },
                "traits": { "type": "array", "items": { "type": "string" } }
              }
            }
          }
        }
      }
    }
  }

  Sample TOKEN_CHOICE notification payload

  {
    "id": "token_choice_42_1712345678901",
    "type": "TOKEN_CHOICE",
    "metadata": {
      "timestamp": 1712345678901,
      "expiresAt": 1712345681901,
      "requiresAcknowledgment": false,
      "priority": "high"
    },
    "payload": {
      "playerId": "playerA",
      "event": {
        "id": "token_choice_42_1712345678901",
        "type": "TOKEN_CHOICE",
        "status": "DECLARED",
        "playerId": "playerA",
        "timestamp": 1712345678901,
        "data": {
          "choiceId": "token_choice_main_deploy_strike_tokens_if_none_1712345678901",
          "userDecisionMade": false,
          "sourceCarduid": "carduid_ST04-012_abc",
          "effect": { "effectId": "main_deploy_strike_tokens_if_none", "action": "choose_one_then_deploy_token" },
          "availableChoices": [
            {
              "index": 0,
              "count": 1,
              "token": { "cardId": "T-010" },
              "tokenData": { "id": "T-010", "name": "Sword Strike Gundam", "ap": 4, "hp": 2, "traits": ["Earth Alliance"] }
            },
            {
              "index": 1,
              "count": 1,
              "token": { "cardId": "T-009" },
              "tokenData": { "id": "T-009", "name": "Launcher Strike Gundam", "ap": 2, "hp": 4, "traits": ["Earth
  Alliance"] }
            }
          ]
        }
      }
    }
  }

  Confirm request (frontend → backend)

  {
    "gameId": "game_123",
    "playerId": "playerA",
    "eventId": "token_choice_42_1712345678901",
    "selectedChoiceIndex": 1
  }
