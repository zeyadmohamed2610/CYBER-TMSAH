-- Migration: 20260926000200_auth_performance_indexes.sql
-- Description: Add performance indexes to speed up login identifier resolution
--              and audit log queries.

-- ── 1. Index on users.national_id ──────────────────────────────────────────
-- Used by resolve_login_identifier RPC when matching numeric IDs / seat numbers.
create index if not exists idx_users_national_id
  on public.users (national_id);

-- ── 2. Index on auth.users raw_user_meta_data username ─────────────────────
-- GIN index for fast JSONB key lookups (username, seat_number in metadata).
create index if not exists idx_auth_users_meta_username
  on auth.users using gin (raw_user_meta_data);

-- ── 3. Index on audit_logs.identifier ──────────────────────────────────────
-- Speeds up per-user audit trail queries and admin dashboards.
create index if not exists idx_audit_logs_identifier
  on public.audit_logs (identifier);

-- ── 4. Index on audit_logs.action + created_at ─────────────────────────────
-- Supports time-range queries per action type (e.g. "all failed logins today").
create index if not exists idx_audit_logs_action_created
  on public.audit_logs (action, created_at desc);

-- ── 5. Index on audit_logs.created_at ──────────────────────────────────────
-- Speeds up cleanup_old_audit_logs() which filters by created_at.
create index if not exists idx_audit_logs_created_at
  on public.audit_logs (created_at desc);
