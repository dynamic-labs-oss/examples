import React from "react";

interface ButtonProps {
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "approve" | "claim";
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function Button({
  type = "button",
  variant = "primary",
  disabled = false,
  loading = false,
  children,
  onClick,
  className = "",
}: ButtonProps) {
  const baseClasses =
    "rounded-xl py-3 font-medium text-sm cursor-pointer transition-colors duration-200 w-full disabled:cursor-not-allowed disabled:opacity-50";

  const variantClasses: Record<string, string> = {
    primary: "bg-earn-primary text-white hover:bg-earn-primary/90",
    secondary: "bg-earn-light text-earn-text-secondary border border-earn-border hover:bg-gray-100",
    approve: "bg-yellow-500 text-gray-900 hover:bg-yellow-600",
    claim: "bg-green-500 text-white hover:bg-green-600",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {loading ? `${children}...` : children}
    </button>
  );
}
