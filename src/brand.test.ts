import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { metadata } from "@/app/layout";
import es from "@/i18n/es-BO.json";
import en from "@/i18n/en.json";

const PRODUCT_DESCRIPTION_ES =
  "Varios inversionistas cofinancian un anticrético en Bolivia desde 100 USDC. Renta mensual mientras el inmueble está alquilado; capital devuelto al final del plazo. On-chain en Stellar.";

const PRODUCT_DESCRIPTION_EN =
  "Llavero enables multiple people to co-finance an anticrético in Bolivia from 100 USDC on Stellar, collect monthly rent while the property is leased, and recover their capital at the end of the term.";

describe("Llavero brand", () => {
  it("uses the new localized brand and minimum-investment copy", () => {
    expect(es.landing.hero.title).toContain("100 USDC");
    expect(es.landing.hero.subtitle).toBe(PRODUCT_DESCRIPTION_ES);
    expect(es.invest.minHint).toBe("Mínimo 100 USDC");
    expect(es.invest.errorMinAmount).toBe("El monto mínimo es 100 USDC.");
    expect(es.owner.noPropertiesBody).toContain("Llavero");

    expect(en.landing.hero.title).toContain("100 USDC");
    expect(en.landing.hero.subtitle).toBe(PRODUCT_DESCRIPTION_EN);
    expect(en.invest.minHint).toBe("Minimum 100 USDC");
    expect(en.invest.errorMinAmount).toBe("Minimum amount is 100 USDC.");
    expect(en.owner.noPropertiesBody).toContain("Llavero");

    expect(JSON.stringify(es)).not.toContain("Anticretico");
    expect(JSON.stringify(en)).not.toContain("Anticretico");
  });

  it("publishes Llavero metadata and favicon", () => {
    expect(metadata.title).toBe("Llavero");
    expect(metadata.description).toBe(PRODUCT_DESCRIPTION_EN);
    expect(metadata.icons).toEqual({ icon: "/favicon.png" });
  });

  it("generates the light Llavero palette", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/tokens.css"),
      "utf8",
    );
    const palette = {
      bg: "#F4F5F7",
      "bg-elevated": "#FFFFFF",
      "bg-elevated-2": "#EFEEF5",
      border: "#E3E5EC",
      "border-strong": "#C6CBDA",
      "text-primary": "#1F2347",
      "text-secondary": "#5C6183",
      "text-muted": "#8F94AF",
      gold: "#D5486C",
      "gold-hover": "#BE3B5D",
      "gold-muted": "#8B2E47",
      "state-success": "#1F9E6A",
      "state-warning": "#E9B749",
      "state-info": "#B6AED6",
      "state-danger": "#D13A3A",
      overlay: "rgba(31, 35, 71, 0.55)",
    };

    for (const [name, value] of Object.entries(palette)) {
      expect(css).toContain(`--color-${name}: ${value};`);
    }
  });

  it("describes Llavero and its 100 USDC minimum in the README", () => {
    const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");

    expect(readme).toContain("# Llavero");
    expect(readme).toContain("100 USDC");
  });
});
