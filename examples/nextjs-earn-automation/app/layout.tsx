import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Header from "@/components/header";
import Providers from "@/lib/providers";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Earn Automation",
  description:
    "Auto-deposit a wallet's assets into Dynamic Earn yield vaults — sweep everything or a fixed amount, on a schedule.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${roboto.variable} font-sans`}>
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
