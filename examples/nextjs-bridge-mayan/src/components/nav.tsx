import { DynamicWidget } from "@/lib/dynamic";
import Image from "next/image";
import { openExternalLink } from "@/lib/utils";
import { useState } from "react";

export default function Nav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="absolute top-0 flex items-center justify-between w-full p-4 border-b border-gray-200 dark:border-gray-700">
      <Image
        className="h-8 pl-4 object-contain"
        src="/logo-dark.png"
        alt="dynamic"
        width="300"
        height="60"
      />

      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center gap-3 pr-4">
        <DynamicWidget />
        <button
          className="px-6 py-2 bg-white text-black font-medium rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors duration-200"
          onClick={() => openExternalLink("https://docs.dynamic.xyz")}
        >
          Docs
        </button>
        <button
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors duration-200"
          onClick={() => openExternalLink("https://app.dynamic.xyz")}
        >
          Get started
        </button>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden flex items-center gap-3 pr-4">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-lg md:hidden">
          <div className="flex flex-col p-4 space-y-3">
            <div className="flex justify-center">
              <DynamicWidget />
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 px-6 py-2 bg-white text-black font-medium rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors duration-200 text-center"
                onClick={() => {
                  openExternalLink("https://docs.dynamic.xyz");
                  setIsMenuOpen(false);
                }}
              >
                Docs
              </button>
              <button
                className="flex-1 px-6 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors duration-200 text-center"
                onClick={() => {
                  openExternalLink("https://app.dynamic.xyz");
                  setIsMenuOpen(false);
                }}
              >
                Get started
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
