"use client";

import { PieChart, Wallet } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useCallback, useState } from "react";
import { useWallet } from "@/lib/providers";
import { useKalshiTrading } from "@/lib/hooks/useKalshiTrading";
import { PortfolioModal } from "./positions/PortfolioModal";
import Logo from "./LogoIcon";
import DynamicButton from "./dynamic/DynamicButton";

const DepositModal = dynamic(
  () => import("./DepositModal").then((mod) => ({ default: mod.DepositModal })),
  { ssr: false }
);

function PortfolioButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="bg-white box-border flex h-[41px] items-center justify-center gap-[6px] px-[12px] py-[8px] relative rounded-[8px] shrink-0 cursor-pointer hover:bg-[#F9F9F9] transition-all duration-150 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:scale-[0.90] border border-[#DADADA]"
      >
        <PieChart className="w-[16px] h-[16px] text-[#4779FF]" strokeWidth={2} />
        <span className="font-medium text-[16px] text-[#030303] leading-[100%] hidden sm:block">Portfolio</span>
      </button>
      <PortfolioModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

function DepositButton() {
  const { getSolBalance } = useKalshiTrading();
  const [balance, setBalance] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { loggedIn } = useWallet();

  const fetchBalance = useCallback(async () => {
    if (!loggedIn) return;
    const bal = await getSolBalance();
    setBalance(bal);
  }, [loggedIn, getSolBalance]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    const handleDeposit = () => { setTimeout(() => { fetchBalance(); }, 2000); };
    window.addEventListener("depositComplete", handleDeposit);
    return () => { clearInterval(interval); window.removeEventListener("depositComplete", handleDeposit); };
  }, [fetchBalance]);

  const displayText = balance !== null && balance > 0 ? `${balance.toFixed(3)} SOL` : "Deposit";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="bg-white box-border flex h-[41px] items-center justify-center gap-[6px] pl-[12px] pr-[12px] py-[8px] relative rounded-[8px] shrink-0 w-[125px] cursor-pointer hover:bg-[#F9F9F9] transition-all duration-150 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:scale-[0.90] border border-[#DADADA]"
      >
        <Wallet className="w-[16px] h-[16px] text-[#4779FF]" />
        <div className="flex flex-col font-medium justify-center leading-[100%] not-italic relative shrink-0 text-[#030303] text-[16px] text-nowrap tracking-[0%] text-right">
          <p className="leading-[100%] whitespace-pre">{displayText}</p>
        </div>
      </button>
      <DepositModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

function HeaderContent() {
  const { loggedIn } = useWallet();
  return (
    <div className="content-stretch flex items-center gap-[16px] relative shrink-0 w-full">
      <Logo />
      <div className="flex items-center gap-[8px] ml-auto">
        {loggedIn && (
          <>
            <PortfolioButton />
            <DepositButton />
          </>
        )}
        <DynamicButton />
      </div>
    </div>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#DADADA]" style={{ boxShadow: "0 1px 2px 0 rgba(0,0,0,0.08)" }}>
      <div className="h-16 flex items-center px-[20px] sm:px-[32px] md:px-[48px] lg:px-[64px] xl:px-[80px]">
        <div className="w-full" style={{ maxWidth: "1440px", margin: "0 auto" }}>
          <HeaderContent />
        </div>
      </div>
    </header>
  );
}
