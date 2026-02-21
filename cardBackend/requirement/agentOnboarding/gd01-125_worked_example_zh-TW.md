# 範例教學：GD01-125 對手回合 Burst 情境

## 1) 規則重點與目標
來源卡：
- `src/data/gd01Card.json`

卡文重點：
- `[Burst] Deploy this card.`
- `[Deploy] Add 1 of your Shields to your hand. Then, if it is your turn, you may deploy 1 (Zeon) Unit card that is Lv.4 or lower from your hand.`

測試目標：
- 在對手回合觸發 burst。
- Base 成功 deploy。
- shield 成功回手。
- 因為不是自己回合，後面可選 deploy 不應執行。

## 2) 環境對應
- 對手攻擊：`currentPlayer = playerId_2`
- 第一張盾是 GD01-125
- 盾區至少 2 張，才能看出「加 1 張到手牌」
- 手上放一張符合條件 Zeon 單位，驗證對手回合不會被 deploy

## 3) 測試流程
1. 載入 scenario 並 inject。
2. 玩家 2 用 `attackShieldArea` 攻擊。
3. 進入 burst choice。
4. 玩家 1 `confirmBurstChoice = true`。
5. 檢查 GD01-125 進 base。
6. 檢查有 1 張 shield 進手牌。
7. 檢查沒有額外從手牌 deploy Zeon 單位。

## 4) 驗證重點
- burst 分支有跑
- deploy + addToHand 有跑
- turn gate（是否自己回合）有生效
