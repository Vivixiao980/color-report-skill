#!/usr/bin/env node
/**
 * 用图像生成模型（gpt-image-2 / Gemini image，Aigate 等 OpenAI 兼容端点）生成高级感色彩报告。
 * 支持 5 种页面，提示词从 analysis.json 自动拼装，人物适当美颜：
 *   p1  总览诊断书（满版高密度）
 *   p2  季型科学解析（三维度 + 实测色 + 坐标）
 *   p3  上脸对比（同脸 × 本命色/踩雷色）
 *   p4  衣橱配饰清单
 *   id  韩式证件照（按最适合的妆容与颜色，美颜，证件照构图）
 *
 * 用法：node generate-report.mjs --data analysis.json --photo selfie.jpg --out 目录 --page p1[,p2,p3,p4,id] [--count 1] [--beauty strong]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2), n = argv[i + 1];
      if (n === undefined || n.startsWith("--")) a[k] = true; else { a[k] = n; i++; }
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
    if (fs.existsSync(p)) { const c = JSON.parse(fs.readFileSync(p, "utf8")); if (c.apiKey) return { cfg: c, from: p }; }
  }
  throw new Error("未找到图像生成配置（~/.config/color-report/config.json 或 exec-headshot 配置）");
}

const names = arr => arr.map(x => x.name).join("、");

// 统一视觉语言：让 5 张图像一套
const HOUSE_STYLE = `STYLE: high-end Korean personal-color studio "진단서" (diagnosis certificate). Ivory paper background, thin GOLD double-border frame around the whole poster with small ✦ corner ornaments, gold hairline rules between sections, elegant serif + sans mixed Chinese/English typography, soft shadows, refined and EXPENSIVE-looking. Fill the ENTIRE page edge-to-edge, magazine-grade density, visual-first with SHORT LABELS ONLY and no long paragraphs. Theme accent color `;

const BEAUTY = strong =>
  strong === "strong"
    ? `Apply NOTICEABLE but natural beauty retouch: smooth even skin, brighten and lift complexion, remove all blemishes and dark circles, soft glowing "honey skin", refined natural makeup (light peach blush, groomed brows, tinted lips), tidy glossy hair — Korean beauty-studio quality. She must still be clearly the SAME person (keep face shape, eye shape, key features), just her most beautiful version.`
    : `Apply tasteful light retouch: even skin tone, brighten complexion, remove blemishes/dark circles, soft natural makeup, tidy hair. Keep her clearly recognizable — the best version of herself.`;

function prompt_p1(d, beauty) {
  const s = d.season, metrics = d.metrics.map(m => `${m.label}(${m.note})`).join("、");
  return `Create a PREMIUM, INFORMATION-DENSE personal color analysis report poster using this portrait. Vertical poster.
PERSON: the woman in the input photo. ${BEAUTY(beauty)}
DIAGNOSIS: "${s.name} / ${s.en}" — ${s.tags.join(", ")}.
Compose densely, top to bottom:
1. HEADER "PERSONAL COLOR ANALYSIS · 个人色彩诊断书", number "NO. ${d.meta.report_no}".
2. HERO: her retouched portrait in a circular gold-ringed frame; beside it LARGE serif title "${s.name} ${s.en}", subtitle "${s.group_en} TYPE · 四季12型", tags ${s.tags.map(t => `"${t}"`).join(" / ")}, and a small red round "认证 CERTIFIED" seal.
3. FOUR METRIC BARS with slider dots: ${metrics}.
4. BEST PALETTE: 12 named swatches — ${names(d.palette.slice(0, 12))}.
5. TWO LISTS: green "✓ 最显白" (${names(d.ranking.best)}) and red "✕ 最踩雷" (${names(d.ranking.worst)}).
6. BEAUTY ROW: 口红色号(${names(d.beauty.lipstick)}), 首饰金属"${d.beauty.metal.verdict}"(gold coin), 发色(${names(d.beauty.hair_colors)}).
7. FOOTER gold rule + keywords "${s.keywords.join(" · ")}" + "AI PERSONAL COLOR LAB".
${HOUSE_STYLE}${s.accent}.`;
}

function prompt_p2(d, beauty) {
  const s = d.season, m = d.measured || {};
  const labLine = m.skin_lab ? `measured skin ${m.skin_hex} CIELAB L=${m.skin_lab.L} a=${m.skin_lab.a} b=${m.skin_lab.b}, hair ${m.hair_hex}` : "";
  return `Create a PREMIUM "color science explanation" report page (page 2 of a personal color diagnosis) using this portrait. Vertical poster. Make it look scientific yet luxurious — like a lab certificate.
PERSON: the woman in the input photo, shown smaller. ${BEAUTY(beauty)}
TITLE: "为什么你是 ${s.name}? · The Science Behind Your Season".
Show these analysis blocks with elegant data-visual style:
1. THREE EVIDENCE CARDS, each a measured color chip + label + one short line:
   · 肤色基调 Undertone — chip ${d.evidence.skin.hex} — "${d.evidence.skin.label}"
   · 发色瞳色 Hair&Eyes — chips ${d.evidence.hair.hex}/${d.evidence.eye?.hex || d.evidence.hair.hex} — "${d.evidence.hair.label}"
   · 五官对比 Contrast — "${d.evidence.contrast.label}"
2. A 12-SEASON MAP: a square coordinate chart, axes 冷COOL↔暖WARM (x) and 浅LIGHT↔深DEEP (y), 12 small season dots, with a glowing marker labeled "你在这里 YOU" placed in the ${s.group_en} quadrant.
3. THREE measured METRIC GAUGES: 冷暖 Hue, 明度 Value, 彩度 Chroma — shown as elegant dial/bar gauges. ${labLine}
4. A small "诊断逻辑 Munsell 色彩体系" caption: 色相→冷暖, 明度→深浅, 彩度→清浊.
${HOUSE_STYLE}${s.accent}.`;
}

function prompt_p3(d, beauty) {
  const s = d.season, best = d.drape.best.slice(0, 3), worst = d.drape.worst.slice(0, 3);
  return `Create a PREMIUM "color draping test" comparison page (page 3) using this portrait. Vertical poster.
Show the SAME woman's face repeated SIX times in a 3×2 grid, each time wearing/draped in a different solid color background, to prove which colors flatter her. ${BEAUTY(beauty)} Keep it the SAME person in every cell.
TOP ROW = 本命色 (flattering), each cell tagged with a green ✓ and the color name:
  ${best.map(c => `${c.name} ${c.hex}`).join(" / ")} — her complexion looks bright and lifted.
BOTTOM ROW = 踩雷色 (unflattering), each cell tagged with a red ✕ and the color name:
  ${worst.map(c => `${c.name} ${c.hex}`).join(" / ")} — her complexion looks dull and shadowed.
TITLE "上脸实测 · Same Face, Different Colors". Subtle note "数码模拟".
${HOUSE_STYLE}${s.accent}.`;
}

function prompt_p4(d, beauty) {
  const s = d.season;
  const outfits = d.outfits.map(o => `${o.scene}(${o.colors.join("/")})`).join("、");
  return `Create a PREMIUM "wardrobe & accessories" recommendation page (page 4) using this portrait (small, optional). Vertical poster.
TITLE "衣橱公式 & 配饰清单 · Wardrobe Formulas".
Show:
1. THREE OUTFIT COLOR FORMULAS as elegant color-block cards with scene labels: ${outfits}.
2. 口红色号 row (${names(d.beauty.lipstick)}) as lipstick-bullet swatches.
3. 首饰金属 "${d.beauty.metal.verdict}" with a gold coin + gem chips ${names(d.beauty.gems || [])}.
4. 发色 row (${names(d.beauty.hair_colors)}).
5. A 12-color QUICK PALETTE strip at the bottom (${names(d.palette.slice(0, 12))}) labeled "购物速查 Quick Palette".
6. SHOPPING KEYWORDS as elegant tags: ${(d.shopping_keywords || []).slice(0, 8).join(" / ")}.
${HOUSE_STYLE}${s.accent}.`;
}

function prompt_id(d, beauty) {
  const s = d.season;
  const lip = d.beauty.lipstick[0]?.name || "暖珊瑚";
  const top = d.palette[0]?.name || "奶油白";
  return `Create a BEAUTIFUL Korean studio ID photo (한국 증명사진 / 韩式证件照) of the woman in the input photo — the kind taken at premium Seoul photo studios. Vertical 3:4 headshot.
${BEAUTY("strong")}
Style it with the makeup and colors that best suit her "${s.name}" personal color season:
  · Makeup in her season's palette: ${lip} lips, soft ${s.keywords[0]} blush, clean glowing skin, natural defined brows, subtle eye makeup — warm, fresh, flattering.
  · She wears a ${top}-colored top (her most flattering color).
  · Hair neat and glossy.
COMPOSITION: front-facing, looking straight at camera, gentle natural smile, head-and-shoulders, even soft studio lighting, clean seamless light background (soft warm ivory), high-end retouching with realistic skin texture (keep pores, no plastic skin).
IDENTITY LOCK: she must be clearly the SAME real person as the input photo — same face shape, eye shape, nose, lips, recognizable to friends. Beautify, do NOT replace her with a different face. No text, no border, no watermark — just a clean gorgeous ID portrait.`;
}

const BUILDERS = { p1: prompt_p1, p2: prompt_p2, p3: prompt_p3, p4: prompt_p4, id: prompt_id };
const OUTNAME = { p1: "01-总览报告", p2: "02-季型解析", p3: "03-上脸对比", p4: "04-衣橱配饰", id: "05-韩式证件照" };

async function genImage(cfg, photoPath, prompt, size) {
  const form = new FormData();
  form.append("model", cfg.model);
  form.append("prompt", prompt);
  if (size) form.append("size", size);
  form.append("image", new Blob([fs.readFileSync(photoPath)], { type: "image/jpeg" }), "photo.jpg");
  const url = `${cfg.baseUrl.replace(/\/+$/, "")}/v1/images/edits`;
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${cfg.apiKey}` }, body: form });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 400 && /size/i.test(text) && size) return genImage(cfg, photoPath, prompt, null);
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  const item = JSON.parse(text).data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
  throw new Error("响应无图片：" + text.slice(0, 200));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.data || !args.photo || !args.page) {
    console.error("用法：node generate-report.mjs --data a.json --photo p.jpg --out 目录 --page p1[,p2,p3,p4,id] [--count 1] [--beauty strong]");
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(path.resolve(args.data), "utf8"));
  const photo = path.resolve(args.photo);
  const outDir = path.resolve(args.out || path.join(os.homedir(), "Desktop", "色彩报告"));
  fs.mkdirSync(outDir, { recursive: true });
  const pages = String(args.page).split(",").map(s => s.trim()).filter(p => BUILDERS[p]);
  const count = Math.max(1, Math.min(4, parseInt(args.count || "1", 10)));
  const beauty = args.beauty || "strong";
  const { cfg, from } = loadConfig();
  console.error(`配置：${from}（${cfg.model}）  页面：${pages.join(",")}  美颜：${beauty}`);

  const results = [];
  for (const pg of pages) {
    const prompt = BUILDERS[pg](data, beauty);
    for (let i = 1; i <= count; i++) {
      let ok = false;
      for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
        try {
          const img = await genImage(cfg, photo, prompt, "1024x1536");
          const suffix = count > 1 ? `-v${i}` : "";
          const out = path.join(outDir, `${OUTNAME[pg]}${suffix}.png`);
          fs.writeFileSync(out, img);
          results.push(out);
          console.error(`✓ ${pg} 第 ${i} 版`);
          ok = true;
        } catch (e) {
          console.error(`${pg} 第 ${i} 版第 ${attempt} 次失败：${e.message}`);
          if (attempt < 3) await new Promise(r => setTimeout(r, 8000));
        }
      }
    }
  }
  if (!results.length) { console.error("全部失败（图像服务可能不可用）"); process.exit(2); }
  console.log(JSON.stringify({ ok: true, pages: results }, null, 2));
}

main();
