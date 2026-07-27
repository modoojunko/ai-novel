import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../components/shared/StatusBadge";

describe("StatusBadge", () => {
  it("renders loading skeleton", () => {
    const { container } = render(<StatusBadge status="loading" />);
    expect(container.querySelector('[data-loaded="false"]')).toBeDefined();
  });

  it("renders no_key state with link to /config", () => {
    render(<StatusBadge status="no_key" />);
    const link = screen.getByText("🔑 未配置 API Key");
    expect(link).toBeDefined();
    expect(link.closest("a")).toHaveAttribute("href", "/config");
  });

  it("renders no_model state with link to /settings", () => {
    render(<StatusBadge status="no_model" />);
    const link = screen.getByText("🤖 未配置模型");
    expect(link).toBeDefined();
    expect(link.closest("a")).toHaveAttribute("href", "/settings");
  });

  it("renders configured state", () => {
    render(<StatusBadge status="configured" configName="My Key" modelName="gpt-4o" />);
    expect(screen.getByText("My Key / gpt-4o")).toBeDefined();
  });

  it("renders invalid state", () => {
    render(<StatusBadge status="invalid" />);
    expect(screen.getByText("⚠️ 模型已失效")).toBeDefined();
  });
});
