#!/usr/bin/env bash
# client/packaging/build/make_icns.sh
#
# 从源图标重新生成 macOS 的 icon.icns（及配套多尺寸 icon.ico）。
#
# 用法:
#   ./make_icns.sh                    # 内置占位图标（渐变圆角 + 书本）
#   ./make_icns.sh path/to/icon.png   # 用自己的 1024x1024 PNG 源
#   ./make_icns.sh path/to/icon.ico   # 用自己的 ICO 源
#
# 依赖: python3 + Pillow, iconutil（macOS 自带）
#
# 换图标 = 替换生成的 icon.icns / icon.ico 两个文件即可，
# 构建时 build.spec 顶部可配置区引用它们（见 build.spec 顶部注释）。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$HERE/.icns_tmp"
SRC="${1:-}"

# 优先用项目 venv（装有 Pillow），否则回退 python3
if [[ -x "$HERE/../../backend/.venv/bin/python" ]]; then
  PY="$HERE/../../backend/.venv/bin/python"
else
  PY="$(command -v python3)"
fi
"$PY" -c "import PIL" 2>/dev/null || { echo "缺少 Pillow: $PY -m pip install pillow"; exit 1; }

rm -rf "$WORK"
mkdir -p "$WORK"

# ── 1. 准备 1024x1024 源 PNG ────────────────────────────────
if [[ -z "$SRC" ]]; then
  # 内置占位图标：圆角渐变背景 + 打开的书
  "$PY" - "$WORK" <<'PY'
import os, sys
from PIL import Image, ImageDraw
work = sys.argv[1]
S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
# 圆角渐变背景（与加载页配色一致：#1a1a2e → #0f3460）
top, bottom = (26, 26, 46), (15, 52, 96)
for y in range(S):
    t = y / (S - 1)
    col = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    d.line([(0, y), (S, y)], fill=col + (255,))
mask = Image.new("L", (S, S), 0)
dm = ImageDraw.Draw(mask)
dm.rounded_rectangle([0, 0, S - 1, S - 1], radius=180, fill=255)
img.putalpha(mask)
# 打开的书：左右两页 + 书脊
d = ImageDraw.Draw(img)
d.polygon([(360, 430), (512, 486), (512, 724), (360, 668)], fill=(255, 255, 255, 235))
d.polygon([(664, 430), (512, 486), (512, 724), (664, 668)], fill=(255, 255, 255, 235))
for i in range(4):
    y = 500 + i * 48
    d.line([(396, y), (492, y + 34)], fill=(150, 180, 210, 255), width=10)
    d.line([(532, y + 34), (604, y)], fill=(150, 180, 210, 255), width=10)
d.line([(512, 486), (512, 724)], fill=(230, 170, 90, 255), width=16)
img.save(os.path.join(work, "source.png"))
PY
  SRC="$WORK/source.png"
else
  # 自定义源（PNG/ICO）→ 1024 源（取最大帧拉伸）
  "$PY" - "$WORK" "$SRC" <<'PY'
import sys, os
from PIL import Image
work, src = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGBA")
img = img.resize((1024, 1024), Image.LANCZOS)
img.save(os.path.join(work, "source.png"))
PY
  SRC="$WORK/source.png"
fi

# ── 2. 生成 icon.icns（iconutil 要求 iconset 目录命名）──────
ICONSET="$WORK/icon.iconset"
mkdir -p "$ICONSET"
for s in 16 32 128 256 512; do
  sips -z "$s" "$s" "$SRC" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s * 2)) $((s * 2)) "$SRC" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$HERE/icon.icns"

# ── 3. 生成多尺寸 icon.ico（Windows app + 安装器共用）───────
"$PY" - "$SRC" "$HERE/icon.ico" <<'PY'
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGBA")
img.save(dst, sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])
PY

rm -rf "$WORK"
echo "done: $HERE/icon.icns + $HERE/icon.ico"
