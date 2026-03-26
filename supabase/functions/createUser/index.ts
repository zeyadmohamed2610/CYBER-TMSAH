// Edge Function - Create User
// Simpler version with better error handling

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserRequest {
  name: string;
  national_id?: string;
  email?: string;
  password: string;
  role: "doctor" | "student";
  subject_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get headers
    const authHeader = req.headers.get('Authorization');
    const apikey = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY');

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user is authenticated
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': authHeader,
        'apikey': apikey!
      }
    });

    if (!userRes.ok) {
      const err = await userRes.text();
      return new Response(JSON.stringify({ error: 'Invalid token', details: err }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userData = await userRes.json();
    const userId = userData.id;

    // Check if user is owner - using service role to bypass RLS
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/users?auth_id=eq.${userId}&select=id,role`,
      {
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': apikey!
        }
      }
    );

    const profiles = await profileRes.json();

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (profiles[0].role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Only owners can create users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerProfileId = profiles[0].id;

    // Parse request body
    const body: UserRequest = await req.json();
    const { name, national_id, email, password, role, subject_id } = body;

    // Validate
    if (!name || !password || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields: name, password, role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (role === 'doctor' && !subject_id) {
      return new Response(JSON.stringify({ error: 'Subject is required for doctors' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (role === 'student' && subject_id) {
      return new Response(JSON.stringify({ error: 'Students must not be assigned to a subject' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build auth email based on role
    let authEmail: string;
    if (role === 'student') {
      if (!national_id || national_id.length !== 14 || !/^\d+$/.test(national_id)) {
        return new Response(JSON.stringify({ error: 'National ID must be exactly 14 digits' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      authEmail = `${national_id}@nid.local`;
    } else {
      if (!email || !email.includes('@')) {
        return new Response(JSON.stringify({ error: 'Valid email required for doctors' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      authEmail = email.toLowerCase();
    }

    // Create auth user using admin API
    const createUserRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': apikey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: authEmail,
        password: password,
        email_confirm: true,
      }),
    });

    let createUserData;
    try {
      createUserData = await createUserRes.json();
    } catch {
      createUserData = {};
    }

    if (!createUserRes.ok) {
      return new Response(JSON.stringify({
        error: createUserData.msg || createUserData.error || 'Failed to create auth user',
        details: createUserData
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authUserId = createUserData.id;

    // Insert user directly into public.users using service role (bypasses RLS)
    const insertRes = await fetch(
      `${supabaseUrl}/rest/v1/users`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': apikey!,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          auth_id: authUserId,
          full_name: name.trim(),
          national_id: national_id || null,
          role: role,
          subject_id: subject_id || null
        }),
      }
    );

    let insertData;
    try {
      insertData = await insertRes.json();
    } catch {
      insertData = [];
    }

    if (!insertRes.ok) {
      const insertError = Array.isArray(insertData) ? insertData.map((e: any) => e.message).join(', ') : insertData.message || insertData.error || 'Unknown error';
      // Cleanup: delete the auth user if insert fails
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': apikey!,
        },
      });
      return new Response(JSON.stringify({ error: 'Failed to create user record', details: insertError }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log the action
    try {
      await fetch(
        `${supabaseUrl}/rest/v1/system_logs`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': apikey!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            actor_id: callerProfileId,
            action: `create_user: created ${insertData[0]?.id || 'unknown'} (auth_id=${authUserId}, role=${role})`
          }),
        }
      );
    } catch {
      // Logging is best-effort, continue even if it fails
    }

    return new Response(JSON.stringify({
      success: true,
      user: { id: authUserId, name: name.trim(), role: role }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Edge Function Error:', errorMessage);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
