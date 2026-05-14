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
  title: "Dynamic: Predictions Market Demo",
  description: "Predictions Market Demo by Dynamic",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={roboto.variable}>
      <body>
        <Providers>
          <div className="flex flex-col min-h-screen">
            <div className="flex-1">
              {children}
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
