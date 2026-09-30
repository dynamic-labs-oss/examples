import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.vaults.fyi";

/**
 * Catch-all proxy: forwards /api/vaultsfyi/* to api.vaults.fyi with the
 * server-side x-api-key attached. Keeps VAULTS_FYI_API_KEY out of the
 * browser bundle.
 *
 * The @vaultsfyi/sdk client in src/lib/vaultsFyi.ts is initialized with
 * apiBaseUrl = `${window.location.origin}/api/vaultsfyi`, so every SDK
 * call lands here first and the upstream sees them with auth.
 *
 * Works as-is on Vercel / any Next.js host. For split frontend/backend
 * deploys, replicate the header injection in your own gateway.
 */
async function proxy(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
) {
  const apiKey = process.env.VAULTS_FYI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "VAULTS_FYI_API_KEY is not set on the server. Add it to .env.local and restart.",
      },
      { status: 500 },
    );
  }

  const { path } = await params;
  const url = new URL(`${API_BASE}/${path.join("/")}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
    });

    const body = await upstream.text();
    if (!upstream.ok) {
      console.error(
        `[vaultsfyi proxy] upstream ${upstream.status} for ${url.pathname}${url.search}:`,
        body.slice(0, 500),
      );
    }
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err) {
    console.error(`[vaultsfyi proxy] fetch failed for ${url}:`, err);
    return NextResponse.json(
      { error: "Upstream request failed", detail: String(err) },
      { status: 502 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, params);
}
