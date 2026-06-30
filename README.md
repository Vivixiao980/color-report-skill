# color-report · AI 个人色彩诊断 + 形象写真 Skill

上传一张自拍 → **科学测色**定四季 12 季型 → 一套韩式诊断书报告 + 定妆照 + 韩式半身证件照。
对标线下 800–2600 元的个人色彩诊断，竖版 3:4，可直接发小红书。

## 能产出什么

| 产物 | 内容 |
|------|------|
| 总览报告 | 季型结论 + 四维量表 + 12 色本命色盘 + 显白/踩雷 + 口红/金属/发色 |
| 季型解析 | 肤色/发瞳/对比三证据 + 12 季型坐标 + 三轴量规（真实 Lab）+ 孟塞尔逻辑 |
| 上脸对比 | 同一张脸 × 本命色 vs 踩雷色，直观显白/显沉 |
| 衣橱配饰 | 配色公式 + 口红/金属/宝石/发色 + 购物关键词 |
| 定妆照 | 按最适合的妆容上妆美颜 + 场景（樱花/影楼/咖啡馆…） |
| 证件照 | 韩式写真馆半身证件照，背景色随季型自动匹配 |

## 三个差异化

1. **科学测色**：不是肉眼猜——采样皮肤像素 → CIELAB → 算冷暖（色相角）/明度/彩度，映射四季 12 型（孟塞尔体系）。
2. **诚实置信度**：暖光自拍会如实下调置信度，并支持录入线下专业诊断结果做校准。
3. **测完给 so what**：不止给标签，给可分享的妆容/穿搭/证件照成品。

## 安装

```bash
./install.sh          # 自动安装到 ~/.claude/skills/color-report
```

依赖：Node ≥ 18；HTML 兜底页需 Google Chrome；测色脚本用到 `sharp`（复用 exec-headshot 的 node_modules，或 `npm i sharp`）。

## 首次配置（图像生成 API）

写 `~/.config/color-report/config.json`：
```json
{ "apiFormat": "images", "apiKey": "sk-...", "baseUrl": "https://你的兼容端点", "model": "gpt-image-2" }
```
已配过 exec-headshot / xhs-cover 的会自动复用，无需重配。没有图像 API 时全程走 HTML 兜底（零成本）。

## 手动跑（开发用）

```bash
# 1. 科学测色
node scripts/analyze-color.mjs --photo selfie.jpg --json

# 2. 生成报告 4 页（生图）
node scripts/generate-report.mjs --data analysis.json --photo selfie.jpg --out out --page p1,p2,p3,p4

# 2b. 或 HTML 兜底
node scripts/render.mjs --data analysis.json --photo selfie.jpg --out out --pages 2,3,4

# 3. 定妆照 + 证件照
node scripts/generate-portrait.mjs --data analysis.json --photo selfie.jpg --out out --scene sakura,studio
node scripts/generate-idphoto.mjs  --data analysis.json --photo selfie.jpg --out out --bg auto --count 2
```

`analysis.json` 的完整 schema 见 [`test-assets/sample-analysis.json`](test-assets/sample-analysis.json)，字段说明见 [`SKILL.md`](SKILL.md)。

## 目录

```
SKILL.md                  # 给 Agent 的完整执行说明（含 onboarding）
assets/seasons.json       # 四季 12 季型知识库（色盘/口红/金属/发色…）
templates/report.html     # HTML 兜底渲染模板
scripts/
  analyze-color.mjs       # 科学测色（CIELAB / 白平衡 / 季型映射）
  generate-report.mjs     # 报告 5 页生图（统一入口）
  generate-portrait.mjs   # 定妆照 + 场景
  generate-idphoto.mjs    # 韩式半身证件照（背景随季型）
  render.mjs              # HTML→Chrome 截图兜底
test-assets/sample-analysis.json  # 脱敏 schema 示例
```

## 隐私

照片只发送给用户自己配置的图像服务，不上传任何第三方。HTML 兜底完全本地、不联网、不重绘人脸。本仓库 `.gitignore` 已排除个人照片与生成结果。

## 调研背景

设计依据 2026 抖音/小红书爆款调研：价格锚点平替、8 合 1 形象分析卡、求 Prompt 裂变、身份保真（只分析不换脸）、测完给 so what。
