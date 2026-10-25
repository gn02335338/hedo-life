# 五位新同事的動畫頭像

使用內建 `imagegen` 製作，再以 Sharp 縮圖、保留透明背景並轉為 WebP。照片只取髮型與衣著線索，五官為原創動畫設計；原始照片沒有加入公開專案。風格參考既有的愛麗絲頭像，使用深藍輪廓、暖色膚色與平面賽璐璐陰影。

| 角色 | 遊戲檔案 |
| --- | --- |
| 紅酒 | `dist/assets/avatars-v74/wine.webp` |
| p神 | `dist/assets/avatars-v74/peter.webp` |
| 8+9 | `dist/assets/avatars-v74/tony.webp` |
| 老大 | `dist/assets/avatars-v74/henry.webp` |
| 米雅 | `dist/assets/avatars-v74/mia.webp` |

尺寸、檔案大小與 SHA-256 見 [頭像清單](portraits-v74.json)。五張圖均已檢查人物數量、手部、透明背景與商標文字。

## 共用提示詞

每次各產生一位角色，第一張參考為使用者私下提供的照片，第二張為現有愛麗絲動畫頭像。共用提示詞後接下方各角色的描述。

```text
Use case: illustration-story. Asset: transparent character portrait for a Traditional Chinese fictional office-comedy game. Match the SECOND reference strictly for visual style only: bold very dark navy outlines, warm skin, clean flat two-tone cel shading, angular expressive anime-comic features, lively yet professional cartoon proportions, no photorealistic texture. FIRST reference is only loose adult hair/clothing inspiration. Invent clearly different cartoon facial proportions; do not trace the real person's face. Centered waist-up cutout, entire head and shoulders comfortably inside frame, consistent scale and line weight with the style reference. Exactly one adult person, two arms and two hands with correct anatomy, no extra hands or floating limbs. Genuine transparent background. No text, labels, logos, watermarks, brands, borders or scenery. Original neutral friendly office character; no allegations or personal life depicted.
```

## 各角色描述

紅酒：

```text
Adult man, short side-parted black hair, oversized rounded rectangular dark glasses, pale pink short-sleeve button-up shirt. Confident tired half-smile. Hold a small unbranded plain blue energy-drink can in one hand and an orderly server-maintenance notebook in the other. Face is fully invented and highly animated.
```

p神：

```text
Adult slim man, tousled short dark-brown hair, large rectangular dark glasses, charcoal crew-neck shirt and teal office lanyard with blank badge. Playful raised eyebrow, relaxed gentle grin. Hold a compact game controller with both hands at waist height. Friendly exaggerated cartoon face, no provocative gesture.
```

8+9：

```text
Adult slim man with short upward-swept black hair, rectangular glasses, navy casual T-shirt. Energetic skeptical grin. One hand holds a paper breakfast bag with no writing, other hand a small closed travel mug. Clearly fictional comedic anime face. No cigarette, no smoke, no street background.
```

後續依使用者要求，使用內建 imagegen 把早餐紙袋改成手持香菸，其餘造型保留。最終遊戲檔案採用這個版本，編修提示詞如下：

```text
Edit this existing cartoon portrait. Change ONLY the raised hand on the viewer's left and the brown paper breakfast bag it holds: replace the paper bag with one small unbranded white cigarette with a tan filter, held naturally between two fingers, with a subtle wisp of smoke. The character is an adult. Adjust that hand's finger pose cleanly, with exactly five fingers and no extra hand. Preserve the entire rest of the image exactly: invented adult face, glasses, short spiky hair, navy T-shirt, expressive grin, the travel mug and the other hand on the viewer's right, waist-up framing, bold navy outlines, warm flat cel-shading, proportions and genuine transparent background. No lettering, brand, scenery or extra objects.
```

老大：

```text
Adult broad-built man, short neatly brushed dark hair, large genial expressive eyebrows, gray professional casual polo with subdued red shoulder panels. Affable seasoned technical manager. One hand holds a plain dark-blue technical folder, the other open palm explaining a system design. Fully original anime cartoon face, no beverage.
```

米雅：

```text
Adult woman with shoulder-length side-parted dark brown hair, navy button-up blouse and a glimpse of ivory trousers. Warm friendly confident smile. One hand holds a slim onboarding clipboard with blank colored tabs, the other hand makes a small welcoming open-palm gesture. Fully original expressive anime face. Modest everyday professional clothing, no glamour styling or sexualization.
```
