-- Migration: 20260926000100_resolve_login_identifier.sql
-- Description: Define resolve_login_identifier RPC and audit logs cleanup function.

create or replace function public.resolve_login_identifier(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    v_clean text;
    v_email text;
begin
    v_clean := trim(p_identifier);
    if v_clean is null or v_clean = '' then
        return null;
    end if;

    -- If already contains @, return directly
    if v_clean like '%@%' then
        return v_clean;
    end if;

    -- 1. Search in users by national_id or auth metadata
    select au.email into v_email
    from public.users u
    join auth.users au on au.id = u.auth_id
    where u.national_id = v_clean
       or au.raw_user_meta_data->>'username' = v_clean
       or au.raw_user_meta_data->>'seat_number' = v_clean
    limit 1;

    if v_email is not null then
        return v_email;
    end if;

    -- 2. Fallback to standard local domain
    return v_clean || '@cyber.local';
end;
$$;

-- Grant execution to all users (needed before authentication)
grant execute on function public.resolve_login_identifier(text) to anon, authenticated;

-- Maintenance function: clean up audit logs older than 180 days
create or replace function public.cleanup_old_audit_logs()
returns integer
language plpgsql
security definer
as $$
declare
    deleted_count integer;
begin
    delete from public.audit_logs
    where created_at < (now() - interval '180 days');
    get diagnostics deleted_count = row_count;
    return deleted_count;
end;
$$;

grant execute on function public.cleanup_old_audit_logs() to service_role;
