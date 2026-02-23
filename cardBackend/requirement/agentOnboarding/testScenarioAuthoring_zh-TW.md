# 測試情境撰寫指南（完整 GameEnv 版）

## 目的
建立可執行的完整 scenario JSON，供手動與前端驗證。

目標路徑格式：
- `shared/testScenarios/gameStates/<SET>/<CARD_ID>/<scenario_name>.json`

## 最低輸入需求
至少要知道：
- 目前回合與 phase
- 觸發者與目標（若是戰鬥）
- 各區域必要卡片（hand/slot/base/shield/energy/trash）
- 要觸發的行為（play/attack/burst confirm...）
- 預期結果

## 撰寫步驟
1. 先看目標卡在 `src/data/*.json` 的 `effects.rules`。
2. 一次只測一個分支目標。
3. 從模板開始，不要空白重寫。
4. 兩位玩家都填完整 `initialGameEnv`。
5. `notes` 用 Action / Expect 交替寫。
6. 跑驗證與手動流程。

## 必填重點
- `processingQueue: []`
- `notificationQueue` 至少一筆 seed（`payload.playerId` 要對應 `currentPlayer`）
- `deck.handUids` 與 `deck.hand` 對齊
- `linked` 與 `paired` 要分清楚：
  - `paired`：同 slot 有 unit + pilot
  - `linked`：`paired` + pilot 身份符合 unit `link`（名稱或 trait）
  - 若是 command 當 pilot，需有 `playedAs: "pilot"` 讓 `designate_pilot` 可參與連結判定

## 能量規則
- 一般情況下，`energyArea` 建議用 `isRested: false`。
- 若要測「不能支付成本」，才刻意放部分 `isRested: true`。

## 檢查清單（送出前）
1. 路徑命名正確
2. 玩家雙方狀態完整
3. 回合與 phase 合理
4. 觸發條件已被環境滿足
5. 預期結果可觀測（有明確檢查點）

## 建議驗證指令
```bash
npm run test:dynamic run shared/testScenarios/gameStates/<SET>/<CARD_ID>/<scenario>.json --verbose
```

## 參考
- `requirement/agentOnboarding/gd01-125_worked_example_zh-TW.md`
- `requirement/skills/createGameEnvTest/references/templates/action-scenario-template.json`
