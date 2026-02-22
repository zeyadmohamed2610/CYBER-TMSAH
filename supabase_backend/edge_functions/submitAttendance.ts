import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const WINDOW_SECONDS = 30;
const RATE_LIMIT_PER_MINUTE = 20;
const encoder = new TextEncoder();

type SubmitAttendancePayload = {
  session_id: string;
  rotating_hash: string;
  time_window: number;
  latitude: number;
  longitude: number;
  device_hash: string;
  request_nonce: string;
  device_memory?: number | null;
};

const MOBILE_UA_REGEX =
  /(android|iphone|ipad|ipod|mobile|blackberry|iemobile|windows phone|opera mini|silk|mobile safari)/i;
const MOBILE_ENFORCEMENT_MESSAGE_AR =
  "تم رفض تسجيل الحضور: يجب استخدام جهاز جوال حقيقي مع بيانات الجهاز المطلوبة.";
const VPN_REJECTION_MESSAGE_AR =
  "تم رفض تسجيل الحضور: الاتصال عبر VPN أو Proxy أو شبكة استضافة غير مسموح.";

const createJsonResponse = (status: number, payload: Record<string, unknown>) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};

const getClientIp = (request: Request): string | null => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  return request.headers.get("x-real-ip");
};

const computeHmacSha256 = async (payload: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return [...new Uint8Array(signature)].map((value) => value.toString(16).padStart(2, "0")).join("");
};

const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const isValidPayload = (payload: SubmitAttendancePayload): boolean => {
  return (
    typeof payload.session_id === "string" &&
    typeof payload.rotating_hash === "string" &&
    typeof payload.time_window === "number" &&
    typeof payload.latitude === "number" &&
    typeof payload.longitude === "number" &&
    typeof payload.device_hash === "string" &&
    typeof payload.request_nonce === "string"
  );
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const parseBooleanLike = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes") {
      return true;
    }
    if (normalized === "0" || normalized === "false" || normalized === "no") {
      return false;
    }
  }

  return null;
};

const isFeatureEnabled = (value: string | undefined | null): boolean => {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

const isLikelyMobileUserAgent = (userAgent: string): boolean => {
  if (!userAgent.trim()) {
    return false;
  }
  return MOBILE_UA_REGEX.test(userAgent);
};

const extractVpnOrHostingSignal = (payload: unknown): boolean => {
  if (!isObject(payload)) {
    return false;
  }

  const directKeys = [
    "proxy",
    "is_proxy",
    "hosting",
    "is_hosting",
    "vpn",
    "is_vpn",
    "tor",
    "is_tor",
  ];

  for (const key of directKeys) {
    const parsed = parseBooleanLike(payload[key]);
    if (parsed === true) {
      return true;
    }
  }

  const nestedCandidates = ["security", "data", "result"];
  for (const candidate of nestedCandidates) {
    const nested = payload[candidate];
    if (isObject(nested)) {
      const nestedDetected = extractVpnOrHostingSignal(nested);
      if (nestedDetected) {
        return true;
      }
    }
  }

  return false;
};

const runVpnCheck = async (ipAddress: string): Promise<{ blocked: boolean; providerPayload: unknown }> => {
  const endpointTemplate = Deno.env.get("VPN_INTELLIGENCE_URL");
  if (!endpointTemplate) {
    throw new Error("VPN_INTELLIGENCE_URL is required when ENABLE_VPN_CHECK=true.");
  }

  const apiKey = Deno.env.get("VPN_INTELLIGENCE_API_KEY");
  const apiKeyHeader = Deno.env.get("VPN_INTELLIGENCE_API_KEY_HEADER") || "x-api-key";

  const targetUrl = endpointTemplate.includes("{ip}")
    ? endpointTemplate.replace("{ip}", encodeURIComponent(ipAddress))
    : `${endpointTemplate}${endpointTemplate.includes("?") ? "&" : "?"}ip=${encodeURIComponent(ipAddress)}`;

  const headers = new Headers({ Accept: "application/json" });
  if (apiKey) {
    headers.set(apiKeyHeader, apiKey);
  }

  const response = await fetch(targetUrl, { method: "GET", headers });
  if (!response.ok) {
    throw new Error(`VPN intelligence request failed with status ${response.status}.`);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return {
    blocked: extractVpnOrHostingSignal(payload),
    providerPayload: payload,
  };
};

serve(async (request) => {
  if (request.method !== "POST") {
    return createJsonResponse(405, { error: "Method not allowed. Use POST." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const serverSecret = Deno.env.get("SERVER_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !serverSecret) {
    return createJsonResponse(500, {
      error: "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SERVER_SECRET are required.",
    });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return createJsonResponse(401, { error: "Missing bearer token." });
  }

  const jwt = authorization.replace("Bearer ", "").trim();
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent")?.trim() ?? "";
  const vpnCheckEnabled = isFeatureEnabled(Deno.env.get("ENABLE_VPN_CHECK"));

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: SubmitAttendancePayload;
  try {
    body = await request.json();
  } catch {
    return createJsonResponse(400, { error: "Invalid JSON body." });
  }

  if (!isValidPayload(body)) {
    return createJsonResponse(400, { error: "Invalid payload fields." });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !authData.user) {
    return createJsonResponse(401, { error: "Invalid JWT token." });
  }

  const userId = authData.user.id;

  const hasDeviceMemoryField = Object.prototype.hasOwnProperty.call(body, "device_memory");
  const isDeviceMemoryUndefined = typeof body.device_memory === "undefined";
  const isMobileUserAgent = isLikelyMobileUserAgent(userAgent);
  if (!isMobileUserAgent || isDeviceMemoryUndefined) {
    await supabaseAdmin.from("system_logs").insert({
      actor_user_id: userId,
      action: "attendance_mobile_enforcement_failed",
      severity: "warning",
      metadata: {
        session_id: body.session_id,
        is_mobile_user_agent: isMobileUserAgent,
        has_device_memory: hasDeviceMemoryField,
        is_device_memory_undefined: isDeviceMemoryUndefined,
        user_agent: userAgent,
      },
      ip_address: ipAddress,
      device_hash: body.device_hash,
    });

    return createJsonResponse(403, {
      error: MOBILE_ENFORCEMENT_MESSAGE_AR,
    });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const timeWindowNow = Math.floor(now.getTime() / 1000 / WINDOW_SECONDS);

  const { count: recentAttempts, error: rateLimitError } = await supabaseAdmin
    .from("system_logs")
    .select("id", { head: true, count: "exact" })
    .eq("action", "attendance_submit_attempt")
    .or(`ip_address.eq.${ipAddress ?? "null"},device_hash.eq.${body.device_hash}`)
    .gte("created_at", new Date(now.getTime() - 60 * 1000).toISOString());

  if (rateLimitError) {
    return createJsonResponse(500, { error: "Rate limit pre-check failed.", details: rateLimitError.message });
  }

  if ((recentAttempts ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    await supabaseAdmin.from("system_logs").insert({
      actor_user_id: userId,
      action: "attendance_rate_limit_hit_edge",
      severity: "critical",
      metadata: { recent_attempts: recentAttempts },
      ip_address: ipAddress,
      device_hash: body.device_hash,
    });

    return createJsonResponse(429, { error: "Rate limit exceeded. Try again later." });
  }

  if (vpnCheckEnabled) {
    if (!ipAddress) {
      await supabaseAdmin.from("system_logs").insert({
        actor_user_id: userId,
        action: "attendance_vpn_check_failed",
        severity: "warning",
        metadata: {
          session_id: body.session_id,
          reason: "missing_ip_address",
        },
        device_hash: body.device_hash,
      });

      return createJsonResponse(403, {
        error: "تم رفض تسجيل الحضور: تعذر التحقق من عنوان الشبكة.",
      });
    }

    try {
      const vpnResult = await runVpnCheck(ipAddress);
      if (vpnResult.blocked) {
        await supabaseAdmin.from("system_logs").insert({
          actor_user_id: userId,
          action: "attendance_vpn_rejected",
          severity: "warning",
          metadata: {
            session_id: body.session_id,
            ip_address: ipAddress,
            provider_response: vpnResult.providerPayload,
          },
          ip_address: ipAddress,
          device_hash: body.device_hash,
        });

        return createJsonResponse(403, {
          error: VPN_REJECTION_MESSAGE_AR,
        });
      }
    } catch (vpnError) {
      const reason = vpnError instanceof Error ? vpnError.message : "unknown_vpn_check_error";
      await supabaseAdmin.from("system_logs").insert({
        actor_user_id: userId,
        action: "attendance_vpn_check_failed",
        severity: "warning",
        metadata: {
          session_id: body.session_id,
          reason,
        },
        ip_address: ipAddress,
        device_hash: body.device_hash,
      });

      return createJsonResponse(403, {
        error: "تم رفض تسجيل الحضور: تعذر التحقق من أمان الشبكة.",
      });
    }
  }

  await supabaseAdmin.from("system_logs").insert({
    actor_user_id: userId,
    action: "attendance_submit_attempt",
    severity: "info",
    metadata: { session_id: body.session_id, time_window: body.time_window, edge_validated_at: nowIso },
    ip_address: ipAddress,
    device_hash: body.device_hash,
  });

  const { data: sessionData, error: sessionError } = await supabaseAdmin
    .from("sessions")
    .select("id, starts_at, ends_at, status, latitude, longitude, geofence_radius_meters")
    .eq("id", body.session_id)
    .maybeSingle();

  if (sessionError || !sessionData) {
    return createJsonResponse(404, { error: "Session not found." });
  }

  const startsAt = new Date(sessionData.starts_at);
  const endsAt = new Date(sessionData.ends_at);

  if (now < startsAt) {
    return createJsonResponse(400, { error: "Session has not started." });
  }

  if (now > endsAt) {
    return createJsonResponse(400, { error: "Session has ended." });
  }

  if (sessionData.status === "ended" || sessionData.status === "cancelled") {
    return createJsonResponse(400, { error: "Session is not active." });
  }

  if (!(now >= startsAt && now <= endsAt) || sessionData.status !== "active") {
    return createJsonResponse(400, { error: "Session is outside hard-expiry active window." });
  }

  if (Math.abs(body.time_window - timeWindowNow) > 1) {
    return createJsonResponse(400, { error: "Invalid rotating hash time window." });
  }

  const expectedHash = await computeHmacSha256(`${body.session_id}:${body.time_window}`, serverSecret);
  if (expectedHash !== body.rotating_hash) {
    return createJsonResponse(401, { error: "Rotating hash mismatch." });
  }

  const distanceMeters = haversineMeters(
    body.latitude,
    body.longitude,
    Number(sessionData.latitude),
    Number(sessionData.longitude),
  );

  if (distanceMeters > Number(sessionData.geofence_radius_meters)) {
    await supabaseAdmin.from("system_logs").insert({
      actor_user_id: userId,
      action: "attendance_geo_validation_failed",
      severity: "warning",
      metadata: {
        session_id: body.session_id,
        distance_meters: distanceMeters,
        allowed_radius_meters: sessionData.geofence_radius_meters,
      },
      ip_address: ipAddress,
      device_hash: body.device_hash,
    });
    return createJsonResponse(403, { error: "Outside allowed geofence." });
  }

  const { data: replayData, error: replayError } = await supabaseAdmin
    .from("attendance")
    .select("id")
    .eq("request_nonce", body.request_nonce)
    .maybeSingle();

  if (replayError) {
    return createJsonResponse(500, { error: "Replay check failed.", details: replayError.message });
  }

  if (replayData) {
    return createJsonResponse(409, { error: "Replay detected: request nonce already used." });
  }

  const { data: duplicateData, error: duplicateError } = await supabaseAdmin
    .from("attendance")
    .select("id")
    .eq("session_id", body.session_id)
    .eq("student_id", userId)
    .maybeSingle();

  if (duplicateError) {
    return createJsonResponse(500, { error: "Duplicate check failed.", details: duplicateError.message });
  }

  if (duplicateData) {
    return createJsonResponse(409, { error: "Duplicate attendance submission for this session." });
  }

  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("rpc_submit_attendance", {
    p_session_id: body.session_id,
    p_rotating_hash: body.rotating_hash,
    p_time_window: body.time_window,
    p_latitude: body.latitude,
    p_longitude: body.longitude,
    p_request_nonce: body.request_nonce,
    p_ip_address: ipAddress,
    p_device_hash: body.device_hash,
    p_student_id: userId,
  });

  if (rpcError) {
    await supabaseAdmin.from("system_logs").insert({
      actor_user_id: userId,
      action: "attendance_submit_failed_edge",
      severity: "warning",
      metadata: { session_id: body.session_id, error: rpcError.message },
      ip_address: ipAddress,
      device_hash: body.device_hash,
    });
    return createJsonResponse(400, { error: "RPC submission failed.", details: rpcError.message });
  }

  return createJsonResponse(200, {
    success: true,
    data: Array.isArray(rpcData) ? rpcData[0] : rpcData,
    distance_meters: Number(distanceMeters.toFixed(2)),
  });
});
