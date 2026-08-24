// 设计词汇 lint（design:lint）：S端 src 全量严格模式——
//   出现档位外 opacity / 未登记任意值 / 原生色板 / 裸 hex·rgb /
//   emoji / daisyUI 语义类回归 → 退出码 1
// 移植自 C端 client/frontend/scripts/design-lint.mjs；
// S端 无一对一原型与像素 parity 层，严格范围即全部 src。
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import {
  strictGlobs, strictSrcGlobs, reportGlobs,
  allowedArbitrary, allowedOpacity, paletteRegex,
  hexRegex, rgbRegex, emojiRegex, bannedDaisyRegex,
} from "./design-vocab.mjs";

const ROOT = path.resolve(process.cwd());

// ── 文件收集 ────────────────────────────────────────────────────
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function collect(glob) {
  // 支持两种形状：精确文件路径（无通配）、<dir>/**/*[…ext]
  if (!glob.includes("*")) {
    const f = path.resolve(ROOT, glob);
    return existsSync(f) ? [f] : [];
  }
  const [dirPart, extPart] = glob.split("/**/");
  const dir = path.resolve(ROOT, dirPart);
  if (!existsSync(dir)) return [];
  let exts = null;
  if (extPart && extPart !== "*") {
    const m = extPart.match(/^\*\.\{?(.+?)\}?$/);
    if (!m) throw new Error(`不支持的 glob: ${glob}`);
    exts = m[1].split(",").map((e) => e.trim().replace(/^\./, ""));
  }
  return walk(dir).filter((f) => !exts || exts.some((e) => f.endsWith("." + e)));
}

// ── 类名提取 ────────────────────────────────────────────────────
//   vue/ts：抓所有字符串字面量（模板属性值同样是带引号字符串，
//   Tailwind 类藏在其中）；class= 属性兜底
//   html（原型）：只抓 class="…" 属性 —— 原型内联 JS 的数组下标/选择器
//   不是类名，字符串字面量扫描会把它们误报成任意值
function extractTokens(source, isHtml = false) {
  const tokens = new Set();
  if (!isHtml) {
    const re = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/gs;
    let m;
    while ((m = re.exec(source))) {
      for (const t of m[2].split(/\s+/)) {
        if (t && /[a-zA-Z]/.test(t)) tokens.add(t);
      }
    }
  }
  // class= 属性兜底（html 主路径 / vue-ts 无害）
  const clsRe = /class\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = clsRe.exec(source))) {
    for (const t of m[1].split(/\s+/)) {
      if (t) tokens.add(t);
    }
  }
  return [...tokens];
}

// ── 检查 ────────────────────────────────────────────────────────
const OPACITY_PROP_FAMILIES = [
  "text", "bg", "border", "shadow", "divide", "ring", "from", "via", "to",
  "outline", "decoration", "placeholder", "accent", "caret", "fill", "stroke",
];

function checkToken(token) {
  const problems = [];
  // 1) 任意值 [..]（bracket 不在首位的才是类；首位是属性选择器字符串如 [data-state]）
  const bracketAt = token.indexOf("[");
  if (bracketAt > 0 && token.includes("]") && !allowedArbitrary.has(token)) {
    problems.push({ kind: "arbitrary", token });
  }
  // 2) opacity 档位（先剥变体前缀/前导负号再判属性族；
  //    top-1/2、-translate-y-1/2、w-3/4 等是位置/尺寸分数工具类，不是 opacity，跳过）
  const m = token.match(/^(.+?)\/(\d{1,3})$/);
  if (m) {
    const base = m[1].replace(/^(?:[a-zA-Z0-9-]+:)+/, "").replace(/^-/, "");
    const isPosUtil = /^(?:(?:w|h|basis|top|left|right|bottom|inset)-\d+|translate-[xy]-\d+)$/.test(base);
    if (!isPosUtil) {
      const val = parseInt(m[2], 10);
      const family = OPACITY_PROP_FAMILIES.find((f) => base === f || base.startsWith(f + "-"));
      const allowed = allowedOpacity[family ?? "default"] ?? allowedOpacity.default;
      if (!allowed.includes(val)) {
        problems.push({ kind: "opacity", token, detail: `${family ?? "default"} 档位外 /${val}` });
      }
    }
  }
  // 3) 原生编号色板
  if (paletteRegex.test(token)) {
    problems.push({ kind: "palette", token });
  }
  // 4) daisyUI 语义类回归（token 级全词匹配）
  if (bannedDaisyRegex.test(token)) {
    problems.push({ kind: "daisy", token });
  }
  return problems;
}

// 文本级检查（不按类名拆分）：裸 hex/rgb 色值、emoji 字符
function checkText(source) {
  const problems = [];
  if (hexRegex.test(source)) problems.push({ kind: "hex", token: "裸 hex 色值" });
  if (rgbRegex.test(source)) problems.push({ kind: "rgb", token: "rgb()/rgba() 色值" });
  if (emojiRegex.test(source)) problems.push({ kind: "emoji", token: "emoji 字符" });
  return problems;
}

// ── 主流程 ──────────────────────────────────────────────────────
const strictFiles = [...strictGlobs, ...strictSrcGlobs].flatMap(collect);
const reportFiles = reportGlobs.flatMap(collect);

const violations = [];
for (const file of strictFiles) {
  const src = readFileSync(file, "utf-8");
  for (const token of extractTokens(src, file.endsWith(".html"))) {
    for (const p of checkToken(token)) {
      const line = src.slice(0, src.indexOf(token) + 1).split("\n").length;
      violations.push({ file: path.relative(ROOT, file), line, ...p });
    }
  }
  for (const p of checkText(src)) {
    violations.push({ file: path.relative(ROOT, file), line: 1, ...p });
  }
}

// 存量统计（只看分布）
const stats = { opacity: {}, arbitrary: {}, palette: 0, daisy: 0, hex: 0, rgb: 0, emoji: 0 };
for (const file of reportFiles) {
  const src = readFileSync(file, "utf-8");
  for (const token of extractTokens(src)) {
    const m = token.match(/\/(\d{1,3})$/);
    if (m) stats.opacity[m[1]] = (stats.opacity[m[1]] ?? 0) + 1;
    if (/\[[^\]]+\]/.test(token)) stats.arbitrary[token] = (stats.arbitrary[token] ?? 0) + 1;
    if (paletteRegex.test(token)) stats.palette += 1;
    if (bannedDaisyRegex.test(token)) stats.daisy += 1;
  }
  if (hexRegex.test(src)) stats.hex += 1;
  if (rgbRegex.test(src)) stats.rgb += 1;
  if (emojiRegex.test(src)) stats.emoji += 1;
}

console.log(`design:lint — 严格扫描 ${strictFiles.length} 个文件，存量统计 ${reportFiles.length} 个文件\n`);
if (violations.length) {
  console.log("✗ 严格范围违规（需改成词汇表档位，或在 scripts/design-vocab.mjs 登记簿登记）：");
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}  [${v.kind}] ${v.token}${v.detail ? " — " + v.detail : ""}`);
  }
}
if (reportFiles.length) {
  console.log(`\n存量 src 分布（冻结观察，不阻断）：`);
  console.log(`  opacity 档位：${JSON.stringify(Object.fromEntries(Object.entries(stats.opacity).sort((a, b) => b[1] - a[1])))}`);
  console.log(`  任意值种类：${Object.keys(stats.arbitrary).length} 种，共 ${Object.values(stats.arbitrary).reduce((a, b) => a + b, 0)} 处`);
  console.log(`  原生色板：${stats.palette} 处；daisyUI 类：${stats.daisy} 处；裸 hex：${stats.hex} 文件；rgb：${stats.rgb} 文件；emoji：${stats.emoji} 文件`);
}

process.exit(violations.length ? 1 : 0);
