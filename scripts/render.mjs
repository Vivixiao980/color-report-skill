#!/usr/bin/env node
/**
 * color-report renderer
 * 用法：node render.mjs --data analysis.json --photo selfie.jpg --out 输出目录 [--pages 1,2,3,4]
 * 将分析 JSON + 用户照片注入 HTML 模板，用无头 Chrome 截图为 1080×1440 PNG。
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ].filter(Boolean);
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error("找不到 Chrome/Chromium，请安装 Google Chrome 或设置 CHROME_PATH 环境变量");
}

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const PAGE_NAMES = {
  1: "01-总览报告",
  2: "02-季型解析",
  3: "03-上脸对比",
  4: "04-衣橱配饰",
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.data || !args.photo) {
    console.error("用法：node render.mjs --data analysis.json --photo selfie.jpg --out 输出目录 [--pages 1,2,3,4]");
    process.exit(1);
  }

  const dataPath = resolve(args.data);
  const photoPath = resolve(args.photo);
  const outDir = resolve(args.out || join(os.homedir(), "Desktop", "色彩报告"));
  const pages = String(args.pages || "1,2,3,4").split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => n >= 1 && n <= 4);

  const data = JSON.parse(readFileSync(dataPath, "utf8"));
  const mime = MIME[extname(photoPath).toLowerCase()];
  if (!mime) throw new Error(`不支持的图片格式：${photoPath}（支持 jpg/png/webp）`);
  const photoUri = `data:${mime};base64,${readFileSync(photoPath).toString("base64")}`;

  let html = readFileSync(join(SKILL_DIR, "templates", "report.html"), "utf8");
  html = html.replace("__DATA_JSON__", () => JSON.stringify(data)).replace(/__PHOTO_DATAURI__/g, () => photoUri);

  const workDir = join(os.tmpdir(), `color-report-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  const htmlPath = join(workDir, "report.html");
  writeFileSync(htmlPath, html);

  const chrome = findChrome();
  const results = [];
  for (const page of pages) {
    const outPath = join(outDir, `${PAGE_NAMES[page]}.png`);
    rmSync(outPath, { force: true }); // 旧文件会让「文件大小稳定」判定提前触发
    await screenshot(chrome, htmlPath, page, outPath, join(workDir, `chrome-profile-${page}`));
    results.push(outPath);
  }

  console.log(JSON.stringify({ ok: true, html: htmlPath, pages: results }, null, 2));
}

/** 启动无头 Chrome 截图；文件落盘且大小稳定后立刻 kill（部分环境下 Chrome 截图后不会自行退出）。 */
function screenshot(chrome, htmlPath, page, outPath, profileDir) {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(chrome, [
      "--headless=new",
      `--screenshot=${outPath}`,
      "--window-size=1080,1440",
      "--force-device-scale-factor=1",
      "--hide-scrollbars",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profileDir}`,
      `file://${htmlPath}?page=${page}`,
    ], { stdio: "ignore" });

    const deadline = Date.now() + 45000;
    let lastSize = -1;
    const timer = setInterval(() => {
      let size = -1;
      try {
        size = statSync(outPath).size;
      } catch { /* 文件还没生成 */ }
      if (size > 0 && size === lastSize) {
        clearInterval(timer);
        proc.kill("SIGKILL");
        resolvePromise();
        return;
      }
      lastSize = size;
      if (Date.now() > deadline) {
        clearInterval(timer);
        proc.kill("SIGKILL");
        reject(new Error(`第 ${page} 页截图超时`));
      }
    }, 300);

    proc.on("exit", () => {
      clearInterval(timer);
      if (existsSync(outPath)) resolvePromise();
      else reject(new Error(`第 ${page} 页截图失败（Chrome 提前退出）`));
    });
  });
}

main();
