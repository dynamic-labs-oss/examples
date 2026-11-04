import { dynamicClient } from "@/lib/dynamic/client";

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required. Please log in.");
    this.name = "AuthRequiredError";
  }
}

export async function authFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  // The session JWT; null when signed out (or in cookie-auth mode).
  const token = dynamicClient.token;
  if (!token) throw new AuthRequiredError();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
