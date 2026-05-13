import type { Metadata } from "next";
import { Providers } from "./providers";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cash Pickup — Dynamic Demo",
  description: "Convert USDC to cash at pickup locations worldwide using embedded wallets on Base, Ethereum, or Solana",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
