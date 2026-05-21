"use client";

import { ChevronDown, Loader2, PieChart, X, Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/lib/providers";
import Logo from "./LogoIcon";
import DynamicButton from "./dynamic/DynamicButton";

const DepositModal = dynamic(
  () => import("./DepositModal").then((mod) => ({ default: mod.DepositModal })),
  { ssr: false }
);
const PortfolioModal = dynamic(
  () => import("./positions/PortfolioModal").then((mod) => ({ default: mod.PortfolioModal })),
  { ssr: false }
);

interface HeaderProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
}

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
  const { evmAccount } = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="bg-white box-border flex h-[41px] items-center justify-center pl-[12px] pr-[12px] py-[8px] relative rounded-[8px] shrink-0 w-[120px] cursor-pointer hover:bg-[#F9F9F9] transition-all duration-150 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:scale-[0.90] border border-[#DADADA]"
      >
        <div className="flex flex-col font-medium justify-center leading-[100%] not-italic relative shrink-0 text-[#030303] text-[16px] text-nowrap tracking-[0%] text-right">
          <p className="leading-[100%] whitespace-pre">Deposit</p>
        </div>
      </button>
      <DepositModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

function SearchInput({ searchValue, onSearchChange }: HeaderProps) {
  return (
    <div className="bg-white box-border hidden md:flex gap-[8px] h-[41px] items-center pl-[9px] pr-[14px] py-[11px] rounded-[9px] flex-1 max-w-[423px] relative border border-[#DADADA]">
      <Search className="w-[18px] h-[18px] text-[#606060] shrink-0" strokeWidth="1.5" />
      <input
        type="text"
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search for markets"
        className="bg-transparent flex-1 font-medium outline-none text-[15px] text-[#030303] placeholder:text-[#606060]"
      />
      {searchValue && (
        <button type="button" onClick={() => onSearchChange("")} className="w-[18px] h-[18px] text-[#606060] hover:text-[#030303] shrink-0 transition-colors cursor-pointer" aria-label="Clear search">
          <X className="w-full h-full" />
        </button>
      )}
    </div>
  );
}

function HeaderContent({ searchValue, onSearchChange }: HeaderProps) {
  const { loggedIn } = useWallet();
  return (
    <div className="content-stretch flex items-center gap-[16px] relative shrink-0 w-full">
      <Logo />
      <SearchInput searchValue={searchValue} onSearchChange={onSearchChange} />
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

export function Header({ searchValue, onSearchChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#DADADA]" style={{ boxShadow: "0 1px 2px 0 rgba(0,0,0,0.08)" }}>
      <div className="h-16 flex items-center px-[20px] sm:px-[32px] md:px-[48px] lg:px-[64px] xl:px-[80px]">
        <div className="w-full" style={{ maxWidth: "1440px", margin: "0 auto" }}>
          <HeaderContent searchValue={searchValue} onSearchChange={onSearchChange} />
        </div>
      </div>
    </header>
  );
}
