# 新手遊玩完整指南（繁體中文版）

這份指南是給新手看的。  
可當作上課講義，先讀再練習。

## 1) 遊戲目標
突破對手防線並獲勝。

重點：
- `defense area` = `shield area` + `base`
- 通常先打 `shield`
- `shield` 清空後，攻擊連到 `base` 側可能直接結束對局

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
`Deploy`, `Pair`, `Linked`, `Attack`, `Burst`, `Continuous`, `Blocker`, `Repair`, `Breach`, `First Strike`, `High-Maneuver`, `Activate`, `Cost`, `Target`, `Optional`, `Once per turn`

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
