#!/usr/bin/env node
/**
 * 科学测色：从照片采样真实像素，计算个人色彩三维度并映射四季 12 型。
 *
 * 原理（孟塞尔 Munsell 色彩体系 → 四季 12 型）：
 *   1. 色相/冷暖 Hue   ← 皮肤在 CIELAB 的 a*(红绿) 与 b*(黄蓝)，黄多=暖、蓝多=冷
 *   2. 明度     Value  ← 皮肤+头发的 L*，整体亮还是暗
 *   3. 彩度/净浊 Chroma ← 皮肤的 C* = √(a*²+b*²)，加上肤-发对比度（清透 vs 柔浊）
 * 输出：三轴 0~1 归一化分值 + 实测色 hex + 最近季型 + 置信度（受光线影响时下调）。
 *
 * 用法：node analyze-color.mjs --photo selfie.jpg [--json]
 * 依赖 sharp（自动探测 exec-headshot / 本 skill 的 node_modules）。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
function loadSharp() {
  const candidates = [
    path.join(os.homedir(), ".claude/skills/exec-headshot/node_modules/sharp"),
    path.join(os.homedir(), "Documents/coding/exec-headshot-skill/node_modules/sharp"),
    "sharp",
  ];
  for (const p of candidates) { try { return require(p); } catch { /* next */ } }
  throw new Error("未找到 sharp。请在 exec-headshot-skill 下 npm install，或全局安装 sharp。");
}

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

// sRGB(0-255) → CIELAB(D65)
function rgb2lab(r, g, b) {
  let R = r / 255, G = g / 255, B = b / 255;
  R = R > 0.04045 ? ((R + 0.055) / 1.055) ** 2.4 : R / 12.92;
  G = G > 0.04045 ? ((G + 0.055) / 1.055) ** 2.4 : G / 12.92;
  B = B > 0.04045 ? ((B + 0.055) / 1.055) ** 2.4 : B / 12.92;
  let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
  let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}
const toHex = (r, g, b) => "#" + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, "0").toUpperCase()).join("");
const clamp01 = x => Math.max(0, Math.min(1, x));
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const clampByte = x => Math.max(0, Math.min(255, x));

// 启发式肤色判定（YCbCr 经验范围，对黄种人放宽）
function isSkin(r, g, b) {
  const Y = 0.299 * r + 0.587 * g + 0.114 * b;
  const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return Y > 70 && Y < 245 && Cb > 95 && Cb < 135 && Cr > 135 && Cr < 180 && r > g && g > b - 12;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.photo) { console.error("用法：node analyze-color.mjs --photo selfie.jpg [--json]"); process.exit(1); }
  const sharp = loadSharp();
  const W = 400;
  const img = sharp(path.resolve(args.photo)).rotate().resize(W, W, { fit: "inside" });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels, w = info.width, h = info.height;

  const skinRaw = [], darkUpper = [], neutralRef = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // 中央区域优先采肤（避开边缘背景）
      const cx = Math.abs(x / w - 0.5), cy = Math.abs(y / h - 0.45);
      if (cx < 0.32 && cy < 0.38 && isSkin(r, g, b)) skinRaw.push([r, g, b]);
      // 上半部最暗像素 → 头发
      if (y < h * 0.5) darkUpper.push([0.299 * r + 0.587 * g + 0.114 * b, r, g, b]);
      // 白平衡参照：高亮 + 低饱和（白衣/眼白/浅灰背景），且未过曝
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx > 0 ? (mx - mn) / mx : 1;
      if (mx > 150 && mx < 250 && sat < 0.16) neutralRef.push([r, g, b, mx]);
    }
  }
  if (skinRaw.length < 50) console.error("肤色像素过少，照片可能光线异常或非正面人像。");

  // ---- 白平衡校正（关键）：用中性参照估计光源偏色，von Kries 法扣除 ----
  // 没有足够中性参照时退回灰世界假设（全图均值 ≈ 灰），弱一些但仍好过不校正。
  let illum, wbMethod;
  if (neutralRef.length >= 80) {
    neutralRef.sort((p, q) => q[3] - p[3]);                 // 按亮度取最亮的一批白参照
    const top = neutralRef.slice(0, Math.max(40, Math.floor(neutralRef.length * 0.3)));
    const m = i => top.reduce((s, v) => s + v[i], 0) / top.length;
    illum = [m(0), m(1), m(2)];
    wbMethod = `白参照(${top.length}px,如白衣/眼白)`;
  } else {
    let sr = 0, sg = 0, sb0 = 0, n = 0;
    for (let i = 0; i < data.length; i += ch) { sr += data[i]; sg += data[i + 1]; sb0 += data[i + 2]; n++; }
    illum = [sr / n, sg / n, sb0 / n];
    wbMethod = "灰世界假设(无明显白参照)";
  }
  // von Kries：以绿通道为锚，把光源 illum 的红/蓝偏色拉成中性（扣掉暖光/冷光的色偏）。
  // 关键教训：参照物（白衣/眼白）往往不是真中性，全量校正会过冲、抹掉真实肤色底色。
  // 故只做「部分校正」——扣 STRENGTH 比例的色偏，宁可欠校正也不要把暖皮测成中性。
  // 真正可靠的校正需要标准灰卡；无灰卡时这里偏保守。
  const STRENGTH = 0.55;
  const partial = ratio => 1 + (ratio - 1) * STRENGTH;
  const wbR = partial(illum[1] / illum[0]), wbB = partial(illum[1] / illum[2]);
  // 曝光归一化：使白参照绿通道亮度 → target≈225（修暖光/欠曝偏暗），同样部分校正、限幅防过冲
  const target = 225;
  const expoScale = clamp(partial(target / illum[1]), 0.7, 1.8);
  const correct = ([r, g, b]) => [clampByte(r * wbR * expoScale), clampByte(g * expoScale), clampByte(b * wbB * expoScale)];

  const skin = skinRaw.map(correct);
  const rawSkinRGB = [0, 1, 2].map(i => skinRaw.reduce((s, v) => s + v[i], 0) / (skinRaw.length || 1));

  // 皮肤：取 L* 中位附近的稳健均值（去掉高光和阴影各 15%）
  // 注意 Lab 的 b* 存为 labB，避免与 RGB 的 b 重名覆盖
  const skinLab = skin.map(([r, g, b]) => { const t = rgb2lab(r, g, b); return { L: t.L, a: t.a, labB: t.b, r, g, b }; });
  skinLab.sort((p, q) => p.L - q.L);
  const lo = Math.floor(skinLab.length * 0.15), hi = Math.ceil(skinLab.length * 0.85);
  const core = skinLab.slice(lo, hi).length ? skinLab.slice(lo, hi) : skinLab;
  const mean = arr => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
  const sL = mean(core.map(p => p.L)), sa = mean(core.map(p => p.a)), sb = mean(core.map(p => p.labB));
  const skinRGB = [mean(core.map(p => p.r)), mean(core.map(p => p.g)), mean(core.map(p => p.b))];

  // 头发：最暗 8% 像素均值（同样做白平衡校正）
  darkUpper.sort((p, q) => p[0] - q[0]);
  const hairPix = darkUpper.slice(0, Math.max(20, Math.floor(darkUpper.length * 0.08)));
  const hairRGB = correct([mean(hairPix.map(p => p[1])), mean(hairPix.map(p => p[2])), mean(hairPix.map(p => p[3]))]);
  const hairLab = rgb2lab(...hairRGB);

  // ---- 三轴打分（采用 CIELAB 标准衍生指标）----
  const skinC = Math.sqrt(sa * sa + sb * sb);              // 彩度 C*ab
  const hab = Math.atan2(sb, sa) * 180 / Math.PI;          // 色相角 h°ab（皮肤约 45~62°）
  // 冷暖：用色相角，黄种人中性点约 51°。>54° 暖（黄金调），<48° 冷（粉蓝调）。
  const warmth = clamp01((hab - 48) / 12);
  // 明度：以皮肤 L* 为主（东亚人头发近黑，不能主导）；L* 约 50(深)~74(浅)。
  const value = clamp01((sL - 50) / 24);
  // 彩度/净浊：直接用皮肤 C*（黄种人约 13~28）；高=清透，低=柔浊。
  const chroma = clamp01((skinC - 13) / 15);
  // 对比度仅作参考输出，不参与季型判定——东亚黑发使其系统性偏高，不可靠。
  const contrast = clamp01((sL - hairLab.L - 25) / 45);

  // ---- 映射四季 12 型 ----
  // 四季 = 冷暖 × 明度；亚型只用「彩度」分清/柔（不用受黑发污染的对比度）。
  const warm = warmth >= 0.5, light = value >= 0.5, clear = chroma >= 0.5;
  let season;
  if (warm && light) season = chroma > 0.62 ? "bright-spring" : (warmth > 0.7 ? "warm-spring" : "light-spring");
  else if (warm && !light) season = chroma > 0.55 ? (value < 0.28 ? "deep-autumn" : "warm-autumn") : "soft-autumn";
  else if (!warm && light) season = chroma > 0.55 ? "light-summer" : (warmth < 0.32 ? "cool-summer" : "soft-summer");
  else season = chroma > 0.55 ? (warmth < 0.3 ? "deep-winter" : "bright-winter") : (warmth < 0.4 ? "cool-summer" : "soft-summer");

  // 光源色偏强度：illum 偏离中性灰的程度（红/蓝相对绿的比值），越大说明原图色偏越重
  const castR = illum[0] / illum[1], castB = illum[2] / illum[1];
  const castStrength = Math.abs(Math.log(castR)) + Math.abs(Math.log(castB)); // 0=无偏色
  const strongCast = castStrength > 0.18 || expoScale > 1.7 || expoScale < 0.72;

  // 置信度：各轴离 0.5 越远越笃定；样本越多越稳；原图色偏越重，校正残差风险越大 → 下调。
  const decisiveness = (Math.abs(warmth - .5) + Math.abs(value - .5) + Math.abs(chroma - .5)) / 1.5;
  const sample = clamp01(skin.length / 4000);
  let confidence = clamp01(0.58 + decisiveness * 0.46 + sample * 0.1 - clamp(castStrength, 0, 0.5) * 0.45);
  if (strongCast) confidence = Math.min(confidence, 0.72);
  if (wbMethod.startsWith("灰世界")) confidence = Math.min(confidence, 0.7); // 无白参照，校正较弱

  const result = {
    white_balance: {
      method: wbMethod,
      illuminant_hex: toHex(...illum),
      cast_strength: +castStrength.toFixed(3),
      exposure_scale: +expoScale.toFixed(2),
      raw_skin_hex: toHex(...rawSkinRGB),
      corrected_skin_hex: toHex(...skinRGB),
    },
    measured: {
      skin_hex: toHex(...skinRGB), skin_lab: { L: +sL.toFixed(1), a: +sa.toFixed(1), b: +sb.toFixed(1) },
      hair_hex: toHex(...hairRGB), hair_lab: { L: +hairLab.L.toFixed(1) },
      skin_chroma: +skinC.toFixed(1), skin_pixels: skin.length,
    },
    axes: {
      warmth: +warmth.toFixed(2), value: +value.toFixed(2),
      chroma: +chroma.toFixed(2), contrast: +contrast.toFixed(2),
    },
    season_id: season,
    confidence: +confidence.toFixed(2),
    strong_cast: strongCast,
    note: strongCast
      ? "原图色偏较重，已做白平衡校正，但残差仍在；强烈建议补一张自然光照片复测。"
      : "已用照片内中性参照做白平衡校正后测色；自然光照片可进一步提升准确度。",
  };

  if (args.json) { console.log(JSON.stringify(result)); return; }
  const wbInfo = result.white_balance;
  console.log("【科学测色结果（已白平衡校正）】");
  console.log(`白平衡    方式=${wbInfo.method}  光源估计=${wbInfo.illuminant_hex}  色偏强度=${wbInfo.cast_strength}  曝光×${wbInfo.exposure_scale}`);
  console.log(`肤色      原始 ${wbInfo.raw_skin_hex}  →  校正后 ${wbInfo.corrected_skin_hex}`);
  console.log(`皮肤实测  ${result.measured.skin_hex}  Lab(L=${result.measured.skin_lab.L} a=${result.measured.skin_lab.a} b=${result.measured.skin_lab.b})  C*=${result.measured.skin_chroma}`);
  console.log(`头发实测  ${result.measured.hair_hex}  L=${result.measured.hair_lab.L}`);
  console.log(`冷暖 ${result.axes.warmth}（>0.5暖） 明度 ${result.axes.value}（>0.5浅） 彩度 ${result.axes.chroma}（>0.5清） 对比 ${result.axes.contrast}`);
  console.log(`→ 季型 ${result.season_id}  置信度 ${result.confidence}${result.strong_cast ? "（原图色偏重，已校正但建议补自然光照）" : ""}`);
}

main().catch(e => { console.error("测色失败：", e.message); process.exit(2); });
