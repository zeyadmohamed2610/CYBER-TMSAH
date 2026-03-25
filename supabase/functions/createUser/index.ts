// Simplified Edge Function for user creation
// Uses native fetch - no external dependencies

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
    // Get auth token from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Supabase config
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify the caller is authenticated
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': authHeader, 'apikey': supabaseKey }
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userData = await userRes.json();

    // Check if user is owner
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/users?auth_id=eq.${userData.id}&select=role`,
      {
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': supabaseKey
        }
      }
    );

    const profiles = await profileRes.json();
    if (!profiles || profiles.length === 0 || profiles[0].role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Only owners can create users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body: UserRequest = await req.json();
    const { name, national_id, email, password, role, subject_id } = body;

    // Validate
    if (!name || !password || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build auth email
    let authEmail: string;
    if (role === 'student') {
      if (!national_id || national_id.length !== 14) {
        return new Response(JSON.stringify({ error: 'National ID must be 14 digits' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      authEmail = `${national_id}@nid.local`;
    } else {
      if (!email) {
        return new Response(JSON.stringify({ error: 'Email required for doctors' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      authEmail = email.toLowerCase();
    }

    // Create auth user
    const createUserRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: authEmail,
        password: password,
        email_confirm: true,
      }),
    });

    const createUserData = await createUserRes.json();

    if (!createUserRes.ok) {
      return new Response(JSON.stringify({ error: createUserData.msg || 'Failed to create user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authUserId = createUserData.id;

    // Call RPC to create user record
    const rpcRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/create_user`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_auth_id: authUserId,
          p_full_name: name,
          p_role: role,
          p_subject_id: subject_id || null,
        }),
      }
    );

    if (!rpcRes.ok) {
      const rpcError = await rpcRes.text();
      // Delete auth user if RPC fails
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': supabaseKey,
        },
      });
      return new Response(JSON.stringify({ error: rpcError }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user: { id: authUserId, name, role }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
