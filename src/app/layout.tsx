import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anticretico",
  description: "Fractional Bolivian anticrético on Stellar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
