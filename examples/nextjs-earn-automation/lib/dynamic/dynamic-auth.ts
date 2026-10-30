import jwt, { type JwtPayload } from "jsonwebtoken";
import { JwksClient } from "jwks-rsa";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

export type JwtVerifiedCredential = {
  id: string;
  address: string;
  chain: string;
  format: string;
  wallet_name: string;
  wallet_provider: string;
};

export interface DynamicJwtPayload extends JwtPayload {
  sub: string;
  environment_id: string;
  verified_credentials: JwtVerifiedCredential[];
  email: string;
}

const JWKS_URL = `${env.NEXT_PUBLIC_DYNAMIC_API_BASE}/sdk/${env.NEXT_PUBLIC_DYNAMIC_ENV_ID}/.well-known/jwks`;

const client = new JwksClient({
  jwksUri: JWKS_URL,
  rateLimit: true,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000,
});

export async function verifyDynamicJWT(
  token: string
): Promise<DynamicJwtPayload | null> {
  try {
    const signingKey = await client.getSigningKey();
    const publicKey = signingKey.getPublicKey();
    return jwt.verify(token, publicKey, {
      ignoreExpiration: false,
    }) as DynamicJwtPayload;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

export type AuthenticatedUser = DynamicJwtPayload;

export function userOwnsAddress(
  user: AuthenticatedUser,
  address: string
): boolean {
  return user.verified_credentials.some(
    (cred) => cred.address.toLowerCase() === address.toLowerCase()
  );
}

type AuthenticatedRequestHandler = (
  req: NextRequest,
  { user }: { user: AuthenticatedUser }
) => Promise<NextResponse> | NextResponse;

export const withAuth =
  (handler: AuthenticatedRequestHandler) =>
  async (req: NextRequest): Promise<NextResponse> => {
    try {
      const authHeader = req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json(
          { error: "Authorization header with Bearer token required" },
          { status: 401 }
        );
      }
      const token = authHeader.slice(7);
      if (!token) {
        return NextResponse.json(
          { error: "Authorization token not found" },
          { status: 401 }
        );
      }
      const user = await verifyDynamicJWT(token);
      if (!user) {
        return NextResponse.json(
          { error: "Invalid authentication token" },
          { status: 401 }
        );
      }
      return handler(req, { user });
    } catch (error) {
      console.error("An unexpected error occurred during auth:", error);
      return NextResponse.json(
        { error: "An internal server error occurred" },
        { status: 500 }
      );
    }
  };
