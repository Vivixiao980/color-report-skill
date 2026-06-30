#!/usr/bin/env node
/**
 * 第一页整页用图像生成模型（gpt-image-2 / Gemini image，Aigate 等 OpenAI 兼容端点）直接生成。
 * 从 analysis.json 自动拼装信息密度拉满的韩式高级色彩报告提示词，人物适当美颜。
 *
 * 用法：node generate-p1.mjs --data analysis.json --photo selfie.jpg --out 输出目录 [--count 2]
 * 配置：自动读取 ~/.config/color-report/config.json，缺失时兜底复用 ~/.config/exec-headshot/config.json。
 *      （apiFormat=images → /v1/images/edits；apiFormat=chat → /v1/chat/completions 带 image_url）
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2), n = argv[i + 1];
      if (n === undefined || n.startsWith("--")) a[k] = true;
      else { a[k] = n; i++; }
    }
  }
  return a;
}

function loadConfig() {
  const candidates = [
    path.join(os.homedir(), ".config/color-report/config.json"),
    path.join(os.homedir(), ".config/exec-headshot/config.json"),
    path.join(os.homedir(), ".config/xhs-cover/config.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const c = JSON.parse(fs.readFileSync(p, "utf8"));
      if (c.apiKey) return { cfg: c, from: p };
    }
  }
  throw new Error("未找到图像生成配置（~/.config/color-report/config.json 或 exec-headshot 配置）");
}

function buildPrompt(d) {
  const s = d.season;
  const names = arr => arr.map(x => x.name).join("、");
  const metrics = d.metrics.map(m => `${m.label}(${m.note})`).join("、");
  return `Create a PREMIUM, INFORMATION-DENSE personal color analysis report poster using this portrait — in the polished style of a high-end Korean personal color consulting studio (퍼스널컬러 진단서) final certificate. Vertical poster, FILL THE ENTIRE PAGE edge to edge with content, no empty space, magazine-grade density and refinement.

PERSON: Use the woman in the input photo. Keep her identity and face shape clearly recognizable, but apply TASTEFUL light beautification — even skin tone, brighten complexion, remove blemishes and dark circles, soft natural makeup, tidy hair — a professional studio retouch. The best version of herself, still obviously the same person.

DIAGNOSIS RESULT: "${s.name} / ${s.en}" — ${s.tags.join(", ")}.

Compose these sections densely on an ivory paper background, with a thin GOLD DOUBLE-BORDER frame around the whole poster, gold hairline rules between sections, small ✦ corner ornaments, and elegant serif + sans typography mixing Chinese and small English labels:

1. HEADER: "PERSONAL COLOR ANALYSIS · 个人色彩诊断书", small report number "NO. ${d.meta.report_no}".
2. HERO: her retouched portrait in a circular gold-ringed frame; beside it a LARGE serif title "${s.name} ${s.en}", subtitle "${s.group_en} TYPE · 四季12型", and the tags ${s.tags.map(t => `"${t}"`).join(" / ")}. Add a small red round "认证 CERTIFIED" seal stamp.
3. FOUR METRIC BARS with sliding dots, Chinese labels: ${metrics}. Each a gradient track with a marker dot.
4. BEST PALETTE: a grid of 12 named color swatches — ${names(d.palette.slice(0, 12))} — soft tones matching the season, each with a tiny name label below.
5. TWO RANKED LISTS side by side: green "✓ 最显白" (${names(d.ranking.best)}) and red "✕ 最踩雷" (${names(d.ranking.worst)}), each row a small color chip + name.
6. BEAUTY ROW: three mini panels — 口红色号 (${d.beauty.lipstick.length} warm lipstick swatches: ${names(d.beauty.lipstick)}), 首饰金属 "${d.beauty.metal.verdict}" (a metal coin), 发色 (${d.beauty.hair_colors.length} hair-color swatches: ${names(d.beauty.hair_colors)}).
7. FOOTER: a thin gold rule with the keyword strip "${s.keywords.join(" · ")}" and small text "AI PERSONAL COLOR LAB".

Style: refined, expensive, certificate-like, abundant small elegant detail, soft shadows, gold accents, theme color ${s.accent}. Visual-first, SHORT LABELS ONLY, no long paragraphs. Every region filled, nothing sparse.`;
}

const SIZE_MAP = { "3:4": "1024x1536", "2:3": "1024x1536", "4:5": "1024x1536", "1:1": "1024x1024" };

async function genImages(cfg, photoPath, prompt, size) {
  const buf = fs.readFileSync(photoPath);
  const form = new FormData();
  form.append("model", cfg.model);
  form.append("prompt", prompt);
  if (size) form.append("size", size);
  form.append("image", new Blob([buf], { type: "image/jpeg" }), "photo.jpg");
  const url = `${cfg.baseUrl.replace(/\/+$/, "")}/v1/images/edits`;
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${cfg.apiKey}` }, body: form });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 400 && /size/i.test(text) && size) return genImages(cfg, photoPath, prompt, null);
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const item = JSON.parse(text).data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
  throw new Error("响应中无图片：" + text.slice(0, 200));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.data || !args.photo) {
    console.error("用法：node generate-p1.mjs --data analysis.json --photo selfie.jpg --out 目录 [--count 2]");
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(path.resolve(args.data), "utf8"));
  const photo = path.resolve(args.photo);
  const outDir = path.resolve(args.out || path.join(os.homedir(), "Desktop", "色彩报告"));
  fs.mkdirSync(outDir, { recursive: true });
  const count = Math.max(1, Math.min(4, parseInt(args.count || "1", 10)));
  const { cfg, from } = loadConfig();
  const prompt = buildPrompt(data);
  console.error(`使用配置：${from}（${cfg.model}）`);

  const results = [];
  for (let i = 1; i <= count; i++) {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const img = await genImages(cfg, photo, prompt, SIZE_MAP[args["aspect-ratio"] || "3:4"]);
        const suffix = count > 1 ? `-v${i}` : "";
        const out = path.join(outDir, `01-总览报告${suffix}.png`);
        fs.writeFileSync(out, img);
        results.push(out);
        console.error(`✓ 第 ${i} 版已保存`);
        break;
      } catch (e) {
        lastErr = e;
        console.error(`第 ${i} 版第 ${attempt} 次失败：${e.message}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 8000));
      }
    }
    if (results.length < i) console.error(`第 ${i} 版放弃：${lastErr?.message}`);
  }
  if (!results.length) { console.error("全部失败（图像服务可能不可用）"); process.exit(2); }
  console.log(JSON.stringify({ ok: true, pages: results }, null, 2));
}

main();
