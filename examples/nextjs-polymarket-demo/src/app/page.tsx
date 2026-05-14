"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { MarketCard } from "@/components/MarketCard";
import { Navigation } from "@/components/Navigation";
import { TagsFilter } from "@/components/TagsFilter";
import { SortFilter } from "@/components/SortFilter";
import { MarketStats } from "@/components/MarketStats";
import {
  usePolymarketMarkets,
  type Market,
  calculateTimeRemaining,
} from "@/lib/hooks/usePolymarketMarkets";

export default function Home() {
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("newest");

  const { data: markets = [], isLoading, error } = usePolymarketMarkets();

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    markets.forEach((market) => {
      market.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [markets]);

  const filteredMarkets = useMemo(() => {
    if (!markets.length) return [];

    const lowerSearchQuery = searchQuery.toLowerCase();

    let filtered = markets.filter((market: Market) => {
      if (activeTab !== "All" && market.category !== activeTab) {
        return false;
      }

      if (
        lowerSearchQuery &&
        !market.question.toLowerCase().includes(lowerSearchQuery)
      ) {
        return false;
      }

      if (selectedTags.length > 0) {
        const marketTags = market.tags || [];
        if (!selectedTags.some((tag) => marketTags.includes(tag))) {
          return false;
        }
      }

      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "newest": {
          const timeA = new Date(a.endDate).getTime();
          const timeB = new Date(b.endDate).getTime();
          return timeB - timeA;
        }
        case "oldest": {
          const timeA = new Date(a.endDate).getTime();
          const timeB = new Date(b.endDate).getTime();
          return timeA - timeB;
        }
        case "volume":
          return b.volume - a.volume;
        case "traders": {
          const tradersA = a.yesTraders + a.noTraders;
          const tradersB = b.yesTraders + b.noTraders;
          return tradersB - tradersA;
        }
        case "price-diff": {
          const diffA = Math.abs(
            parseFloat(a.yesPrice) - parseFloat(a.noPrice)
          );
          const diffB = Math.abs(
            parseFloat(b.yesPrice) - parseFloat(b.noPrice)
          );
          return diffA - diffB;
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [markets, activeTab, searchQuery, selectedTags, sortBy]);

  return (
    <>
      <Header searchValue={searchQuery} onSearchChange={setSearchQuery} />
      <div className="px-[20px] sm:px-[32px] md:px-[48px] lg:px-[64px] xl:px-[80px]">
      <div style={{ maxWidth: "1440px", margin: "0 auto" }}>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <TagsFilter
        selectedTags={selectedTags}
        onTagToggle={handleTagToggle}
        availableTags={availableTags}
      />
      <SortFilter sortBy={sortBy} onSortChange={setSortBy} />
      <MarketStats markets={filteredMarkets} />

      {/* Market Cards Grid */}
      <div className="pt-[27px] pb-[93px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-[18px] text-[#606060]">
              Loading markets...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-[18px] text-[#606060]">
              Error loading markets. Please try again later.
            </p>
          </div>
        ) : filteredMarkets.length > 0 ? (
          <div className="grid grid-cols-responsive gap-x-[20px] gap-y-[20px]">
            {filteredMarkets.map((market: Market) => (
              <MarketCard
                key={market.id}
                question={market.question}
                timeRemaining={calculateTimeRemaining(market.endDate)}
                yesPrice={market.yesPrice}
                noPrice={market.noPrice}
                category={market.category}
                imageUrl={market.imageUrl}
                yesTraders={market.yesTraders}
                noTraders={market.noTraders}
                conditionId={market.conditionId}
                yesTokenId={market.yesTokenId}
                noTokenId={market.noTokenId}
                marketId={market.id}
                tags={market.tags}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-[18px] text-[#606060]">
              No markets found
            </p>
          </div>
        )}
      </div>
      </div>
      </div>
    </>
  );
}
