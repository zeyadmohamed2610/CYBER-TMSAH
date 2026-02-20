# Attendance Management System - Supabase Deployment Guide (100% FREE)

## 🎉 Supabase Free Tier Includes:
- **500MB** Database storage
- **1GB** File storage  
- **50,000** Monthly active users
- **500MB** Edge Function invocations
- **Unlimited** API requests
- **Real-time** subscriptions
- **Row Level Security** (same as Firestore rules)

---

## Step 1: Create Supabase Account (FREE)

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub or email
4. Verify your email

---

## Step 2: Create New Project

1. Click "New Project"
2. Enter project name: `attendance-system`
3. Generate a strong database password (save it!)
4. Choose a region close to you
5. Click "Create new project"
6. Wait ~2 minutes for project to initialize

---

## Step 3: Get API Keys

1. Go to **Settings** > **API**
2. Copy these values:
   - **Project URL** → This is your `VITE_SUPABASE_URL`
   - **anon public key** → This is your `VITE_SUPABASE_ANON_KEY`

3. Create `.env` file in project root:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Step 4: Setup Database Schema

1. Go to **SQL Editor** in Supabase dashboard
2. Click "New query"
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and click **Run**
5. You should see "Success. No rows returned"

---

## Step 5: Configure Authentication

1. Go to **Authentication** > **Providers**
2. **Email** should already be enabled
3. Configure email templates if needed (optional)

### Email Settings (Optional)
1. Go to **Authentication** > **Settings**
2. Enable "Enable email confirmations" if you want email verification
3. Customize email templates

---

## Step 6: Create Owner Account

### Option A: Via Supabase Dashboard
1. Go to **Authentication** > **Users**
2. Click "Add user"
3. Enter owner email and password
4. Click "Create user"

### Set Owner Role
1. Go to **SQL Editor**
2. Run this query (replace with your owner's user ID):
```sql
UPDATE public.users 
SET role = 'owner' 
WHERE email = 'owner@yourdomain.com';
```

Or if the user doesn't exist in the users table:
```sql
INSERT INTO public.users (id, email, name, role)
SELECT id, email, email, 'owner'
FROM auth.users
WHERE email = 'owner@yourdomain.com';
```

---

## Step 7: Update Server Secret (IMPORTANT!)

1. Go to **SQL Editor**
2. Run this to change the server secret:
```sql
UPDATE public._server_config 
SET value = 'YOUR-NEW-SECRET-MIN-32-CHARACTERS-LONG-CHANGE-THIS'
WHERE key = 'server_secret';
```

Generate a strong secret:
```bash
openssl rand -base64 32
```

---

## Step 8: Install Dependencies & Build

```bash
# Install Supabase client
npm install @supabase/supabase-js

# Build the project
npm run build
```

---

## Step 9: Deploy Frontend (FREE Options)

### Option A: Vercel (Recommended - FREE)
1. Go to [vercel.com](https://vercel.com)
2. Connect your GitHub repository
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy

### Option B: Netlify (FREE)
1. Go to [netlify.com](https://netlify.com)
2. Connect your repository
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variables
6. Deploy

### Option C: Supabase Hosting
1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link project: `supabase link --project-ref your-project-ref`
4. Deploy: `supabase functions deploy` (for Edge Functions)

---

## Step 10: Create Doctor Accounts

### Via Dashboard
1. Login as **Owner**
2. Go to Users section
3. Create new users with role "doctor"

### Via SQL (for bulk creation)
```sql
-- First create auth user, then:
INSERT INTO public.users (id, email, name, role)
VALUES (
  'user-uuid-from-auth',
  'doctor@example.com',
  'Dr. Name',
  'doctor'
);
```

---

## Step 11: Test the System

1. Visit your deployed URL
2. Test login with owner account
3. Create a test session as doctor
4. Test the rotating hash generation
5. Test attendance marking as student

---

## Security Checklist

- [ ] Changed default `server_secret`
- [ ] Owner account created with correct role
- [ ] Row Level Security policies are active
- [ ] `.env` file not committed to git
- [ ] API keys are public-safe (anon key is safe to expose)

---

## Database Structure

| Table | Purpose |
|-------|---------|
| `users` | User profiles (synced with auth.users) |
| `sessions` | Attendance sessions |
| `attendance` | Attendance records |
| `system_logs` | Activity logging |
| `alerts` | Security alerts |
| `rate_limits` | Rate limiting data |
| `_server_config` | Server secrets (protected) |

---

## Row Level Security Summary

| Role | Users | Sessions | Attendance |
|------|-------|----------|------------|
| **Owner** | Read all | Read/write all | Read all |
| **Doctor** | - | Own only | Own sessions only |
| **Student** | Own profile | Active only | Own records only |

---

## API Endpoints (via Supabase RPC)

| Function | Purpose |
|----------|---------|
| `generate_rotating_hash(session_id)` | Get current 6-digit code |
| `validate_attendance(...)` | Mark attendance securely |
| `haversine_distance(...)` | Calculate distance |

---

## Troubleshooting

### "Failed to fetch user profile"
- Check if user exists in `public.users` table
- Run the trigger to sync: 
```sql
SELECT public.handle_new_user();
```

### "Permission denied" errors
- Check RLS policies are enabled
- Verify user role is set correctly
- Run: `SELECT * FROM public.users WHERE id = auth.uid();`

### Rotating hash not working
- Verify `server_secret` is set
- Check the session exists and is active
- Run: `SELECT * FROM public.generate_rotating_hash('session-uuid');`

---

## Cost: $0/month

Everything runs on Supabase's free tier:
- Database: 500MB (plenty for thousands of records)
- Auth: 50,000 users
- API: Unlimited requests
- Hosting: Use Vercel/Netlify free tier

---

## Support

- Supabase Discord: [discord.supabase.com](https://discord.supabase.com)
- Supabase Docs: [supabase.com/docs](https://supabase.com/docs)
- GitHub Issues: Report bugs in your project

---

## Quick Reference Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Generate strong secret
openssl rand -base64 32
```

---

## Next Steps

1. Create your Supabase project
2. Run the SQL schema
3. Update environment variables
4. Deploy to Vercel/Netlify
5. Create owner account
6. Start adding doctors and students!
