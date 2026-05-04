import "./globals.css";
import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Providers from "@/lib/providers";
import Header from "@/components/header";
import Footer from "@/components/footer";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "LiFi Cross-Chain Swaps with Dynamic",
  description:
    "Bridge tokens across multiple chains seamlessly with Dynamic's MPC wallets and LiFi. Access the best routes and execute cross-chain transfers with confidence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={roboto.className} style={{ background: "rgb(249,249,249)" }}>
        <Providers>
          <Header />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
