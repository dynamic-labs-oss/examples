"use client";

import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type CarouselApi = UseEmblaCarouselType[1];

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  "All",
  "Game Lines",
  "Player Props",
  "Futures",
  "Season Totals",
  "Awards",
  "Specials",
  "Head to Head",
  "Live",
];

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
    const scrollBy = 3;
    const slides = emblaApi.slideNodes();
    if (slides.length === 0) return 0;

    const firstSlide = slides[0];
    if (!firstSlide) return 0;

    const slideWidth = firstSlide.offsetWidth;
    const gap = 20;
    return (slideWidth + gap) * scrollBy;
  }, [emblaApi]);

  const scrollPrev = useCallback(() => {
    if (!viewportElementRef.current) return;
    const scrollDistance = calculateScrollDistance();
    if (scrollDistance === 0) return;

    const viewport = viewportElementRef.current;
    const newScrollLeft = Math.max(0, viewport.scrollLeft - scrollDistance);
    viewport.scrollTo({ left: newScrollLeft, behavior: "smooth" });
  }, [calculateScrollDistance]);

  const scrollNext = useCallback(() => {
    if (!viewportElementRef.current) return;
    const scrollDistance = calculateScrollDistance();
    if (scrollDistance === 0) return;

    const viewport = viewportElementRef.current;
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    const newScrollLeft = Math.min(maxScroll, viewport.scrollLeft + scrollDistance);
    viewport.scrollTo({ left: newScrollLeft, behavior: "smooth" });
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

    const updateScrollState = () => {
      const scrollLeft = viewport.scrollLeft;
      const maxScroll = viewport.scrollWidth - viewport.clientWidth;
      setCanScrollPrev(scrollLeft > 1);
      setCanScrollNext(scrollLeft < maxScroll - 1);
    };

    const timeoutId = setTimeout(() => {
      viewport.addEventListener("scroll", updateScrollState, { passive: true });
      window.addEventListener("resize", updateScrollState, { passive: true });
      updateScrollState();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      viewport.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [viewportReady]);

  const arrowButtonClasses =
    "hidden md:flex absolute top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full bg-white border border-[#DADADA] hover:border-[#4779FF] transition-all duration-150 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:scale-[0.90] shadow-sm";
  const arrowButtonStateClasses = (canScroll: boolean) =>
    canScroll ? "opacity-100 cursor-pointer" : "opacity-0 cursor-not-allowed pointer-events-none";
  const arrowIconClasses = (canScroll: boolean) =>
    `w-4 h-4 transition-colors ${canScroll ? "text-[#030303]" : "text-[#DADADA]"}`;

  return (
    <div className="relative pt-[28px] pb-0">
      <div className="relative w-full">
        <button
          type="button"
          onClick={scrollPrev}
          disabled={!canScrollPrev}
          className={`${arrowButtonClasses} left-0 ${arrowButtonStateClasses(canScrollPrev)}`}
          aria-label="Scroll left"
        >
          <ChevronLeft className={arrowIconClasses(canScrollPrev)} strokeWidth={1.5} />
        </button>

        <button
          type="button"
          onClick={scrollNext}
          disabled={!canScrollNext}
          className={`${arrowButtonClasses} right-0 ${arrowButtonStateClasses(canScrollNext)}`}
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
          className="overflow-hidden relative"
          ref={(node) => {
            emblaRef(node);
            viewportElementRef.current = node;
            if (node) setViewportReady(true);
          }}
        >
          <div
            ref={containerRef}
            className="flex font-medium items-center gap-[20px] text-[15px]"
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                className={`flex flex-col justify-center relative shrink-0 cursor-pointer transition-all duration-150 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] active:scale-[0.90] pb-[6px] ${
                  activeTab === tab
                    ? "text-[#030303]"
                    : "text-[#606060] hover:text-[#030303]"
                }`}
              >
                <p className="leading-[normal] text-nowrap whitespace-pre">{tab}</p>
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-[18px] bg-[#4779FF] rounded-full transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
