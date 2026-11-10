import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/env";

/**
 * GET /api/vaults — proxies the environment's yield vault list using the
 * caller's Dynamic JWT so the UI never holds an API token.
 */
export const GET = async (req: NextRequest) => {
  const auth = req.headers.get("authorization");
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await fetch(
    `${env.NEXT_PUBLIC_DYNAMIC_API_BASE}/sdk/${env.NEXT_PUBLIC_DYNAMIC_ENV_ID}/yield/vaults`,
    { headers: { Authorization: auth } }
  );
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
};
