import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getArchiveAiSummaryEnabled,
  setArchiveAiSummaryEnabled,
  isArchiveNoticeShown,
  markArchiveNoticeShown,
} from "@/lib/prefs";

describe("lib/prefs — 归档 AI 摘要本地偏好", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("默认开启 AI 摘要", () => {
    expect(getArchiveAiSummaryEnabled()).toBe(true);
  });

  it("关闭后读取为 false 并持久化", () => {
    setArchiveAiSummaryEnabled(false);
    expect(getArchiveAiSummaryEnabled()).toBe(false);
    expect(localStorage.getItem("pref.archive_ai_summary")).toBe("off");
  });

  it("重新打开后恢复 true", () => {
    setArchiveAiSummaryEnabled(false);
    setArchiveAiSummaryEnabled(true);
    expect(getArchiveAiSummaryEnabled()).toBe(true);
  });

  it("首次提示默认未展示，标记后为已展示", () => {
    expect(isArchiveNoticeShown()).toBe(false);
    markArchiveNoticeShown();
    expect(isArchiveNoticeShown()).toBe(true);
    expect(localStorage.getItem("pref.archive_notice_shown")).toBe("1");
  });

  it("localStorage 抛错时不炸（降级为默认值）", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => setArchiveAiSummaryEnabled(false)).not.toThrow();
    expect(() => markArchiveNoticeShown()).not.toThrow();
    // 写入失败 → 读取仍返回默认值
    expect(getArchiveAiSummaryEnabled()).toBe(true);
    expect(isArchiveNoticeShown()).toBe(false);
  });

  it("localStorage.getItem 抛错时读取降级为默认值", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(getArchiveAiSummaryEnabled()).toBe(true);
    // 提示标记读不到 → 按“已展示”处理（读不到就不再打扰）
    expect(isArchiveNoticeShown()).toBe(true);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
