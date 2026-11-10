import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { env } from "@/env";

/** Constant-time check of `Authorization: Bearer $CRON_SECRET`. */
export function isCronAuthorized(req: NextRequest): boolean {
  const provided = req.headers.get("authorization") ?? "";
  // Hash both sides so lengths match and timingSafeEqual can't throw.
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(`Bearer ${env.CRON_SECRET}`).digest();
  return timingSafeEqual(a, b);
}
