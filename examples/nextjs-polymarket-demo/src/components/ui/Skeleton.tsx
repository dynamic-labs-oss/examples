"use client";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className = "",
  variant = "rectangular",
  width,
  height,
}: SkeletonProps) {
  const baseClasses = "bg-[#F0F0F0] animate-pulse";
  
  const variantClasses = {
    text: "rounded",
    circular: "rounded-full",
    rectangular: "rounded-[8px]",
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
}

export function PositionCardSkeleton() {
  return (
    <div className="bg-white rounded-[16px] p-[16px] border border-[#DADADA]">
      {/* Header */}
      <div className="flex items-start gap-[12px] mb-[12px]">
        <Skeleton variant="rectangular" width={48} height={48} className="rounded-[8px]" />
        <div className="flex-1">
          <Skeleton variant="text" height={14} className="mb-[8px] w-3/4" />
          <Skeleton variant="text" height={14} className="w-1/2" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-[8px] mb-[12px]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#F9F9F9] border border-[#DADADA] rounded-[8px] p-[10px]">
            <Skeleton variant="text" height={10} className="w-1/2 mb-[4px]" />
            <Skeleton variant="text" height={14} className="w-3/4" />
          </div>
        ))}
      </div>

      {/* Value Row */}
      <div className="flex items-center justify-between bg-[#F9F9F9] border border-[#DADADA] rounded-[8px] p-[12px] mb-[12px]">
        <div>
          <Skeleton variant="text" height={10} className="w-20 mb-[4px]" />
          <Skeleton variant="text" height={18} className="w-16" />
        </div>
        <div className="text-right">
          <Skeleton variant="text" height={10} className="w-8 mb-[4px] ml-auto" />
          <Skeleton variant="text" height={16} className="w-24" />
        </div>
      </div>

      {/* Button */}
      <Skeleton variant="rectangular" height={44} className="rounded-[10px]" />
    </div>
  );
}

export function OrderCardSkeleton() {
  return (
    <div className="bg-white rounded-[16px] p-[16px] border border-[#DADADA]">
      {/* Header */}
      <div className="flex items-start justify-between gap-[12px] mb-[12px]">
        <div className="flex-1">
          <Skeleton variant="text" height={14} className="mb-[8px] w-3/4" />
          <div className="flex gap-[6px]">
            <Skeleton variant="text" width={40} height={18} className="rounded-[4px]" />
            <Skeleton variant="text" width={50} height={18} className="rounded-[4px]" />
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-3 gap-[8px] mb-[12px]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#F9F9F9] border border-[#DADADA] rounded-[8px] p-[10px]">
            <Skeleton variant="text" height={10} className="w-1/2 mb-[4px]" />
            <Skeleton variant="text" height={14} className="w-3/4" />
          </div>
        ))}
      </div>

      {/* Button */}
      <Skeleton variant="rectangular" height={40} className="rounded-[10px]" />
    </div>
  );
}

