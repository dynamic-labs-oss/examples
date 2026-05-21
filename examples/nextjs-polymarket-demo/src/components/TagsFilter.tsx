"use client";

import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type CarouselApi = UseEmblaCarouselType[1];

interface TagsFilterProps {
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  availableTags: string[];
}

interface FilterButtonProps {
  isSelected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  padding?: string;
}

const FilterButton = ({
  isSelected,
  onClick,
  children,
  padding = "pl-[6px] pr-[10px] py-[4px]",
}: FilterButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`bg-white relative rounded-[27px] border transition-all duration-150 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:scale-[0.90] ${
      isSelected
        ? "border-[#4779FF]"
        : "border-[#DADADA] hover:border-[#4779FF]"
    }`}
  >
    <div className="flex flex-row items-center justify-center">
      <div className={`box-border content-stretch flex gap-[4px] items-center justify-center ${padding} relative`}>
        {children}
      </div>
    </div>
  </button>
);

const FilterButtonText = ({
  isSelected,
  children,
}: {
  isSelected: boolean;
  children: React.ReactNode;
}) => (
  <div
    className={`flex flex-col font-medium justify-center leading-0 not-italic relative shrink-0 text-[15px] text-nowrap transition-colors duration-150 ${
      isSelected ? "text-[#030303]" : "text-[#606060]"
    }`}
  >
    <p className="leading-[normal] whitespace-pre">{children}</p>
  </div>
);

const TAG_COLORS: Record<string, string> = {
  trending: "text-[#ff6b6b]",
  hot: "text-[#ff9500]",
  new: "text-[#4ecdc4]",
  "ending soon": "text-[#ffd93d]",
  "high stakes": "text-[#9b59b6]",
  "close call": "text-[#3498db]",
};

export function TagsFilter({
  selectedTags,
  onTagToggle,
  availableTags,
}: TagsFilterProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragFree: true,
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const viewportElementRef = useRef<HTMLDivElement | null>(null);
  const [viewportReady, setViewportReady] = useState(false);

  const onSelect = useCallback((emblaApi: CarouselApi) => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, []);

  const calculateScrollDistance = useCallback(() => {
    if (!emblaApi) return 0;
    const slides = emblaApi.slideNodes();
    if (slides.length === 0) return 0;
    const firstSlide = slides[0];
    if (!firstSlide) return 0;
    return (firstSlide.offsetWidth + 8) * 3;
  }, [emblaApi]);

  const scrollPrev = useCallback(() => {
    if (!viewportElementRef.current) return;
    const scrollDistance = calculateScrollDistance();
    if (scrollDistance === 0) return;
    const viewport = viewportElementRef.current;
    viewport.scrollTo({ left: Math.max(0, viewport.scrollLeft - scrollDistance), behavior: "smooth" });
  }, [calculateScrollDistance]);

  const scrollNext = useCallback(() => {
    if (!viewportElementRef.current) return;
    const scrollDistance = calculateScrollDistance();
    if (scrollDistance === 0) return;
    const viewport = viewportElementRef.current;
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    viewport.scrollTo({ left: Math.min(maxScroll, viewport.scrollLeft + scrollDistance), behavior: "smooth" });
  }, [calculateScrollDistance]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect(emblaApi);
    emblaApi.on("reInit", onSelect);
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!viewportReady) return;
    const viewport = viewportElementRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      const scrollLeft = viewport.scrollLeft;
      const maxScroll = viewport.scrollWidth - viewport.clientWidth;
      setCanScrollPrev(scrollLeft > 1);
      setCanScrollNext(scrollLeft < maxScroll - 1);
    };

    const timeoutId = setTimeout(() => {
      viewport.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      viewport.removeEventListener("scroll", handleScroll);
    };
  }, [viewportReady]);

  const arrowButtonClasses =
    "hidden md:flex absolute top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full bg-white border border-[#DADADA] hover:border-[#4779FF] transition-all duration-150 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:scale-[0.90] shadow-sm";
  const arrowStateClasses = (canScroll: boolean) =>
    canScroll ? "opacity-100 cursor-pointer" : "opacity-0 cursor-not-allowed pointer-events-none";
  const arrowIconClasses = (canScroll: boolean) =>
    `w-4 h-4 transition-colors ${canScroll ? "text-[#030303]" : "text-[#DADADA]"}`;

  if (availableTags.length === 0) return null;

  return (
    <div className="pt-[16px] relative">
      <div className="relative w-full">
        <button
          type="button"
          onClick={scrollPrev}
          disabled={!canScrollPrev}
          className={`${arrowButtonClasses} left-0 ${arrowStateClasses(canScrollPrev)}`}
          aria-label="Scroll left"
        >
          <ChevronLeft className={arrowIconClasses(canScrollPrev)} strokeWidth={1.5} />
        </button>

        <button
          type="button"
          onClick={scrollNext}
          disabled={!canScrollNext}
          className={`${arrowButtonClasses} right-0 ${arrowStateClasses(canScrollNext)}`}
          aria-label="Scroll right"
        >
          <ChevronRight className={arrowIconClasses(canScrollNext)} strokeWidth={1.5} />
        </button>

        <div
          className={`hidden md:block absolute left-0 top-0 bottom-0 w-16 z-5 pointer-events-none bg-linear-to-r from-[#F9F9F9] via-[#F9F9F9]/80 to-transparent transition-opacity ${
            canScrollPrev ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`hidden md:block absolute right-0 top-0 bottom-0 w-16 z-5 pointer-events-none bg-linear-to-l from-[#F9F9F9] via-[#F9F9F9]/80 to-transparent transition-opacity ${
            canScrollNext ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          className="overflow-hidden"
          ref={(node) => {
            emblaRef(node);
            viewportElementRef.current = node;
            if (node) setViewportReady(true);
          }}
        >
          <div className="flex gap-[8px] items-center">
            <div className="shrink-0">
              <FilterButton
                isSelected={selectedTags.length === 0}
                onClick={() => selectedTags.forEach((tag) => onTagToggle(tag))}
                padding="px-[10px] py-[4px]"
              >
                <FilterButtonText isSelected={selectedTags.length === 0}>
                  All Tags
                </FilterButtonText>
              </FilterButton>
            </div>

            {availableTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              const tagColor = TAG_COLORS[tag] || "text-[#030303]";
              return (
                <div key={tag} className="shrink-0">
                  <FilterButton isSelected={isSelected} onClick={() => onTagToggle(tag)}>
                    <FilterButtonText isSelected={isSelected}>
                      <span className={isSelected ? tagColor : ""}>
                        {tag.charAt(0).toUpperCase() + tag.slice(1)}
                      </span>
                    </FilterButtonText>
                  </FilterButton>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
