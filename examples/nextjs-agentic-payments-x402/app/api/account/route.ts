import { type NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { deriveAccountCode } from "@/lib/shared/delegation-store";
import { DELEGATION_CHAIN } from "@/lib/shared/constants";
import { getDelegationByAddress } from "@/lib/shared/delegation-store";

/**
 * Returns the short account code for a wallet address — shown to the user so an
 * operator/system can tell the agent which account to act for (`pnpm agent <code>`).
 *
 * The code is deterministic from the address, so we can return it immediately;
 * `delegated` reflects whether the authorize step has stored credentials yet.
 * The code is not a secret (it doesn't grant access to funds — signing creds
 * stay encrypted server-side), so a public address lookup is acceptable here.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: "A valid `address` query param is required" },
      { status: 400 }
    );
  }

  const delegation = await getDelegationByAddress(address, DELEGATION_CHAIN);
  return NextResponse.json({
    address,
    code: deriveAccountCode(address),
    delegated: Boolean(delegation),
  });
}
