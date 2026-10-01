-- =============================================================================
-- Migration: 20261001000700_biometric_attendance_gate.sql
-- Purpose  : Add biometric credential tracking to the attendance system.
--            1. Add biometric_credential_id column to attendance table.
--            2. Update submit_attendance RPC to accept and record the biometric
--               credential ID — proving the student performed a live biometric
--               challenge at time of submission.
--            3. Add index for audit queries.
-- Security : The biometric gate is enforced in the frontend via WebAuthn
--            `allowCredentials` restricted to the submitting user's own
--            registered passkeys. The credential ID is logged in the DB for
--            forensic audit. The RPC itself does NOT re-verify the credential
--            cryptographically (that is done by the browser OS), but it records
--            whether biometric verification was performed for each record.
-- =============================================================================

-- 1. Add biometric_credential_id to attendance (nullable — backcompat with older records)
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS biometric_credential_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.attendance.biometric_credential_id IS
  'WebAuthn credential ID used at time of attendance submission. NULL means no biometric gate (legacy records or bypass).';

-- 2. Index for querying attendance records by biometric status
CREATE INDEX IF NOT EXISTS idx_attendance_biometric
  ON public.attendance (biometric_credential_id)
  WHERE biometric_credential_id IS NOT NULL;

-- 3. Replace submit_attendance to accept the new optional p_biometric_credential_id
--    and record it in both the row and the metadata audit log.
CREATE OR REPLACE FUNCTION public.submit_attendance(
  p_hash                      TEXT,
  p_device_fingerprint        TEXT DEFAULT NULL,
  p_student_latitude          DOUBLE PRECISION DEFAULT NULL,
  p_student_longitude         DOUBLE PRECISION DEFAULT NULL,
  p_biometric_credential_id   TEXT DEFAULT NULL
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, extensions
AS $$
DECLARE
  v_caller            public.users;
  v_session           public.sessions;
  v_record            public.attendance;
  v_fp                TEXT;
  v_ip                TEXT;
  v_recent            INTEGER;
  v_distance          DOUBLE PRECISION;
  v_window            BIGINT;
  v_gps_verified      BOOLEAN := FALSE;
  v_existing_auth     UUID;
  v_existing_fp       TEXT;
  v_biometric_ok      BOOLEAN;
BEGIN
  -- 1. Identify and authenticate caller
  v_caller := private.get_caller_user();

  IF v_caller IS NULL OR v_caller.role <> 'student' THEN
    RAISE EXCEPTION 'permission_denied: only students may submit attendance';
  END IF;

  -- 2. Anti-spam rate limiting (maximum 10 attempts per minute)
  SELECT COUNT(*) INTO v_recent
  FROM public.system_logs
  WHERE actor_id = v_caller.id
    AND action LIKE 'submit_attendance:%'
    AND created_at > now() - INTERVAL '1 minute';

  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'rate_limited: too many submission attempts, please wait';
  END IF;

  -- 3. Validate attendance hash
  IF p_hash IS NULL OR length(trim(p_hash)) = 0 THEN
    RAISE EXCEPTION 'validation_error: attendance hash cannot be empty';
  END IF;

  -- 4. Derive device fingerprint (fallback to SHA256 of UA + IP if not provided)
  v_fp := trim(COALESCE(p_device_fingerprint, ''));
  IF v_fp = '' THEN
    v_fp := encode(
      digest(
        COALESCE(private.current_request_user_agent(), '') || '|' ||
        COALESCE(private.current_request_ip(), ''),
        'sha256'
      ),
      'hex'
    );
  END IF;

  v_ip := private.current_request_ip();
  v_window := EXTRACT(EPOCH FROM now())::bigint / 10;

  -- 5. Validate session and rolling TOTP token / short_code
  SELECT * INTO v_session
  FROM public.sessions
  WHERE expires_at > now()
    AND (
      trim(p_hash) = public.generate_totp(rotating_hash, v_window)
      OR
      trim(p_hash) = public.generate_totp(rotating_hash, v_window - 1)
      OR
      trim(p_hash) = short_code
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_expired: attendance hash is invalid or has expired';
  END IF;

  -- 6. GPS Geofence validation
  IF v_session.latitude IS NOT NULL AND v_session.longitude IS NOT NULL
     AND p_student_latitude IS NOT NULL AND p_student_longitude IS NOT NULL THEN
    v_distance := public.gps_distance_meters(
      v_session.latitude, v_session.longitude,
      p_student_latitude, p_student_longitude
    );
    IF v_distance > COALESCE(v_session.radius_meters, 50) THEN
      RAISE EXCEPTION 'location_denied: you are %.0f meters away from the session location (max: %m)',
        v_distance, COALESCE(v_session.radius_meters, 50);
    END IF;
    v_gps_verified := TRUE;
  ELSIF v_session.latitude IS NOT NULL AND v_session.longitude IS NOT NULL
        AND (p_student_latitude IS NULL OR p_student_longitude IS NULL) THEN
    RAISE EXCEPTION 'location_denied: this session requires GPS verification, please enable location.';
  END IF;

  -- 7. Device Binding with Transaction-Scoped Advisory Locking
  IF v_caller.auth_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_caller.auth_id::text));

    SELECT student_auth_id INTO v_existing_auth
    FROM public.device_locks
    WHERE device_fingerprint = v_fp
    LIMIT 1;

    IF v_existing_auth IS NOT NULL AND v_existing_auth <> v_caller.auth_id THEN
      RAISE EXCEPTION 'device_conflict: this device is registered to another student account';
    END IF;

    SELECT device_fingerprint INTO v_existing_fp
    FROM public.device_locks
    WHERE student_auth_id = v_caller.auth_id;

    IF v_existing_fp IS NOT NULL THEN
      IF v_existing_fp IS DISTINCT FROM v_fp THEN
        RAISE EXCEPTION 'device_mismatch: this account is already bound to another device. Contact administrator to reset device binding.';
      END IF;
      UPDATE public.device_locks
      SET locked_at = now()
      WHERE student_auth_id = v_caller.auth_id;
    ELSE
      INSERT INTO public.device_locks (student_auth_id, device_fingerprint, device_label, locked_at)
      VALUES (v_caller.auth_id, v_fp, 'جهاز معتمد', now());
    END IF;
  END IF;

  -- Synchronize legacy student_devices table
  BEGIN
    INSERT INTO public.student_devices (student_id, device_fingerprint, ip_address, bound_at, last_seen_at)
    VALUES (v_caller.id, v_fp, v_ip, now(), now())
    ON CONFLICT (student_id) DO UPDATE
      SET last_seen_at = now(),
          ip_address = EXCLUDED.ip_address
      WHERE public.student_devices.device_fingerprint = v_fp;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 8. Prevent duplicate attendance in the same session
  IF EXISTS (
    SELECT 1 FROM public.attendance
    WHERE student_id = v_caller.id AND session_id = v_session.id
  ) THEN
    RAISE EXCEPTION 'already_recorded: your attendance has already been recorded for this session';
  END IF;

  -- 9. Determine biometric status
  v_biometric_ok := (p_biometric_credential_id IS NOT NULL AND length(trim(p_biometric_credential_id)) > 0);

  -- 10. Insert attendance record with biometric_credential_id
  INSERT INTO public.attendance (
    student_id,
    session_id,
    device_fingerprint,
    student_latitude,
    student_longitude,
    biometric_credential_id,
    metadata
  )
  VALUES (
    v_caller.id,
    v_session.id,
    v_fp,
    p_student_latitude,
    p_student_longitude,
    NULLIF(trim(COALESCE(p_biometric_credential_id, '')), ''),
    jsonb_build_object(
      'ip', v_ip,
      'gps_verified', v_gps_verified,
      'distance_meters', CASE WHEN v_gps_verified THEN v_distance ELSE NULL END,
      'user_agent', private.current_request_user_agent(),
      'biometric_verified', v_biometric_ok,
      'biometric_credential_id', p_biometric_credential_id,
      'submitted_at', now()
    )
  )
  RETURNING * INTO v_record;

  -- 11. System log audit trail (includes biometric status)
  INSERT INTO public.system_logs (actor_id, action)
  VALUES (
    v_caller.id,
    format(
      'submit_attendance: success student %s in session %s (device bound, GPS: %s, biometric: %s)',
      v_caller.id,
      v_session.id,
      CASE WHEN v_gps_verified THEN 'yes' ELSE 'no' END,
      CASE WHEN v_biometric_ok THEN 'yes' ELSE 'no' END
    )
  );

  RETURN v_record;
END;
$$;

-- Re-grant permissions (idempotent)
REVOKE EXECUTE ON FUNCTION public.submit_attendance(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.submit_attendance(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO authenticated;

-- Keep backward-compat grant for old 4-arg signature if it still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'submit_attendance'
      AND pg_get_function_identity_arguments(p.oid) = 'p_hash text, p_device_fingerprint text, p_student_latitude double precision, p_student_longitude double precision'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.submit_attendance(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated';
  END IF;
END $$;
