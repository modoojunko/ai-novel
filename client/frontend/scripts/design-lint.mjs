// 设计词汇 lint（design:check 第 0 层）：
//   严格模式（原型 + 已收编屏）出现档位外 opacity / 未登记任意值 / 原生色板 → 退出码 1
//   存量 src 只输出分布统计（冻结观察，供 DESIGN.md 定档），不阻断
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { strictGlobs, strictSrcGlobs, reportGlobs, allowedArbitrary, allowedOpacity, paletteRegex } from "./design-vocab.mjs";

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

// ── 类名提取：抓取源码/HTML 里所有字符串字面量，按空白切分 ──────
function extractTokens(source) {
  const tokens = new Set();
  const re = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/gs;
  let m;
  while ((m = re.exec(source))) {
    for (const t of m[2].split(/\s+/)) {
      if (t && /[a-zA-Z]/.test(t)) tokens.add(t);
    }
  }
  // HTML：class="..." 已被上面覆盖；再兜底扫 class= 属性
  const clsRe = /class\s*=\s*"([^"]*)"/g;
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
  // 2) opacity 档位（先剥 hover:/group-hover:/断点 等变体前缀再判属性族；
  //    w-1/2、w-3/4 等是宽度分数工具类，不是 opacity，跳过）
  const m = token.match(/^(.+?)\/(\d{1,3})$/);
  if (m && !/^(?:[a-zA-Z0-9-]+:)*(?:w|h)-\d+$/.test(m[1])) {
    const base = m[1].replace(/^(?:[a-zA-Z0-9-]+:)+/, "");
    const val = parseInt(m[2], 10);
    const family = OPACITY_PROP_FAMILIES.find((f) => base === f || base.startsWith(f + "-"));
    const allowed = allowedOpacity[family ?? "default"] ?? allowedOpacity.default;
    if (!allowed.includes(val)) {
      problems.push({ kind: "opacity", token, detail: `${family ?? "default"} 档位外 /${val}` });
    }
  }
  // 3) 原生编号色板
  if (paletteRegex.test(token)) {
    problems.push({ kind: "palette", token });
  }
  return problems;
}

// ── 主流程 ──────────────────────────────────────────────────────
const strictFiles = [...strictGlobs, ...strictSrcGlobs].flatMap(collect);
const reportFiles = reportGlobs.flatMap(collect);

const violations = [];
for (const file of strictFiles) {
  const src = readFileSync(file, "utf-8");
  const lines = src.split("\n");
  for (const token of extractTokens(src)) {
    for (const p of checkToken(token)) {
      const line = src.slice(0, src.indexOf(token) + 1).split("\n").length;
      violations.push({ file: path.relative(ROOT, file), line, ...p });
    }
  }
  void lines;
}

// 存量统计（只看分布）
const stats = { opacity: {}, arbitrary: {}, palette: 0 };
for (const file of reportFiles) {
  const src = readFileSync(file, "utf-8");
  for (const token of extractTokens(src)) {
    const m = token.match(/\/(\d{1,3})$/);
    if (m) stats.opacity[m[1]] = (stats.opacity[m[1]] ?? 0) + 1;
    if (/\[[^\]]+\]/.test(token)) stats.arbitrary[token] = (stats.arbitrary[token] ?? 0) + 1;
    if (paletteRegex.test(token)) stats.palette += 1;
  }
}

console.log(`design:lint — 严格扫描 ${strictFiles.length} 个文件，存量统计 ${reportFiles.length} 个文件\n`);
if (violations.length) {
  console.log("✗ 严格范围违规（需改成词汇表档位，或在 scripts/design-vocab.mjs 登记簿登记）：");
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}  [${v.kind}] ${v.token}${v.detail ? " — " + v.detail : ""}`);
  }
}
console.log(`\n存量 src 分布（冻结观察，不阻断）：`);
console.log(`  opacity 档位：${JSON.stringify(Object.fromEntries(Object.entries(stats.opacity).sort((a, b) => b[1] - a[1])))}`);
console.log(`  任意值种类：${Object.keys(stats.arbitrary).length} 种，共 ${Object.values(stats.arbitrary).reduce((a, b) => a + b, 0)} 处`);
console.log(`  原生色板：${stats.palette} 处`);

process.exit(violations.length ? 1 : 0);
