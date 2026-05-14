import { NextRequest, NextResponse } from "next/server";
import https from "https";

const POLYMARKET_DATA_API = "https://data-api.polymarket.com";

// data-api.polymarket.com has a mismatched SAN on its TLS cert — use a
// scoped https.Agent to bypass verification for this host only.
function httpsGet(url: string): Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: false }, (res) => {
      let body = "";
      res.on("data", (chunk: string) => { body += chunk; });
      res.on("end", () => {
        const status = res.statusCode ?? 0;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          json: async () => JSON.parse(body),
          text: async () => body,
        });
      });
    });
    req.on("error", reject);
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const user = searchParams.get("user");

  if (!user) {
    return NextResponse.json(
      { error: "User address is required" },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams({
      user,
      sizeThreshold: searchParams.get("sizeThreshold") || "0.01",
      limit: searchParams.get("limit") || "100",
      sortBy: searchParams.get("sortBy") || "CURRENT",
      sortDirection: searchParams.get("sortDirection") || "DESC",
    });

    // Add optional filters if provided
    const redeemable = searchParams.get("redeemable");
    if (redeemable) params.set("redeemable", redeemable);

    const mergeable = searchParams.get("mergeable");
    if (mergeable) params.set("mergeable", mergeable);

    const response = await httpsGet(`${POLYMARKET_DATA_API}/positions?${params}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Polymarket API error: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error) {
    console.error("Position fetch error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch positions", details: errorMessage },
      { status: 500 }
    );
  }
}

