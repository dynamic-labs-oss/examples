"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface HamburgerMenuProps {
  children: React.ReactNode;
  className?: string;
}

export function HamburgerMenu({ children, className }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden p-2"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-[#DADADA] rounded-md shadow-lg z-50">
          <div className="flex flex-col p-2 space-y-1">
            <div className="flex flex-col space-y-1">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}
