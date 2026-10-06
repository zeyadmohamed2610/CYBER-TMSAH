-- ============================================================
-- Migration: User Permissions & Schedule Access Control
-- Date: 2026-10-06
-- Description:
--   1. Add `permissions` JSONB column to users table
--   2. Update academic_scope to respect custom schedule_access permission
--   3. Add RPC for owner to update user permissions
--   4. Auto-promote role when coordinator gets all owner-level permissions
-- ============================================================

BEGIN;

-- ─── 1. Add permissions column to users ─────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}';

-- ─── 2. Update private.academic_scope to respect schedule_access permission ──
CREATE OR REPLACE FUNCTION private.academic_scope(
  p_department text,
  p_year text,
  p_write boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  c public.users;
  d text;
  y text;
BEGIN
  c := private.get_caller_user();
  IF auth.uid() IS NULL OR c.id IS NULL THEN
    RAISE EXCEPTION 'permission_denied: sign in';
  END IF;

  d := COALESCE(NULLIF(p_department,''), c.department);
  y := COALESCE(
    NULLIF(p_year,''),
    c.academic_year,
    CASE
      WHEN NOT p_write AND c.role <> 'student'
      THEN (
        SELECT e.academic_year
        FROM public.academic_schedule_entries e
        WHERE e.department = d
        GROUP BY e.academic_year
        ORDER BY e.academic_year
        LIMIT 1
      )
    END,
    '1'
  );

  IF d IS NULL
     OR d NOT IN ('cybersecurity','ai','data_science','mechatronics','autotronics','control_systems','garments')
     OR y NOT IN ('1','2','3','4')
  THEN
    RAISE EXCEPTION 'validation_error: department and year';
  END IF;

  IF c.role <> 'owner' AND c.department IS DISTINCT FROM d THEN
    RAISE EXCEPTION 'permission_denied: another department';
  END IF;

  IF c.role = 'student' AND c.academic_year IS DISTINCT FROM y THEN
    RAISE EXCEPTION 'permission_denied: another academic year';
  END IF;

  IF p_write AND c.role NOT IN ('owner','coordinator') THEN
    RAISE EXCEPTION 'permission_denied: schedule management';
  END IF;

  -- Schedule read access: owner + student always allowed.
  -- doctor / ta / coordinator need explicit schedule_access permission.
  IF c.role NOT IN ('owner','student') THEN
    IF NOT COALESCE((c.permissions->>'schedule_access')::boolean, false) THEN
      RAISE EXCEPTION 'permission_denied: schedule not accessible for your role';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'department',      d,
    'academic_year',   y,
    'can_edit',        c.role IN ('owner','coordinator'),
    'student_section', CASE WHEN c.role = 'student' THEN c.section_number::text ELSE NULL END
  );
END;
$function$;

-- ─── 3. RPC: update_user_permissions (owner-only) ───────────────────────────
CREATE OR REPLACE FUNCTION public.update_user_permissions(
  p_user_id     uuid,
  p_permissions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller        public.users;
  target        public.users;
  new_role      text;
  all_perms     text[] := ARRAY[
    'schedule_access',
    'manage_users',
    'manage_departments',
    'manage_lectures',
    'view_reports',
    'manual_attendance'
  ];
  perm_count    int := 0;
  perm          text;
BEGIN
  caller := private.get_caller_user();

  IF caller.role <> 'owner' THEN
    RAISE EXCEPTION 'permission_denied: only owner can update permissions';
  END IF;

  SELECT * INTO target FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found: user does not exist';
  END IF;

  IF target.role = 'owner' THEN
    RAISE EXCEPTION 'permission_denied: cannot modify owner permissions';
  END IF;

  -- Count granted owner-level permissions
  FOREACH perm IN ARRAY all_perms LOOP
    IF COALESCE((p_permissions->>perm)::boolean, false) THEN
      perm_count := perm_count + 1;
    END IF;
  END LOOP;

  -- Auto-promote coordinator to owner if all permissions granted
  new_role := target.role;
  IF target.role = 'coordinator' AND perm_count = array_length(all_perms, 1) THEN
    new_role := 'owner';
  END IF;

  UPDATE public.users
  SET permissions = p_permissions,
      role        = new_role
  WHERE id = p_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_user_permissions(uuid, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_user_permissions(uuid, jsonb) TO authenticated;

COMMIT;
