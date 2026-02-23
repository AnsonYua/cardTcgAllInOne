# 新手遊玩完整指南（繁體中文版）

這份指南是給新手看的。  
可當作上課講義，先讀再練習。

## 1) 遊戲目標
突破對手防線並獲勝。

重點：
- `defense area` = `shield area` + `base`
- 通常先打 `base`
- `base` 清空後，攻擊連到 `shield` 側可能直接結束對局

## 2) 卡片與區域
### 卡片
- `Unit card`
- `Pilot card`
- `Command card`
- `Base card`

### 區域
- `slot1` ~ `slot6`
- `shield area`
- `base`
- `energy area`
- `trash`
- `hand`

## 3) 回合流程
Start Turn -> Draw -> Main -> Attack/Blocker/Action Step -> End Turn

## 4) 必懂關鍵字
`Deploy`, `Pair`, `Linked`, `Attack`, `Burst`, `Continuous`, `Blocker`, `Repair`, `Breach`, `First Strike`, `High-Maneuver`, `Suppression`, `Activate`, `Cost`, `Target`, `Optional`, `Once per turn`

補充：
- `paired`：同一個 slot 同時有 unit + pilot。
- `linked`：`paired` 之外，還要符合 unit 的 `link` 對應（名稱或 trait）。

## 5) 一個回合怎麼玩
1. 看手牌與能量
2. Main 出牌
3. 需要時開啟 Activate 效果
4. 宣告攻擊
5. 處理 blocker/action step
6. End Turn

## 6) 戰鬥流程
1. 宣告攻擊（`attackUnit` / `attackShieldArea`）
2. 攻擊效果處理
3. 防守方可能出現 blocker choice
4. 進入 action step
5. 雙方確認
6. 結算

### `Blocker` 概念（新手重點）
- `Blocker` 是防守方在被攻擊時的攔截手段。
- 出現 `BLOCKER_CHOICE` 時，代表防守方可以選擇是否攔截。
- 若使用 `Blocker`，攻擊目標可能改成該 `Blocker` 單位。
- 若不使用，攻擊照原目標繼續。

### 關鍵字概念（新手重點）
- `Burst`：護盾受擊後可能出現的觸發效果，通常會先進入 burst choice 流程。
- `Breach`：分兩步驟運作。
  1) 先取得 `Breach` 數值（例如 Breach 1）。
  2) 當你的單位在戰鬥中擊破對方單位（`BATTLE_DESTROY`）時才觸發。
  之後系統會套用 `damageShield`。
  規則：先檢查對手 `base`；若沒有 `base`，才處理 shield 側。
- `First Strike`：在戰鬥順序中，這個單位會先造成戰鬥傷害。
- `High-Maneuver`：這個單位有特殊攻擊目標規則，通常更不容易被一般防線阻擋。
- `Suppression`：當這個攻擊者打到 shield 側時，一次攻擊事件可指定前 2 張 shield。
  補充：若對手還有 `base`，會先走 base 分支。
- `Repair`：回復傷害（HP）的效果，常見於回合結束或卡文指定時機。
- `Activate`：玩家主動選擇使用的效果，需符合時機並支付 `cost`。

### 快速例子
- `Burst` 例子：你的 `shield` 被打到後，跳出 `BURST_EFFECT_CHOICE`，你可以決定是否發動 burst。
- `Breach` 例子（會觸發）：你的攻擊單位有 `Breach 1`，且在戰鬥中擊破對方單位。
  系統會再造成 1 點防區傷害（先 base，否則 shield）。
- `Breach` 例子（不會觸發）：你的攻擊單位沒有擊破對方單位。
  這次就不會有 Breach 追加傷害。
- `First Strike` 例子：兩個單位交戰時，帶有 `First Strike` 的那一方先造成戰鬥傷害。
- `High-Maneuver` 例子：你的單位用特殊目標規則攻擊，對手較難用一般防線應對。
- `Suppression` 例子：你的攻擊單位有 `Suppression` 並攻擊 shield 側。
  若對手有 2 張以上 shield，後端會指定前 2 張 shield。
- `Repair` 例子：你的單位先前受到 2 點傷害，觸發 `Repair` 後會回復部分 HP。
- `Activate` 例子：在 `Main` 階段你主動開啟 `Activate` 技能，支付 `cost` 後結算效果。

## 6.1) 當 Unit 槽位全滿時
- Unit 區有 6 個槽位：`slot1` 到 `slot6`。
- 若 6 個槽位都有 unit，再打出 `unit` 必須帶 `replaceSlot`。
- 若沒帶 `replaceSlot`，出牌會被拒絕：`"Board is full. Choose a slot to replace."`
- 若 `replaceSlot` 合法，舊 unit 先進 `trash`，再放入新 unit。
- 若場上其實沒滿，卻送了 `replaceSlot`，同樣會被判為無效。

## 7) Choice 規則
有 choice 事件時，先解它。

常見：
- `BURST_EFFECT_CHOICE`
- `TARGET_CHOICE`
- `BLOCKER_CHOICE`
- `TOKEN_CHOICE`
- `OPTION_CHOICE`
- `PROMPT_CHOICE`

## 8) 快速讀卡文公式
`WHEN` + `WHO` + `WHAT` + `LIMIT`

## 9) 時機對照
- `[Deploy]`：進場觸發
- `[When Paired]`：配對後觸發
- `[Attack]`：攻擊中觸發
- `[Burst]`：護盾受擊時觸發
- `End of turn`：回合結束觸發
- `While ...`：持續效果

## 10) 常見新手錯誤
- 不夠成本硬出牌
- 忽略未解 choice
- 忘記 blocker
- 忘記 once-per-turn
- 太早結束回合

## 11) 建議練習
1. 先練 deploy + attack
2. 再練 blocker
3. 再練 burst
4. 再練 pair/linked

## 12) 行動前檢查
- 是我回合嗎？
- 成本夠嗎？
- 有未解 choice 嗎？
- 有看懂 target 嗎？

## 13) 參考文件
- `requirement/agentOnboarding/game_flow_and_logic_guideline_zh-TW.md`
- `requirement/agentOnboarding/card_effects_implemented_guide_zh-TW.md`
- `requirement/agentOnboarding/effects_rules_schema_guide_zh-TW.md`
