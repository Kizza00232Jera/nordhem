/**
 * Step 12 bring-your-own-engine. When SEARCH_API_TOKEN is set, the search
 * service requires a matching `Authorization: Bearer <token>` on its endpoints,
 * so a tunnelled local service is not open to the whole internet. No token
 * configured means open (local dev, CI, the integration tests).
 */
export function bearerMatches(
  authHeader: string | undefined,
  token: string | undefined,
): boolean {
  if (!token) return true;
  if (!authHeader) return false;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return !!match && match[1] === token;
}
