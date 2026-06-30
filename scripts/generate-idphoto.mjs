#!/usr/bin/env node
/**
 * 韩式形象写真馆证件照（对标「기록가 해빈」等高级 profile studio）。
 * - 背景色按季型自动匹配（暖春→柔暖粉，冷冬→高级灰白…）
 * - 强身份锁定 + 克制美颜（避免把脸带偏成网红脸/偶像脸）
 * - 必须用「原始照片」做身份基准，不要拿已生成的图再改
 *
 * 用法：node generate-idphoto.mjs --data a.json --photo 原始照片.jpg --out 目录 [--bg pink|grey|beige|blue|auto] [--count 2]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function parseArgs(argv){const a={};for(let i=0;i<argv.length;i++){if(argv[i].startsWith("--")){const k=argv[i].slice(2),n=argv[i+1];if(n===undefined||n.startsWith("--"))a[k]=true;else{a[k]=n;i++;}}}return a;}
function loadConfig(){for(const p of [path.join(os.homedir(),".config/color-report/config.json"),path.join(os.homedir(),".config/exec-headshot/config.json"),path.join(os.homedir(),".config/xhs-cover/config.json")])if(fs.existsSync(p)){const c=JSON.parse(fs.readFileSync(p,"utf8"));if(c.apiKey)return c;}throw new Error("未找到图像生成配置");}

// 季型 → 背景色（参考韩国写真馆：暖季柔暖粉/奶杏，冷季高级灰/雾蓝/冷粉）
const SEASON_BG = {
  "light-spring": { name: "柔暖粉", desc: "soft warm peachy-pink seamless backdrop (like #F2DBD2)" },
  "warm-spring":  { name: "奶杏粉", desc: "soft warm apricot-pink seamless backdrop (like #F3DCCB)" },
  "bright-spring":{ name: "珊瑚粉", desc: "soft warm coral-pink seamless backdrop (like #F4D2CB)" },
  "light-summer": { name: "雾感冷粉", desc: "soft cool rose-pink seamless backdrop (like #EFD9DD)" },
  "cool-summer":  { name: "高级雾蓝灰", desc: "soft cool grey-blue seamless backdrop (like #DDE2E8)" },
  "soft-summer":  { name: "莫兰迪灰粉", desc: "muted greyish mauve seamless backdrop (like #E0D7DA)" },
  "soft-autumn":  { name: "奶咖杏", desc: "soft warm beige seamless backdrop (like #E8DCC9)" },
  "warm-autumn":  { name: "暖卡其", desc: "warm camel-beige seamless backdrop (like #E2D2B8)" },
  "deep-autumn":  { name: "暖棕灰", desc: "deep warm taupe seamless backdrop (like #CDBBA6)" },
  "bright-winter":{ name: "冷调浅灰", desc: "clean cool light-grey seamless backdrop (like #E2E4E8)" },
  "cool-winter":  { name: "高级灰白", desc: "clean cool greyish-white seamless backdrop (like #E6E8EC)" },
  "deep-winter":  { name: "冷雾灰", desc: "cool slate-grey seamless backdrop (like #D6D9DE)" },
};
const BG_ALIAS = {
  pink: { name: "柔暖粉", desc: "soft warm peachy-pink seamless backdrop (like #F2DBD2)" },
  grey: { name: "高级灰白", desc: "clean cool greyish-white seamless backdrop (like #E6E8EC)" },
  beige:{ name: "奶咖杏", desc: "soft warm beige seamless backdrop (like #E8DCC9)" },
  blue: { name: "雾蓝灰", desc: "soft cool grey-blue seamless backdrop (like #DDE2E8)" },
};

function buildPrompt(d, bg){
  const s=d.season, mk=d.makeup_profile||{};
  const lips=(d.beauty?.lipstick||[]).map(l=>l.name).join("、");
  return `Create a HIGH-END Korean photo-studio profile portrait (한국 프로필 증명사진, like premium studios "기록가 해빈" / "시현하다") of the person in the input photo. Vertical 3:4, HALF-BODY framing: waist-up, shot from a slight distance (≈85mm look) so the SUBJECT IS SMALLER in the frame with generous space around her — the head occupies only roughly the top 22-28% of the image height, plenty of headroom and breathing room. NOT a tight face crop.

⚠️ IDENTITY IS THE TOP PRIORITY — STRICTLY THE SAME REAL PERSON:
- Reproduce her EXACT face from the input: same face shape & proportions, same eye shape and spacing, same nose, same lips, same eyebrows, same hairline, same smile. A close friend must say "that's clearly her".
- This is a RETOUCH, not a new face. DO NOT slim the face, DO NOT enlarge the eyes, DO NOT make her look like a K-pop idol or a generic pretty Korean girl. Keep her real bone structure and any distinctive features (e.g. cheek shape, dimples).
- Only LIGHT, natural retouching: even skin tone, clear glowing "물광/honey" skin (keep real pores & texture), brighten complexion, remove temporary blemishes & dark circles, tidy stray hair. Keep her actual age and real identity.

STUDIO STYLE (match the references — clean editorial Korean profile photo):
- Seamless solid ${bg.desc}, soft even beauty-dish studio lighting, gentle soft shadows, premium magazine retouch.
- WAIST-UP composition, subject smaller and centered with lots of space around (head ~22-28% of frame height), generous headroom — a real Korean studio profile photo shot from a little distance, NOT a passport-style tight headshot.
- Hair: glossy, voluminous, softly waved and well-groomed (keep her real hair color region natural, can look freshly styled).
- Soft elegant expression, gentle closed-lip smile or serene look, FRONT-FACING; her EYES LOOK DIRECTLY INTO THE CAMERA LENS, making clear eye contact with the viewer (not looking away or down).
- Wears an elegant off-shoulder cream knit or simple refined top; delicate ${mk.accessory||"gold"} jewelry (small earrings + thin necklace).

MAKEUP matched to her "${s.name} / ${s.en}" personal color (soft, fresh, flattering, NOT heavy):
- base: ${mk.base||"dewy natural skin"}; eyes: ${mk.eyeshadow||"soft warm shimmer"}; brows: ${mk.brow||"natural"}; blush: ${mk.blush||"peach"}; lips: ${mk.lip||lips||"coral/peach tinted"}.

Photorealistic, sharp, magazine-quality. No text, no watermark, no border, no logo.`;
}

async function genImage(cfg, photoPath, prompt){
  const form=new FormData();
  form.append("model",cfg.model); form.append("prompt",prompt); form.append("size","1024x1536");
  form.append("image",new Blob([fs.readFileSync(photoPath)],{type:"image/jpeg"}),"photo.jpg");
  const url=`${cfg.baseUrl.replace(/\/+$/,"")}/v1/images/edits`;
  const res=await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${cfg.apiKey}`},body:form});
  const text=await res.text();
  if(!res.ok){
    if(res.status===400&&/size/i.test(text)){const f=new FormData();f.append("model",cfg.model);f.append("prompt",prompt);f.append("image",new Blob([fs.readFileSync(photoPath)],{type:"image/jpeg"}),"photo.jpg");const r=await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${cfg.apiKey}`},body:f});const t=await r.text();if(!r.ok)throw new Error(`HTTP ${r.status}: ${t.slice(0,180)}`);const it=JSON.parse(t).data?.[0];if(it?.b64_json)return Buffer.from(it.b64_json,"base64");if(it?.url)return Buffer.from(await(await fetch(it.url)).arrayBuffer());}
    throw new Error(`HTTP ${res.status}: ${text.slice(0,180)}`);
  }
  const it=JSON.parse(text).data?.[0];
  if(it?.b64_json)return Buffer.from(it.b64_json,"base64");
  if(it?.url)return Buffer.from(await(await fetch(it.url)).arrayBuffer());
  throw new Error("响应无图片");
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  if(!args.data||!args.photo){console.error("用法：node generate-idphoto.mjs --data a.json --photo 原始照片.jpg --out 目录 [--bg auto|pink|grey|beige|blue] [--count 2]");process.exit(1);}
  const d=JSON.parse(fs.readFileSync(path.resolve(args.data),"utf8"));
  const photo=path.resolve(args.photo);
  const outDir=path.resolve(args.out||path.join(os.homedir(),"Desktop","色彩报告"));
  fs.mkdirSync(outDir,{recursive:true});
  const bgKey=args.bg||"auto";
  const bg = bgKey==="auto" ? (SEASON_BG[d.season?.id]||SEASON_BG["light-spring"]) : (BG_ALIAS[bgKey]||SEASON_BG[d.season?.id]||SEASON_BG["light-spring"]);
  const count=Math.max(1,Math.min(4,parseInt(args.count||"2",10)));
  const cfg=loadConfig();
  console.error(`证件照：背景=${bg.name}（${bgKey}）  季型=${d.season?.id}`);
  const prompt=buildPrompt(d,bg);
  const results=[];
  for(let i=1;i<=count;i++){
    for(let attempt=1;attempt<=3;attempt++){
      try{
        const img=await genImage(cfg,photo,prompt);
        const out=path.join(outDir,`证件照-${bg.name}${count>1?`-v${i}`:""}.png`);
        fs.writeFileSync(out,img); results.push(out); console.error(`✓ 第 ${i} 版`); break;
      }catch(e){console.error(`第${i}版第${attempt}次失败：${e.message}`);if(attempt<3)await new Promise(r=>setTimeout(r,8000));}
    }
  }
  if(!results.length){console.error("全部失败");process.exit(2);}
  console.log(JSON.stringify({ok:true,photos:results},null,2));
}
main();
