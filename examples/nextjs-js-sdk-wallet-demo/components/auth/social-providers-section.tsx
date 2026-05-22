"use client";

/**
 * Social Providers Authentication Section
 *
 * Renders a button for each social provider enabled in the dashboard.
 * Handles the OAuth redirect flow (detect redirect -> complete auth).
 * Includes the "or" divider when email auth is also enabled.
 *
 * @see https://www.dynamic.xyz/docs/javascript/authentication-methods/social
 */

import { useState, useEffect } from "react";
import { SocialIcon } from "@dynamic-labs/iconic";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorMessage } from "@/components/error-message";
import { WidgetCard } from "@/components/ui/widget-card";
import type { SocialProvider } from "@dynamic-labs-sdk/client";
import { useSocialAuth } from "@/hooks/use-mutations";
import {
  detectOAuthRedirect,
  completeSocialAuthentication,
  getEnabledSocialProviders,
  isEmailAuthEnabled,
} from "@/lib/dynamic";

// Module-level guard — survives Strict Mode unmount/remount
let oauthHandled = false;

interface SocialProvidersSectionProps {
  /** Callback when OAuth redirect is completing (shows full-screen loading) */
  onCompletingOAuth?: (isCompleting: boolean) => void;
}

/**
 * Social providers section — returns null if no social providers are enabled
 */
export function SocialProvidersSection({
  onCompletingOAuth,
}: SocialProvidersSectionProps) {
  const [oauthError, setOauthError] = useState<Error | null>(null);
  const socialAuth = useSocialAuth();

  const enabledProviders = getEnabledSocialProviders();

  useEffect(() => {
    if (oauthHandled) return;
    oauthHandled = true;

    const handleOAuthRedirect = async () => {
      try {
        const url = new URL(window.location.href);
        const isReturning = await detectOAuthRedirect({ url });

        if (isReturning) {
          onCompletingOAuth?.(true);
          await completeSocialAuthentication({ url });

          // Clean OAuth params from URL to prevent re-processing on refresh
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("dynamicOauthCode");
          cleanUrl.searchParams.delete("dynamicOauthState");
          window.history.replaceState({}, "", cleanUrl.toString());
        }
      } catch (error) {
        console.error("OAuth redirect error:", error);
        setOauthError(error as Error);
      } finally {
        onCompletingOAuth?.(false);
      }
    };

    handleOAuthRedirect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (enabledProviders.length === 0) return null;

  const handleSocialSignIn = async (provider: SocialProvider) => {
    try {
      await socialAuth.mutateAsync(provider);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <>
      {/* Divider — only shown when email auth is also enabled */}
      {isEmailAuthEnabled() && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-(--widget-border)" />
          <span className="text-xs text-(--widget-muted)">or</span>
          <div className="flex-1 h-px bg-(--widget-border)" />
        </div>
      )}

      {enabledProviders.map((provider) => (
        <Button
          key={provider}
          variant="secondary"
          className="w-full"
          onClick={() => handleSocialSignIn(provider as SocialProvider)}
          loading={socialAuth.isPending}
        >
          <SocialIcon name={provider} className="w-4 h-4" />
          Continue with {capitalize(provider)}
        </Button>
      ))}

      <ErrorMessage error={socialAuth.error || oauthError} />
    </>
  );
}

/**
 * Completing OAuth loading screen — shown when returning from a provider redirect
 */
export function SocialAuthCompletingCard() {
  return (
    <WidgetCard title="Signing In" subtitle="Completing authentication...">
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    </WidgetCard>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

/** Capitalize first letter of a string */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
