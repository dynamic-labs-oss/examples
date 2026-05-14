import { NextResponse } from "next/server";

interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  endDate: string;
  category: string;
  image?: string;
  icon?: string;
  outcomes?: string;
  outcomePrices?: string;
  volume?: string;
  volumeNum?: number;
  active?: boolean;
  closed?: boolean;
  clobTokenIds?: string;
}

interface TransformedMarket {
  id: string;
  question: string;
  endDate: string; // Send raw date, calculate timeRemaining on client
  yesPrice: string;
  noPrice: string;
  category: string;
  imageUrl: string;
  yesTraders: number;
  noTraders: number;
  conditionId: string;
  yesTokenId?: string;
  noTokenId?: string;
  tags: string[]; // Tags like "trending", "hot", "new", "ending soon"
  volume: number; // For sorting/filtering
}

const CATEGORY_MAP: Record<string, string> = {
  // Game Lines
  sports: "Game Lines",
  nfl: "Game Lines",
  nba: "Game Lines",
  mlb: "Game Lines",
  nhl: "Game Lines",
  soccer: "Game Lines",
  football: "Game Lines",
  basketball: "Game Lines",
  baseball: "Game Lines",
  hockey: "Game Lines",
  tennis: "Game Lines",
  golf: "Game Lines",
  mma: "Game Lines",
  boxing: "Game Lines",
  // Player Props
  player: "Player Props",
  prop: "Player Props",
  // Head to Head
  "head-to-head": "Head to Head",
  // Futures / Politics
  politics: "Futures",
  election: "Futures",
  political: "Futures",
  crypto: "Futures",
  bitcoin: "Futures",
  ethereum: "Futures",
  economy: "Futures",
  financial: "Futures",
  "current-affairs": "Futures",
  "us-current-affairs": "Futures",
  // Awards
  award: "Awards",
  oscar: "Awards",
  grammy: "Awards",
  emmy: "Awards",
  // Season Totals
  season: "Season Totals",
  // Live
  live: "Live",
  // Specials
  entertainment: "Specials",
  celebrity: "Specials",
  science: "Specials",
  tech: "Specials",
  weather: "Specials",
};

function transformMarket(
  market: PolymarketMarket,
  now: number
): TransformedMarket | null {
  try {
    // Fast path: parse outcomes and prices only if they exist
    let outcomes: string[] = ["Yes", "No"];
    let prices: string[] = ["0", "0"];

    if (market.outcomes) {
      try {
        outcomes = JSON.parse(market.outcomes) as string[];
      } catch {
        // Use defaults
      }
    }

    if (market.outcomePrices) {
      try {
        prices = JSON.parse(market.outcomePrices) as string[];
      } catch {
        // Use defaults
      }
    }

    // Find Yes and No indices (optimized)
    const lowerOutcomes = outcomes.map((o) => o.toLowerCase());
    const yesIndex = lowerOutcomes.findIndex(
      (o) => o.includes("yes") || o === "true"
    );
    const noIndex = lowerOutcomes.findIndex(
      (o) => o.includes("no") || o === "false"
    );

    const finalYesIndex = yesIndex >= 0 ? yesIndex : 0;
    const finalNoIndex = noIndex >= 0 ? noIndex : yesIndex >= 0 ? 1 : 1;

    // Parse and normalize prices
    let yesPriceNum = parseFloat(prices[finalYesIndex] || "0");
    let noPriceNum = parseFloat(prices[finalNoIndex] || "0");

    // Check if prices need conversion (sum > 1.5 means already in 0-100 range)
    const priceSum = yesPriceNum + noPriceNum;
    if (priceSum <= 1.5 && priceSum > 0) {
      yesPriceNum *= 100;
      noPriceNum *= 100;
    }

    // Normalize to sum to 100
    const total = yesPriceNum + noPriceNum;
    if (total > 0) {
      const factor = 100 / total;
      yesPriceNum *= factor;
      noPriceNum *= factor;
    } else {
      yesPriceNum = 50;
      noPriceNum = 50;
    }

    const yesPrice = Math.max(0, Math.min(100, yesPriceNum)).toFixed(1);
    const noPrice = Math.max(0, Math.min(100, noPriceNum)).toFixed(1);

    // Parse token IDs
    let yesTokenId: string | undefined;
    let noTokenId: string | undefined;
    if (market.clobTokenIds) {
      try {
        const tokenIds = JSON.parse(market.clobTokenIds) as string[];
        if (tokenIds.length >= 2) {
          yesTokenId = tokenIds[finalYesIndex] || tokenIds[0];
          noTokenId = tokenIds[finalNoIndex] || tokenIds[1];
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Map category (optimized lookup)
    let category = "All";
    if (market.category) {
      const lowerCategory = market.category.toLowerCase();
      for (const [key, value] of Object.entries(CATEGORY_MAP)) {
        if (lowerCategory.includes(key)) {
          category = value;
          break;
        }
      }
    }

    // Calculate traders from volume
    const volume =
      market.volumeNum ?? (market.volume ? parseFloat(market.volume) : 0);
    const yesTraders = Math.floor(volume * 0.4);
    const noTraders = Math.floor(volume * 0.3);

    // Generate tags based on market characteristics
    const tags: string[] = [];
    const endTime = new Date(market.endDate).getTime();
    const hoursUntilEnd = (endTime - now) / (1000 * 60 * 60);

    // "Ending Soon" - less than 24 hours
    if (hoursUntilEnd > 0 && hoursUntilEnd < 24) {
      tags.push("ending soon");
    }

    // "New" - created recently (using volume as proxy, low volume = new)
    if (volume < 1000) {
      tags.push("new");
    }

    // "Hot" - high volume
    if (volume > 50000) {
      tags.push("hot");
    }

    // "Trending" - high trader count
    const totalTraders = yesTraders + noTraders;
    if (totalTraders > 100) {
      tags.push("trending");
    }

    // "High Stakes" - very high volume
    if (volume > 200000) {
      tags.push("high stakes");
    }

    // "Close Call" - prices are close (within 10%)
    const priceDiff = Math.abs(parseFloat(yesPrice) - parseFloat(noPrice));
    if (priceDiff < 10) {
      tags.push("close call");
    }

    return {
      id: market.id,
      question: market.question,
      endDate: market.endDate, // Send raw date for client-side calculation
      yesPrice,
      noPrice,
      category,
      imageUrl: market.image || market.icon || "",
      yesTraders,
      noTraders,
      conditionId: market.conditionId,
      yesTokenId,
      noTokenId,
      tags,
      volume,
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || "100";
    const active = searchParams.get("active") !== "false";

    // Build URL
    const url = new URL("https://gamma-api.polymarket.com/markets");
    url.searchParams.set("limit", limit);
    if (active) {
      url.searchParams.set("closed", "false");
      url.searchParams.set("active", "true");
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Polymarket API error: ${response.status} - ${errorText}`
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      throw new Error(`Unexpected content type: ${contentType}`);
    }

    const data = await response.json();

    // Handle different response formats
    const markets: PolymarketMarket[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.markets)
      ? data.markets
      : [];

    if (markets.length === 0) {
      return NextResponse.json([]);
    }

    // Cache current time for all comparisons
    const now = Date.now();

    // Pre-parse endDates for filtering and sorting (cache date objects)
    const marketsWithDates = markets.map((market) => ({
      market,
      endTime: new Date(market.endDate).getTime(),
    }));

    // Filter and sort
    const activeMarkets = marketsWithDates
      .filter(({ market, endTime }) => {
        const hasActive = market.active !== undefined;
        const hasClosed = market.closed !== undefined;

        // Fast path: use explicit fields if available
        if (hasActive && hasClosed) {
          return market.active && !market.closed;
        }

        // Check endDate (use pre-parsed time)
        if (isNaN(endTime)) return true; // Include if date is invalid
        const isEndDatePassed = endTime < now;

        if (hasActive) return market.active && !isEndDatePassed;
        if (hasClosed) return !market.closed && !isEndDatePassed;
        return !isEndDatePassed;
      })
      .sort((a, b) => {
        // Sort by endDate (most recent first)
        return (
          (isNaN(b.endTime) ? 0 : b.endTime) -
          (isNaN(a.endTime) ? 0 : a.endTime)
        );
      })
      .map(({ market }) => market); // Extract just the market objects

    // Transform markets (pass cached now time)
    const transformedMarkets = activeMarkets
      .map((market) => transformMarket(market, now))
      .filter((market): market is TransformedMarket => market !== null);

    return NextResponse.json(transformedMarkets, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch markets", details: errorMessage },
      { status: 500 }
    );
  }
}
