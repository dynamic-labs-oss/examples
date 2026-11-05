/**
 * Delegation storage for the Next.js app.
 *
 * Backed by Supabase with AES-256-GCM encryption at rest. The implementation is
 * framework-agnostic and lives in lib/shared so the standalone agent can reuse it.
 */
export * from "@/lib/shared/delegation-store";
