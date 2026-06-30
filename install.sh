#!/bin/bash
# AI 个人色彩诊断报告 - Skill 安装脚本（在仓库根目录运行 ./install.sh）

set -e

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

PLATFORM=""
if [ -d "$HOME/.claude/skills" ]; then
  SKILL_DIR="$HOME/.claude/skills/color-report"
  PLATFORM="Claude Code"
elif [ -d "$HOME/.codex" ] || command -v codex &> /dev/null; then
  SKILL_DIR="$HOME/.codex/skills/color-report-skill"
  PLATFORM="Codex"
elif [ -d "$HOME/.openclaw/skills" ]; then
  SKILL_DIR="$HOME/.openclaw/skills/color-report"
  PLATFORM="OpenClaw"
else
  read -r -p "未检测到已知平台，请输入完整安装路径: " SKILL_DIR
  PLATFORM="Custom"
fi
echo "📍 安装到 $SKILL_DIR（$PLATFORM）"

if ! command -v node &> /dev/null; then
  echo "❌ 未检测到 Node.js（需要 >= v18）：https://nodejs.org/"
  exit 1
fi
echo "✓ Node.js $(node -v)"

if [ ! -d "/Applications/Google Chrome.app" ] && [ -z "$CHROME_PATH" ]; then
  echo "⚠️  未检测到 Google Chrome（渲染报告需要），请安装或设置 CHROME_PATH"
fi

mkdir -p "$SKILL_DIR"
rsync -a --delete \
  --exclude .git --exclude .DS_Store --exclude "test-assets/out" \
  "$SRC_DIR/" "$SKILL_DIR/"

echo ""
cat <<'WELCOME'
╭───────────────────────────────────────────────────────────╮
│  🎨  AI 个人色彩诊断 + 形象写真 · 安装完成                  │
╰───────────────────────────────────────────────────────────╯

怎么用：直接发一张自拍，说「帮我做个色彩测试」即可。

你会一次性拿到整套（约 15–25 分钟，陆续发给你）：
  ① 4 页诊断报告  总览 / 季型科学解析 / 上脸对比 / 衣橱配饰
  ② 定妆照 ×3     樱花树下 / 影楼 / 咖啡馆（按你最适合的妆容上妆）
  ③ 韩式证件照 ×2 半身正脸，背景色随你的季型自动匹配

特色：
  • 科学测色（CIELAB / 孟塞尔），不是肉眼猜
  • 只分析不换脸，报告里还是你自己
  • 有线下诊断结果？告诉我，我直接采用并校准

拍照建议：自然光、无重滤镜、素颜或淡妆、头发不挡脸的正面照最准。

环境：
  • Codex —— 零配置，开箱即用（内置生图）
  • Claude Code —— 首次需配一次图像生成 API（已配过 exec-headshot 则自动复用）
WELCOME
echo "✅ 重启后发自拍试试吧！"
