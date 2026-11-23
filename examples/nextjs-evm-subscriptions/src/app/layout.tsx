import "./globals.css";
import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import ProvidersLoader from "@/lib/providers-loader";
import Footer from "@/components/footer";
import { Header } from "@/components/header";
import { Toaster } from "@/components/Toaster";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EVM Subscriptions with Dynamic",
  description:
    "Recurring pull payments on EVM via EIP-3009 authorizations. Powered by Dynamic wallets and Relay.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={roboto.className}>
        <ProvidersLoader>
          <Header />
          <div
            className="min-h-screen"
            style={{ background: "rgb(249,249,249)" }}
          >
            {children}
          </div>
          <Footer />
          <Toaster />
        </ProvidersLoader>
      </body>
    </html>
  );
}
