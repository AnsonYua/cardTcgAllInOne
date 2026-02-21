# `effects.rules` 結構教學（繁體中文版）

## 1) `effects.rules` 是什麼？
`effects.rules` 是卡片的規則清單。  
每一條規則都像：**如果（IF）發生某時機，就（THEN）做某動作**。  
一張卡可以有多條規則。

## 2) 一句話心法
`trigger` 決定「何時發動」，`action` 決定「做什麼」，`target` 決定「對誰做」，`conditions` 決定「是否允許」。

## 3) 最小可讀範例
```json
{
  "effectId": "example_damage",
  "type": "triggered",
  "trigger": "ENTERS_PLAY",
  "action": "damage",
  "target": { "scope": "opponent", "type": "unit", "count": 1 }
}
```

## 4) 欄位表（學生版）

| 欄位 | 意思 | 常見值 | 是否必要 |
|---|---|---|---|
| `effectId` | 規則 ID | `pair_draw` | 建議有 |
| `type` | 規則型態 | `triggered`, `continuous` | 建議有 |
| `trigger` | 觸發時機 | `ENTERS_PLAY`, `ATTACK_PHASE` | 大多必要 |
| `action` | 動作 | `damage`, `draw`, `deploy` | 多數必要 |
| `target` | 目標 | `scope/type/count/filters` | 看 action |
| `conditions` | 額外條件 | 陣列物件 | 可選 |
| `sourceConditions` | 來源條件 | 陣列物件 | 可選 |
| `cost` | 發動成本 | discard/rest/exile 類 | 可選 |
| `timing` | 時間設定 | duration/windows/actionTurn | 可選 |
| `parameters` | 參數 | 數值或設定物件 | 可選 |
| `optional` | 可否跳過 | `true/false` | 可選 |
| `description` | 說明文字 | 字串/陣列 | 可選 |

## 5) 觸發時機對照回合
- Start/Draw：`EFFECT_DRAW`
- Main：`MAIN_PHASE`
- Attack：`ATTACK_PHASE`, `ATTACK_REDIRECT`
- Pair：`PAIRING_COMPLETE`
- End Turn：`END_OF_TURN`
- Burst：`BURST_CONDITION`
- Continuous：`continuous`

## 6) Action 家族（簡表）
- 移動牌：`addToHand`, `deploy`, `returnToHand`
- 戰鬥影響：`damage`, `destroy`, `rest`, `setActive`
- 資源控制：`addBasicEnergy`, `addExtraEnergy`, `discardFromHand`
- 關鍵字/防護：`grant_keyword`, `grant_breach`, `prevent_battle_damage`
- 多步驟：`sequence`, `conditional`, `draw_then_discard`, `tutor_top_deck`

## 7) 後端怎麼讀規則
1. 讀卡片 JSON
2. `EffectRuleCatalog` 依 trigger 抓規則
3. `normalizeEffectRule` 正規化欄位
4. 交給 `EffectExecutor` / `EffectActionRouter`
5. 若需要玩家選擇，Queue 暫停
6. 選擇完成後繼續跑 Queue

## 8) 常見錯誤（節選）
1. 觸發拼錯（`ENTER_PLAY` 應為 `ENTERS_PLAY`）
2. 缺 `action`
3. `target.count` 不合理
4. 別名混用（建議 `sourceAp` 而非 `sourceAP`）
5. 成本 `cost` 格式寫錯

## 9) Choice 事件提醒
遇到以下事件要先解：
- `TARGET_CHOICE`
- `BLOCKER_CHOICE`
- `TOKEN_CHOICE`
- `OPTION_CHOICE`
- `PROMPT_CHOICE`
- `BURST_EFFECT_CHOICE`

## 10) 目前狀態
- ST 審核：`Rows: 176 | PASS: 176 | WARN: 0 | FAIL: 0`
- 來源：`requirement/review/st_effect_audit_report.md`

## 11) 新規則上線前檢查
1. trigger 是否在已知清單
2. action 是否有 handler
3. target/conditions 是否合理
4. choice 流程是否可解
5. 用 scenario/test 實跑

## 12) 常用參考
- `src/services/EventQueue/interfaces/GameEvent.ts`
- `src/utils/EffectNormalizationUtils.ts`
- `src/services/effects/schema/EffectSchema.ts`
- `src/services/effects/EffectRuleCatalog.ts`
- `src/services/effects/EffectExecutor.ts`
- `src/services/effects/EffectActionRouter.ts`
