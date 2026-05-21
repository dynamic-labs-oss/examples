"use client";

export default function Logo() {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="relative w-[36px] h-[36px]">
        {/* Outer glow */}
        <div className="absolute inset-0 bg-linear-to-br from-[#8b5cf6] to-[#06b6d4] rounded-lg blur-sm opacity-50" />
        {/* Main logo container */}
        <div className="relative w-full h-full bg-linear-to-br from-[#8b5cf6] to-[#06b6d4] rounded-lg flex items-center justify-center">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2L2 7L12 12L22 7L12 2Z"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 17L12 22L22 17"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 12L12 17L22 12"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <span className="text-[20px] font-bold text-[#030303] hidden sm:block">
        BetPulse
      </span>
    </div>
  );
}

