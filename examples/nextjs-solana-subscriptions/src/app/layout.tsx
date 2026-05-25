import "./globals.css";
import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Providers from "@/lib/providers";
import Footer from "@/components/footer";
import { Header } from "@/components/header";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Solana Subscriptions with Dynamic",
  description:
    "Manage on-chain recurring payment subscriptions on Solana. Powered by Dynamic's embedded wallets and the Solana Subscriptions program.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={roboto.className}>
        <Providers>
          <Header />
          <div
            className="min-h-screen"
            style={{ background: "rgb(249,249,249)" }}
          >
            {children}
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
