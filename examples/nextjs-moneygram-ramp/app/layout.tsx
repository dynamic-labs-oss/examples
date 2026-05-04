import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { Providers } from "./providers";
import { Header } from "@/components/header";
import Footer from "@/components/footer";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Cash Pickup — Dynamic Demo",
  description: "Convert USDC to cash at pickup locations worldwide using embedded wallets on Base, Ethereum, or Solana",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${roboto.variable} font-sans bg-[rgb(249,249,249)]`}>
        <Providers>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
