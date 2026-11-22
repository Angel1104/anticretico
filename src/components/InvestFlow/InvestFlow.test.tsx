import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/stellar/wallet", () => ({
  connectWallet: vi.fn(),
}));

vi.mock("@/lib/db/positions", () => ({
  recordPosition: vi.fn(),
}));

import { InvestFlow } from "./InvestFlow";
import { MIN_INVESTMENT_USDC } from "@/lib/stellar/invest";

describe("InvestFlow", () => {
  it("starts at the 100 USDC minimum", () => {
    render(
      <InvestFlow propertyId="property-1" propertySlug="property" canInvest />,
    );

    expect(MIN_INVESTMENT_USDC).toBe(100);
    expect(screen.getByRole("spinbutton")).toHaveValue(100);
    expect(screen.getByRole("spinbutton")).toHaveAttribute("min", "100");
  });

  it("rejects an amount below 100 USDC", () => {
    render(
      <InvestFlow propertyId="property-1" propertySlug="property" canInvest />,
    );

    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "99" },
    });
    fireEvent.click(screen.getByRole("button", { name: "continue" }));

    expect(screen.getByText("errorMinAmount")).toBeInTheDocument();
  });
});
