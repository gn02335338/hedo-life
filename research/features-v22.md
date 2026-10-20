# e22：猜謎、阿福與前女友

本次新增 20 個原創日常事件：端午猜謎靈感 8 個、阿福 6 個、海倫 6 個。每段有三個選項，包含一個腦洞選項。日常目錄增至 303 個，結局維持 341 種，成就維持 118 枚。

題目改編成同名派工、零人部門、交接接力、飲料暗號、陸上龍舟、綽號、離職月曆與辦公室武學。阿福增加道別點名、撤回預告、午餐氣味、裝水拖延、印表機與資安演練。海倫的故事以產品工作、SQL、開關門、交接期限、離場後責任及帳號權限為主。「前女友」是辦公室比喻，不表示已查證的交往關係。原始文章、題庫、照片與私人來源連結均不在公開專案中。

## 相容與統計

新人生使用 `e22-` 種子，事件要求 `minRules:22`。既有職業抽選、人事優先順序、八階職涯、能力取捨、休息與談薪規則沿用。所有 e21 及更早的存檔保留原事件池與亂數序列；舊 e21 的 341 條自然路線另存為 `tests/fixtures/legacy-e21-routes.json`，包含 14,541 個 JSON 存檔邊界雜湊。

海倫使用穩定 ID `helen`，在角色圖鑑顯示為「前女友／產品開發總監」。她的夢境與現實失控分開結算，沿用既有後續世界線；其餘角色完全委派給原處理流程。角色統計由已結算歷史推導，使用既有追加式資料表，沒有新增個資、存檔欄位或資料庫遷移。阿福的圖鑑補充「桑尼」稱呼，既有 ID `sonny` 不變。

## 驗證

```sh
node tests/find-routes-v3.mjs 5000
npm test
npm run build:check
```

新版自然操作證據位於 `tests/fixtures/chronicle-routes-v22.json`，包含二十段新故事，以及海倫夢境／現實分支。UI 測試涵蓋選前保密、選後明細、角色頭像與互動；Worker／SQLite 測試以自然回放確認同步、重送去重、舊局相容與匿名隔離。

## 原創角色圖

使用內建 imagegen，延續專案動畫畫風，以既有原創角色 `dist/assets/meimei.png` 作畫風參考，沒有使用真人照片。產出為透明背景 PNG，專案檔案為 `dist/assets/helen.png`。

最終生成提示：

> Use case: illustration-story. Create one original fictional character portrait asset for a Taiwan black-comedy office game, adult female product-development director nicknamed Helen. Match the polished colorful 2D anime/Western animation hybrid character-card quality of the supplied style reference, but create an entirely DIFFERENT original person with no resemblance to any real person. Waist-up centered, expressive amber eyes, chunky rounded glasses, violet/plum shoulder-length hair in a high half-bun, confident wry smile, ivory blouse and indigo blazer with a small magenta lapel accent. Holds a rolled product roadmap and a tiny toy sailboat, nod to office-project metaphors; no literal romantic couple or sexual elements. Bold clean ink contours, cel shading, playful exaggerated proportions, vivid flat color, generous safe padding around hair and hands. Transparent background, no text, no logos, no border, no other characters. Make face and silhouette visually distinct from the reference woman with teal hair. Asset will display at 64px avatar through 400px card sizes.
