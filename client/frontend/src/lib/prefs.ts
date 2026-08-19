/**
 * 本地偏好（localStorage，设备级）：
 * - 归档 AI 摘要开关（默认开；关闭后归档用正文前 200 字降级摘要，不消耗 AI 额度）
 * - 归档 AI 摘要首次提示（会员第一次归档前弹「将消耗 AI 额度」提示）
 */

const KEY_AI_SUMMARY = "pref.archive_ai_summary";
const KEY_NOTICE_SHOWN = "pref.archive_notice_shown";

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
