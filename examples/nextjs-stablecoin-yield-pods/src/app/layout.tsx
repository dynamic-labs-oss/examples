import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Providers from "@/lib/providers";
import Footer from "@/components/footer";
import { Header } from "@/components/header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DeFi Yield with Dynamic",
  description:
    "Deposit assets to earn yield and manage your DeFi positions with Dynamic's MPC wallets and Pods/Deframe. Access multiple yield protocols seamlessly.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
