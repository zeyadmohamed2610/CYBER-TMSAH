-- ================================================================
-- Fix join requests approval flow & student metrics query
-- ================================================================

-- 1. Helper RPC to count students bypassing RLS
CREATE OR REPLACE FUNCTION public.count_students()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
SET row_security = off
AS $$
  SELECT count(*)::bigint FROM public.users WHERE role = 'student';
$$;

GRANT EXECUTE ON FUNCTION public.count_students() TO authenticated, anon;

-- 2. Drop obsolete approve_join_request overload
DROP FUNCTION IF EXISTS public.approve_join_request(uuid, uuid);

-- 3. Robust approve_join_request that handles auth user & public.users creation
CREATE OR REPLACE FUNCTION public.approve_join_request(
  p_request_id uuid,
  p_temp_password text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'auth'
SET row_security TO 'off'
AS $function$
DECLARE
  v_caller      public.users;
  v_req         public.join_requests;
  v_email       text;
  v_password    text;
  v_auth_id     uuid;
BEGIN
  -- Only owner can approve
  v_caller := private.get_caller_user();
  IF v_caller IS NULL OR v_caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owners may approve join requests';
  END IF;

  -- Load the request
  SELECT * INTO v_req
  FROM public.join_requests
  WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: join request not found or already processed';
  END IF;

  -- Build email from username
  v_email    := lower(trim(v_req.username)) || '@cyber.local';
  v_password := COALESCE(p_temp_password, 'Cyber' || trim(v_req.username) || '2025!');

  -- Check if auth user already exists with this email
  SELECT id INTO v_auth_id
  FROM auth.users
  WHERE email = v_email
  LIMIT 1;

  IF v_auth_id IS NULL THEN
    -- Create a new auth user directly in auth.users
    v_auth_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      raw_app_meta_data,
      role,
      aud,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      v_auth_id,
      '00000000-0000-0000-0000-000000000000',
      v_email,
      crypt(v_password, gen_salt('bf', 10)),
      now(),
      jsonb_build_object('role', v_req.role::text, 'full_name', v_req.full_name),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      'authenticated',
      'authenticated',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  END IF;

  -- Insert (or upsert) into public.users
  INSERT INTO public.users (auth_id, full_name, role, username)
  VALUES (v_auth_id, v_req.full_name, v_req.role, v_req.username)
  ON CONFLICT (auth_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role      = EXCLUDED.role,
        username  = EXCLUDED.username;

  -- Mark request approved
  UPDATE public.join_requests
  SET status      = 'approved',
      reviewed_at = now(),
      reviewed_by = v_caller.id
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'auth_id',       v_auth_id,
    'email',         v_email,
    'username',      v_req.username,
    'role',          v_req.role::text,
    'temp_password', v_password
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid, text) TO authenticated;

-- 4. Robust reject_join_request
CREATE OR REPLACE FUNCTION public.reject_join_request(
  p_request_id uuid,
  p_note text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
SET row_security TO 'off'
AS $function$
BEGIN
  IF private.current_user_role() <> 'owner' THEN
    RAISE EXCEPTION 'Only owner can reject join requests';
  END IF;

  UPDATE public.join_requests
  SET status = 'rejected',
      rejection_note = p_note,
      reviewed_at = now(),
      reviewed_by = private.current_user_id()
  WHERE id = p_request_id AND status = 'pending';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reject_join_request(uuid, text) TO authenticated;
