import "./globals.css";
import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Providers from "@/lib/providers";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Dynamic - Cross-Chain Swaps with Mayan",
  description:
    "Fast and secure cross-chain bridging and swapping powered by Dynamic and Mayan Finance",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={roboto.className} style={{ background: "rgb(249,249,249)" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
