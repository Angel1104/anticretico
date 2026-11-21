import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      dashboard: {
        title: "Dashboard",
        subtitle: "Your investments across all properties.",
        connectWallet: "Connect wallet",
        connectWalletBody: "Connect Freighter to see your investments.",
        totalInvested: "Total invested",
        positionsCount: "Positions",
        distributionsReceived: "Distributions received",
        variable: "variable",
        noPositions: "You don't have any investments yet.",
        myPositions: "My positions",
        distributionHistory: "Distribution history",
        date: "Date",
        property: "Property",
        amount: "Amount",
        transaction: "Tx",
      },
      propertyCard: {
        anticretico: "Anticretico",
        rent: "Rent",
        rentVariable: "{amount} USDC/month · variable",
        viewDetails: "View details",
        finalized: "Completed",
        viewHistory: "View history",
      },
      state: {
        "En fondeo": "Funding",
        "En trámite": "In registration",
        "Buscando inquilino": "Seeking tenant",
        Alquilado: "Rented",
        Finalizado: "Completed",
      },
    };

    return (key: string, values?: Record<string, string>) => {
      let value = messages[namespace]?.[key] ?? key;
      for (const [name, replacement] of Object.entries(values ?? {})) {
        value = value.replace(`{${name}}`, replacement);
      }
      return value;
    };
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/db/supabase", () => ({
  supabase: { from: mocks.from },
}));

import { DashboardContent } from "./Dashboard";

const wallet = "GCLIENTWALLET";
const depositTx = "deposit1234567890";
const distributionTx = "distribution1234567890";

const property = {
  id: "property-1",
  slug: "sopocachi-central",
  state: "Alquilado",
  ciudad: "La Paz",
  barrio: "Sopocachi",
  address: "Av. 20 de Octubre 1234",
  target_usdc: 100_000,
  rent_monthly_usdc: 1_000,
  duration_months: 24,
  owner_wallet: null,
  escrow_address: null,
  token_series_code: null,
  images_urls: ["https://example.com/property.jpg"],
  dr_inscription_date: null,
  description: null,
  created_at: "2026-01-01T00:00:00Z",
};

function arrangeQueries({ positions = [
  {
    id: "position-1",
    property_id: property.id,
    investor_wallet: wallet,
    tokens_held: 2_000,
    usdc_invested: 2_000,
    deposited_tx: depositTx,
    created_at: "2026-01-01T00:00:00Z",
  },
] } = {}) {
  let positionQueryCount = 0;

  mocks.from.mockImplementation((table: string) => {
    if (table === "positions") {
      positionQueryCount += 1;
      if (positionQueryCount === 1) {
        return {
          select: () => ({
            eq: async () => ({ data: positions, error: null }),
          }),
        };
      }

      return {
        select: () => ({
          in: async () => ({
            data: [
              ...positions,
              {
                id: "position-2",
                property_id: property.id,
                investor_wallet: "GOTHERWALLET",
                tokens_held: 2_000,
                usdc_invested: 2_000,
                deposited_tx: "other-deposit",
                created_at: "2026-01-01T00:00:00Z",
              },
            ],
            error: null,
          }),
        }),
      };
    }

    if (table === "properties") {
      return {
        select: () => ({
          in: async () => ({ data: [property], error: null }),
        }),
      };
    }

    if (table === "distributions") {
      return {
        select: () => ({
          in: async () => ({
            data: [
              {
                id: "distribution-1",
                property_id: property.id,
                period_month: "2026-11-01",
                gross_usdc: 100,
                fee_usdc: 16,
                net_usdc: 84,
                holders_count: 2,
                stellar_tx: distributionTx,
                created_at: "2026-11-15T00:00:00Z",
              },
            ],
            error: null,
          }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });
}

describe("DashboardContent", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.from.mockReset();
  });

  it("asks the investor to connect when no persisted wallet exists", () => {
    render(<DashboardContent />);

    expect(screen.getByRole("heading", { name: "Connect wallet" })).toBeInTheDocument();
    expect(screen.getByText("Connect Freighter to see your investments.")).toBeInTheDocument();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("renders wallet summaries, compact positions, and investor distribution history", async () => {
    window.localStorage.setItem("anticretico:wallet", wallet);
    arrangeQueries();

    render(<DashboardContent />);

    expect(
      await screen.findByRole("heading", { name: "Sopocachi, La Paz" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("2,000 USDC")).toHaveLength(2);
    expect(screen.getAllByText("42 USDC")).toHaveLength(2);
    expect(screen.getByText("variable")).toBeInTheDocument();
    expect(screen.getByText("11/1/2026")).toBeInTheDocument();

    const propertyLink = screen.getByRole("link", { name: /Sopocachi, La Paz/i });
    expect(propertyLink).toHaveAttribute("href", "/propiedades/sopocachi-central");
    expect(propertyLink.querySelector("img")).not.toBeInTheDocument();

    expect(screen.getByTitle(depositTx)).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/testnet/tx/${depositTx}`,
    );
    expect(screen.getByTitle(distributionTx)).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/testnet/tx/${distributionTx}`,
    );
  });

  it("shows the empty state when the connected wallet has no positions", async () => {
    window.localStorage.setItem("anticretico:wallet", wallet);
    arrangeQueries({ positions: [] });

    render(<DashboardContent />);

    await waitFor(() => {
      expect(screen.getByText("You don't have any investments yet.")).toBeInTheDocument();
    });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
