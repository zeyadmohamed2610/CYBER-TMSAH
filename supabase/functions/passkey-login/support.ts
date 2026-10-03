export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getOrigin(req?: Request): string | string[] {
  const envOrigin = Deno.env.get("WEBAUTHN_ORIGIN");
  const requestOrigin = req?.headers.get("origin") ?? "";

  const allowedOrigins = [
    "https://cyber-tmsah.vercel.app",
    "https://www.cyber-tmsah.site",
    "https://cyber-tmsah.site",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
  ];
  if (envOrigin && !allowedOrigins.includes(envOrigin)) {
    allowedOrigins.push(envOrigin);
  }

  if (requestOrigin) {
    try {
      const u = new URL(requestOrigin);
      if (
        u.hostname === "localhost" ||
        u.hostname === "127.0.0.1" ||
        allowedOrigins.includes(requestOrigin)
      ) {
        if (!allowedOrigins.includes(requestOrigin)) {
          allowedOrigins.push(requestOrigin);
        }
        return requestOrigin;
      }
    } catch { /* ignore */ }
  }

  return allowedOrigins;
}

export function getRpId(req?: Request): string {
  const envRpId = Deno.env.get("WEBAUTHN_RP_ID");
  if (envRpId) return envRpId;
  const requestOrigin = req?.headers.get("origin") ?? "";
  if (requestOrigin) {
    try {
      const u = new URL(requestOrigin);
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
        return u.hostname;
      }
      return u.hostname;
    } catch { /* ignore */ }
  }
  return "www.cyber-tmsah.site";
}

export function getExpectedRpIds(req?: Request): string[] {
  const current = getRpId(req);
  return Array.from(new Set([
    current,
    "cyber-tmsah.site",
    "www.cyber-tmsah.site",
    "cyber-tmsah.vercel.app",
    "localhost",
  ]));
}

export function getRpName(): string {
  return Deno.env.get("WEBAUTHN_RP_NAME") ?? "CYBER TMSAH";
}

