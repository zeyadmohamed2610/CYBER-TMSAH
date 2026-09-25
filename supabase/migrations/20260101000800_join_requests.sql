-- Migration 8: join_requests table + username-based auth
-- (Applied via MCP — saved here for version control)

CREATE TABLE IF NOT EXISTS public.join_requests (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name       text        NOT NULL,
  username        text        NOT NULL,
  role            public.user_role NOT NULL DEFAULT 'student',
  seat_number     text,
  section_number  integer,
  rank_in_list    integer,
  status          text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_note  text,
  created_at      timestamptz DEFAULT now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_join_requests_status ON public.join_requests(status);
CREATE INDEX IF NOT EXISTS idx_join_requests_created ON public.join_requests(created_at DESC);

ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_join_request"   ON public.join_requests;
DROP POLICY IF EXISTS "owner_all_join_requests"    ON public.join_requests;

CREATE POLICY "anon_insert_join_request"
  ON public.join_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "owner_all_join_requests"
  ON public.join_requests FOR ALL
  USING      (private.current_user_role() = 'owner')
  WITH CHECK (private.current_user_role() = 'owner');

GRANT INSERT              ON public.join_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.join_requests TO authenticated;
GRANT ALL                 ON public.join_requests TO service_role;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

CREATE OR REPLACE FUNCTION public.approve_join_request(p_request_id uuid, p_auth_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_req public.join_requests;
BEGIN
  IF private.current_user_role() <> 'owner' THEN RAISE EXCEPTION 'Only owner can approve'; END IF;
  SELECT * INTO v_req FROM public.join_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found or already processed'; END IF;
  INSERT INTO public.users (auth_id, full_name, role, username) VALUES (p_auth_id, v_req.full_name, v_req.role, v_req.username) ON CONFLICT (auth_id) DO NOTHING;
  UPDATE public.join_requests SET status = 'approved', reviewed_at = now(), reviewed_by = private.current_user_id() WHERE id = p_request_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_join_request(p_request_id uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF private.current_user_role() <> 'owner' THEN RAISE EXCEPTION 'Only owner can reject'; END IF;
  UPDATE public.join_requests SET status = 'rejected', rejection_note = p_note, reviewed_at = now(), reviewed_by = private.current_user_id() WHERE id = p_request_id AND status = 'pending';
END; $$;

GRANT EXECUTE ON FUNCTION public.reject_join_request(uuid, text) TO authenticated;
