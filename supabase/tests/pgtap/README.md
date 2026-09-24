# pgTAP Tests for CYBER-TMSAH

This directory contains pgTAP tests for verifying Row Level Security (RLS) policies and database functions.

## Prerequisites

1. **pgTAP extension** installed in your PostgreSQL database:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pgtap;
   ```

2. **Supabase database** with all migrations applied (especially `20260101000200_rls_policies.sql`)

## Running Tests

### Option 1: Using psql directly

```bash
# Connect to your Supabase database and run tests
psql "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres" \
  -f supabase/tests/pgtap/rls_policies.test.sql
```

### Option 2: Using Supabase CLI (local development)

```bash
# Start local Supabase
supabase start

# Run tests against local database
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f supabase/tests/pgtap/rls_policies.test.sql
```

### Option 3: Using Docker

```bash
# Run pgTAP in a container
docker run --rm -i \
  -e PGPASSWORD=postgres \
  postgres:16 \
  psql -h host.docker.internal -U postgres -d postgres \
  -f /tests/rls_policies.test.sql \
  -v $(pwd)/supabase/tests/pgtap:/tests
```

## Test Coverage

The tests verify:

1. **RLS Enabled** - All 10 tables have Row Level Security enabled
2. **users table policies** (6 tests):
   - `self_read` - users can read own row
   - `owner_all_users` - owner sees all users
   - `doctor_own_users` - doctor sees own row + students
   - `ta_own_users` - TA sees own row + students
   - `student_own_users` - student sees only own row
   - `owner_update_self` - owner can update own profile

3. **subjects table policies** (5 tests):
   - Owner, doctor, TA, student access patterns

4. **sessions table policies** (5 tests):
   - Owner, doctor, TA, student access
   - Student cannot see expired sessions

5. **attendance table policies** (5 tests):
   - Owner sees all
   - Doctor/TA see attendance for their subject's sessions
   - Student sees only own attendance

6. **system_logs table policies** (2 tests):
   - Owner can read logs
   - Direct INSERT blocked (only SECURITY DEFINER functions can write)

7. **course_materials table policies** (4 tests):
   - All roles can read (owner has full access)

8. **student_devices table policies** (3 tests):
   - Owner sees all
   - Student sees only own devices

9. **login_sessions table policies** (1 test):
   - User sees only own login sessions

10. **lectures table policies** (5 tests):
    - Owner, doctor, TA read access
    - Owner and doctor insert access
    - Doctor cannot insert for other subjects

11. **RLS enabled verification** (9 tests):
    - One test per table

## Expected Output

Successful run shows:
```
1..46
ok 1 - student can read own user row via self_read policy
ok 2 - owner can read all user rows via owner_all_users policy
...
ok 46 - lectures table has RLS enabled
# Tests were run in 0.123 seconds
```

## Adding New Tests

1. Add test cases to `rls_policies.test.sql`
2. Follow the pattern: `SELECT results_eq(...)`, `SELECT has_rls_enabled(...)`
3. Update the `plan(N)` call at the top with the new test count
4. Run tests to verify

## CI/CD Integration

Add to GitHub Actions workflow:

```yaml
- name: Run pgTAP tests
  run: |
    supabase start
    psql "postgresql://postgres:postgres@localhost:54322/postgres" \
      -f supabase/tests/pgtap/rls_policies.test.sql
  env:
    SUPABASE_DB_PASSWORD: postgres
```