import { newPasswordError } from "../../../src/shared/lib/passwordPolicy.ts";
import { RequestFailure } from "./request.ts";

/** Fail closed. SHA-1 is only the HIBP lookup format, never password storage. */
export async function assertUncompromisedPassword(password: unknown): Promise<string> {
  if (typeof password !== "string" || newPasswordError(password))
    throw new RequestFailure(400, "PASSWORD_POLICY");
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password)),
  );
  const hash = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true", "User-Agent": "CYBER-TMSAH-password-policy" },
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    if (!response.ok || !response.body) throw new Error("Unavailable");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        length += next.value.length;
        if (length > 1_048_576) {
          await reader.cancel();
          throw new Error("Invalid response");
        }
        chunks.push(next.value);
      }
    } finally {
      reader.releaseLock();
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }
    const lines = new TextDecoder().decode(body).trim().split(/\r?\n/);
    if (!lines.length || lines.some((line) => !/^[A-Fa-f0-9]{35}:\d+$/.test(line)))
      throw new Error("Invalid response");
    if (
      lines.some(
        (line) => line.slice(0, 35).toUpperCase() === hash.slice(5) && Number(line.slice(36)) > 0,
      )
    )
      throw new RequestFailure(400, "PASSWORD_COMPROMISED");
    return password;
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    // Never log the password, its hash, prefix, provider body or exception.
    throw new RequestFailure(503, "PASSWORD_CHECK_UNAVAILABLE");
  }
}
