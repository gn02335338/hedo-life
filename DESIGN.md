---
name: "資料科學大戰"
description: "週五讀書會在投影幕前變成一場證據攻防。"
colors:
  night: "#170f21"
  plum: "#26162e"
  edge: "#583d5c"
  pale: "#fff1e2"
  dim: "#ccb7c8"
  paper: "#f7e7ce"
  ink: "#352337"
  coral: "#ff836e"
  dark-coral: "#2f1019"
  gold: "#ffc374"
  slip: "#fff7e9"
  slip-selected: "#ffd0bc"
  paper-focus: "#893e54"
  quiet: "#34223f"
  combat: "#411c2e"
  combat-text: "#ffd3b2"
typography:
  body:
    fontFamily: 'PingFang TC, Noto Sans TC, Microsoft JhengHei, system-ui, sans-serif'
    fontSize: "1rem"
    lineHeight: 1.55
  dialogue:
    fontSize: "clamp(1rem, 1.6vw, 1.25rem)"
    lineHeight: 1.62
  label:
    fontSize: "0.875rem"
  action:
    fontWeight: 800
    lineHeight: 1.4
rounded:
  control: "4px"
  dialog: "8px"
spacing:
  slips-gap: "8px"
  slip-padding: "12px"
  mobile-gutter: "12px"
  wide-gutter: "44px"
components:
  button-primary:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.dark-coral}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0.68rem 1rem"
  button-quiet:
    backgroundColor: "{colors.quiet}"
    textColor: "{colors.pale}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0.68rem 1rem"
  button-combat:
    backgroundColor: "{colors.combat}"
    textColor: "{colors.combat-text}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0.68rem 1rem"
  evidence-slip:
    backgroundColor: "{colors.slip}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "{spacing.slip-padding}"
  evidence-slip-selected:
    backgroundColor: "{colors.slip-selected}"
    textColor: "{colors.ink}"
  restart-dialog:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.pale}"
    rounded: "{rounded.dialog}"
    padding: "25px"
---

# 資料科學大戰

## Overview

**Creative North Star** 「會議投影下的辯論」

這份規格適用於 [《資料科學大戰》](dist/data-science-war/index.html)。會議室插畫延續到對話場景，深紫語框承接人物發言，桌上的米色資料供玩家查證。確認反駁成立時，珊瑚色印記短暫打斷畫面。

## Colors

- 珊瑚色配深酒紅字，用於開始、出示證據和推進。淺金色用於發言者與狀態數字。
- 深紫底用暖白主文字與淡紫輔助文字。米色資料區與象牙白紙條用深紫墨色，選定的紙條加暖粉底與酒紅輪廓。
- 深底使用淺金焦點環，紙面使用酒紅焦點環，兩者皆為 3px 外框與 4px 間距。怒氣同時顯示狀態文字、數值與進度條。

## Typography

繁中內文採無襯線，基準 16px、行高 1.55。桌面對白行高 1.62，手機對白為 0.94rem、行高 1.55。封面以暖白「資料科學」接珊瑚色「大戰」；回合標題與人物對白各有明確層級。怒氣、回合與數值變動使用等寬數字。

## Layout

頁首、主內容與頁尾共用最大 1360px 橫幅。開場的道具桌在左側保留會議室插畫，右側紙本清單列出三樣能立即選取的道具。手機依序顯示進場情境和三個選項。桌面以 1.62:1 排列左側發言和回應、右側會議資料。880px 以下收窄外距與欄距，680px 以下改單欄。手機版出手前依序顯示發言、旁觀反應、答案或資料和操作；出手後先顯示回合結果，再附上會議資料。誤闖開場直接選擇說明來意，再進入標示三題進度的山姆連問，後半段回到會議交鋒。

## Elevation & Depth

以會議室原畫的投影光、底部暗幕和深紫語框分出景深。怒氣升高時，舞台與進度條逐步轉暖。角色變身用 580ms 的亮光與位移，反駁印記用 280ms 的短促入場；兩者遵循減少動態效果偏好。

## Shapes

舞台與對話框用直角細框，證據區、紙條和主要按鈕用 4px 小圓角。重新開會確認框使用 8px 圓角。

## Components

- **證據紙條**保留編號、名稱、摘要與按下狀態。選擇資料後才啟用「推進問題」。回合結果保留當時送出的資料選取狀態。
- **回應按鈕**使用珊瑚色推進或出示證據，沉紫色用於其餘會議回應，酒紅色用於進入戰鬥。
- **會議旁觀**以兩列人物與短句顯示伊森持續唱歌、傑克從偷笑變成緊張。紅酒首次救場的降怒顯示在同一則結果中。
- **回合結果**在深紫底顯示敘事反應、怒氣與會議信用變動，以及下一個操作。答錯或斥責後可在同一個回合先認錯。單挑用確認框說明它會結束會議。

## Do's and Don'ts

- 維持先讀發言、再看資料、最後選擇回應的閱讀順序。
- 搭配文字、數值和選取狀態來呈現進度與回饋。
