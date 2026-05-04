import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "../styles/globals.css";
import Providers from "@/lib/providers";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dynamic: Kalshi Predictions Demo",
  description: "Kalshi Predictions Market Demo by Dynamic",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={roboto.variable} style={{ background: "rgb(249,249,249)" }}>
      <body style={{ background: "rgb(249,249,249)", fontFamily: "var(--font-roboto), Roboto, sans-serif" }}>
        <Providers>
          <div className="flex flex-col min-h-screen">
            <div className="flex-1 flex justify-center">
              <div
                className="box-border w-full px-[20px] sm:px-[32px] md:px-[48px] lg:px-[64px] xl:px-[80px]"
                style={{ maxWidth: "1440px" }}
              >
                {children}
              </div>
            </div>
            <footer className="border-t border-[#DADADA] py-4 text-center text-sm text-[#606060]">
              Powered by{" "}
              <a
                href="https://dynamic.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4779FF] hover:underline font-medium"
              >
                Dynamic
              </a>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
