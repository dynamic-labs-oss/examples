import type { Metadata } from "next";
import Providers from "@/lib/providers";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "vaults.fyi Yield with Dynamic",
  description:
    "Deposit, track, and claim DeFi yield across 1,000+ vaults using vaults.fyi and Dynamic embedded wallets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#F9F9F9] text-[#030303] font-sans antialiased">
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 pb-16">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
