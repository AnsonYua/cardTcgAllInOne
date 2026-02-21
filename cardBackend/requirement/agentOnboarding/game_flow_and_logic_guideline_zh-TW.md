# 簡明指南：這個卡牌遊戲後端流程怎麼跑

本指南給新手閱讀。  
把後端想成裁判：照固定順序處理事件。

## 核心模型
遊戲主狀態是 `GameEnvironment`。

檔案：
- `src/models/GameEnvironment.ts`

重要欄位：
- `phase`
- `currentPlayer`
- `processingQueue`
- `currentBattle`
- `notificationQueue`

## 事件佇列（Queue）
事件有三個狀態：
1. `DECLARED`（宣告）
2. `RESOLVING`（處理中）
3. `RESOLVED`（已完成）

主要檔案：
- `src/services/StaticEventProcessor.ts`
- `src/services/GameEngine.ts`

### 為什麼有時會卡住
如果佇列最前面是「需要玩家選擇」的事件，流程會先停住。  
判斷在：`needsPlayerInput()`（`src/models/GameEnvironment.ts`）。

## 從 API 到結果的完整路徑
1. Route 收到請求
2. Controller 驗證參數
3. `GameLogic` 載入遊戲
4. Action 轉成 Event
5. Event 放入 Queue
6. Queue 開始處理
7. `GameEngine` 分派到對應 Manager
8. 新狀態寫回檔案

主要檔案：
- `src/routes/gameRoutes.ts`
- `src/controllers/gameController.ts`
- `src/services/GameLogic.ts`
- `src/services/actions/ActionProcessor.ts`
- `src/services/actions/ActionEventFactory.ts`

## 對局開始流程
1. 建房（Create game）
2. 加入（Join game）
3. 選先手（Choose first player）
4. 重抽/就緒（Redraw/Ready）
5. 正式開局（Gameplay begins）

主要檔案：
- `src/services/effects/PhaseTransitionManager.ts`

## 回合流程（簡化）
`DRAW_PHASE` -> `MAIN_PHASE` -> `END_PHASE` -> 下一位玩家

相關檔案：
- `src/services/TurnLifecycleManager.ts`
- `src/services/EventQueue/StateBasedActionEngine.ts`

## 防區名詞（Defense Area）
- `Defense area` = `shield area` + `base`
- `base`：先被攻擊的防區
- `shield area`：`base` 清空後的後續防區
- `slot`：單位/駕駛放置位置（`slot1`~`slot6`）
- `pilot card`：和 `unit` 在同 slot 形成配對
- `command card`：一次性效果卡
- `base card`：基地卡，位於 base 區
- `trash`：棄牌區
- `Blocker`：防守方可把原本攻擊目標改成 blocker 單位

## 出牌流程
主要在：`src/services/CardPlayExecutor.ts`

步驟：
1. 檢查合法性
2. 支付能量成本
3. 卡片進場
4. 觸發進場效果
5. 若形成 `pair/link`，觸發額外效果

Unit 槽位全滿規則：
- 若 `slot1`~`slot6` 都已有 unit，再打出 `unit` 必須帶 `replaceSlot`。
- 若缺少 `replaceSlot`，後端會拒絕：`Board is full. Choose a slot to replace.`
- `replaceSlot` 合法時，該槽原 unit 先進 `trash`，再放新 unit。
- 若場上沒滿卻送 `replaceSlot`，也會判為無效。

相關檔案補充：
- `src/services/playCard/UnitReplaceSlotCoordinator.ts`

## 戰鬥流程
1. 宣告攻擊（`attackUnit` 或 `attackShieldArea`）
2. 處理攻擊階段效果
3. 防守方可能出現 `BLOCKER_CHOICE`
4. 沒有 blocker 則進入 `Action Step`
5. 雙方確認戰鬥
6. 戰鬥結算

`Suppression` 補充（盾側路徑）：
- 若攻擊者有 `Suppression`，且結算走到 shield 側，後端會一次指定最多前 2 張 shield。
- 這段邏輯在 shield 結算分支。若防守方仍有 `base`，會先走 base 分支。

主要檔案：
- `src/services/BattlePhaseManager.ts`
- `src/services/BlockerChoiceManager.ts`

## 常見 Choice 事件
- `BURST_EFFECT_CHOICE`
- `TARGET_CHOICE`
- `BLOCKER_CHOICE`
- `TOKEN_CHOICE`
- `OPTION_CHOICE`
- `PROMPT_CHOICE`

對應 API 在：
- `src/routes/gameRoutes.ts`

## 回合結束與自動檢查
`END_PHASE` 會依序檢查：
1. 修復（repair）
2. 回合結束觸發效果
3. 換下一位玩家

## 勝負判定（其中一條）
當對手 `base` 已清空，且攻擊連到 `shield` 側，遊戲可結束。

檔案：
- `src/services/BattlePhaseManager.ts`
- `src/services/GameEndManager.ts`

## 新手除錯速查
先看：
1. `phase`
2. `currentPlayer`
3. `processingQueue` 最前事件
4. `currentBattle`
5. `notificationQueue`

建議指令：
```bash
npm run test:quick
npm run test:list
npm run test:dynamic run shared/testScenarios/gameStates/<SET>/<CARD_ID>/<scenario>.json --verbose
```
