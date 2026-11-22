import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Llavero",
  description:
    "Llavero enables multiple people to co-finance an anticrético in Bolivia from 100 USDC on Stellar, collect monthly rent while the property is leased, and recover their capital at the end of the term.",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
