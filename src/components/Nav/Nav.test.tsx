import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/stellar/wallet", () => ({
  connectWallet: vi.fn(),
}));

import { Nav } from "./Nav";

describe("Nav", () => {
  it("links app navigation to the investor dashboard", () => {
    render(<Nav variant="app" />);

    expect(screen.getByRole("link", { name: "dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });
});
