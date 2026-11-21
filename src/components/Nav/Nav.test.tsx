import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  pathname: "/propiedades",
  replace: vi.fn(),
}));

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

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));

vi.mock("@/lib/stellar/wallet", () => ({
  connectWallet: vi.fn(),
}));

import { Nav } from "./Nav";

describe("Nav", () => {
  beforeEach(() => {
    navigation.pathname = "/propiedades";
    navigation.replace.mockReset();
  });

  it("links app navigation to the investor dashboard", () => {
    render(<Nav variant="app" />);

    expect(screen.getByRole("link", { name: "dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("switches from the default Spanish path to the same English page", () => {
    render(<Nav variant="app" />);

    expect(screen.getByRole("button", { name: "ES" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "EN" }));

    expect(navigation.replace).toHaveBeenCalledWith("/en/propiedades");
  });

  it("switches from an English path to the same unprefixed Spanish page", () => {
    navigation.pathname = "/en/propiedades";
    render(<Nav variant="app" />);

    expect(screen.getByRole("button", { name: "EN" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "ES" }));

    expect(navigation.replace).toHaveBeenCalledWith("/propiedades");
  });
});
