# 後端程式邏輯指南（中學生可讀）

這份文件解釋「程式怎麼判斷遊戲流程」。  
你可以把它想成：裁判的工作流程圖。

## 1) 整體觀念
後端是 Event-driven（事件驅動）：
1. 玩家送 API
2. API 轉成 Event
3. Event 進 Queue
4. Queue 依序處理
5. 遊戲狀態更新並保存

## 2) 核心物件
核心是 `GameEnvironment`：
- phase
- currentPlayer
- players/zones
- processingQueue
- currentBattle
- notificationQueue

檔案：
- `src/models/GameEnvironment.ts`

## 3) Queue 模型
事件狀態：
- `DECLARED`
- `RESOLVING`
- `RESOLVED`

處理器：
- `src/services/StaticEventProcessor.ts`

分派器：
- `src/services/GameEngine.ts`

關鍵閘門：
- `needsPlayerInput()`
- 若最前事件需要玩家選擇，流程先停。

## 4) 一次請求怎麼走
1. Route 收請求
2. Controller 驗證
3. `GameLogic` 載入 game
4. `ActionProcessor` 建立 event
5. event 入 queue
6. processor 跑 queue
7. `GameEngine` 交給對應 manager
8. 存回新狀態

## 5) 回合與階段管理
- 階段轉換：`src/services/effects/PhaseTransitionManager.ts`
- 回合輔助：`src/services/TurnLifecycleManager.ts`
- 自動檢查：`src/services/EventQueue/StateBasedActionEngine.ts`

## 6) 出牌邏輯
主入口：`src/services/CardPlayExecutor.ts`

流程：
1. 驗證合法與成本
2. 消耗能量
3. 放牌進區域
4. 觸發進場效果
5. 處理 pair/link 後續

## 7) 戰鬥邏輯
主入口：`src/services/BattlePhaseManager.ts`

流程：
1. 宣告攻擊
2. 攻擊效果
3. blocker 分支
4. action step
5. 雙方確認
6. 戰鬥結算

相關：
- `src/services/BlockerChoiceManager.ts`
- `src/services/GameEndManager.ts`

## 8) 效果系統邏輯
- 結構型別：`EffectDefinition`（`src/services/EventQueue/interfaces/GameEvent.ts`）
- 規則蒐集：`src/services/effects/EffectRuleCatalog.ts`
- 規則正規化：`src/utils/EffectNormalizationUtils.ts`
- 執行器：`src/services/effects/EffectExecutor.ts`
- 路由器：`src/services/effects/EffectActionRouter.ts`

## 9) Choice 解決邏輯
主要 API：
- `confirmBurstChoice`
- `confirmTargetChoice`
- `confirmBlockerChoice`
- `confirmTokenChoice`
- `confirmOptionChoice`

服務：
- `src/services/choices/ChoiceConfirmationService.ts`

規則：
- queue 最前面有未解 choice，就先解 choice。

## 10) 資料與審核
- 卡片資料：`src/data/*.json`
- 狀態讀寫：`GameLogic`
- 審核報告：
  - `requirement/review/st_effect_audit_report.md`
  - `requirement/review/st_effect_audit_report.json`
  - `GD01_EFFECT_AUDIT_MATRIX.md` / `GD02_EFFECT_AUDIT_MATRIX.md` / `GD03_EFFECT_AUDIT_MATRIX.md`

## 11) 除錯方法（簡單）
先看 5 件事：
1. `phase`
2. `currentPlayer`
3. `processingQueue` 最前事件
4. `currentBattle`
5. choice 是否已被標記完成

## 12) Bug 對照檔案
- 出牌錯誤：`CardPlayExecutor`, `PlayCardPreparationManager`
- 戰鬥卡住：`BattlePhaseManager`, `BlockerChoiceManager`
- choice 不消失：`ChoiceConfirmationService`, `needsPlayerInput`
- 觸發沒反應：`EffectRuleCatalog`, `EffectNormalizationUtils`

## 13) 安全檢查清單
1. queue 順序有沒有壞掉
2. choice gating 是否仍正確
3. trigger/action 名稱是否標準化
4. 是否意外繞過回合限制
5. scenario/test 是否通過

## 14) 常用指令
```bash
npm run test:quick
npm run test:list
npm run review:effects
npm run review:unresolved
npm run test:dynamic run shared/testScenarios/gameStates/<SET>/<CARD_ID>/<scenario>.json --verbose
```

## 15) 學習順序建議
1. 先讀遊玩指南
2. 再讀 effect schema
3. 最後讀本檔（後端邏輯）
