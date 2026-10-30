import type { Metadata } from "next";
import Providers from "@/lib/providers";
import "./globals.css";

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
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
