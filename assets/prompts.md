# 生图提示词模板（Codex 内置生图 / 任何原生图像生成环境用）

> 用法：从 `analysis.json` 取值替换 `{{占位符}}`，把照片作为输入图，调用**内置图像生成**直接出图。
> 与 `scripts/generate-*.mjs` 共用同一套提示词——脚本走外部 API，本文件供内置生图用，两条路结果一致。
> 统一约定：竖版 3:4；保持人物为同一真人；除证件照/定妆照外不写错别字、中文标签精简。

共享占位符（来自 analysis.json）：
`{{season.name}}` 季型中文名（如 暖春）、`{{season.en}}`、`{{season.group_en}}`（SPRING/SUMMER/AUTUMN/WINTER）、
`{{season.accent}}` 主题色 hex、`{{season.tags}}`、`{{season.keywords}}`、`{{meta.report_no}}`、
`{{palette12}}` 12 色名、`{{ranking.best}}`/`{{ranking.worst}}`、`{{lipstick}}`、`{{metal.verdict}}`、`{{hair_colors}}`、
`{{measured.skin_hex/skin_lab}}`、`{{makeup_profile.*}}`。

---

## HOUSE STYLE（所有报告页共用的视觉语言）
> high-end Korean personal-color studio "진단서" (diagnosis certificate). Ivory paper background, thin GOLD double-border frame with small ✦ corner ornaments, gold hairline rules, elegant serif + sans mixed Chinese/English typography, soft shadows, refined and EXPENSIVE. Fill the ENTIRE page edge-to-edge, magazine-grade density, visual-first with SHORT LABELS ONLY, no long paragraphs. Theme accent color {{season.accent}}.

## 美颜档（BEAUTY）
- light（报告页默认）：tasteful light retouch — even skin tone, brighten, remove blemishes/dark circles, soft natural makeup, tidy hair. Keep her clearly recognizable.
- strong（定妆照可用）：noticeable natural retouch — glowing "honey skin", refined makeup. **仍须是同一人**：keep face shape, eye shape, key features; NOT a different/idol face.

---

## P1 总览报告
Create a PREMIUM, INFORMATION-DENSE personal color analysis poster using this portrait. Vertical.
PERSON: the woman in the photo. {{BEAUTY:light}} DIAGNOSIS: "{{season.name}} / {{season.en}}" — {{season.tags}}.
Compose densely top→bottom: 1) HEADER "PERSONAL COLOR ANALYSIS · 个人色彩诊断书" + "NO. {{meta.report_no}}". 2) HERO: portrait in circular gold-ring frame; big serif title "{{season.name}} {{season.en}}", subtitle "{{season.group_en}} TYPE · 四季12型", tags {{season.tags}}, a small red round "认证 CERTIFIED" seal. 3) FOUR METRIC BARS with slider dots: 冷暖/明度/净浊/对比. 4) BEST PALETTE 12 named swatches: {{palette12}}. 5) TWO LISTS: green "✓ 最显白" ({{ranking.best}}) and red "✕ 最踩雷" ({{ranking.worst}}). 6) BEAUTY ROW: 口红色号({{lipstick}}), 首饰金属"{{metal.verdict}}"(gold coin), 发色({{hair_colors}}). 7) FOOTER gold rule + keywords "{{season.keywords}}" + "AI PERSONAL COLOR LAB". {{HOUSE_STYLE}}

## P2 季型解析（科学）
Create a PREMIUM "color science" page (page 2) using this portrait (smaller). {{BEAUTY:light}}
TITLE "为什么你是 {{season.name}}? · The Science Behind Your Season".
1) THREE EVIDENCE CARDS (measured color chip + label): 肤色基调 {{evidence.skin.hex}} "{{evidence.skin.label}}"; 发色瞳色 {{evidence.hair.hex}} "{{evidence.hair.label}}"; 五官对比 "{{evidence.contrast.label}}". 2) 12-SEASON MAP: square chart, x=冷COOL↔暖WARM, y=浅LIGHT↔深DEEP, 12 dots, a glowing "你在这里 YOU" marker in the {{season.group_en}} quadrant. 3) THREE measured GAUGES 冷暖/明度/彩度 showing {{measured.skin_hex}} CIELAB L={{measured.skin_lab.L}} a={{measured.skin_lab.a}} b={{measured.skin_lab.b}}. 4) caption "诊断逻辑 Munsell 色彩体系：色相→冷暖, 明度→深浅, 彩度→清浊". {{HOUSE_STYLE}}

## P3 上脸对比
Create a PREMIUM "color draping test" page (page 3). Show the SAME woman's face SIX times in a 3×2 grid, each on a different solid color background. {{BEAUTY:light}} Same person every cell.
TOP ROW 本命色 (green ✓ + name), complexion bright/lifted: {{drape.best 3 个 name+hex}}.
BOTTOM ROW 踩雷色 (red ✕ + name), complexion dull/shadowed: {{drape.worst 3 个 name+hex}}.
TITLE "上脸实测 · Same Face, Different Colors". small note "数码模拟". {{HOUSE_STYLE}}

## P4 衣橱配饰
Create a PREMIUM "wardrobe & accessories" page (page 4). TITLE "衣橱公式 & 配饰清单".
1) THREE OUTFIT COLOR FORMULAS as color-block cards with scene labels: {{outfits}}. 2) 口红色号 row ({{lipstick}}). 3) 首饰金属 "{{metal.verdict}}" + gem chips {{gems}}. 4) 发色 row ({{hair_colors}}). 5) bottom 12-color QUICK PALETTE ({{palette12}}) "购物速查". 6) SHOPPING KEYWORDS tags: {{shopping_keywords}}. {{HOUSE_STYLE}}

---

## 定妆照（场景）
Create a BEAUTIFUL retouched beauty portrait of the woman, styled for her "{{season.name}}" color. Vertical 3:4.
IDENTITY LOCK: clearly the SAME real person — same face/eye/nose/lips, recognizable. Beautify, do NOT replace with a different face. {{BEAUTY:strong}}
MAKEUP (warm/fresh, season-matched): 底妆 {{makeup_profile.base}}; 眼 {{makeup_profile.eyeshadow}}; 眉 {{makeup_profile.brow}}; 腮红 {{makeup_profile.blush}}; 唇 {{makeup_profile.lip}}; 发 {{makeup_profile.hair}}; 配饰 {{makeup_profile.accessory}}. Wears a flattering {{palette[0].name}}-toned top.
SCENE: {{scene}}  — 场景词：
- sakura 樱花树下: under blooming cherry blossoms, soft pink petals & bokeh, gentle spring sunlight.
- studio 影楼: clean seamless soft-ivory studio, even beauty lighting, premium Korean profile.
- cafe 咖啡馆: cozy minimal Korean cafe by a window, warm light, plant/wood bokeh.
- hanok 韩屋 / city 街拍 / garden 花园暖阳（自行展开）.
COMPOSITION: front or gentle 3/4, natural smile, soft light, magazine quality. No text/watermark/border.

## 韩式半身证件照（背景随季型）
Create a HIGH-END Korean photo-studio profile portrait (한국 프로필 증명사진, like 기록가 해빈 / 시현하다). Vertical 3:4, HALF-BODY (waist-up), shot from a slight distance so the subject is SMALLER with generous space — head ≈ top 22-28% of frame, lots of headroom. NOT a tight crop.
⚠️ IDENTITY TOP PRIORITY: reproduce her EXACT face (shape, eyes, nose, lips, brows, smile); a RETOUCH not a new face; DO NOT slim face / enlarge eyes / make her an idol/generic-pretty face. Only LIGHT natural retouch, keep real pores & age.
STUDIO: seamless solid {{背景色 by season}} backdrop, soft even beauty-dish light; glossy voluminous waved hair; FRONT-FACING, eyes looking DIRECTLY INTO the camera lens (eye contact); off-shoulder cream knit; delicate {{makeup_profile.accessory|gold}} jewelry. MAKEUP season-matched soft. No text/watermark/border.

### 季型 → 背景色
- 春(暖)：light-spring 柔暖粉#F2DBD2 / warm-spring 奶杏粉#F3DCCB / bright-spring 珊瑚粉#F4D2CB
- 夏(冷)：light-summer 冷粉#EFD9DD / cool-summer 雾蓝灰#DDE2E8 / soft-summer 莫兰迪灰粉#E0D7DA
- 秋(暖)：soft-autumn 奶咖杏#E8DCC9 / warm-autumn 暖卡其#E2D2B8 / deep-autumn 暖棕灰#CDBBA6
- 冬(冷)：bright-winter 冷浅灰#E2E4E8 / cool-winter 高级灰白#E6E8EC / deep-winter 冷雾灰#D6D9DE
