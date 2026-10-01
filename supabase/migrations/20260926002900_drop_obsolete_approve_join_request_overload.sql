-- ==============================================================================
-- Migration: 20260926002900_drop_obsolete_approve_join_request_overload.sql
-- Description:
--   Drop obsolete 2-parameter overload of public.approve_join_request(uuid, text)
--   which causes PostgREST RPC ambiguity with the updated 3-parameter function
--   public.approve_join_request(uuid, text, uuid).
-- ==============================================================================

DROP FUNCTION IF EXISTS public.approve_join_request(uuid, text);
