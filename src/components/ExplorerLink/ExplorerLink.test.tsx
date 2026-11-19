import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ExplorerLink } from "./ExplorerLink";

const TX_HASH = "6f5a2c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3a9b4";
const ACCOUNT = "GABC123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ012345";

describe("ExplorerLink", () => {
  // AC-1: truncated tx hash + testnet URL
  it("renders a truncated tx hash as 6…4 chars and links to testnet /tx/{hash}", () => {
    render(<ExplorerLink kind="tx" value={TX_HASH} />);
    const anchor = screen.getByRole("link");
    expect(anchor).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/testnet/tx/${TX_HASH}`,
    );
    expect(anchor).toHaveAttribute("target", "_blank");
    expect(anchor.textContent).toMatch(/6f5a2c.*a9b4/);
    expect(anchor.textContent).toContain("…"); // the ellipsis character …
    expect(anchor.textContent).not.toContain(TX_HASH); // full value not inlined
  });

  // AC-2: account kind
  it("renders an account address and links to testnet /account/{addr}", () => {
    render(<ExplorerLink kind="account" value={ACCOUNT} />);
    const anchor = screen.getByRole("link");
    expect(anchor).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/testnet/account/${ACCOUNT}`,
    );
  });

  // AC-3: logo + external icon present
  it("renders the Stellar logo and an external-link icon", () => {
    const { container } = render(<ExplorerLink kind="tx" value={TX_HASH} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(2); // logo + external-link
    // The icons are distinguishable by data-attributes we render on them.
    expect(container.querySelector('[data-icon="stellar"]')).not.toBeNull();
    expect(container.querySelector('[data-icon="external"]')).not.toBeNull();
  });

  // AC-4: mainnet env is ignored; URL base is a module constant
  it("ignores any env-level override and always emits the testnet base URL", () => {
    const saved = process.env.NEXT_PUBLIC_EXPLORER_BASE_URL;
    process.env.NEXT_PUBLIC_EXPLORER_BASE_URL = "https://stellar.expert/explorer/public"; // mainnet
    try {
      render(<ExplorerLink kind="tx" value={TX_HASH} />);
      const anchor = screen.getByRole("link");
      expect(anchor.getAttribute("href")).toMatch(/explorer\/testnet\//);
      expect(anchor.getAttribute("href")).not.toMatch(/explorer\/public/);
    } finally {
      process.env.NEXT_PUBLIC_EXPLORER_BASE_URL = saved;
    }
  });

  // AC-5: full value in title attribute
  it("exposes the full value in the title attribute for hover + copy", () => {
    render(<ExplorerLink kind="tx" value={TX_HASH} />);
    const anchor = screen.getByRole("link");
    expect(anchor).toHaveAttribute("title", TX_HASH);
  });

  // AC-6: barrel export (import route exists)
  it("is importable from the components barrel", async () => {
    const mod = await import("../index");
    expect(mod.ExplorerLink).toBeDefined();
    expect(mod.ExplorerLink).toBe(ExplorerLink);
  });

  // AC-7: component uses tokens (via CSS variables), not raw hex
  it("does not contain any raw hex literal in its inline style or className", () => {
    const { container } = render(<ExplorerLink kind="tx" value={TX_HASH} />);
    const html = container.innerHTML;
    // After rendering, the component should reference css variables, not hex literals.
    // We allow hex only inside the user-provided value, and we strip it before checking.
    const htmlWithoutValues = html.replace(new RegExp(TX_HASH, "g"), "");
    expect(htmlWithoutValues).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });

  // Edge: short values are not re-truncated oddly.
  it("renders a very short tx value verbatim without ellipsis", () => {
    render(<ExplorerLink kind="tx" value="abc123" />);
    expect(screen.getByRole("link").textContent).toContain("abc123");
    expect(screen.getByRole("link").textContent).not.toContain("…");
  });
});
