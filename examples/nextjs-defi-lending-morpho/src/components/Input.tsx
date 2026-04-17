import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`px-4 py-3 rounded-xl border border-earn-border text-earn-text-primary bg-white outline-none w-full transition-all duration-200 focus:ring-2 focus:ring-earn-primary/30 focus:border-earn-primary placeholder:text-earn-text-secondary/60 ${className}`}
      {...props}
    />
  );
}
