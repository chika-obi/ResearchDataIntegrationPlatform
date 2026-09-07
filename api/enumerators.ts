import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !publishableKey || !secretKey) {
      return json({ error: 'Enumerator provisioning is not configured on the server. Add the Supabase server secret to the Vercel project environment.' }, 500);
    }

    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return json({ error: 'Authentication required.' }, 401);
    }

    const accessToken = authorization.slice('Bearer '.length);
    const userClient = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);
    if (authError || !authData.user) return json({ error: 'Your session is invalid. Please sign in again.' }, 401);

    const requesterId = authData.user.id;
    const admin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    const { data: requester, error: requesterError } = await admin
      .from('profiles')
      .select('id,role,status')
      .eq('id', requesterId)
      .single();

    if (requesterError || !requester || requester.status !== 'active' || requester.role !== 'researcher') {
      return json({ error: 'Only an active researcher can register field enumerators.' }, 403);
    }

    const body = await request.json();
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const phone = String(body?.phone || '').trim();
    const projectId = String(body?.projectId || '').trim();

    if (!name || !email || !projectId) {
      return json({ error: 'Enumerator name, email, and research project are required.' }, 400);
    }

    const { data: project, error: projectError } = await admin
      .from('projects')
      .select('id,owner_id,status')
      .eq('id', projectId)
      .single();

    if (projectError || !project || project.owner_id !== requesterId) {
      return json({ error: 'You can only register enumerators for projects you own.' }, 403);
    }

    if (project.status === 'archived' || project.status === 'completed') {
      return json({ error: 'Enumerators cannot be registered to an archived or completed project.' }, 400);
    }

    const { data: existingUsers, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) return json({ error: usersError.message }, 500);
    const existingUser = existingUsers.users.find((u) => (u.email || '').toLowerCase() === email);
    let enumeratorUserId: string;

    if (existingUser) {
      enumeratorUserId = existingUser.id;
      if (enumeratorUserId === requesterId) return json({ error: 'The researcher account cannot also be registered as an enumerator.' }, 400);
    } else {
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: name, role: 'enumerator' } });
      if (inviteError || !invited.user) return json({ error: inviteError?.message || 'Unable to create the enumerator account.' }, 500);
      enumeratorUserId = invited.user.id;
    }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: enumeratorUserId,
      email,
      full_name: name,
      phone: phone || null,
      role: 'enumerator',
      status: 'active',
      metadata: { source: 'rdip_enumerator_operations', provisioned_by: requesterId },
    }, { onConflict: 'id' });

    if (profileError) return json({ error: `Enumerator profile could not be saved: ${profileError.message}` }, 500);

    const { error: memberError } = await admin.from('project_members').upsert({
      project_id: projectId,
      user_id: enumeratorUserId,
      role: 'viewer',
      status: 'active',
      permissions: { can_collect: true, can_view_history: true, can_edit: false, can_analyze: false, can_export: false, can_manage_enumerators: false },
      invited_by: requesterId,
    }, { onConflict: 'project_id,user_id' });

    if (memberError) return json({ error: `Enumerator project membership could not be saved: ${memberError.message}` }, 500);

    return json({
      success: true,
      enumerator: { id: enumeratorUserId, email, full_name: name, phone: phone || null, role: 'enumerator', status: 'active' },
      projectId,
      invited: !existingUser,
      message: existingUser ? 'Enumerator linked to the project.' : 'Enumerator account created and invitation sent.',
    });
  } catch (error) {
    console.error('Enumerator provisioning error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unexpected enumerator provisioning error.' }, 500);
  }
}
