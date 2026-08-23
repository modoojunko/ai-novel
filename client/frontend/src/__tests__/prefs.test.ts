import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getArchiveAiSummaryEnabled,
  setArchiveAiSummaryEnabled,
  isArchiveNoticeShown,
  markArchiveNoticeShown,
  getDefaultFontSize,
  setDefaultFontSize,
  getBookFontSize,
  setBookFontSize,
  getBookLineHeight,
  setBookLineHeight,
  getBookArchiveAiSummary,
  setBookArchiveAiSummary,
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

describe("lib/prefs — 本书偏好（per-book 覆盖，回落全局）", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("本书未设置时回落全局默认", () => {
    expect(getBookFontSize("p1")).toBe(getDefaultFontSize()); // fs-m
    expect(getBookLineHeight("p1")).toBe("lh-comfy");
    expect(getBookArchiveAiSummary("p1")).toBe(true);
  });

  it("本书覆盖只影响该书", () => {
    setDefaultFontSize("fs-l");
    setBookFontSize("p1", "fs-s");
    setBookLineHeight("p1", "lh-loose");
    setBookArchiveAiSummary("p1", false);
    expect(getBookFontSize("p1")).toBe("fs-s");
    expect(getBookLineHeight("p1")).toBe("lh-loose");
    expect(getBookArchiveAiSummary("p1")).toBe(false);
    // 其他书仍走全局
    expect(getBookFontSize("p2")).toBe("fs-l");
    expect(getBookArchiveAiSummary("p2")).toBe(true);
  });

  it("非法存储值按未设置处理（回落全局）", () => {
    localStorage.setItem("pref.book.p1.fs", "garbage");
    localStorage.setItem("pref.book.p1.ai_summary", "garbage");
    expect(getBookFontSize("p1")).toBe(getDefaultFontSize());
    expect(getBookArchiveAiSummary("p1")).toBe(getArchiveAiSummaryEnabled());
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
