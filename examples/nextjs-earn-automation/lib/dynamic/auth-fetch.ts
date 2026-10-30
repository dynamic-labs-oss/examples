import { getAuthToken } from "@dynamic-labs/sdk-react-core";

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
  const token = getAuthToken();
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
