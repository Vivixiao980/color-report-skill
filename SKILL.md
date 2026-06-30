---
name: color-report
description: >
  AI 个人色彩诊断 + 形象写真。用户上传一张自拍 → 科学测色（CIELAB/孟塞尔）定四季 12 季型 →
  生成一套高质感韩式诊断书报告（总览/季型解析/上脸对比/衣橱配饰），并可加生成定妆照、
  韩式半身证件照（背景色随季型）。竖版 3:4，可直接发小红书。
  Triggers: "色彩测试", "个人色彩", "色彩诊断", "测色", "四季型", "季型",
  "冷暖皮", "测冷暖皮", "本命色", "适合什么颜色", "显白颜色", "定妆照", "证件照",
  "形象诊断", "personal color", "color analysis"。
  Also trigger when user uploads a selfie and asks what colors / styles
  suit them, or mentions 穿搭配色 / 口红色号 / 染发颜色 / 韩式证件照 by face.
metadata:
  openclaw:
    requires:
      bins:
        - node
    primaryEnv: COLOR_REPORT_API_KEY
    emoji: "🎨"
---

# AI 个人色彩诊断 + 形象写真

用户上传一张自拍 → 科学测色定季型 → 输出一套对标线下 800–2600 元韩式色彩诊断的成品：

| 产物 | 内容 | 出图方式 |
|------|------|---------|
| P1 总览报告 | 季型大结论 + 四维量表 + 12 色本命色盘 + 显白/踩雷 TOP3 + 口红/金属/发色 | 生图（满版高密度） |
| P2 季型解析 | 肤色/发瞳/对比三证据 + 12 季型坐标 + 三轴量规（**真实 Lab 数值**）+ 孟塞尔逻辑 | 生图（科学诊断书感） |
| P3 上脸对比 | 同一张脸 × 3 本命色 vs 3 踩雷色，✓/✕ | 生图，或 HTML 原脸合成 |
| P4 衣橱配饰 | 3 套配色公式 + 口红/金属/宝石/发色 + 购物关键词 + 速查条 | 生图 |
| 定妆照（可选） | 按最适合的妆容上妆美颜 + 场景（樱花/影楼/咖啡馆/韩屋…） | 生图 |
| 证件照（可选） | 韩式写真馆半身证件照，**背景色随季型自动匹配** | 生图 |

**核心卖点**：① **科学测色**——不是肉眼猜，而是采样像素转 CIELAB 算冷暖/明度/彩度（别家没有）；
② **诚实置信度** + 允许录入线下诊断结果校准；③ 测完给一整套「so what」可分享卡。

---

## 0. Onboarding（首次使用，给用户的话术）

触发后若 `~/.config/color-report/config.json` 和 `~/.config/exec-headshot/config.json` 都不存在，先引导配置图像生成 API：

> 🎨 欢迎使用 AI 个人色彩诊断！
> 上传一张自拍，我会帮你科学测出四季季型，并生成一套韩式诊断书报告 + 定妆照 + 证件照。
> 首次使用需要配置一次图像生成 API（用来出图），之后每次直接发照片就行。
> 你的照片只发给你自己配置的图像服务，不上传到任何第三方。

用 AskUserQuestion 让用户选 API 来源，然后 Write 到 `~/.config/color-report/config.json`：

```json
{
  "apiFormat": "images",
  "apiKey": "sk-...",
  "baseUrl": "https://你的兼容端点",
  "model": "gpt-image-2"
}
```

- **gpt-image-2 / 第三方 Images 端点**（推荐，中文渲染稳）：`apiFormat: "images"`，调 `/v1/images/edits`
- **Gemini / Chat 端点**：暂用 HTML 兜底（见下），或扩展脚本支持 chat 格式
- 写入后 `mkdir -p ~/.config/color-report && chmod 600` 该文件
- **已配过 exec-headshot / xhs-cover 的用户无需重配**——脚本会自动兜底复用那套 Aigate 配置

> 没有图像 API 也能用：跳过 onboarding，全程走 HTML 兜底（零成本、文字精确，见 Step 3 备选）。

---

## 路径约定

- **已安装（Claude Code）**：`~/.claude/skills/color-report`
- **本地开发**：`~/Documents/coding/color-report-skill`

后续 `${SKILL_DIR}` 指此目录。前置依赖：Node ≥ 18；HTML 兜底页需本机有 Google Chrome（`analyze-color.mjs` 复用 exec-headshot 的 sharp）。

---

## 执行流程

### Step 1：收集照片
一张人像（绝对路径，JPG/PNG/WebP/HEIC）。建议：自然光、无重滤镜、素颜或淡妆、头发不挡脸的正面照。多张时选光线最自然的做主图，其余交叉验证。
> HEIC 先转码：`sips -s format jpeg in.HEIC --out out.jpg`

### Step 2：科学测色 + 人工校验（核心）

**先跑测色脚本**（产品「科学性」的底座）：
```bash
node ${SKILL_DIR}/scripts/analyze-color.mjs --photo /路径/照片.jpg --json
```
采样皮肤/头发像素 → **白平衡部分校正**（去暖光/冷光色偏）→ CIELAB → 算 **冷暖(色相角)/明度/彩度/对比** 四轴 + 实测肤色 hex/Lab + 最近季型 + 置信度。原理：孟塞尔体系（色相→冷暖、明度→深浅、彩度→清浊）映射四季 12 型。

**再用 Read 看图复核**（机器受光线影响，必须人眼对账）：
1. **照片质量**：暖光/绿光偏色、滤镜、带妆 → 影响置信度。脚本 `strong_cast` 为 true 或暖光自拍 → 置信度压到 0.7 以下，`photo_quality_note` 写明并建议补自然光照。
2. **机器 vs 人眼分歧**：暖光常把人测得偏暖偏深。分歧时**不要默默二选一**，把分歧+光线原因如实告诉用户，用 AskUserQuestion 让用户定。
3. **⭐ 用户有线下诊断结果时，直接采纳，不让算法覆盖它**。照片算法 < 标准光下的专业实测——这是诚实，也是产品可信度。可把诊断师给的妆容/色号写进 `makeup_profile`。
4. **定季型**：以测色为基线、人眼校验后定；对照 `${SKILL_DIR}/assets/seasons.json` 取该型 12 维数据。
5. 把实测 `skin_hex/skin_lab/hair_hex` 填进 analysis.json 的 `measured` 字段（P2 会显示真实 Lab）。

> ⚠️ 白平衡陷阱（实战教训）：不要拿「白衣服/不确定的白物」当中性参照做全量校正——衣服常是暖米白，会把真实暖意一起扣掉，把暖皮测成中性。脚本已改为**部分校正**（55%）；真正可靠的校正需要标准灰卡。

### Step 3：写 analysis.json 并出图

以 `${SKILL_DIR}/test-assets/sample-analysis.json` 为 schema 范例，结合 seasons.json 生成个性化 JSON：
- **直接复用季型数据**：palette(12)、avoid、lipstick、metal、gems、hair、keywords、accent
- **个性化改写（禁止套话，结合照片实际特征）**：season.summary、evidence.*、myth、ranking、drape、outfits(3)、shopping_keywords(8)
- metrics 固定 4 条；meta.report_no=`VC-日期`

**出图（默认全生图，5 页统一韩式诊断书视觉）**：
```bash
node ${SKILL_DIR}/scripts/generate-report.mjs \
  --data analysis.json --photo 照片.jpg --out ~/Desktop/色彩报告/昵称 \
  --page p1,p2,p3,p4 --count 1 --beauty strong
```
提示词从 analysis.json 自动拼装；配置自动读 color-report → 兜底 exec-headshot。一张约 1–3 分钟、按张计费、2:3≈3:4。

**HTML 兜底（图像服务宕机 / 想零成本精确文字）**：
```bash
node ${SKILL_DIR}/scripts/render.mjs --data analysis.json --photo 照片.jpg --out 目录 --pages 2,3,4
```
P3 的 HTML 版用**原脸 CSS 合成**（脸不被重绘，可信度卖点）。`face_crop` 控制圆形头像取景（cy≈鼻尖偏上，zoom≈0.65÷脸高占比）。

### Step 4：自检（必做，最多迭代 2 轮）
Read 看 P1 + P3：①人物是否还像本人、美颜没过度、文字无乱码、季型名对、满版无空白 ②不满意重跑（生图每次不同，`--count 2` 多挑）。
**硬性标准**（用户明确要求）：3:4、撑满无大块留白、五页风格统一、信息密度宁多勿少、人物适当美颜但仍是本人。

### Step 5：可选加料 + 交付

**定妆照**（按最适合妆容上妆 + 场景）：
```bash
node ${SKILL_DIR}/scripts/generate-portrait.mjs --data analysis.json --photo 原始照片.jpg \
  --out 目录 --scene sakura,studio,cafe   # 可选 hanok/city/garden
```

**韩式半身证件照**（背景色随季型）：
```bash
node ${SKILL_DIR}/scripts/generate-idphoto.mjs --data analysis.json --photo 原始照片.jpg \
  --out 目录 --bg auto --count 2          # 或 --bg pink/grey/beige/blue
```
> ⚠️ 证件照/定妆照必须用**原始照片**做身份基准，别拿已生成的图再改。提示词已内置强身份锁定 + 克制美颜（禁止瘦脸/放大眼/idol 化）+ 半身正脸 + 眼睛看镜头。

**交付**：Read 展示成品；给 3–5 句口头总结（季型 + 2 个穿衣结论 + 1 个踩雷）；附一段可直接发的小红书文案（标题 + 话题 #我的四季型Note #色彩测试 #个人形象）。

---

## 修改 / 追问处理
- **换照片重测**：重走 Step 2–5；两次季型不一致就如实解释（光线差异），以质量好的为准。
- **「不准 / 我是 XX 型」**：不硬辩，重看照片解释依据；用户给新信息（如有线下诊断）→ 直接采纳，调季型重出。
- **「只要第 X 页 / 改个色」**：改 analysis.json，`--page`/`--pages` 重出。
- **「证件照换背景 / 不像我 / 要半身」**：调 `generate-idphoto.mjs` 的 `--bg` 或提示词；不像→加强身份锁定、降美颜、用原图。
- **男性用户**：lipstick 改唇部护理/气色，outfits 改通勤/休闲/正装，shopping 用男装品类。

## 注意事项
- 分析基于照片实际特征，**置信度要诚实**——和「随便套模板」拉开差距的关键。
- 屏幕颜色受设备影响，不承诺医学/专业级准确；P3 标注「数码模拟」。
- 照片只发给用户自己配置的图像服务，不上传第三方；HTML 页不联网、不重绘人脸。
