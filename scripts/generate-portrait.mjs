#!/usr/bin/env node
/**
 * 定妆照生成：按 analysis.json 的 makeup_profile（最适合该用户的妆容+颜色）给人物上妆、美颜，
 * 并可放进不同场景（樱花树下、影楼、咖啡馆、韩屋…）。
 *
 * 用法：node generate-portrait.mjs --data analysis.json --photo selfie.jpg --out 目录 \
 *        --scene sakura[,studio,cafe,hanok,city] [--count 1]
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
  for (const p of [
    path.join(os.homedir(), ".config/color-report/config.json"),
    path.join(os.homedir(), ".config/exec-headshot/config.json"),
    path.join(os.homedir(), ".config/xhs-cover/config.json"),
  ]) if (fs.existsSync(p)) { const c = JSON.parse(fs.readFileSync(p, "utf8")); if (c.apiKey) return c; }
  throw new Error("未找到图像生成配置");
}

const SCENES = {
  studio:  { name: "影楼定妆照", desc: "clean seamless soft-ivory studio background, even beauty-dish lighting, head-and-shoulders, gentle natural smile — a premium Korean studio beauty portrait (정장 프로필 사진)." },
  sakura:  { name: "樱花树下", desc: "standing under blooming cherry blossom (sakura) trees, soft pink petals and bokeh, gentle spring sunlight, dreamy outdoor portrait, slight breeze in hair." },
  cafe:    { name: "韩系咖啡馆", desc: "sitting in a cozy minimal Korean cafe by a window, warm natural light, soft bokeh of plants and wood interior, lifestyle portrait." },
  hanok:   { name: "韩屋庭院", desc: "in a traditional Korean hanok courtyard, warm wood and paper-door background, soft daylight, elegant editorial portrait." },
  city:    { name: "城市街拍", desc: "stylish city street in soft afternoon light, clean blurred urban background, fashion street-snap portrait." },
  garden:  { name: "花园暖阳", desc: "in a sunlit flower garden with soft warm golden-hour light, blooming pastel flowers bokeh, fresh airy portrait." },
};

function buildPrompt(d, sceneKey) {
  const s = d.season, mk = d.makeup_profile || {};
  const scene = SCENES[sceneKey] || SCENES.studio;
  const lips = (d.beauty?.lipstick || []).map(l => l.name).join("、");
  return `Create a BEAUTIFUL, professionally retouched beauty portrait (정장/화보 사진) of the woman in the input photo, styled with the makeup and colors that best suit her "${s.name} / ${s.en}" personal color.

IDENTITY LOCK: she must clearly be the SAME real person as the input photo — same face shape, eye shape, nose, lips, recognizable to friends. Beautify and apply makeup, do NOT replace her with a different face.

BEAUTY RETOUCH: smooth even glowing skin (keep realistic texture & pores, no plastic skin), brighten complexion, remove blemishes and dark circles, bright clear eyes, tidy glossy hair — high-end Korean studio quality, the most beautiful version of herself.

MAKEUP (matched to her ${s.name} season — warm, fresh, flattering):
· 底妆 base: ${mk.base || "ivory warm, dewy natural skin"}.
· 眼妆 eyes: ${mk.eyeshadow || "warm coral/peach eyeshadow"}, soft and blended.
· 眉 brows: ${mk.brow || "natural warm-brown brows"}.
· 腮红 blush: ${mk.blush || "peach coral blush on the apples of cheeks"}.
· 唇 lips: ${mk.lip || lips || "coral/peach glossy lips"}.
· 发色 hair: ${mk.hair || "warm orange-brown"}.
· 配饰 accessory: ${mk.accessory || "delicate yellow-gold jewelry"}.
She wears a flattering ${(d.palette?.[0]?.name) || "cream"}-toned top.

SCENE: ${scene.desc}
COMPOSITION: front or gentle 3/4 face toward camera, natural confident smile, soft flattering light, shallow depth of field. Photorealistic, magazine-quality. No text, no watermark, no border.`;
}

async function genImage(cfg, photoPath, prompt) {
  const form = new FormData();
  form.append("model", cfg.model);
  form.append("prompt", prompt);
  form.append("size", "1024x1536");
  form.append("image", new Blob([fs.readFileSync(photoPath)], { type: "image/jpeg" }), "photo.jpg");
  const url = `${cfg.baseUrl.replace(/\/+$/, "")}/v1/images/edits`;
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${cfg.apiKey}` }, body: form });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 400 && /size/i.test(text)) { /* retry without size */
      const f2 = new FormData();
      f2.append("model", cfg.model); f2.append("prompt", prompt);
      f2.append("image", new Blob([fs.readFileSync(photoPath)], { type: "image/jpeg" }), "photo.jpg");
      const r2 = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${cfg.apiKey}` }, body: f2 });
      const t2 = await r2.text(); if (!r2.ok) throw new Error(`HTTP ${r2.status}: ${t2.slice(0, 200)}`);
      const it = JSON.parse(t2).data?.[0]; if (it?.b64_json) return Buffer.from(it.b64_json, "base64");
      if (it?.url) return Buffer.from(await (await fetch(it.url)).arrayBuffer());
    }
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const it = JSON.parse(text).data?.[0];
  if (it?.b64_json) return Buffer.from(it.b64_json, "base64");
  if (it?.url) return Buffer.from(await (await fetch(it.url)).arrayBuffer());
  throw new Error("响应无图片");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.data || !args.photo) { console.error("用法：node generate-portrait.mjs --data a.json --photo p.jpg --out 目录 --scene sakura[,studio]"); process.exit(1); }
  const d = JSON.parse(fs.readFileSync(path.resolve(args.data), "utf8"));
  const photo = path.resolve(args.photo);
  const outDir = path.resolve(args.out || path.join(os.homedir(), "Desktop", "色彩报告"));
  fs.mkdirSync(outDir, { recursive: true });
  const scenes = String(args.scene || "studio").split(",").map(s => s.trim()).filter(s => SCENES[s]);
  const count = Math.max(1, Math.min(4, parseInt(args.count || "1", 10)));
  const cfg = loadConfig();
  const results = [];
  for (const sc of scenes) {
    const prompt = buildPrompt(d, sc);
    for (let i = 1; i <= count; i++) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const img = await genImage(cfg, photo, prompt);
          const out = path.join(outDir, `定妆照-${SCENES[sc].name}${count > 1 ? `-v${i}` : ""}.png`);
          fs.writeFileSync(out, img); results.push(out);
          console.error(`✓ ${SCENES[sc].name} 第 ${i} 版`); break;
        } catch (e) { console.error(`${sc} 第${i}版第${attempt}次失败：${e.message}`); if (attempt < 3) await new Promise(r => setTimeout(r, 8000)); }
      }
    }
  }
  if (!results.length) { console.error("全部失败"); process.exit(2); }
  console.log(JSON.stringify({ ok: true, portraits: results }, null, 2));
}
main();
