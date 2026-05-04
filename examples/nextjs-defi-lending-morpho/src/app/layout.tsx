import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Providers from "@/lib/providers";
import Navigation from "@/components/Navigation";
import Footer from "@/components/footer";

import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
});

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
    <html lang="en">
      <body className={`${roboto.variable} font-sans bg-[#F9F9F9] text-[#030303]`}>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Navigation />
            <main className="flex-1 pt-0">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
