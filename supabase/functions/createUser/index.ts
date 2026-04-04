// Edge Function - Create User
// Fixed version with better error handling and duplicate email check

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserRequest {
  name: string;
  national_id?: string;
  email?: string;
  password: string;
  role: "doctor" | "student" | "ta";
  subject_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const body: UserRequest = await req.json();
    const { name, national_id, email, password, role, subject_id } = body;

    if (!name || !password || !role) {
      return new Response(JSON.stringify({ error: 'جميع الحقول مطلوبة (الاسم، كلمة المرور، الدور)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if ((role === 'doctor' || role === 'ta') && !subject_id) {
      return new Response(JSON.stringify({ error: 'يرجى اختيار المادة للدكتور أو المعيد' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (role === 'student' && subject_id) {
      return new Response(JSON.stringify({ error: 'الطلاب لا يتم ربطهم بمادة' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let authEmail: string;
    if (role === 'student') {
      if (!national_id || national_id.length !== 14 || !/^\d+$/.test(national_id)) {
        return new Response(JSON.stringify({ error: 'الرقم القومي يجب أن يكون 14 رقم' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      authEmail = `${national_id}@nid.local`;
    } else {
      if (!email || !email.includes('@')) {
        return new Response(JSON.stringify({ error: 'يرجى إدخال بريد إلكتروني صحيح' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      authEmail = email.toLowerCase();
    }

    // Check for duplicate email in auth.users BEFORE creating
    const emailCheckRes = await fetch(
      `${supabaseUrl}/rest/v1/users?email=eq.${authEmail}&select=id`,
      {
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
      }
    );
    const emailCheckData = await emailCheckRes.json();
    // Note: We can't directly query auth.users email, so we'll try to create and catch the error

    // Check for duplicate national_id
    if (national_id) {
      const dupCheck = await fetch(
        `${supabaseUrl}/rest/v1/users?national_id=eq.${national_id}&select=id`,
        {
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
          },
        }
      );
      const dupData = await dupCheck.json();
      if (Array.isArray(dupData) && dupData.length > 0) {
        return new Response(JSON.stringify({ error: 'الرقم القومي مسجل بالفعل' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Create auth user
    const createUserRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
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
      // Check for duplicate email error
      const errorMsg = createUserData.msg || createUserData.error || '';
      if (errorMsg.toLowerCase().includes('email') || errorMsg.toLowerCase().includes('already') || errorMsg.toLowerCase().includes('already exists')) {
        return new Response(JSON.stringify({ error: 'البريد الإلكتروني مسجل بالفعل' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        error: createUserData.msg || createUserData.error || 'فشل في إنشاء المستخدم في المصادقة',
        details: createUserData
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authUserId = createUserData.id;

    const insertRes = await fetch(
      `${supabaseUrl}/rest/v1/users`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
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
      const insertError = Array.isArray(insertData)
        ? insertData.map((entry) => (entry && typeof entry === 'object' && 'message' in entry ? String(entry.message) : 'خطأ غير معروف')).join(', ')
        : insertData.message || insertData.error || 'خطأ غير معروف';
      
      // Cleanup: delete the auth user if insert fails
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
      });
      
      return new Response(JSON.stringify({ error: 'فشل في إنشاء المستخدم في قاعدة البيانات', details: insertError }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user: { id: authUserId, name: name.trim(), role: role }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      error: 'خطأ داخلي في الخادم',
      message: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
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
          'apikey': serviceKey
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

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if ((role === 'doctor' || role === 'ta') && !subject_id) {
      return new Response(JSON.stringify({ error: 'Subject is required for doctors and TAs' }), {
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
        return new Response(JSON.stringify({ error: 'Valid email required for doctors and TAs' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      authEmail = email.toLowerCase();
    }

    // Check for duplicate national_id BEFORE creating auth user
    if (national_id) {
      const dupCheck = await fetch(
        `${supabaseUrl}/rest/v1/users?national_id=eq.${national_id}&select=id`,
        {
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
          },
        }
      );
      const dupData = await dupCheck.json();
      if (Array.isArray(dupData) && dupData.length > 0) {
        return new Response(JSON.stringify({ error: 'National ID already registered' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Create auth user using admin API
    const createUserRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
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
          'apikey': serviceKey,
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
      const insertError = Array.isArray(insertData)
        ? insertData
            .map((entry) => (entry && typeof entry === 'object' && 'message' in entry ? String(entry.message) : 'Unknown error'))
            .join(', ')
        : insertData.message || insertData.error || 'Unknown error';
      // Cleanup: delete the auth user if insert fails
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
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
            'apikey': serviceKey,
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
