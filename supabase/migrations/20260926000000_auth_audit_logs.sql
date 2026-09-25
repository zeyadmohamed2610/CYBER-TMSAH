-- Migration: 20260926000000_auth_audit_logs.sql
-- Description: Create audit_logs table for authentication events, security monitoring, and login tracking.

create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    action text not null,
    identifier text,
    role text,
    user_agent text,
    screen_resolution text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

-- Enable RLS
alter table public.audit_logs enable row level security;

-- Policy: Allow inserts from anyone (for recording login successes and failures)
drop policy if exists "Allow insert audit logs" on public.audit_logs;
create policy "Allow insert audit logs"
    on public.audit_logs
    for insert
    with check (true);

-- Policy: Allow read only for system administrators (owner role)
drop policy if exists "Allow owners to read audit logs" on public.audit_logs;
create policy "Allow owners to read audit logs"
    on public.audit_logs
    for select
    using (
        exists (
            select 1 from public.users
            where public.users.auth_id = auth.uid()
            and public.users.role = 'owner'
        )
    );

-- Index for fast query on action and created_at
create index if not exists idx_audit_logs_action_created on public.audit_logs (action, created_at desc);
create index if not exists idx_audit_logs_identifier on public.audit_logs (identifier);
