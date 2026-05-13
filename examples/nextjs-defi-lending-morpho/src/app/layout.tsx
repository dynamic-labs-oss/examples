import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Providers from "@/lib/providers";
import Navigation from "@/components/Navigation";
import Footer from "@/components/footer";

import "./globals.css";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto" });

export const metadata: Metadata = {
  title: "DeFi Lending & Borrowing with Dynamic",
  description: "Decentralized lending and borrowing on Morpho with Dynamic wallets",
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
          <Navigation />
          <div className="min-h-screen bg-background pt-16 pb-14">{children}</div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
