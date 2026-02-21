# 卡牌效果實作指南（依回合時機）

## 這份文件是什麼
這是效果速查表。  
它把卡文、觸發時機、後端路徑連在一起。  
可用來快速判斷某效果是否已被後端支援。

## 卡文快速讀法
- `Deploy`：進場觸發
- `Pair`：配對完成觸發
- `Attack`：攻擊流程觸發
- `Burst`：護盾受擊後可觸發
- `End Turn`：回合結束觸發
- `Linked`：需要連結狀態
- `Continuous`：條件成立時持續有效
- `Slot`：`slot1`~`slot6`
- `Pilot card`：駕駛卡
- `Command card`：一次性效果卡
- `Base card`：基地卡
- `Trash`：棄牌區
- `Breach`：先賦予 Breach 數值，之後在 `BATTLE_DESTROY` 才會追加防區傷害（先 base，否則 shield）
- `Once per turn`：每回合一次（由 usage tracker 管控）

## 回合時機矩陣（簡表）

| 時機 | 卡文線索 | 常見結果 |
|---|---|---|
| Start/Draw | 抽牌/回合開始 | 抽牌、資源或觸發效果 |
| Deploy | `[Deploy]` | 進場後觸發指定效果 |
| Pairing | `[When Paired]` | 配對相關增減益 |
| Attack | `[Attack]` | 攻擊中效果 |
| Blocker | `Blocker` | 改變攻擊目標 |
| Burst | `[Burst]` | 護盾受擊時的效果 |
| End turn | 回合結束語句 | 修復/收尾 |
| Continuous | `While ...` | 持續效果 |

## 已接線 Action（重點）
主要來源：`src/services/effects/EffectExecutor.ts`

- `draw`, `addToHand`, `deploy`, `deploy_from_hand`
- `damage`, `destroy`, `rest`, `setActive`
- `allow_attack_target`, `restrict_attack`
- `addBasicEnergy`, `addExtraEnergy`
- `discardFromHand`, `moveFromTrashToDeck`, `exileFromTrash`
- `grant_keyword`, `grant_breach`, `prevent_battle_damage`, `prevent_damage`

`grant_breach` 補充：
- 先在 `src/services/effects/actions/EffectBreachActions.ts` 賦予 Breach 數值。
- 再由 `src/services/effects/BattleDestroyEffectManager.ts` 在 `BATTLE_DESTROY` 觸發追加傷害。
- 追加傷害實作在 `src/services/effects/actions/EffectShieldActions.ts`（先 base，否則 shield）。

多步驟路由：`src/services/effects/EffectActionRouter.ts`
- `sequence`, `conditional`, `draw_then_discard`, `tutor_top_deck`, `deploy_from_top_deck`

## Choice 事件（玩家必須先解）
- `BURST_EFFECT_CHOICE`
- `TARGET_CHOICE`
- `BLOCKER_CHOICE`
- `TOKEN_CHOICE`
- `OPTION_CHOICE`
- `PROMPT_CHOICE`

原則：Queue 最前面如果是這些事件，要先解完。

## 目前審核狀態
- `requirement/review/st_effect_audit_report.md`
- `requirement/review/st_effect_audit_report.json`
- 摘要：`Rows: 176 | PASS: 176 | WARN: 0 | FAIL: 0`

另外有 GD 審核矩陣：
- `GD01_EFFECT_AUDIT_MATRIX.md`
- `GD02_EFFECT_AUDIT_MATRIX.md`
- `GD03_EFFECT_AUDIT_MATRIX.md`

## 小提醒
資料或規則更新後，仍要重跑檢查：
```bash
npm run review:effects
npm run review:unresolved
npm run test:quick
```
