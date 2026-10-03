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
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function isAllowedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.origin !== origin) return false;
    if (['localhost','127.0.0.1'].includes(url.hostname)) return url.protocol === 'http:' || url.protocol === 'https:';
    return url.protocol === 'https:' && [
      'https://www.cyber-tmsah.site','https://cyber-tmsah.site','https://cyber-tmsah.vercel.app',
      Deno.env.get('WEBAUTHN_ORIGIN'),
    ].includes(origin);
  } catch { return false; }
}
