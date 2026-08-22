// 设计词汇表（lint 白名单）——机器可读的单一事实源。
// 人工版说明见 docs/design-c/DESIGN.md（本地资产）；两处需同步修改。
// 规则：原型与「已收编」屏的源码里出现的类，必须落在下列档位/登记簿内；
// 出现未登记的任意值或档位外 opacity → design:lint 失败。

// ── 严格模式的扫描范围 ──────────────────────────────────────────
// 原型永远严格；strictSrcGlobs 是「已收编」屏的源码，随校准逐屏加入（PR B 起）。
// 首批收编：书列表屏页面 + 该屏渲染路径上的全局组件（Footer/Navbar/ThemeToggle）。
export const strictGlobs = ["../../docs/design-c/prototypes/**/*.html"];
export const strictSrcGlobs = [
  "src/pages/NovelListPage.tsx",
  "src/components/Footer.tsx",
  "src/components/Navbar.tsx",
  "src/components/novel/ThemeToggle.tsx",
];

// ── 只统计、不阻断的范围（存量冻结，供定档观察）────────────────
export const reportGlobs = ["src/**/*.{tsx,ts}"];

// ── 任意值登记簿 ────────────────────────────────────────────────
// Tailwind 任意值语法（[...]）默认一律禁止；确需使用的在此登记并注明用途。
export const allowedArbitrary = new Set([
  "min-h-[100px]", // 书列表虚线卡最小高（tailwind 3.4 无 100px 档）
]);

// ── opacity 档位（按属性族）────────────────────────────────────
// 文本灰度四档 /30 /40 /60 /80；边框允许低档做发丝线；bg/shadow 允许浅色晕染
// 档与表面混合档。档位外（如 /50 /70 /15 /25）在严格范围内即违规。
export const allowedOpacity = {
  text: [30, 40, 60, 80],
  border: [10, 20, 30, 40, 60],
  bg: [5, 10, 20, 60, 70, 80],
  shadow: [5, 10, 20],
  default: [30, 40, 60, 80],
};

// ── 禁用的原生色板（必须用主题语义色 base-/primary-/… 替代）────
export const paletteRegex =
  /^(?:stone|amber|slate|gray|zinc|neutral|red|orange|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|yellow)-\d{2,3}(?:\/\d+)?$/;
