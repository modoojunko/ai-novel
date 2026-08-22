/**
 * 本地偏好（localStorage，设备级）：
 * - 默认字号/行距（全局写作偏好：新建章节正文的排版基线）
 * - 归档 AI 摘要开关（默认开；关闭后归档用正文前 200 字降级摘要，不消耗 AI 额度）
 * - 归档 AI 摘要首次提示（会员第一次归档前弹「将消耗 AI 额度」提示）
 */

const KEY_AI_SUMMARY = "pref.archive_ai_summary";
const KEY_NOTICE_SHOWN = "pref.archive_notice_shown";
const KEY_FONT_SIZE = "pref.default_font_size";
const KEY_LINE_HEIGHT = "pref.default_line_height";

export type FontSizePref = "fs-s" | "fs-m" | "fs-l";
export type LineHeightPref = "lh-tight" | "lh-comfy" | "lh-loose";

export function getDefaultFontSize(): FontSizePref {
  try {
    const v = localStorage.getItem(KEY_FONT_SIZE);
    return v === "fs-s" || v === "fs-l" ? v : "fs-m";
  } catch {
    return "fs-m";
  }
}

export function setDefaultFontSize(v: FontSizePref) {
  try {
    localStorage.setItem(KEY_FONT_SIZE, v);
  } catch {
    // 忽略
  }
}

export function getDefaultLineHeight(): LineHeightPref {
  try {
    const v = localStorage.getItem(KEY_LINE_HEIGHT);
    return v === "lh-tight" || v === "lh-loose" ? v : "lh-comfy";
  } catch {
    return "lh-comfy";
  }
}

export function setDefaultLineHeight(v: LineHeightPref) {
  try {
    localStorage.setItem(KEY_LINE_HEIGHT, v);
  } catch {
    // 忽略
  }
}

export function getArchiveAiSummaryEnabled(): boolean {
  try {
    return localStorage.getItem(KEY_AI_SUMMARY) !== "off";
  } catch {
    return true;
  }
}

export function setArchiveAiSummaryEnabled(enabled: boolean) {
  try {
    localStorage.setItem(KEY_AI_SUMMARY, enabled ? "on" : "off");
  } catch {
    // localStorage 不可用（隐私模式等）：保持默认开
  }
}

export function isArchiveNoticeShown(): boolean {
  try {
    return localStorage.getItem(KEY_NOTICE_SHOWN) === "1";
  } catch {
    return true; // 读不到就不再打扰
  }
}

export function markArchiveNoticeShown() {
  try {
    localStorage.setItem(KEY_NOTICE_SHOWN, "1");
  } catch {
    // 忽略
  }
}
