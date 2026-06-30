#!/usr/bin/env node
/**
 * 一键生成完整交付物（默认）：4 页诊断报告 + 定妆照(多场景) + 韩式半身证件照。
 * 串行调用 generate-report / generate-portrait / generate-idphoto，单步失败不影响其余。
 *
 * 用法：node generate-all.mjs --data analysis.json --photo 原始照片.jpg --out 目录 \
 *        [--scenes sakura,studio,cafe] [--idcount 2] [--beauty strong] [--skip report,portrait,idphoto]
 *
 * 注：仅用于无内置生图的环境（Claude Code）。Codex 等有内置生图的环境改读 assets/prompts.md 直接出图。
 */
import { spawn } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
function parseArgs(argv){const a={};for(let i=0;i<argv.length;i++){if(argv[i].startsWith("--")){const k=argv[i].slice(2),n=argv[i+1];if(n===undefined||n.startsWith("--"))a[k]=true;else{a[k]=n;i++;}}}return a;}

function run(script, args){
  return new Promise(res=>{
    const p=spawn("node",[join(SCRIPTS,script),...args],{stdio:"inherit"});
    p.on("exit",code=>res(code===0));
    p.on("error",()=>res(false));
  });
}

async function main(){
  const a=parseArgs(process.argv.slice(2));
  if(!a.data||!a.photo){console.error("用法：node generate-all.mjs --data a.json --photo 照片.jpg --out 目录 [--scenes sakura,studio,cafe] [--idcount 2]");process.exit(1);}
  const data=resolve(a.data), photo=resolve(a.photo);
  const out=resolve(a.out||join(os.homedir(),"Desktop","色彩报告"));
  const scenes=a.scenes||"sakura,studio,cafe";
  const idcount=a.idcount||"2";
  const beauty=a.beauty||"strong";
  const skip=String(a.skip||"").split(",");

  const common=["--data",data,"--photo",photo,"--out",out];
  const done=[];

  if(!skip.includes("report")){
    console.error("\n▶ [1/3] 生成 4 页诊断报告 ...");
    done.push(["报告4页", await run("generate-report.mjs",[...common,"--page","p1,p2,p3,p4","--count","1","--beauty",beauty])]);
  }
  if(!skip.includes("portrait")){
    console.error(`\n▶ [2/3] 生成定妆照（场景：${scenes}）...`);
    done.push(["定妆照", await run("generate-portrait.mjs",[...common,"--scene",scenes])]);
  }
  if(!skip.includes("idphoto")){
    console.error(`\n▶ [3/3] 生成韩式半身证件照（${idcount} 版）...`);
    done.push(["证件照", await run("generate-idphoto.mjs",[...common,"--bg","auto","--count",idcount])]);
  }

  console.error("\n=== 完成情况 ===");
  for(const [name,ok] of done) console.error(`  ${ok?"✓":"✗"} ${name}`);
  console.error(`输出目录：${out}`);
  if(done.some(([,ok])=>!ok)) console.error("（部分失败——多为图像服务临时不可用，可对失败项单独重跑）");
}
main();
