"use client";

import MultiChainSwap from "@/components/MultiChainSwap";
import Nav from "@/components/nav";
import Footer from "@/components/footer";

export default function Main() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "rgb(249,249,249)" }}>
      <Nav />
      <main className="flex-1">
        <MultiChainSwap />
      </main>
      <Footer />
    </div>
  );
}
