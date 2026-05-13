import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Providers from "@/lib/providers";
import { Header } from "@/components/header";
import Footer from "@/components/footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EuroRamp - Fiat ↔ Crypto for Europe",
  description:
    "Onramp and offramp EUR/USD to stablecoins seamlessly. Built for European customers using SEPA and powered by Iron Finance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <Header />
          <div className="min-h-screen bg-background">{children}</div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
