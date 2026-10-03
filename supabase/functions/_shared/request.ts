export class RequestFailure extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Enforce the limit even when Content-Length is absent or false. */
export async function readJsonObject(
  request: Request,
  limit = 16_384,
): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase().endsWith("/json"))
    throw new RequestFailure(415, "JSON required");
  const reader = request.body?.getReader();
  if (!reader) throw new RequestFailure(400, "Invalid request");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RequestFailure(413, "Request too large");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new RequestFailure(400, "Invalid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RequestFailure(400, "Invalid request");
  return value as Record<string, unknown>;
}

export function serverEnvironment() {
  const publishable = Deno.env.get("APP_SUPABASE_PUBLISHABLE_KEY");
  const secret = Deno.env.get("APP_SUPABASE_SECRET_KEY");
  return {
    ...(publishable ? { publishableKeys: { default: publishable } } : {}),
    ...(secret ? { secretKeys: { default: secret } } : {}),
  };
}
