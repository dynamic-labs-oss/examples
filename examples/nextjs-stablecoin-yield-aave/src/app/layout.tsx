import "./globals.css";
import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Providers from "@/lib/providers";
import { Header } from "@/components/header";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto" });

export const metadata: Metadata = {
  title: "DeFi Yield with Dynamic",
  description:
    "Supply assets, borrow against collateral, and manage your DeFi positions with Dynamic's MPC wallets and Aave V3. Earn yield on stablecoins and access liquidity seamlessly.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={roboto.variable}>
        <Providers>
          <Header />
          <div className="min-h-screen bg-background pt-16">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
