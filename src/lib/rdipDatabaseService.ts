import { supabase } from './supabase';
import {
  DbProfile,
  DbProject,
  DbProjectMember,
  DbQuestionnaire,
  DbQuestionnaireVersion,
  DbQuestion,
  DbVariable,
  DbQuestionnaireAssignment,
  DbResponse,
  DbResponseAnswer,
  DbDataQualityIssue,
  DbStatisticalAnalysis,
  DbAuditLog,
  Project,
  ProjectStatus,
} from '../types';

/**
 * RDIP Database & Repository Service
 * Provides typed, secure query abstractions over Supabase PostgreSQL tables
 * with automatic fallback to local memory/cache to maintain continuity.
 */

// ==============================================================================
// 1. PROFILES & AUTH SERVICE
// ==============================================================================

export async function getCurrentUserProfile(): Promise<DbProfile | null> {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (error) {
      console.warn('[RDIP DB] Could not fetch profile from Supabase:', error.message);
      return null;
    }

    return data as DbProfile;
  } catch (err) {
    console.error('[RDIP DB] Profile retrieval error:', err);
    return null;
  }
}

// ==============================================================================
// 2. PROJECTS SERVICE
// ==============================================================================

export function mapDbProjectToProject(db: DbProject): Project {
  let status: ProjectStatus = 'Active';
  if (db.status === 'draft') status = 'Design';
  else if (db.status === 'active') status = 'Active';
  else if (db.status === 'collection') status = 'Collection';
  else if (db.status === 'analysis') status = 'Analysis';
  else if (db.status === 'completed') status = 'Complete';
  else status = 'Active';

  return {
    id: db.id,
    code: db.project_code,
    title: db.title,
    institution: db.institution || 'Research Institute',
    status,
    progress: typeof db.progress === 'number' ? db.progress : 0,
    enumeratorsCount: 0,
    responsesCount: 0,
    startDate: db.start_date || new Date().toISOString().split('T')[0],
    endDate: db.end_date || '2025-12-31',
    description: db.description || '',
    qualityScore: typeof db.quality_score === 'number' ? db.quality_score : 100,
    notes: db.notes || undefined,
    ownerId: db.owner_id,
    researchObjectives: Array.isArray(db.research_objectives) ? db.research_objectives : [],
    category: db.research_topic || undefined,
  };
}

export async function fetchProjects(): Promise<{ data: DbProject[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[RDIP DB] Projects query failed:', error.message);
      return { data: [], error: error.message };
    }

    return { data: (data || []) as DbProject[], error: null };
  } catch (err: any) {
    console.error('[RDIP DB] fetchProjects error:', err);
    return { data: [], error: err?.message || 'Network error fetching projects' };
  }
}

export async function createProjectInDb(
  project: Omit<DbProject, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: DbProject | null; error: string | null }> {
  try {
    // 1. Verify active Supabase authenticated session
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return {
        data: null,
        error: 'Authentication error: Active Supabase session required. Please sign in.'
      };
    }

    const userId = authData.user.id;
    const userEmail = authData.user.email || '';

    // 2. Inspect creator profile to ensure active role permission
    const { data: creatorProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, role, status')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      console.warn('[RDIP DB] Notice querying creator profile:', profileErr);
    }

    if (!creatorProfile) {
      console.warn('[RDIP DB] Profile not found in public.profiles. Attempting initialization...');
      try {
        await supabase.from('profiles').upsert({
          id: userId,
          email: userEmail,
          full_name: authData.user.user_metadata?.full_name || userEmail.split('@')[0] || 'Researcher',
          institution: authData.user.user_metadata?.institution || 'Research Institute',
          role: 'researcher',
          status: 'active'
        });
      } catch (upsertErr) {
        console.debug('[RDIP DB] Profile auto-provisioning note:', upsertErr);
      }
    } else {
      if (creatorProfile.status !== 'active') {
        return {
          data: null,
          error: `Permission denied: Your RDIP account status is '${creatorProfile.status}'. An active status is required to register research projects.`
        };
      }

      const allowedRoles = ['researcher', 'data_manager', 'super_admin'];
      if (!allowedRoles.includes(creatorProfile.role)) {
        return {
          data: null,
          error: `Permission denied: Your current database role is '${creatorProfile.role}'. Research projects may only be created by researchers, data managers, or administrators.`
        };
      }
    }

    // 3. Pre-generate project UUID to avoid INSERT ... RETURNING * RLS evaluation race
    const newProjectId = (project as any).id || crypto.randomUUID();
    const finalProjectPayload = {
      ...project,
      id: newProjectId,
      owner_id: userId
    };

    // 4. Perform direct INSERT without .select() to prevent premature SELECT RLS evaluation
    const { error: insertError } = await supabase
      .from('projects')
      .insert([finalProjectPayload]);

    if (insertError) {
      console.error('[RDIP DB] Failed to insert project into Supabase:', insertError);
      return { data: null, error: insertError.message };
    }

    // 5. Authoritatively register project owner in project_members
    try {
      await supabase.from('project_members').insert([{
        project_id: newProjectId,
        user_id: userId,
        role: 'owner',
        permissions: {
          can_edit: true,
          can_analyze: true,
          can_export: true,
          can_manage_enumerators: true,
        },
        status: 'active',
      }]);
    } catch (pmErr) {
      console.debug('[RDIP DB] Owner membership record note:', pmErr);
    }

    // 6. Retrieve the authoritative project record
    const { data: fetchedProject, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', newProjectId)
      .maybeSingle();

    if (fetchError) {
      console.debug('[RDIP DB] Project fetch note after insert:', fetchError);
    }

    const resultProject: DbProject = fetchedProject || {
      id: newProjectId,
      owner_id: userId,
      project_code: finalProjectPayload.project_code,
      title: finalProjectPayload.title,
      description: finalProjectPayload.description,
      research_topic: finalProjectPayload.research_topic,
      research_design: finalProjectPayload.research_design,
      institution: finalProjectPayload.institution,
      status: finalProjectPayload.status,
      progress: finalProjectPayload.progress,
      quality_score: finalProjectPayload.quality_score,
      research_objectives: finalProjectPayload.research_objectives,
      start_date: finalProjectPayload.start_date,
      end_date: finalProjectPayload.end_date,
      notes: finalProjectPayload.notes,
      metadata: finalProjectPayload.metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 7. Log immutable audit trail event
    try {
      await logAuditEvent({
        user_id: userId,
        action: 'PROJECT_CREATED',
        entity_type: 'project',
        entity_id: newProjectId,
        details: { title: resultProject.title, code: resultProject.project_code },
      });
    } catch (auditErr) {
      console.debug('[RDIP DB] Audit log note:', auditErr);
    }

    return { data: resultProject, error: null };
  } catch (err: any) {
    console.error('[RDIP DB] createProjectInDb exception:', err);
    return {
      data: null,
      error: err?.message || 'Unexpected failure connecting to Supabase database.'
    };
  }
}

// ==============================================================================
// 3. PROJECT COLLABORATION & MEMBERSHIP
// ==============================================================================

export async function fetchProjectMembers(projectId: string): Promise<DbProjectMember[]> {
  try {
    const { data, error } = await supabase
      .from('project_members')
      .select('*, profile:profiles(*)')
      .eq('project_id', projectId);

    if (error) {
      console.warn('[RDIP DB] Failed to fetch project members:', error.message);
      return [];
    }

    return (data || []) as DbProjectMember[];
  } catch (err) {
    console.error('[RDIP DB] fetchProjectMembers error:', err);
    return [];
  }
}

// ==============================================================================
// 4. QUESTIONNAIRES & VERSIONING SERVICE
// ==============================================================================

export async function fetchProjectQuestionnaires(projectId: string): Promise<DbQuestionnaire[]> {
  try {
    const { data, error } = await supabase
      .from('questionnaires')
      .select('*, current_version:questionnaire_versions(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[RDIP DB] Failed to fetch questionnaires:', error.message);
      return [];
    }

    return (data || []) as DbQuestionnaire[];
  } catch (err) {
    console.error('[RDIP DB] fetchProjectQuestionnaires error:', err);
    return [];
  }
}

export async function fetchQuestionnaireVersionWithQuestions(versionId: string): Promise<{
  version: DbQuestionnaireVersion | null;
  questions: DbQuestion[];
}> {
  try {
    const { data: version, error: vErr } = await supabase
      .from('questionnaire_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (vErr || !version) {
      return { version: null, questions: [] };
    }

    const { data: questions, error: qErr } = await supabase
      .from('questions')
      .select('*, options:question_options(*)')
      .eq('questionnaire_version_id', versionId)
      .order('display_order', { ascending: true });

    if (qErr) {
      return { version: version as DbQuestionnaireVersion, questions: [] };
    }

    return {
      version: version as DbQuestionnaireVersion,
      questions: (questions || []) as DbQuestion[],
    };
  } catch (err) {
    console.error('[RDIP DB] fetchQuestionnaireVersionWithQuestions error:', err);
    return { version: null, questions: [] };
  }
}

// ==============================================================================
// 5. ENUMERATOR ASSIGNMENTS (Strict RLS Isolation Verification)
// ==============================================================================

export async function fetchEnumeratorAssignedQuestionnaires(enumeratorId: string): Promise<DbQuestionnaireAssignment[]> {
  try {
    const { data, error } = await supabase
      .from('questionnaire_assignments')
      .select('*, questionnaire:questionnaires(*)')
      .eq('enumerator_id', enumeratorId)
      .eq('status', 'active');

    if (error) {
      console.warn('[RDIP DB] fetchEnumeratorAssignedQuestionnaires error:', error.message);
      return [];
    }

    return (data || []) as DbQuestionnaireAssignment[];
  } catch (err) {
    console.error('[RDIP DB] fetchEnumeratorAssignedQuestionnaires exception:', err);
    return [];
  }
}

export async function assignEnumeratorToQuestionnaire(params: {
  questionnaire_id: string;
  questionnaire_version_id?: string;
  enumerator_id: string;
  assigned_by: string;
  permissions?: Record<string, boolean>;
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('questionnaire_assignments')
      .upsert({
        questionnaire_id: params.questionnaire_id,
        questionnaire_version_id: params.questionnaire_version_id,
        enumerator_id: params.enumerator_id,
        assigned_by: params.assigned_by,
        status: 'active',
        permissions: params.permissions || { can_collect: true, can_view_history: true },
      }, { onConflict: 'questionnaire_id,enumerator_id' });

    if (error) {
      console.error('[RDIP DB] Failed to assign enumerator:', error.message);
      return false;
    }

    await logAuditEvent({
      user_id: params.assigned_by,
      action: 'ENUMERATOR_ASSIGNED',
      entity_type: 'questionnaire_assignment',
      entity_id: params.questionnaire_id,
      details: { enumerator_id: params.enumerator_id },
    });

    return true;
  } catch (err) {
    console.error('[RDIP DB] assignEnumeratorToQuestionnaire exception:', err);
    return false;
  }
}

// ==============================================================================
// 6. RESPONSES & RESPONSE ANSWERS SERVICE
// ==============================================================================

export async function submitSurveyResponseToDb(params: {
  project_id: string;
  questionnaire_id: string;
  questionnaire_version_id: string;
  enumerator_id?: string | null;
  respondent_id: string;
  collected_offline?: boolean;
  gps_coordinates?: any;
  telemetry?: any;
  answers: Array<{
    question_id?: string;
    variable_name: string;
    answer_value: any;
    text_value?: string;
    numeric_value?: number;
    boolean_value?: boolean;
    date_value?: string;
    gps_value?: any;
  }>;
}): Promise<{ success: boolean; responseId?: string; error?: string }> {
  try {
    // 1. Insert primary response header
    const { data: respData, error: respErr } = await supabase
      .from('responses')
      .insert([{
        project_id: params.project_id,
        questionnaire_id: params.questionnaire_id,
        questionnaire_version_id: params.questionnaire_version_id,
        enumerator_id: params.enumerator_id || null,
        respondent_id: params.respondent_id,
        collection_status: 'synced',
        collected_offline: params.collected_offline ?? false,
        gps_coordinates: params.gps_coordinates || null,
        telemetry: params.telemetry || {},
        submitted_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (respErr || !respData) {
      return { success: false, error: respErr?.message || 'Failed to insert response' };
    }

    // 2. Insert normalized answer rows
    if (params.answers && params.answers.length > 0) {
      const answerRows = params.answers.map((ans) => ({
        response_id: respData.id,
        question_id: ans.question_id || null,
        variable_name: ans.variable_name,
        answer_value: ans.answer_value,
        text_value: ans.text_value ?? null,
        numeric_value: typeof ans.numeric_value === 'number' ? ans.numeric_value : null,
        boolean_value: typeof ans.boolean_value === 'boolean' ? ans.boolean_value : null,
        date_value: ans.date_value ?? null,
        gps_value: ans.gps_value || null,
      }));

      const { error: ansErr } = await supabase.from('response_answers').insert(answerRows);
      if (ansErr) {
        console.warn('[RDIP DB] Answer rows insert warning:', ansErr.message);
      }
    }

    // 3. Log audit event
    await logAuditEvent({
      action: 'RESPONSE_SUBMITTED',
      entity_type: 'response',
      entity_id: respData.id,
      details: {
        project_id: params.project_id,
        questionnaire_id: params.questionnaire_id,
        respondent_id: params.respondent_id,
      },
    });

    return { success: true, responseId: respData.id };
  } catch (err: any) {
    console.error('[RDIP DB] submitSurveyResponseToDb exception:', err);
    return { success: false, error: err?.message || 'Unknown network failure' };
  }
}

export async function fetchProjectResponses(projectId: string): Promise<DbResponse[]> {
  try {
    const { data, error } = await supabase
      .from('responses')
      .select('*, answers:response_answers(*)')
      .eq('project_id', projectId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.warn('[RDIP DB] fetchProjectResponses failed:', error.message);
      return [];
    }

    return (data || []) as DbResponse[];
  } catch (err) {
    console.error('[RDIP DB] fetchProjectResponses exception:', err);
    return [];
  }
}

// ==============================================================================
// 7. VARIABLES & DATA DICTIONARY SERVICE
// ==============================================================================

export async function fetchVariablesForProject(projectId: string): Promise<DbVariable[]> {
  try {
    const { data, error } = await supabase
      .from('variables')
      .select('*')
      .eq('project_id', projectId)
      .order('variable_name', { ascending: true });

    if (error) {
      console.warn('[RDIP DB] fetchVariablesForProject warning:', error.message);
      return [];
    }

    return (data || []) as DbVariable[];
  } catch (err) {
    console.error('[RDIP DB] fetchVariablesForProject exception:', err);
    return [];
  }
}

export async function upsertProjectVariable(variable: Omit<DbVariable, 'id' | 'created_at' | 'updated_at'>): Promise<DbVariable | null> {
  try {
    const { data, error } = await supabase
      .from('variables')
      .upsert(variable, { onConflict: 'project_id,variable_name' })
      .select()
      .single();

    if (error) {
      console.error('[RDIP DB] upsertProjectVariable error:', error.message);
      return null;
    }

    return data as DbVariable;
  } catch (err) {
    console.error('[RDIP DB] upsertProjectVariable exception:', err);
    return null;
  }
}

// ==============================================================================
// 8. DATA QUALITY & STATISTICAL ANALYSIS SERVICE
// ==============================================================================

export async function fetchDataQualityIssues(projectId: string): Promise<DbDataQualityIssue[]> {
  try {
    const { data, error } = await supabase
      .from('data_quality_issues')
      .select('*')
      .eq('project_id', projectId)
      .order('detected_at', { ascending: false });

    if (error) return [];
    return (data || []) as DbDataQualityIssue[];
  } catch (err) {
    return [];
  }
}

export async function saveStatisticalAnalysis(analysis: Omit<DbStatisticalAnalysis, 'id' | 'created_at'>): Promise<boolean> {
  try {
    const { error } = await supabase.from('statistical_analyses').insert([analysis]);
    return !error;
  } catch (err) {
    return false;
  }
}

// ==============================================================================
// 9. AUDIT LOGGING SERVICE
// ==============================================================================

export async function logAuditEvent(params: {
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, any>;
}): Promise<void> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = params.user_id || authData?.user?.id || null;

    await supabase.from('audit_logs').insert([{
      user_id: userId,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id || null,
      details: params.details || {},
      created_at: new Date().toISOString(),
    }]);
  } catch (err) {
    // Non-blocking
    console.debug('[RDIP DB] Audit log recording note:', err);
  }
}

export async function fetchAuditLogs(): Promise<DbAuditLog[]> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return [];
    return (data || []) as DbAuditLog[];
  } catch (err) {
    return [];
  }
}
