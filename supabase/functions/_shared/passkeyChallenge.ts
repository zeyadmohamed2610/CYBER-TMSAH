/** Read the signed client-data challenge without treating it as verified yet. */
export function readAssertionChallenge(credential: Record<string, unknown>): string {
  const response = credential.response as Record<string, unknown> | undefined;
  const encoded = response?.clientDataJSON;
  if (typeof encoded !== "string" || encoded.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw new Error("Invalid client data");
  }
  const bytes = Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
  const data = JSON.parse(new TextDecoder().decode(bytes)) as { challenge?: unknown };
  if (typeof data.challenge !== "string" || !/^[A-Za-z0-9_-]{16,512}$/.test(data.challenge)) {
    throw new Error("Invalid challenge");
  }
  return data.challenge;
}
