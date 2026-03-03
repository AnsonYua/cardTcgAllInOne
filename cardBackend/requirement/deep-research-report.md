# 鋼彈卡牌遊戲 GCG 對戰 AI 系統設計深度研究報告

## 執行摘要

本報告以官方《鋼彈卡牌對戰 綜合規則》（繁中版）與官方《規則 Q&A》（繁中版）為核心，系統化拆解 Gundam GCG 的回合結構、卡牌類型、能量（能源）與 Lv/費用系統、攻擊/阻擋/瞬動（即時）時序、傷害與護盾/基地結算、效果觸發與結算優先序、以及規則處理（state-based rule processing）等關鍵機制，並彙整常見邊界情境與裁定依據。這些規則特性使得「可行動集合（legal action set）」在不同時窗（主要階段 vs. 戰鬥中的瞬動步驟 vs. 回合結束階段的瞬動步驟）劇烈變動，且效果結算具明確的「回合玩家先結算 → 非回合玩家後結算」、「新誘發效果插隊優先」、「爆發優先」等規則序，適合以**符號化規則引擎**保證合法性、用**LLM 多角色協作**負責語意理解（卡文→結構化效果）、不完全資訊推理（對手手牌/護盾推測）與策略規劃。citeturn2view0turn17view1turn18view1turn8view0turn30view0

在 AI 系統設計上，本報告提出一個「規則引擎主導、LLM 輔助」的分工：規則引擎負責卡牌/區域/計數器狀態、觸發佇列、時序窗、合法動作枚舉與結算；LLM 以多角色（狀態解析、規則裁判、卡效推理、策略規劃、對手模型、動作選擇/解釋）協作，對每一步給出可稽核的 JSON 輸出與置信度，並設計衝突仲裁、降級模式（fallback）與自動化單元測試框架，確保「勝率」與「合法率」可以分別被量化與迭代優化。citeturn17view1turn15view0

---

## 官方規則與裁定深度整理

### 遊戲目標、敗北條件與規則優先序

官方綜合規則明確定義勝負：任一玩家滿足敗北條件時遊戲結束，未敗北者獲勝；敗北條件包含「護盾區無任何卡牌時受到來自機體的戰鬥傷害」以及「卡組變為 0 張」。citeturn15view1turn15view0turn18view0  
此外，規則優先序採「**卡牌文本優先於綜合規則**」：若卡牌文本與綜合規則矛盾，遵循卡牌文本；並有「能做多少做多少」原則：若被要求做無法執行的行動則不做；若部分可做則盡可能處理。這些條款對 AI 的「效果解析」與「合法性檢查」至關重要，因為大量例外都來自卡牌文本。citeturn15view1turn17view1

### 區域、公開資訊與「卡牌換區即視為新卡」

GCG 的主要區域包含：卡組區、能源卡組區、能源區、戰鬥區、護盾區（基地放置處 + 護盾放置處）、除外區、手牌、廢棄區等；其中能源區/戰鬥區/基地放置處/廢棄區/除外區多為公開區域，手牌與卡組/能源卡組為非公開區域；護盾放置處為非公開，且除非特別指定，移動護盾時只能取最上方那張。citeturn13view0turn13view2turn13view3  
一條對推理引擎非常關鍵的原則是：卡牌跨區域移動時，除非特別指定，**視為新區域中的新卡**，之前區域的效果不會「原樣延續」。AI 若用 LLM 做狀態摘要，必須正確處理這種「物件身分（identity）重置」語意。citeturn13view0

### 卡牌類型與搭乘/共鳴核心機制

官方規則列出 5 種卡牌類型：機體、駕駛員、指令、基地、能源。citeturn12view0turn12view5  
機體可被配置於戰鬥區且是唯一能攻擊的類型；「新配置機體通常在配置回合不能攻擊」，但若機體下方疊放了滿足其「共鳴條件」的駕駛員，則成為「共鳴機體」，**在配置回合即可立即攻擊**。citeturn12view2turn48view5  
駕駛員以「搭乘」方式疊放在戰鬥區機體下方；原則上一機體只能被一駕駛員搭乘，且搭乘後不能任意取下或交換；機體換區時，搭乘其下方的駕駛員會隨之移動到同一區域。citeturn12view2turn12view3turn8view0  
指令卡牌在【主要】或【瞬動】等時機使用以發動指令效果；部分指令卡牌具有【駕駛員】效果，使用時可選擇不發動指令效果，改作為駕駛員搭乘機體；但在瞬動步驟中**不能把具有【駕駛員】效果的指令卡當駕駛員搭乘**。citeturn12view4turn10view3turn8view0

### Lv/費用與能源系統

能源卡組固定 10 張；能源區最多 15 張能源（其中 EX 能源最多 5 張）。citeturn14view2turn13view0turn28view1  
每回合的能源階段，回合玩家必須從能源卡組放置 1 張能源卡到能源區（正面朝上、活躍狀態），不可跳過；若能源卡組沒牌，仍進行能源階段但直接過渡到主要階段。citeturn49view0turn28view1  

Lv 與費用的規則要分開看：  
綜合規則定義 Lv 為「使用卡牌所需的能源張數門檻」，比較的是**能源區的能源數量**（包含 EX 能源），且與能源是否活躍/休息無關；費用則是在使用卡牌時，把能源區中「所需數量的活躍狀態能源」轉為休息狀態來支付。citeturn48view5turn49view0  
官方規則也指出：除能源卡與替代卡外，其他卡牌都有顏色；能源本身沒有顏色。此設計意味著「能量支付」通常是**通用資源**（不靠顏色匹配支付），顏色更多用於構築限制與效果參照。citeturn48view0turn48view5  

### 回合流程與行動窗

綜合規則將回合拆為 5 階段：起始、抽卡、能源、主要、結束；其中起始階段包含「啟動步驟（全體轉活躍）」與「開始步驟（回合開始時效果）」，結束階段包含「瞬動步驟 → 結束步驟（回合結束時效果） → 手牌步驟（手牌上限 10） → 清算步驟（本回合中效果失效）」；並明確指出：若行動誘發效果，需等所有效果處理完畢才進入下一階段/步驟。citeturn14view4turn18view0turn49view0  

主要階段中，回合玩家可任意順序多次進行：「使用手牌」「發動【啟動·主要】效果」「機體攻擊」，但除非透過效果，這些行動只能在「沒有任何已誘發且等待發動的效果」的狀態下進行（等於要求觸發佇列清空）。citeturn49view0turn27view0

### 攻擊與戰鬥步驟、阻擋與瞬動「優先權」

攻擊在主要階段宣告後會進入戰鬥，戰鬥依序為：攻擊步驟、阻擋步驟、瞬動步驟、傷害步驟、戰鬥結束步驟。citeturn18view0turn18view1  
攻擊宣言時，選擇我方 1 張活躍機體轉為休息並宣告攻擊對象；攻擊對象只能是「對方玩家」或「對方休息狀態機體」。citeturn18view1turn49view0  

阻擋步驟中，非回合玩家可用其戰鬥區中活躍機體的《阻擋者》效果，將攻擊對象變更為該阻擋者機體；每次攻擊至多發動 1 次《阻擋者》，且原本就是攻擊對象的機體不能發動自己的阻擋者。citeturn18view1turn10view1  
若攻擊中的機體具有《高機動》，則其攻擊期間對方機體無法發動《阻擋者》。citeturn10view1turn27view6  

瞬動步驟（戰鬥中、以及結束階段中各有一次）採交替行動：从**非回合玩家**開始，雙方輪流選擇「使用具有【瞬動】的指令」「發動【啟動·瞬動】效果」「讓過」；只要不是雙方連續讓過，行動權就來回轉交；雙方連續讓過則結束瞬動步驟。這可視為本作的「優先權/回應窗」機制。citeturn18view1turn5view2turn27view2

### 傷害結算、護盾/基地判定與爆發

傷害步驟先確認當前攻擊對象：若攻擊玩家，則檢查對方護盾區；若沒有基地與護盾，攻擊機體給予對方玩家等同 AP 的戰鬥傷害，對方立即敗北；若有護盾但無基地，則對最上方護盾造成等同 AP 的戰鬥傷害；護盾受到 1 點以上傷害就被破壞（每張護盾視為 HP1），破壞後翻開置於廢棄區，若正面有【爆發】可在進廢棄區前選擇是否發動；若護盾區有基地，則傷害優先給予基地並以計數器管理，基地 HP 變 0 則破壞。citeturn11view1turn13view2turn8view0turn27view1  
同時，基地與護盾即便受到超過其 HP 的傷害，**溢出傷害不會傳遞到其他護盾**；若給予傷害為 0 則不視為給予傷害。citeturn14view5turn27view1  

【爆發】在「護盾被破壞、翻正面、進廢棄區前」可不支付費用立即發動；也可選擇不發動。citeturn10view3turn8view0turn27view6  

### 效果分類、誘發結算序與「爆發優先/新誘發插隊」

綜合規則將效果分為常時型、誘發型、啟動型、指令效果、置換效果；並定義「可以～」的效果可選擇不發動，沒有「可以～」則必須盡可能處理。citeturn16view2turn27view3  
最重要的是誘發型效果結算序：  
同一玩家多個效果同時誘發時視為同時誘發，需決定結算順序依次處理；我方與對方多個效果同時誘發時，**先結算回合玩家誘發的全部效果，再結算非回合玩家誘發的全部效果**；結算多個效果時若又誘發新效果，**優先結算新誘發效果**；若同一批被誘發效果中包含【爆發】，則**爆發優先結算**。citeturn16view2turn17view0turn27view3  

指令效果若要求選擇對象，只要無法選擇對象就不能使用該指令；且文本若存在「此後」「若那樣做的話」等多段，每段要求選擇對象時，只要無法選擇「前段」對象就不能使用該指令。citeturn17view1turn27view4  

### 規則處理：敗北、破壞、配置上限超額

規則處理是當特定事態發生時由規則自動執行，且即便正在進行其他行動，也會在發生事態的時間點立刻結算；其中包含敗北判定、破壞處理、戰鬥區 6 機體上限與基地放置處 1 基地上限的超額處理。citeturn15view0turn27view4  
當戰鬥區已滿仍要配置新機體時，需選 1 張既有機體置於廢棄區，且此方式置於廢棄區的機體**不視為被破壞**；基地同理。citeturn15view0turn8view0turn27view4  

---

### 多元範例情境與逐步裁定演算

以下案例以「步驟 → 規則依據 → 結果」呈現，涵蓋攻擊、阻擋、瞬動、爆發、誘發序、共鳴、上限超額等常見邊界。

#### 案例：攻擊玩家且護盾區有基地

情境：A 以 AP=3 機體攻擊玩家 B；B 的護盾區存在基地（基地放置處 1 張）。  
步驟：A 宣告攻擊（攻擊步驟），攻擊對象為玩家；進入傷害步驟後確認護盾區，因存在基地，戰鬥傷害先給予基地；以計數器記錄傷害，基地 HP 變 0 則破壞入廢棄區。citeturn18view1turn11view1turn12view5  
結果：基地承受 3 點傷害；若因此 HP≤0，基地被破壞（不是護盾卡）。citeturn11view1turn15view0  

#### 案例：攻擊玩家且無基地、存在護盾，護盾爆發可選擇發動

情境：A 以 AP=2 攻擊玩家 B；B 無基地且有多張護盾。  
步驟：傷害步驟確認攻擊玩家且無基地，傷害給予「最上方」護盾；護盾視為 HP1，受到 ≥1 傷害即破壞；破壞時翻開，若有【爆發】可在進廢棄區前選擇是否發動。citeturn11view1turn13view2turn8view0turn27view1  
結果：頂護盾被破壞，B 可選擇是否發動爆發；不論是否爆發，若未被其他效果移動，該卡最後會進入廢棄區。citeturn10view3turn27view6  

#### 案例：攻擊玩家且護盾區完全空，直接敗北

情境：B 護盾區沒有基地也沒有護盾；A 用 AP=1 機體攻擊玩家 B。  
步驟：傷害步驟確認護盾區無任何卡牌，A 給予玩家等同 AP 的戰鬥傷害；受到此戰鬥傷害的玩家立即敗北。citeturn11view1turn15view0turn27view1  
結果：B 立即敗北，A 獲勝。citeturn11view1turn15view0  

#### 案例：AP=0 機體可以攻擊，但不能破壞護盾

情境：A 用 AP=0 機體攻擊玩家 B（B 無基地、有護盾）。  
步驟：規則允許 AP=0 機體攻擊；但護盾視為 HP1，AP=0 造成 0 點戰鬥傷害，而「給予 0 傷害不視為給予傷害」，因此護盾不會被破壞。citeturn28view2turn14view5turn13view2  
結果：攻擊可成立但不能破壞護盾；戰局只改變攻擊機體狀態（活躍→休息）。citeturn18view1turn28view2  

#### 案例：阻擋者改變攻擊對象、每次攻擊限一次阻擋

情境：A 攻擊 B 的某休息機體 X；B 有另一張活躍機體 Y 具有《阻擋者》。  
步驟：阻擋步驟由非回合玩家 B 決定是否發動《阻擋者》；若發動，將 Y 轉為休息並把攻擊對象改為 Y；同一次攻擊只能發動 1 次阻擋者。citeturn18view1turn10view1turn27view1  
結果：攻擊對象由 X 變為 Y；後續戰鬥傷害以 Y 為對象結算。citeturn18view1turn27view1  

#### 案例：高機動使防守方無法阻擋

情境：A 的攻擊機體具有《高機動》，B 有活躍《阻擋者》想阻擋。  
步驟：高機動為「攻擊期間持續發動」的關鍵字效果，意思是「此機體進行攻擊的期間，對方機體無法發動《阻擋者》」。citeturn10view1turn27view6  
結果：阻擋步驟中 B 不能用阻擋者改變攻擊對象；若無其他效果，直接進入瞬動步驟。citeturn18view1turn10view1  

#### 案例：瞬動步驟交替行動與「連續讓過結束」

情境：戰鬥進入瞬動步驟；非回合玩家先手。  
步驟：非回合玩家在「使用【瞬動】指令 / 發動【啟動·瞬動】 / 讓過」三選一；只要不是雙方連續讓過，就持續交替；雙方連續讓過才結束瞬動步驟。citeturn5view2turn18view1turn27view2  
結果：AI 必須把瞬動步驟當作一個可能多輪互動的子回合（mini-loop），並維護「當前優先權持有者」與「上一手是否讓過」旗標。citeturn5view2turn27view2  

#### 案例：先制攻擊使攻擊方先造成傷害，若先破壞對方則不受反擊傷害

情境：A 的攻擊機體具有《先制攻擊》，攻擊 B 的機體；雙方 AP 足以互相致死。  
步驟：先制攻擊定義為「在傷害步驟中優先給予戰鬥傷害」，若先造成的傷害破壞了對方機體或基地，則攻擊機體不會受到來自被攻擊方的戰鬥傷害。citeturn10view1turn28view2turn46view1turn27view6  
結果：A 先打死 B 的機體後，A 不吃反擊；此對「交換（trade）」與攻擊順序的策略評估很關鍵。citeturn10view1turn27view6  

#### 案例：突破在我方回合中以戰鬥傷害破壞對手機體時觸發，若對方無護盾/基地則不發動

情境：A（回合玩家）在自己回合用具有《突破3》的機體打死 B 的機體；B 的護盾區仍有基地或護盾。  
步驟：《突破》定義為：我方回合中，當此機體透過戰鬥傷害破壞對方機體時，對對方護盾區「最前方」1 張卡造成指定值傷害；若對方有基地則給予基地，無基地則給予最上方護盾；若對方護盾區沒有基地也沒有護盾，則不發動突破。citeturn10view0turn10view0turn27view5turn46view0  
結果：突破額外傷害會打到基地或頂盾；但不會在對方護盾區為空時轉成「打玩家」，而是直接不發動。citeturn10view0turn27view5  

#### 案例：多個誘發同時發生時的結算序、爆發優先與新誘發插隊

情境：同一時點同時誘發「A 的效果 1」「A 的效果 2」「B 的爆發效果」，且在結算其中一個效果時又誘發「新效果 3」。  
步驟：同時誘發且包含【爆發】時，爆發優先；若雙方都有多個誘發，先結算回合玩家全部，再結算非回合玩家全部；在結算多個效果過程中若有新效果被誘發，優先結算新誘發效果。citeturn16view2turn17view0turn27view3  
結果：正確的 AI 事件佇列應支援（1）按玩家分組的批次結算、（2）爆發插到最前、（3）結算期間的新事件具更高優先序。citeturn16view2turn27view3  

#### 案例：配置上限超額時送廢棄區不算「破壞」

情境：戰鬥區已有 6 張機體，玩家想再配置第 7 張。  
步驟：規則處理要求選 1 張既有機體置廢棄區，且此方式不視為被破壞。citeturn15view0turn8view0turn27view4  
結果：若某效果是「破壞時」觸發，這裡不會觸發；AI 的事件系統必須把「移至廢棄區」原因區分為 Destroy vs. RuleOverflow。citeturn15view0turn27view4  

---

## 卡牌分類與效果建模：結構化卡庫資料庫設計

### 卡牌效果「文本 → 結構化」的挑戰與設計原則

GCG 的規則允許效果以多種型態出現（常時/誘發/啟動/指令/置換），且觸發與結算序嚴格；另外存在關鍵字（如《修復》《突破》《高機動》《壓制》與【爆發】【攻擊時】【破壞時】等）會把大量文本壓縮成可機械化的模板。citeturn16view2turn10view0turn10view1turn10view3  
因此建議卡庫資料庫採「**雙層表示**」：  
第一層保存官方原文（多語版本）與版控資訊；第二層把效果編譯為 DSL/AST（可執行或可驗證），並保留「編譯置信度」與「需要人工覆核」標記，讓 AI 對戰引擎能在「高可信卡」走全自動，在「低可信卡」走保守策略（只做合法且明確的部分）。此設計也呼應了規則的「能做多少做多少」原則。citeturn15view1turn16view2

### 建議的結構化卡牌資料 Schema

下表給出一個可支援規則引擎與 LLM 的最小完備 Schema（精簡但可擴充）。其中 `effects[]` 建議使用「事件驅動」格式（trigger/condition/cost/actions），以對齊官方的回合與戰鬥時序窗。citeturn49view0turn18view1turn17view1  

| 欄位 | 型別 | 必填 | 說明 |
|---|---:|:---:|---|
| card_id | string | ✓ | 全域唯一（建議：`{set}-{number}-{variant}`） |
| card_no | string | ✓ | 官方卡號，如 `ST01-001`（官方規則亦以卡號區分可投入 4 張上限）citeturn8view0turn14view2 |
| name | object | ✓ | 多語名稱：`{ja, zh_tw, en, ...}` |
| rarity | enum | ✓ | `C/U/R/LR/P/...`（依官方） |
| card_type | enum | ✓ | `UNIT/PILOT/COMMAND/BASE/RESOURCE`（對齊官方五類）citeturn12view0turn12view5 |
| colors | array<enum> | △ | 非能源/替代卡通常有顏色；能源無顏色citeturn48view0turn48view5 |
| level | int | △ | Lv（能源/替代卡視為 0）citeturn48view5 |
| cost | int | △ | 費用（能源/替代卡視為 0）citeturn48view5 |
| ap | int / string | △ | UNIT/BASE：數值；PILOT：修正如 `+2`citeturn12view3turn38view0 |
| hp | int / string | △ | UNIT/BASE：數值；PILOT：修正如 `+1`citeturn12view3turn38view0 |
| traits | array<string> | △ | 特徵（faction/隊伍/屬性），文本常會參照citeturn48view0turn35view0 |
| terrain | array<enum> | △ | `SPACE/EARTH/...`（若存在）citeturn35view0turn46view0 |
| resonance | object | △ | 共鳴條件/Link：如「需要某駕駛員名或特徵」citeturn12view2turn48view5turn35view0 |
| text_raw | object | ✓ | 多語原文效果（逐行保留，用於驗證與對齊） |
| keywords | array<enum> | △ | 由 parser 擷取：`REPAIR/BREAKTHROUGH/HIGH_MOBILITY/...`citeturn10view0turn10view1 |
| effects | array<object> | △ | 編譯後 DSL/AST（可執行） |
| rulings | array<object> | △ | 官方 Q&A/FAQ 摘要（指向條目）citeturn35view0turn38view1turn46view0 |
| legality_notes | object | △ | 例如「瞬動步驟不可搭乘」等特殊限制citeturn10view3turn8view0 |
| updated_at | date | △ | 版控與更新時間（多語版本不同步時很重要）citeturn15view1turn29view0 |

#### `effects[]` 的建議 DSL 形狀（示意）

```json
{
  "effect_id": "ST01-001#E2",
  "effect_kind": "TRIGGERED",
  "timing": {
    "trigger": "WHILE_MOUNTED", 
    "window": "CONTINUOUS"
  },
  "limit": { "per_turn": null },
  "condition": { "and": [] },
  "cost": null,
  "actions": [
    {
      "type": "MODIFY_STAT_AURA",
      "target": { "side": "SELF", "zone": "BATTLE", "card_type": "UNIT", "filter": "ALL" },
      "stat": "AP",
      "delta": +1,
      "duration": "WHILE_THIS_EFFECT_ACTIVE"
    }
  ]
}
```

此 DSL 對齊官方「常時型效果持續發動」「多個常時型效果可重複生效」「矛盾常時型效果否定優先」等規則。citeturn16view2turn27view3  

### 以官方卡例示範 Schema 實例

下列示範取自官方卡面資料（日本官方卡表頁面），用於展示「同一內在卡」如何以結構化欄位表示；繁中名稱可作為本地化層另行補齊。

#### 範例：ST01-001「ガンダム / Gundam」

官方卡表顯示：Lv4、Cost3、Blue、UNIT、AP3、HP4，具《リペア2》與「セット中：自分ターン中，自分ユニット全部 AP+1」，共鳴/Link 為「アムロ・レイ」，並有 Q&A 指出「全體 AP+1 包含自身」。citeturn35view0turn28view0turn7view0  

#### 範例：ST01-010「アムロ・レイ / Amuro Ray」（PILOT）

官方卡表顯示：Lv4、Cost1、Blue、PILOT，AP 修正 +2、HP 修正 +1；並有【バースト：加入手牌】、【セット時：選擇 HP5 以下敵方 UNIT 令其休息】。citeturn38view0turn35view0turn27view6  

#### 範例：ST01-014「予期せぬ出来事」（COMMAND，含 Burst 與 Action/瞬動窗）

官方卡表顯示：Lv3、Cost1、White、COMMAND；【バースト：發動此卡的メイン】；【メイン/アクション：選擇敵方 UNIT，本回合中 AP-3】——這說明同一張指令可同時具有「主要 / 瞬動」時窗，且 Burst 可直接發動主要效果（不付費）。citeturn38view2turn10view3turn27view6  

#### 範例：ST01-015「ホワイトベース」（BASE，含 配備時、啟動·主要、Turn 1/回合一次、②費用寫法）

官方卡表顯示：Lv3、Cost2、Blue、BASE、HP5；【バースト：配備此卡】、【配備時：自己護盾 1 張加入手牌】、【起動・メイン・ターン1回・②：依我方 UNIT 數量配備對應 UNIT TOKEN】。此卡同時展示了「啟動型效果條件/費用寫法（②）」與「依場面狀態分支生成 token」。citeturn38view3turn17view0turn27view4  

#### 範例：GD02-001「サイコ・ガンダム」（UNIT，含《突破3》與特殊條件常時/誘發）

官方卡表顯示：Lv6、Cost4、Blue、UNIT、AP4、HP5，具《突破3》；並有「セット中・〔強化人間〕パイロット」條件下的效果：我方〔ティターンズ〕ユニット以傷害破壞敵方護盾區卡時，此卡回復 2；官方 Q&A 指出「破壞基地或護盾都算」。citeturn46view0turn35view0turn27view5  

---

## 多角色 LLM 設計與提示詞模板

### 角色分工總覽與置信度介面

本節將多角色拆分成「可被測試與仲裁」的小型專家。每個角色輸出都必須附帶 `confidence`（0~1）與 `uncertainty_reasons[]`，並把「不確定」落到具體原因（資訊缺失、卡效解析不完整、對手資訊不完全、規則衝突等）。這讓上層仲裁器能做保守決策：在低信心時偏向「只做強合法、低風險」行動，並可請求額外工具（如重新解析場面或查詢官方 FAQ）。citeturn17view1turn13view0turn30view0  

| 角色 | 核心責任 | 主要輸入 | 主要輸出（JSON） | 置信度基準 |
|---|---|---|---|---|
| 遊戲狀態解析器 | 把人類描述/對局紀錄/畫面文字轉為結構化 GameState 或 Delta | raw_log、OCR/文字、上次 GameState | `parsed_state`, `diff`, `missing_fields` | 資訊完整度與一致性（區域張數、卡號、活躍/休息）citeturn13view0turn49view0 |
| 規則裁判 | 檢查動作合法性與時窗（主要/瞬動/阻擋等） | GameState、candidate_action | `legality`, `violations`, `rule_refs` | 能否映射到明確規則條文citeturn18view1turn17view1 |
| 卡效推理器 | 將卡文/已編譯 DSL 與當前事件佇列做可執行推論；處理誘發序/爆發優先 | GameState、stack/queue、card_text/DSL | `resolved_events`, `next_prompts` | 是否需依賴「不確定文本解析」citeturn16view2turn10view3 |
| 策略規劃師 | 給出本回合與多回合計畫（攻守節奏、資源曲線、勝利條件路徑） | GameState（含隱資訊摘要） | `plan`, `goals`, `lines` | 對牌序/護盾未知的敏感度 |
| 對手模型師 | 以公開資訊建立對手手牌/護盾/牌型分布（belief）與威脅清單 | 觀測到的卡、回合行為、系列/顏色 | `belief_state`, `likely_responses` | 資料量（已見卡比例）與可解釋性 |
| 戰術枚舉/評估器 | 在「合法動作集合」上做局部評分（即時交換、保護基地、逼爆發） | legal_actions[], GameState | `scored_actions` | 是否涵蓋所有高影響招（漏招則降分） |
| 動作選擇器 | 綜合規則/卡效/策略/對手模型，選定最終動作並產生稽核理由 | 上述角色輸出 + legal_actions | `chosen_action`, `why`, `risk` | 與規則裁判一致性 > 策略偏好 |

---

### 通用上下文片段（所有提示詞共用）

為避免每個提示詞重複貼上整份規則，建議把「可機械化的規則要點」以短摘要放入 `COMMON_RULE_DIGEST`（由官方條文萃取），並在系統層保證這段摘要來自已驗證的規則版本（例如綜合規則 Ver.1.5.0，最後更新日 2026/1/30）。citeturn15view1turn29view0  

`COMMON_RULE_DIGEST` 應至少包含：回合階段與瞬動步驟優先權、攻擊對象限制、護盾/基地傷害規則、爆發時機、誘發結算序（回合玩家先/爆發優先/新誘發插隊）、Lv/費用與能源限制、超額處理不算破壞、護盾最上方選取規則。citeturn49view0turn18view1turn16view2turn15view0turn13view2turn48view5  

---

### 角色提示詞模板與範例輸入輸出

下面每個模板都以 zh‑TW 撰寫，並用 JSON Schema（簡化版）規定輸出。所有模板都假設「規則引擎已提供 legal_actions」，LLM 僅在該集合內選擇；若 LLM 判斷 legal_actions 缺漏，必須回報 `needs_reenumeration=true`，交由引擎重算。

#### 遊戲狀態解析器提示詞

**Token 上限建議**：輸入 6k、輸出 1.2k（解析器偏長輸入）。  

**System（模板）**
```text
你是「Gundam GCG 對局狀態解析器」。你的任務是把使用者提供的對局文字紀錄/口述，轉成結構化 JSON。
嚴格禁止臆測未知資訊：不知道就標記 missing。
輸出必須符合 JSON Schema，且只輸出 JSON（無多餘文字）。
```

**User（模板）**
```text
[COMMON_RULE_DIGEST 已在系統端提供，這裡不重複]

請解析以下對局描述為 GameStateDelta（相對於 last_state），並回報缺漏欄位：
- last_state: <JSON>
- raw_log: <TEXT>

輸出 JSON Schema:
{
  "type":"object",
  "required":["delta","missing_fields","confidence","uncertainty_reasons"],
  "properties":{
    "delta":{"type":"object"},
    "missing_fields":{"type":"array","items":{"type":"string"}},
    "confidence":{"type":"number"},
    "uncertainty_reasons":{"type":"array","items":{"type":"string"}}
  }
}
```

**Example input（節錄）**
```text
last_state: {"turn_player":"P1","phase":"MAIN", ...}
raw_log:
P1 在能源階段放置 1 張能源。
P1 主要階段使用 ST01-001 高達（COST3）配置到戰鬥區，並用 ST01-010 阿姆羅・雷 搭乘它。
```

**Example output（示意）**
```json
{
  "delta":{
    "phase":"MAIN",
    "players":{
      "P1":{
        "energy":{"add_from_resource_deck":1},
        "battlefield":{"deploy_unit":[{"card_no":"ST01-001","instance_id":"u1"}]},
        "attach_pilot":[{"pilot_card_no":"ST01-010","to_unit_instance_id":"u1"}]
      }
    }
  },
  "missing_fields":["P1.hand_after","P1.energy_active_count_after","P1.resource_deck_top_unknown"],
  "confidence":0.86,
  "uncertainty_reasons":["未提供手牌與能源活躍/休息具體狀態，只能確認發生了配置與搭乘行為"]
}
```

#### 規則裁判提示詞

**Token 上限建議**：輸入 3k、輸出 900。  

**System（模板）**
```text
你是「Gundam GCG 規則裁判」。你只做合法性判定與引用規則依據，不做策略建議。
你必須假設綜合規則與官方Q&A為準；卡牌文字可優先於綜合規則。
輸出必須是 JSON，且必須指出違規原因或通過理由。
```

**User（模板）**
```text
請判定 candidate_action 是否在當前時點合法。
- game_state: <JSON>
- candidate_action: <JSON>  // 由規則引擎或策略模組提出
- current_window: {"phase": "...", "step": "...", "priority_player": "P1|P2"}

輸出 JSON Schema:
{
  "type":"object",
  "required":["is_legal","violations","required_costs","rule_refs","confidence","uncertainty_reasons"],
  "properties":{
    "is_legal":{"type":"boolean"},
    "violations":{"type":"array","items":{"type":"string"}},
    "required_costs":{"type":"object"},
    "rule_refs":{"type":"array","items":{"type":"string"}},
    "confidence":{"type":"number"},
    "uncertainty_reasons":{"type":"array","items":{"type":"string"}}
  }
}
```

**Example input（瞬動步驟想用「有駕駛員效果的指令卡」去搭乘）**
```json
{
  "game_state":{"phase":"BATTLE","step":"INSTANT","priority_player":"P2", "...": "..."},
  "candidate_action":{"type":"MOUNT_PILOT_FROM_COMMAND","card_no":"STxx-yyy","target_unit":"u9"},
  "current_window":{"phase":"BATTLE","step":"INSTANT","priority_player":"P2"}
}
```

**Example output（示意，引用官方限制）**
```json
{
  "is_legal": false,
  "violations": [
    "瞬動步驟中不可把具有【駕駛員】效果的指令卡當作駕駛員搭乘"
  ],
  "required_costs": {},
  "rule_refs": [
    "綜合規則 13-2-4-2 / 規則Q&A Q38"
  ],
  "confidence": 0.95,
  "uncertainty_reasons": []
}
```
此裁定依據來自綜合規則對【瞬動】的限制與規則 Q&A。citeturn10view3turn8view0turn27view6  

#### 卡效推理器提示詞

**Token 上限建議**：輸入 4k、輸出 1.2k。  

**System（模板）**
```text
你是「Gundam GCG 卡牌效果推理器」。你會根據：
(1) 已編譯的 effects DSL（若提供）與
(2) 官方卡文原文（raw text）
推導下一步事件佇列、爆發/誘發結算序與狀態變更。
你必須遵守：回合玩家誘發先結算、爆發優先、新誘發插隊優先。
只輸出 JSON。
```

**User（模板）**
```text
- game_state: <JSON>
- event_queue: <JSON>   // 可能含多個同時誘發事件
- effects_dsl: <JSON|null>
- raw_card_texts: <array>  // 需要時提供

請輸出：
{
  "type":"object",
  "required":["resolution_plan","state_mutations","followup_triggers","confidence","uncertainty_reasons"],
  "properties":{
    "resolution_plan":{"type":"array","items":{"type":"string"}},
    "state_mutations":{"type":"array","items":{"type":"object"}},
    "followup_triggers":{"type":"array","items":{"type":"object"}},
    "confidence":{"type":"number"},
    "uncertainty_reasons":{"type":"array","items":{"type":"string"}}
  }
}
```

**Example output（示意：同時爆發兩張護盾、由護盾持有者決定順序的情境）**
```json
{
  "resolution_plan":[
    "先處理爆發事件（爆發優先）",
    "若同時多個爆發，交由護盾持有者決定順序",
    "每結算一個爆發後，檢查是否誘發新事件；若有，新事件插隊優先"
  ],
  "state_mutations":[
    {"move":"shield_top -> reveal -> (optional) burst -> discard", "player":"P2"}
  ],
  "followup_triggers":[],
  "confidence":0.82,
  "uncertainty_reasons":["未提供兩張護盾的實際卡文，只能給出結算序框架"]
}
```
其「爆發優先」「新誘發插隊」「壓制同時破壞 2 護盾時由持有者決定爆發結算順序」等規則依據見綜合規則。citeturn16view2turn10view1turn27view6  

#### 策略規劃師提示詞

**Token 上限建議**：輸入 3k、輸出 1k。  

**System（模板）**
```text
你是「Gundam GCG 策略規劃師」。你在合法行動集合內，產出：
- 本回合目標（攻/守/資源曲線/牌差）
- 1~2 回合的計畫路線（lines）
你必須把不完全資訊（對手手牌/護盾未知）當作風險來源，並做保守/激進分支。
只輸出 JSON。
```

**User（模板）**
```text
- game_state: <JSON>
- legal_actions: <JSON array>
- opponent_belief: <JSON|null>

輸出 JSON Schema:
{
  "type":"object",
  "required":["goals","primary_line","backup_line","key_risks","confidence","uncertainty_reasons"],
  "properties":{
    "goals":{"type":"array","items":{"type":"string"}},
    "primary_line":{"type":"array","items":{"type":"object"}},
    "backup_line":{"type":"array","items":{"type":"object"}},
    "key_risks":{"type":"array","items":{"type":"string"}},
    "confidence":{"type":"number"},
    "uncertainty_reasons":{"type":"array","items":{"type":"string"}}
  }
}
```

**Example output（示意）**
```json
{
  "goals":["本回合建立共鳴機體以取得先手輸出","保留至少1張活躍能源以應對瞬動"],
  "primary_line":[
    {"do":"PLAY_UNIT","card_no":"ST01-001"},
    {"do":"MOUNT_PILOT","card_no":"ST01-010","target":"ST01-001"},
    {"do":"ATTACK_PLAYER","attacker":"ST01-001"}
  ],
  "backup_line":[
    {"do":"PLAY_BASE","card_no":"ST01-015"},
    {"do":"END_MAIN"}
  ],
  "key_risks":["對手瞬動窗可能以指令降低AP或破壞共鳴機體"],
  "confidence":0.74,
  "uncertainty_reasons":["未知對手手牌與護盾爆發內容"]
}
```

#### 對手模型師提示詞

**Token 上限建議**：輸入 3k、輸出 900。  

**System（模板）**
```text
你是「Gundam GCG 對手模型師」。你只能使用公開資訊推測對手未公開資訊的分布（belief）。
你的輸出必須：
- 列出最可能的 3~5 個回應
- 指出推測依據（例如：已見顏色、已打出的卡號、能源張數、節奏）
只輸出 JSON。
```

**User（模板）**
```text
- public_observations: <JSON>
- opponent_series_or_deck_hint: <string|null>
- candidate_threats_catalog: <array>  // 由卡庫提供的常見瞬動/爆發/解場牌

輸出 JSON Schema:
{
  "type":"object",
  "required":["belief_state","top_responses","confidence","uncertainty_reasons"],
  "properties":{
    "belief_state":{"type":"object"},
    "top_responses":{"type":"array","items":{"type":"object"}},
    "confidence":{"type":"number"},
    "uncertainty_reasons":{"type":"array","items":{"type":"string"}}
  }
}
```

**Example output（示意）**
```json
{
  "belief_state":{
    "opponent_colors":["White"],
    "likely_instant_commands":["AP減益型","破壞休息機體型"],
    "shield_burst_rate_estimate":0.25
  },
  "top_responses":[
    {"response":"在戰鬥瞬動步驟使用瞬動指令降低我方攻擊機體AP","prob":0.28},
    {"response":"護盾爆發：把護盾加入手牌以形成牌差","prob":0.18}
  ],
  "confidence":0.55,
  "uncertainty_reasons":["尚未看見對手具體卡號，只能依顏色與節奏作弱推斷"]
}
```

#### 動作選擇器提示詞

**Token 上限建議**：輸入 4k、輸出 1k。  

**System（模板）**
```text
你是「Gundam GCG 動作選擇器」。你必須：
1) 僅能從 legal_actions 中選擇一個動作（或選擇 END_MAIN / PASS）。
2) 你的理由必須引用上游角色輸出（規則裁判/卡效推理/策略規劃/對手模型）。
3) 若上游輸出互相衝突，以規則裁判為最高優先。
4) 以 JSON 輸出，包含：chosen_action、rationale、risk、confidence。
```

**User（模板）**
```text
- game_state: <JSON>
- legal_actions: <array>
- rules_judge: <JSON>
- effect_reasoner: <JSON>
- planner: <JSON>
- opponent_model: <JSON|null>

輸出 JSON Schema:
{
  "type":"object",
  "required":["chosen_action","rationale","risk","contingency","confidence","uncertainty_reasons"],
  "properties":{
    "chosen_action":{"type":"object"},
    "rationale":{"type":"array","items":{"type":"string"}},
    "risk":{"type":"array","items":{"type":"string"}},
    "contingency":{"type":"array","items":{"type":"string"}},
    "confidence":{"type":"number"},
    "uncertainty_reasons":{"type":"array","items":{"type":"string"}}
  }
}
```

**Example output（示意）**
```json
{
  "chosen_action":{"type":"END_MAIN"},
  "rationale":[
    "目前沒有可安全攻擊的共鳴機體；以規則裁判確認攻擊合法但回報高風險",
    "依策略規劃師：保留活躍能源以應對結束階段瞬動更重要"
  ],
  "risk":["可能錯失本回合的破盾節奏"],
  "contingency":["若對手在結束階段瞬動不作為，下回合再展開攻勢"],
  "confidence":0.66,
  "uncertainty_reasons":["對手手牌未知，瞬動反制風險估計不穩定"]
}
```

---

### 角色與提示詞模板對照表

| 角色 | 輸出 JSON 核心欄位 | 必須讀入的上下文 | 常見失敗模式 | 建議防呆 |
|---|---|---|---|---|
| 狀態解析 | `delta/missing_fields` | 區域定義、活躍/休息、卡號 | 擅自補齊未知護盾/手牌 | 嚴格 `missing_fields`；缺資料降信心citeturn13view0turn13view2 |
| 規則裁判 | `is_legal/violations/rule_refs` | 時窗（主要/戰鬥/瞬動）、限制（攻擊對象/搭乘） | 把「可做」誤判為「必做」 | 輸出必含 rule_refs；衝突時走保守citeturn49view0turn10view3 |
| 卡效推理 | `resolution_plan/state_mutations` | 誘發序、爆發優先、新誘發插隊 | 忽略「新誘發插隊」導致錯序 | 事件佇列必須是顯式資料結構citeturn16view2turn17view0 |
| 策略規劃 | `primary_line/backup_line` | 合法行動集合、勝負條件 | 產出非法行動 | 僅能引用 legal_actions 的 action_id |
| 對手模型 | `belief_state/top_responses` | 公開資訊與套牌/顏色線索 | 過度確定推測 | 置信度與理由必填；保留多分支 |
| 動作選擇 | `chosen_action/risk` | 上游所有輸出 | 選擇集合外動作 | 嚴格驗證 action_id；否則要求重枚舉 |

---

## 決策管線與系統設計

### 管線設計理念：規則引擎主導、LLM 可稽核輔助

由於 GCG 的合法性高度依賴時序窗（尤其瞬動交替）與事件結算序（爆發優先/新誘發插隊/回合玩家先），最可靠的工程路線是讓**規則引擎成為唯一「狀態真相來源」**：  
規則引擎負責（1）維護狀態、（2）枚舉合法動作、（3）執行動作並生成觸發事件、（4）依官方順序結算事件並更新狀態；LLM 的所有輸出都只能是「在引擎提供的候選中做選擇」或「對卡文/對手做推理建議」。citeturn49view0turn16view2turn15view0

### 角色互動架構圖

```mermaid
flowchart TD
  A[規則引擎: GameState/合法動作枚舉] --> B[LLM 狀態解析器\n(必要時: 人類輸入/戰報)]
  B --> A
  A --> C[LLM 規則裁判\n合法性複核/引用條文]
  A --> D[LLM 卡效推理器\n事件佇列/爆發/誘發序]
  A --> E[LLM 對手模型師\nbelief 推測]
  A --> F[LLM 策略規劃師\n多回合計畫]
  C --> G[LLM 動作選擇器]
  D --> G
  E --> G
  F --> G
  G --> H{仲裁器/控制器}
  H -->|一致且高信心| A
  H -->|衝突或低信心| I[降級策略:\n保守動作/重新枚舉/要求補資料]
  I --> A
```

### 回合與戰鬥時序的時間線流程圖

下圖把官方規則的「回合階段」與「戰鬥五步驟」合併為可在引擎中實作的狀態機（FSM）。citeturn49view0turn18view1turn5view2turn11view1  

```mermaid
flowchart TD
  S0[起始階段: 啟動步驟\n全體休息->活躍] --> S1[起始階段: 開始步驟\n處理回合開始時效果]
  S1 --> D0[抽卡階段\n抽1張; 若抽後卡組=0則敗北]
  D0 --> R0[能源階段\n放置1張能源(活躍)]
  R0 --> M0[主要階段\n重複: 使用手牌/啟動·主要/攻擊]
  M0 -->|宣告攻擊| B0[戰鬥: 攻擊步驟\n宣告對象+攻擊時效果]
  B0 --> B1[阻擋步驟\n非回合玩家可用阻擋者(至多1次)]
  B1 --> B2[瞬動步驟\n非回合玩家先, 交替行動直到連續讓過]
  B2 --> B3[傷害步驟\n玩家攻擊: 基地>護盾>玩家\n機體攻擊: 同時傷害/先制攻擊]
  B3 --> B4[戰鬥結束步驟\n本次戰鬥中效果失效\n回到主要階段]
  B4 --> M0
  M0 -->|宣告主要階段結束| E0[結束階段: 瞬動步驟\n交替行動直到連續讓過]
  E0 --> E1[結束步驟\n回合結束時效果/修復等]
  E1 --> E2[手牌步驟\n>10則棄到10]
  E2 --> E3[清算步驟\n本回合中效果失效]
  E3 --> N0[回合移交對手]
```

### 仲裁、延遲與錯誤處理

本題假設無嚴格即時限制，但仍建議把一次決策控制在「可互動」的秒級到十秒級。可採以下機制：

仲裁策略建議採「硬規則優先」：若規則裁判判定候選動作非法，該動作直接剔除；若動作合法但卡效推理器指出事件結算存在不確定（例如 DSL 低信心、或需要查官方 FAQ），則優先選擇「不依賴不確定解析」的動作（例如結束主要、部署不涉及複雜觸發的卡、保留能源等待瞬動）。這與官方規則的「必須盡可能處理」相容，但把不確定性外顯化。citeturn16view2turn15view1  

錯誤處理（fallback）至少包含三層：  
第一層：重新請狀態解析器補齊缺欄位（特別是活躍/休息、護盾張數、事件佇列）。citeturn13view0turn18view1  
第二層：重新枚舉合法動作（legal_actions）——因官方規則要求在主要階段只能在「無等待誘發效果」時操作，若引擎漏掉觸發佇列狀態，legal_actions 會錯。citeturn49view0turn16view2  
第三層：最保守動作集（SAFE_SET）：`END_MAIN`、`PASS_INSTANT`、或「不需選擇對象的啟動效果」等；並把 `confidence` 設低，標記需要外部查證（例如對應官方 FAQ）。citeturn17view1turn7view0  

---

## 評估與測試方法：情境庫、指標與自動化單元測試

### 測試情境庫設計

建議把測試分為三個層級，逐層提高複雜度與不完全資訊比重：

第一層為**規則引擎單元測試**：每個測試只驗證一條規則或一個時序窗，例如「攻擊玩家時基地優先」「AP=0 不破盾」「瞬動交替直到連續讓過」「戰鬥區滿 6 超額不算破壞」。citeturn11view1turn28view2turn18view1turn15view0  

第二層為**卡效回歸測試**：以官方卡表頁 + 官方 Q&A/FAQ 為 oracle，測試特定卡的效果解析與裁定一致性。例如：ST01-001 的全體 AP+1 包含自身（官方 Q113）；ST01-011 攻擊時可以選擇活躍能源與 EX 能源（官方 Q142/Q143）；GD02-001 的指定條件觸發包含破壞基地與護盾（官方 Q171）。citeturn35view0turn38view1turn46view0turn7view0  

第三層為**整局/多回合策略測試**：建立固定種子（seed）的牌庫與抽牌序列（或以抽樣近似），比較 AI 對局表現、非法率與解釋品質。在此層可加入「語言版本混用」與「卡套/替代卡」等賽場規則限制的模擬，確保系統在實戰場景可用。citeturn30view0turn29view2turn29view0  

### 指標設計

建議同時追蹤四大類指標：

勝率相關：對固定基準 AI（rule-based bot、隨機 bot、或弱策略 bot）之勝率、平均回合數、平均破盾數/基地破壞數。勝率必須和「非法率」分開看，避免靠 bug 贏。citeturn15view1turn11view1  

合法性相關：非法動作率（應為 0 或趨近 0）、非法動作被裁判攔截率（越高表示仲裁有效，但也表示上游策略常亂提案）、以及「事件結算序錯誤」的回歸率（爆發優先/新誘發插隊/回合玩家先等）。citeturn16view2turn18view1  

效率相關：平均決策時間、P95 決策時間；瞬動步驟內平均回應輪數；以及在「無嚴格即時」前提下仍要避免每回合拖到不可遊玩。citeturn5view2turn27view2  

可解釋性：輸出理由中「引用規則/卡效」比例、「風險與備案」完整度、以及人類審查通過率。由於官方規則對誘發序非常嚴格，能否把「為何現在能/不能做」講清楚，是可用性的核心。citeturn49view0turn16view2  

### 自動化單元測試示例清單（可直接轉成測試用例）

以下以「Given/When/Then」描述（便於轉成程式測試），不展開程式碼：

Given：B 護盾區有基地；When：A 攻擊玩家；Then：傷害先去基地，護盾不受傷害。citeturn11view1turn12view5  

Given：護盾視為 HP1；When：AP=0 攻擊護盾；Then：護盾不破壞（0 傷害不算傷害）。citeturn28view2turn14view5turn13view2  

Given：瞬動步驟；When：P2 行動→P1 行動→P2 讓過→P1 讓過；Then：瞬動步驟結束。citeturn5view2turn27view2  

Given：同時誘發多效果且含爆發；When：結算；Then：爆發優先，且新誘發插隊優先於舊佇列。citeturn16view2turn17view0  

Given：滿 6 機體再配置；When：規則處理超額；Then：被送廢棄區者不算破壞，不觸發【破壞時】。citeturn15view0turn27view4turn10view3  

---

## 範例對局逐回合紀錄：以提示詞驅動的四個完整回合

以下示範一個「最小但規則完整」的對局片段：  
P1 使用 ST01 系列（Gundam/Amuro/White Base/Command），P2 以 ST06-001（具先制攻擊條件）作為示例威脅。示範重點是：能源與 Lv/費用、共鳴機體可在配置回合攻擊、戰鬥瞬動窗、爆發與誘發序。所有「是否合法」以官方回合/戰鬥/瞬動規則為準。citeturn49view0turn18view1turn35view0turn38view0turn46view1  

為節省篇幅，每回合僅展示兩次關鍵決策點（主要階段與戰鬥/結束瞬動），但仍完整涵蓋該回合的階段順序。

### 第一回合：P1

**起始階段**：啟動步驟全體轉活躍；開始步驟處理回合開始時效果。citeturn14view4turn27view0  
**抽卡階段**：抽 1 張。citeturn49view0turn18view0  
**能源階段**：放置 1 張能源（活躍）。citeturn49view0turn28view1  

#### 決策點：主要階段（P1 動作選擇器）

（輸入摘要）P1 手上有：ST01-001（Lv4/Cost3）、ST01-010（Lv4/Cost1，PILOT）、其餘略；P1 能源區目前只有 1 張能源。  

**legal_actions（節錄）**：`PLAY_PILOT(ST01-010, target_unit=none?)`（不合法，駕駛員不能單獨存在戰鬥區）、`END_MAIN`、`PLAY_COMMAND(cost<=1 & lv<=1)`（若手牌有）。  
依規則：「使用手牌」要先確認 Lv（能源數量門檻），再以活躍能源支付費用；目前能源不足以使用 Lv4 卡。citeturn49view0turn48view5turn12view2  

**動作選擇器輸出（示意 JSON）**
```json
{
  "chosen_action":{"type":"END_MAIN"},
  "rationale":[
    "能源僅1張，無法滿足Lv4卡的使用條件（需能源數量>=Lv）",
    "駕駛員不能以非搭乘狀態存在於戰鬥區，因此本回合不強行展開"
  ],
  "risk":["放棄本回合節奏，但屬合法且低風險"],
  "contingency":["下回合能源到2後，優先鋪場或先下基地"],
  "confidence":0.88,
  "uncertainty_reasons":[]
}
```

**結束階段**：先進入結束階段瞬動步驟（雙方可輪流瞬動/啟動·瞬動/讓過），接著回合結束時效果、手牌上限、清算步驟。citeturn18view0turn5view2turn27view2  

---

### 第二回合：P2

P2 起始→抽卡→能源同理。citeturn27view0turn49view0  

#### 決策點：主要階段（P2 展開具共鳴條件的 UNIT）

假設 P2 此時能源達到 3，手上有 ST06-001（Lv5/Cost3）與其指定共鳴駕駛員（略）。由於 Lv5 仍不足（能源僅 3），P2 不能使用該卡；改為配置低 Lv/Cost 的 UNIT 或結束。Lv 條件的檢查是使用手牌流程的一部分。citeturn49view0turn48view5turn46view1  

**動作選擇器（示意）**選擇部署一張 Lv3/Cost2 的 UNIT（假卡），並結束主要階段以進入結束階段瞬動，嘗試保留能源回應。此處略。

---

### 第三回合：P1（示範共鳴機體「配置回合可攻擊」）

假設至此 P1 能源累積到 4（含 EX 能源則更容易），手上仍有 ST01-001（Gundam）與 ST01-010（Amuro）。  

**規則要點**：  
1) 使用手牌流程：公開卡→確認 Lv→選擇活躍能源轉休息付費→使用卡。citeturn49view0turn48view5  
2) 共鳴機體：疊放滿足共鳴條件的駕駛員後，該機體可在配置回合立即攻擊。citeturn12view2turn48view5turn35view0  

#### 決策點：主要階段（P1 連續兩個行動：配置 UNIT + 搭乘 PILOT → 立即攻擊）

**動作選擇器輸出（示意 JSON）**
```json
{
  "chosen_action":{
    "type":"COMPOSITE",
    "steps":[
      {"type":"PLAY_UNIT","card_no":"ST01-001","pay_cost":3},
      {"type":"MOUNT_PILOT","card_no":"ST01-010","target_unit":"ST01-001","pay_cost":1},
      {"type":"ATTACK_PLAYER","attacker":"ST01-001"}
    ]
  },
  "rationale":[
    "ST01-001 需要Lv4且Cost3；目前能源數量>=4且有足夠活躍能源支付",
    "ST01-001 的共鳴條件是「アムロ・レイ」，搭乘 ST01-010 後成為共鳴機體，配置回合可攻擊",
    "攻擊玩家時若對方護盾區有基地則先打基地，否則打最上方護盾"
  ],
  "risk":[
    "進入戰鬥後會開瞬動步驟，非回合玩家先手可能用瞬動指令削弱AP或移除攻擊者"
  ],
  "contingency":[
    "若對手在阻擋步驟以阻擋者改目標，改以交換換取破壞",
    "若瞬動窗遭AP降低，仍可保留後續回合靠修復與基地鋪場"
  ],
  "confidence":0.8,
  "uncertainty_reasons":[
    "未知對手瞬動手牌與護盾爆發內容"
  ]
}
```

此回合的核心合法性依據：共鳴機體配置回合可攻擊（一般機體不行）、攻擊對象限制、以及玩家攻擊時的基地/護盾/玩家判定。citeturn12view2turn18view1turn11view1turn35view0  

#### 戰鬥過程（摘要）

阻擋步驟：若 P2 有活躍阻擋者且 P1 攻擊者不具高機動，P2 可改變攻擊對象；每次攻擊限一次阻擋。citeturn18view1turn10view1  
瞬動步驟：P2 先手，可瞬動/啟動·瞬動/讓過；雙方連續讓過結束。citeturn5view2turn18view1  
傷害步驟：若攻擊玩家成立，依基地>護盾>玩家結算；護盾破壞可爆發。citeturn11view1turn10view3turn13view2  

---

### 第四回合：P2（示範先制攻擊與瞬動互動）

假設 P2 已達成 ST06-001 的條件（「リンク時：若有其他〔クラン〕友軍，本回合獲得《先制攻擊》」）。citeturn46view1turn10view1turn27view6  

#### 決策點：主要階段（P2 宣告攻擊，目標為 P1 的休息機體）

合法性要點：只能攻擊對方玩家或對方休息狀態機體。citeturn18view1turn49view0  

**動作選擇器輸出（示意 JSON）**
```json
{
  "chosen_action":{"type":"ATTACK_UNIT","attacker":"ST06-001","target":"ST01-001"},
  "rationale":[
    "目標ST01-001為休息狀態，符合可被攻擊條件",
    "若本回合已透過リンク時效果取得《先制攻擊》，可在傷害步驟優先造成戰鬥傷害，爭取無反擊破壞"
  ],
  "risk":[
    "戰鬥瞬動步驟由P1先手（非回合玩家先手），可能使用瞬動指令保護或反制"
  ],
  "contingency":[
    "若P1瞬動提高HP或降低我方AP，改為把攻擊轉向玩家破盾（若可行）"
  ],
  "confidence":0.72,
  "uncertainty_reasons":[
    "未知P1是否持有可在瞬動步驟使用的指令"
  ]
}
```

戰鬥中若 ST06-001 具先制攻擊，則其先造成傷害；若先破壞目標，則不受反擊傷害。citeturn10view1turn28view2turn46view1  

---

### 四回合示範小結：AI 系統需要「可稽核」的三條主線能力

第一是**狀態與時窗一致性**：主要階段/戰鬥步驟/瞬動優先權切換，直接決定能否出牌與能否回應。citeturn49view0turn18view1turn5view2  
第二是**結算序正確性**：爆發優先、新誘發插隊、回合玩家先結算，否則同一局面會被算出不同結果。citeturn16view2turn17view0  
第三是**不完全資訊下的保守性**：護盾區內容、對手手牌與能源活躍狀態都會構成反制風險；LLM 必須用置信度把不確定性外顯。citeturn13view2turn30view0turn5view2