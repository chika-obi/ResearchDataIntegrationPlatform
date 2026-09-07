import { supabase } from './supabase';
import {
  DbProfile,
  DbProject,
  DbProjectMember,
  DbQuestionnaire,
  DbQuestionnaireVersion,
  DbQuestion,
  DbQuestionOption,
  DbVariable,
  DbQuestionnaireAssignment,
  DbResponse,
  DbResponseAnswer,
  DbDataQualityIssue,
  DbStatisticalAnalysis,
  DbAuditLog,
  Project,
  ProjectStatus,
  Question,
  QuestionOption,
  QuestionType,
  DataType,
  MeasurementLevel,
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

    let { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (!data && authData.user.email) {
      const { data: emailData } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', authData.user.email)
        .maybeSingle();
      if (emailData) {
        data = emailData;
      }
    }

    if (!data) {
      // Graceful fallback to authenticated user metadata
      const meta = (authData.user as any).user_metadata || {};
      const fallbackRole = (meta.role as any) || 'researcher';
      return {
        id: authData.user.id,
        email: authData.user.email || '',
        full_name: meta.full_name || meta.name || authData.user.email?.split('@')[0] || 'Researcher',
        institution: meta.institution || 'Research Institute',
        department: meta.department || null,
        role: fallbackRole,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
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
  if (!db) {
    return {
      id: '',
      code: 'PROJ',
      title: 'Untitled Project',
      institution: 'Research Institute',
      status: 'Active',
      progress: 0,
      enumeratorsCount: 0,
      responsesCount: 0,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '2025-12-31',
      description: '',
      qualityScore: 100,
      researchObjectives: [],
    };
  }
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

export interface CreateQuestionnaireParams {
  project_id: string; // Must be a real Supabase UUID from public.projects
  name: string;
  description?: string | null;
  version_number?: string; // Default: 'v1.0'
  version_title?: string;
  version_description?: string;
  questions?: Question[];
  metadata?: Record<string, any>;
}

export interface FormattedSupabaseError {
  title: string;
  friendlyMessage: string;
  code?: string;
  technicalDetails?: string;
  actionHint?: string;
}

export function formatSupabaseError(error: any): FormattedSupabaseError {
  if (!error) {
    return {
      title: 'Database Operation Error',
      friendlyMessage: 'An unexpected database error occurred while communicating with Supabase.',
      actionHint: 'Please review your inputs and try again.',
    };
  }

  const rawMessage: string =
    typeof error === 'string'
      ? error
      : error.message || error.error_description || error.error || JSON.stringify(error);
  const rawCode: string | undefined =
    error.code ||
    (rawMessage.match(/\b(23505|42501|23503|23502|PGRST\d+)\b/)
      ? rawMessage.match(/\b(23505|42501|23503|23502|PGRST\d+)\b/)![1]
      : undefined);
  const technicalDetails: string | undefined =
    error.details || error.hint || (typeof error === 'object' && error.message ? error.message : undefined);

  // 1. Unique constraint / duplicate key (PostgreSQL code 23505)
  if (rawCode === '23505' || /unique constraint|already exists|duplicate key/i.test(rawMessage)) {
    return {
      title: 'Duplicate Questionnaire Title',
      friendlyMessage:
        'A questionnaire with this title already exists in the selected project. Questionnaire titles must be unique within each research project.',
      code: rawCode || '23505 (Unique Violation)',
      technicalDetails: technicalDetails || rawMessage,
      actionHint: 'Please provide a distinct title for this questionnaire or choose another parent project.',
    };
  }

  // 2. Row Level Security / Permission Denied (PostgreSQL code 42501)
  if (
    rawCode === '42501' ||
    /row-level security|permission denied|violates.*policy|unauthorized/i.test(rawMessage)
  ) {
    return {
      title: 'Permission Denied by Row-Level Security (RLS)',
      friendlyMessage:
        'Supabase database security policies prevented creating this questionnaire. Questionnaire authoring is restricted to active Researchers and Administrators.',
      code: rawCode || '42501 (Insufficient Privilege)',
      technicalDetails: technicalDetails || rawMessage,
      actionHint:
        'Ensure your authenticated profile has the "researcher" or "admin" role with "active" status in Supabase public.profiles.',
    };
  }

  // 3. Foreign Key Violation (PostgreSQL code 23503)
  if (rawCode === '23503' || /foreign key constraint|violates foreign key/i.test(rawMessage)) {
    return {
      title: 'Referenced Project Not Found in Database',
      friendlyMessage:
        'The selected research project was not found in the Supabase public.projects table (foreign key validation failed).',
      code: rawCode || '23503 (Foreign Key Violation)',
      technicalDetails: technicalDetails || rawMessage,
      actionHint:
        'Ensure the project is saved to Supabase (look for the "✓ Supabase DB" indicator in the project list).',
    };
  }

  // 4. Not Null Constraint Violation (PostgreSQL code 23502)
  if (rawCode === '23502' || /violates not-null constraint|null value in column/i.test(rawMessage)) {
    return {
      title: 'Mandatory Field Missing in Database Payload',
      friendlyMessage:
        'A required database field received a null value during questionnaire insertion.',
      code: rawCode || '23502 (Not Null Violation)',
      technicalDetails: technicalDetails || rawMessage,
      actionHint: 'Verify that all required fields (title, version number, parent project) are filled.',
    };
  }

  // 5. Auth / JWT Session expired
  if (/jwt|session|auth|token|refresh token|unauthenticated/i.test(rawMessage)) {
    return {
      title: 'Supabase Authentication Session Expired',
      friendlyMessage:
        'Your database authentication session is inactive or could not be verified. You must be signed in to author questionnaires.',
      code: rawCode || 'AUTH_SESSION_EXPIRED',
      technicalDetails: technicalDetails || rawMessage,
      actionHint: 'Please sign in again or reload the page to refresh your authentication token.',
    };
  }

  // 6. Network connection failure
  if (/failed to fetch|networkerror|connection refused|timeout/i.test(rawMessage)) {
    return {
      title: 'Supabase Cloud Connection Failed',
      friendlyMessage:
        'Unable to communicate with the Supabase database endpoint. The service could not be reached over the network.',
      code: 'NETWORK_ERROR',
      technicalDetails: technicalDetails || rawMessage,
      actionHint:
        'Check your network connection. Your entered form values are preserved below so you can retry.',
    };
  }

  // 7. Invalid Project UUID check
  if (/invalid project uuid/i.test(rawMessage)) {
    return {
      title: 'Invalid Target Project UUID',
      friendlyMessage:
        'Questionnaires must be linked to a valid Supabase project record with a standard UUID identifier.',
      code: 'INVALID_PROJECT_UUID',
      technicalDetails: technicalDetails || rawMessage,
      actionHint: 'Please select a project with a valid Supabase database record from the dropdown.',
    };
  }

  // 8. General fallback
  return {
    title: 'Supabase Questionnaire Creation Failed',
    friendlyMessage: rawMessage.replace(/^[A-Za-z]+:\s*/, ''),
    code: rawCode || 'SUPABASE_ERROR',
    technicalDetails: technicalDetails || rawMessage,
    actionHint:
      'The form remains editable below. Review your inputs and click "Create Questionnaire in DB" to retry.',
  };
}

export interface CreateQuestionnaireResult {
  data: {
    questionnaire: DbQuestionnaire;
    version: DbQuestionnaireVersion;
    questions?: Question[];
  } | null;
  error: string | null;
  errorCode?: string | null;
  errorDetails?: string | null;
  parsedError?: FormattedSupabaseError;
}

/**
 * Phase 6: Standard UUID validator
 */
export const isStandardUuid = (val?: string | null): boolean => {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
};

/**
 * Phase 6: Sanitize question attributes to match Supabase schema constraints
 */
export function sanitizeQuestionFields(q: Question, idx: number) {
  const validTypes = [
    'multiple-choice',
    'checkboxes',
    'short-text',
    'paragraph',
    'likert',
    'matrix',
    'dropdown',
    'date-time',
    'number',
    'geolocation',
    'gps-coordinate',
  ];
  let qType = q.type;
  if (!validTypes.includes(qType)) {
    qType = 'short-text' as any;
  }

  const validDataTypes = ['Categorical', 'Numerical', 'Ordinal', 'Continuous'];
  let dType = q.dataType || 'Categorical';
  if (!validDataTypes.includes(dType)) dType = 'Categorical';

  const validLevels = ['Nominal', 'Ordinal', 'Interval', 'Ratio'];
  let mLevel = q.measurementLevel || 'Nominal';
  if (!validLevels.includes(mLevel)) mLevel = 'Nominal';

  return {
    question_number: q.number || `Q${idx + 1}`,
    section: q.section || 'Section A',
    question_text: q.title || `Question ${idx + 1}`,
    help_text: q.helpText || null,
    variable_name: q.variableName || `VAR_${idx + 1}`,
    variable_label: q.variableLabel || q.title || null,
    question_type: qType,
    data_type: dType,
    measurement_level: mLevel,
    required: q.required ?? true,
    has_other_option: Boolean(q.hasOtherOption),
    likert_scale: q.likertScale ? Number(q.likertScale) : null,
    linked_research_objective: q.linkedObjective || null,
    validation_rules: q.validationRules || {},
    conditional_logic: q.logicRule || {},
    gps_config: q.gpsConfig || {},
    display_order: idx + 1,
  };
}

/**
 * Phase 6: Convert authoritative database question row and options to frontend Question
 */
export function mapDbQuestionToQuestion(dbQ: any): Question {
  const rawOptions = Array.isArray(dbQ.options) ? dbQ.options : [];
  const sortedOptions = [...rawOptions].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );

  return {
    id: dbQ.id,
    number: dbQ.question_number,
    section: dbQ.section || undefined,
    title: dbQ.question_text,
    helpText: dbQ.help_text || undefined,
    variableName: dbQ.variable_name,
    variableLabel: dbQ.variable_label || undefined,
    type: dbQ.question_type as QuestionType,
    required: Boolean(dbQ.required),
    hasOtherOption: Boolean(dbQ.has_other_option),
    likertScale: dbQ.likert_scale != null ? Number(dbQ.likert_scale) : undefined,
    linkedObjective: dbQ.linked_research_objective || undefined,
    dataType: dbQ.data_type,
    measurementLevel: dbQ.measurement_level,
    validationRules:
      dbQ.validation_rules && Object.keys(dbQ.validation_rules).length > 0
        ? dbQ.validation_rules
        : undefined,
    logicRule:
      dbQ.conditional_logic && Object.keys(dbQ.conditional_logic).length > 0
        ? dbQ.conditional_logic
        : undefined,
    gpsConfig:
      dbQ.gps_config && Object.keys(dbQ.gps_config).length > 0
        ? dbQ.gps_config
        : undefined,
    options: sortedOptions.map((opt: any) => ({
      id: opt.id,
      label: opt.option_label,
      numericCode: opt.numeric_code != null ? Number(opt.numeric_code) : undefined,
    })),
  };
}

export async function fetchProjectQuestionnaires(projectId: string): Promise<{
  data: DbQuestionnaire[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('questionnaires')
      .select('*, current_version:questionnaire_versions!fk_questionnaires_current_version(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[RDIP DB] Primary questionnaire fetch notice:', error.message);
      // Fallback query without specific constraint name in case PostgREST cache differs
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('questionnaires')
        .select('*, current_version:questionnaire_versions(*)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (fallbackErr) {
        // Simple select if nested queries fail
        const { data: simpleData, error: simpleErr } = await supabase
          .from('questionnaires')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });

        if (simpleErr) {
          return { data: [], error: simpleErr.message };
        }
        return { data: (simpleData || []) as DbQuestionnaire[], error: null };
      }
      return { data: (fallbackData || []) as DbQuestionnaire[], error: null };
    }

    return { data: (data || []) as DbQuestionnaire[], error: null };
  } catch (err: any) {
    console.error('[RDIP DB] fetchProjectQuestionnaires error:', err);
    return { data: [], error: err?.message || 'Failed to connect to Supabase database.' };
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

/**
 * Authoritative Supabase Questionnaire Creation
 * Workflow:
 * 1. Validate real authenticated Supabase user UUID.
 * 2. Validate user role in public.profiles (strictly reject enumerators).
 * 3. Validate real Supabase project UUID.
 * 4. Insert into public.questionnaires with status = 'draft', created_by = user.id, project_id = project.id.
 * 5. Insert initial draft version into public.questionnaire_versions with status = 'draft' (NEVER auto-published).
 * 6. Populate public.questions and public.question_options for draft version.
 * 7. Set current_version_id on the questionnaire.
 * 8. Log audit trail.
 */
export async function createQuestionnaireInDb(
  params: CreateQuestionnaireParams
): Promise<CreateQuestionnaireResult> {
  try {
    // 1. Authenticated session validation
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      const parsed = formatSupabaseError(
        authErr || 'Authentication required: You must be signed in with a researcher account to author questionnaires.'
      );
      return {
        data: null,
        error: parsed.friendlyMessage,
        errorCode: parsed.code,
        errorDetails: parsed.technicalDetails,
        parsedError: parsed,
      };
    }
    const userId = authData.user.id;

    // 2. Validate project UUID
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!params.project_id || !UUID_REGEX.test(params.project_id)) {
      const parsed = formatSupabaseError(
        'Invalid Project UUID: Questionnaires must be associated with a valid Supabase project record.'
      );
      return {
        data: null,
        error: parsed.friendlyMessage,
        errorCode: parsed.code,
        errorDetails: parsed.technicalDetails,
        parsedError: parsed,
      };
    }

    // 3. User profile & role permission check
    let { data: creatorProfile, error: profileLookupErr } = await supabase
      .from('profiles')
      .select('id, role, status')
      .eq('id', userId)
      .maybeSingle();

    if (profileLookupErr) {
      console.warn('[RDIP DB] Creator profile lookup note:', profileLookupErr);
    }

    if (!creatorProfile) {
      console.warn('[RDIP DB] Profile not found in public.profiles. Attempting initialization...');
      const userEmail = authData.user.email || '';
      try {
        await supabase.from('profiles').upsert({
          id: userId,
          email: userEmail,
          full_name: authData.user.user_metadata?.full_name || userEmail.split('@')[0] || 'Researcher',
          institution: authData.user.user_metadata?.institution || 'Research Institute',
          role: 'researcher',
          status: 'active',
        });
        const { data: retriedProfile } = await supabase
          .from('profiles')
          .select('id, role, status')
          .eq('id', userId)
          .maybeSingle();
        creatorProfile = retriedProfile;
      } catch (upsertErr) {
        console.debug('[RDIP DB] Profile auto-provisioning note:', upsertErr);
      }
    }

    if (creatorProfile) {
      if (creatorProfile.status !== 'active') {
        const parsed = formatSupabaseError(
          `Permission denied: Account status is '${creatorProfile.status}'. Active status required to create questionnaires.`
        );
        return {
          data: null,
          error: parsed.friendlyMessage,
          errorCode: 'ACCOUNT_INACTIVE',
          errorDetails: `Account status is '${creatorProfile.status}'. Active status required.`,
          parsedError: parsed,
        };
      }
      if (creatorProfile.role === 'enumerator') {
        const parsed = formatSupabaseError(
          'Permission denied: Field enumerators cannot author questionnaires. Researcher role required.'
        );
        return {
          data: null,
          error: parsed.friendlyMessage,
          errorCode: 'ROLE_UNAUTHORIZED',
          errorDetails: 'Field enumerators cannot author questionnaires. Researcher or Admin role required.',
          parsedError: parsed,
        };
      }
    }

    // 4. Verify project exists in public.projects
    const { data: projectRow, error: projErr } = await supabase
      .from('projects')
      .select('id, title, owner_id')
      .eq('id', params.project_id)
      .maybeSingle();

    if (projErr || !projectRow) {
      const parsed = formatSupabaseError(
        projErr || 'Target project not found in Supabase: Project does not exist or access denied.'
      );
      return {
        data: null,
        error: parsed.friendlyMessage,
        errorCode: projErr?.code || 'PROJECT_NOT_FOUND',
        errorDetails: projErr?.details || projErr?.message || 'Project not found in public.projects.',
        parsedError: parsed,
      };
    }

    // 5. Pre-generate UUIDs to avoid RETURNING race conditions
    const newQuestionnaireId = crypto.randomUUID();
    const newVersionId = crypto.randomUUID();
    const versionNumber = params.version_number || 'v1.0';

    // Ensure all questions and options have stable, valid UUIDs
    const preparedQuestions: Question[] = (params.questions || []).map((q, idx) => {
      const qCopy = { ...q };
      if (!isStandardUuid(qCopy.id)) {
        qCopy.id = crypto.randomUUID();
      }
      if (!qCopy.number) {
        qCopy.number = `Q${idx + 1}`;
      }
      if (qCopy.options && Array.isArray(qCopy.options)) {
        qCopy.options = qCopy.options.map((opt, optIdx) => {
          const optCopy = { ...opt };
          if (!isStandardUuid(optCopy.id)) {
            optCopy.id = crypto.randomUUID();
          }
          if (optCopy.numericCode === undefined) {
            optCopy.numericCode = optIdx + 1;
          }
          return optCopy;
        });
      }
      return qCopy;
    });

    // 6. Schema definition for initial draft version
    const schemaDefinition = {
      sections: [
        {
          id: 'sec-a',
          title: params.metadata?.section || 'Section A: General Demographics & Core Measures',
          description: params.metadata?.sectionDesc || 'Primary protocol instrument sections',
        },
      ],
      style: params.metadata?.style || 'academic',
      questions: preparedQuestions,
      created_at: new Date().toISOString(),
    };

    // 7. Insert into public.questionnaires (Draft status, real project_id & created_by)
    const questionnairePayload = {
      id: newQuestionnaireId,
      project_id: params.project_id,
      created_by: userId,
      name: params.name.trim(),
      description: params.description ? params.description.trim() : null,
      status: 'draft' as const,
      metadata: {
        ...params.metadata,
        created_via: 'RDIP Questionnaire Studio',
        created_at: new Date().toISOString(),
      },
    };

    const { error: qInsertError } = await supabase
      .from('questionnaires')
      .insert([questionnairePayload]);

    if (qInsertError) {
      console.error('[RDIP DB] Failed to insert questionnaire into Supabase:', qInsertError);
      const parsed = formatSupabaseError(qInsertError);
      return {
        data: null,
        error: parsed.friendlyMessage,
        errorCode: qInsertError.code,
        errorDetails: qInsertError.details || qInsertError.hint || qInsertError.message,
        parsedError: parsed,
      };
    }

    // 8. Insert initial version into public.questionnaire_versions (Status is strictly 'draft')
    const versionPayload = {
      id: newVersionId,
      questionnaire_id: newQuestionnaireId,
      version_number: versionNumber,
      status: 'draft' as const, // Strict draft requirement: never auto-publish
      title: params.version_title || `${params.name.trim()} (Draft ${versionNumber})`,
      description: params.version_description || 'Initial draft version created in Questionnaire Studio',
      schema_definition: schemaDefinition,
    };

    const { error: vInsertError } = await supabase
      .from('questionnaire_versions')
      .insert([versionPayload]);

    if (vInsertError) {
      console.error('[RDIP DB] Failed to insert initial version into Supabase:', vInsertError);
      // Clean up orphaned questionnaire record
      try {
        await supabase.from('questionnaires').delete().eq('id', newQuestionnaireId);
      } catch (cleanupErr) {
        console.debug('[RDIP DB] Questionnaire cleanup note:', cleanupErr);
      }
      const parsed = formatSupabaseError(vInsertError);
      return {
        data: null,
        error: parsed.friendlyMessage,
        errorCode: vInsertError.code,
        errorDetails: vInsertError.details || vInsertError.hint || vInsertError.message,
        parsedError: parsed,
      };
    }

    // 9. Update questionnaire current_version_id
    try {
      await supabase
        .from('questionnaires')
        .update({ current_version_id: newVersionId })
        .eq('id', newQuestionnaireId);
    } catch (updErr) {
      console.debug('[RDIP DB] Note linking current_version_id:', updErr);
    }

    // 10. Populate relational question rows in public.questions and public.question_options
    if (preparedQuestions.length > 0) {
      try {
        for (let idx = 0; idx < preparedQuestions.length; idx++) {
          const q = preparedQuestions[idx];
          const fields = sanitizeQuestionFields(q, idx);

          const { error: qInsertErr } = await supabase.from('questions').insert([
            {
              id: q.id,
              questionnaire_version_id: newVersionId,
              ...fields,
            },
          ]);

          if (qInsertErr) {
            console.error(`[RDIP DB] Error inserting question ${q.id}:`, qInsertErr);
          }

          if (q.options && q.options.length > 0) {
            for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
              const opt = q.options[optIdx];
              const { error: optErr } = await supabase.from('question_options').insert([
                {
                  id: opt.id,
                  question_id: q.id,
                  option_label: opt.label || `Option ${optIdx + 1}`,
                  option_value: opt.id || `opt_${optIdx + 1}`,
                  numeric_code: typeof opt.numericCode === 'number' ? opt.numericCode : optIdx + 1,
                  display_order: optIdx + 1,
                  metadata: {},
                },
              ]);
              if (optErr) {
                console.error(`[RDIP DB] Error inserting question option ${opt.id}:`, optErr);
              }
            }
          }
        }
      } catch (questionsPopulateErr) {
        console.warn('[RDIP DB] Question row population note:', questionsPopulateErr);
      }
    }

    // Sync back to params.questions in-place
    if (params.questions) {
      for (let i = 0; i < params.questions.length; i++) {
        if (preparedQuestions[i]) {
          params.questions[i].id = preparedQuestions[i].id;
          if (params.questions[i].options && preparedQuestions[i].options) {
            for (let j = 0; j < (params.questions[i].options?.length || 0); j++) {
              if (preparedQuestions[i].options![j]) {
                params.questions[i].options![j].id = preparedQuestions[i].options![j].id;
              }
            }
          }
        }
      }
    }

    // 11. Immutable audit trail
    try {
      await logAuditEvent({
        user_id: userId,
        action: 'QUESTIONNAIRE_CREATED',
        entity_type: 'questionnaire',
        entity_id: newQuestionnaireId,
        details: {
          name: questionnairePayload.name,
          project_id: params.project_id,
          project_title: projectRow.title,
          version_id: newVersionId,
          version_number: versionNumber,
          status: 'draft',
          item_count: params.questions?.length || 0,
        },
      });
    } catch (auditErr) {
      console.debug('[RDIP DB] Audit log note:', auditErr);
    }

    // 12. Fetch authoritative records
    const { data: fetchedQ } = await supabase
      .from('questionnaires')
      .select('*, current_version:questionnaire_versions!fk_questionnaires_current_version(*)')
      .eq('id', newQuestionnaireId)
      .maybeSingle();

    const { data: fetchedV } = await supabase
      .from('questionnaire_versions')
      .select('*')
      .eq('id', newVersionId)
      .maybeSingle();

    const finalVersion: DbQuestionnaireVersion = (fetchedV as DbQuestionnaireVersion) || {
      id: newVersionId,
      questionnaire_id: newQuestionnaireId,
      version_number: versionNumber,
      status: 'draft',
      title: versionPayload.title,
      description: versionPayload.description,
      schema_definition: schemaDefinition,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const finalQuestionnaire: DbQuestionnaire = (fetchedQ as DbQuestionnaire) || {
      id: newQuestionnaireId,
      project_id: params.project_id,
      created_by: userId,
      name: questionnairePayload.name,
      description: questionnairePayload.description,
      status: 'draft',
      current_version_id: newVersionId,
      metadata: questionnairePayload.metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      current_version: (fetchedQ as any)?.current_version || finalVersion,
    };

    return {
      data: {
        questionnaire: finalQuestionnaire,
        version: finalVersion,
        questions: preparedQuestions,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('[RDIP DB] createQuestionnaireInDb fatal error:', err);
    const parsed = formatSupabaseError(err);
    return {
      data: null,
      error: parsed.friendlyMessage,
      errorCode: parsed.code,
      errorDetails: parsed.technicalDetails,
      parsedError: parsed,
    };
  }
}

/**
 * Save draft edits to an existing questionnaire version in Supabase.
 * Respects version immutability: published versions cannot be mutated.
 * Authoritatively syncs public.questions and public.question_options with relational upsert/delete.
 */
export async function saveQuestionnaireDraftInDb(params: {
  questionnaire_id: string;
  version_id?: string;
  name?: string;
  description?: string;
  questions: Question[];
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; questions?: Question[]; error?: string }> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      return {
        success: false,
        error: 'Authentication required to save questionnaire drafts in Supabase.',
      };
    }

    // 1. Update questionnaire header fields
    if (params.name || params.description !== undefined || params.metadata) {
      const updates: any = { updated_at: new Date().toISOString() };
      if (params.name) updates.name = params.name.trim();
      if (params.description !== undefined) updates.description = params.description?.trim() || null;
      if (params.metadata) updates.metadata = params.metadata;

      await supabase
        .from('questionnaires')
        .update(updates)
        .eq('id', params.questionnaire_id);
    }

    // 2. Identify target version
    let targetVersionId = params.version_id;
    if (!targetVersionId) {
      const { data: q } = await supabase
        .from('questionnaires')
        .select('current_version_id')
        .eq('id', params.questionnaire_id)
        .maybeSingle();
      targetVersionId = q?.current_version_id || null;
    }

    if (!targetVersionId) {
      return { success: false, error: 'No questionnaire version found to save draft.' };
    }

    const { data: ver, error: verFetchErr } = await supabase
      .from('questionnaire_versions')
      .select('id, status, schema_definition')
      .eq('id', targetVersionId)
      .maybeSingle();

    if (verFetchErr || !ver) {
      return {
        success: false,
        error: verFetchErr?.message || 'Questionnaire version not found in database.',
      };
    }

    if (ver.status !== 'draft') {
      return {
        success: false,
        error: `Cannot update version: current status is '${ver.status}'. Published versions are immutable. Please create a new draft version.`,
      };
    }

    // 3. Prepare questions and options with stable UUIDs
    const preparedQuestions: Question[] = (params.questions || []).map((q, idx) => {
      const qCopy = { ...q };
      if (!isStandardUuid(qCopy.id)) {
        qCopy.id = crypto.randomUUID();
      }
      if (!qCopy.number) {
        qCopy.number = `Q${idx + 1}`;
      }
      if (qCopy.options && Array.isArray(qCopy.options)) {
        qCopy.options = qCopy.options.map((opt, optIdx) => {
          const optCopy = { ...opt };
          if (!isStandardUuid(optCopy.id)) {
            optCopy.id = crypto.randomUUID();
          }
          if (optCopy.numericCode === undefined) {
            optCopy.numericCode = optIdx + 1;
          }
          return optCopy;
        });
      }
      return qCopy;
    });

    // 4. Fetch existing questions and options for this version
    const { data: existingQRows, error: fetchQErr } = await supabase
      .from('questions')
      .select('id, options:question_options(id)')
      .eq('questionnaire_version_id', targetVersionId);

    if (fetchQErr) {
      console.warn('[RDIP DB] Error fetching existing questions for diff:', fetchQErr);
    }

    const existingQuestionMap = new Map<string, Set<string>>();
    if (existingQRows && Array.isArray(existingQRows)) {
      for (const row of existingQRows) {
        const optIds = new Set<string>();
        if (row.options && Array.isArray(row.options)) {
          for (const o of row.options) {
            if (o.id) optIds.add(o.id);
          }
        }
        existingQuestionMap.set(row.id, optIds);
      }
    }

    // 5. Delete removed questions from public.questions (cascade will remove question_options)
    const activeQuestionIds = new Set(preparedQuestions.map((q) => q.id));
    for (const [existingQId] of existingQuestionMap) {
      if (!activeQuestionIds.has(existingQId)) {
        const { error: delErr } = await supabase
          .from('questions')
          .delete()
          .eq('id', existingQId);
        if (delErr) {
          console.error(`[RDIP DB] Failed to delete removed question ${existingQId}:`, delErr);
        }
      }
    }

    // 6. Upsert current questions and options
    for (let idx = 0; idx < preparedQuestions.length; idx++) {
      const q = preparedQuestions[idx];
      const fields = sanitizeQuestionFields(q, idx);

      if (existingQuestionMap.has(q.id)) {
        // Update existing question
        const { error: updErr } = await supabase
          .from('questions')
          .update({
            ...fields,
            updated_at: new Date().toISOString(),
          })
          .eq('id', q.id);

        if (updErr) {
          console.error(`[RDIP DB] Failed to update question ${q.id}:`, updErr);
        }
      } else {
        // Insert new question
        const { error: insErr } = await supabase.from('questions').insert([
          {
            id: q.id,
            questionnaire_version_id: targetVersionId,
            ...fields,
          },
        ]);

        if (insErr) {
          console.error(`[RDIP DB] Failed to insert question ${q.id}:`, insErr);
        }
      }

      // Handle options synchronization for this question
      const existingOptIds = existingQuestionMap.get(q.id) || new Set<string>();
      const currentOptIds = new Set((q.options || []).map((o) => o.id));

      // Delete removed options
      for (const optId of existingOptIds) {
        if (!currentOptIds.has(optId)) {
          const { error: delOptErr } = await supabase
            .from('question_options')
            .delete()
            .eq('id', optId);
          if (delOptErr) {
            console.error(`[RDIP DB] Failed to delete removed option ${optId}:`, delOptErr);
          }
        }
      }

      // Upsert current options
      if (q.options && q.options.length > 0) {
        for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
          const opt = q.options[optIdx];
          const optPayload = {
            id: opt.id,
            question_id: q.id,
            option_label: opt.label || `Option ${optIdx + 1}`,
            option_value: opt.id || `opt_${optIdx + 1}`,
            numeric_code: typeof opt.numericCode === 'number' ? opt.numericCode : optIdx + 1,
            display_order: optIdx + 1,
            metadata: {},
          };

          if (existingOptIds.has(opt.id)) {
            const { error: updOptErr } = await supabase
              .from('question_options')
              .update(optPayload)
              .eq('id', opt.id);
            if (updOptErr) {
              console.error(`[RDIP DB] Failed to update option ${opt.id}:`, updOptErr);
            }
          } else {
            const { error: insOptErr } = await supabase
              .from('question_options')
              .insert([optPayload]);
            if (insOptErr) {
              console.error(`[RDIP DB] Failed to insert option ${opt.id}:`, insOptErr);
            }
          }
        }
      }
    }

    // 7. Keep schema_definition synchronized for backwards compatibility
    const updatedSchema = {
      ...(ver.schema_definition || {}),
      questions: preparedQuestions,
      last_saved_at: new Date().toISOString(),
    };

    const { error: verUpdateErr } = await supabase
      .from('questionnaire_versions')
      .update({
        schema_definition: updatedSchema,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetVersionId);

    if (verUpdateErr) {
      console.warn('[RDIP DB] schema_definition update note:', verUpdateErr.message);
    }

    // 8. Update caller's questions in-place so local state retains newly assigned UUIDs
    if (params.questions) {
      for (let i = 0; i < params.questions.length; i++) {
        if (preparedQuestions[i]) {
          params.questions[i].id = preparedQuestions[i].id;
          if (params.questions[i].options && preparedQuestions[i].options) {
            for (let j = 0; j < (params.questions[i].options?.length || 0); j++) {
              if (preparedQuestions[i].options![j]) {
                params.questions[i].options![j].id = preparedQuestions[i].options![j].id;
              }
            }
          }
        }
      }
    }

    return { success: true, questions: preparedQuestions };
  } catch (err: any) {
    console.error('[RDIP DB] saveQuestionnaireDraftInDb error:', err);
    return { success: false, error: err?.message || 'Failed to save questionnaire draft.' };
  }
}

/**
 * Phase 6: Granular single question creation in Supabase
 */
export async function createQuestionInDb(params: {
  version_id: string;
  question: Question;
  display_order?: number;
}): Promise<{ success: boolean; question?: Question; error?: string }> {
  try {
    const qCopy = { ...params.question };
    if (!isStandardUuid(qCopy.id)) qCopy.id = crypto.randomUUID();

    const fields = sanitizeQuestionFields(qCopy, (params.display_order ?? 1) - 1);
    const { error: qErr } = await supabase.from('questions').insert([
      {
        id: qCopy.id,
        questionnaire_version_id: params.version_id,
        ...fields,
      },
    ]);

    if (qErr) {
      return { success: false, error: qErr.message };
    }

    if (qCopy.options && qCopy.options.length > 0) {
      for (let i = 0; i < qCopy.options.length; i++) {
        const opt = qCopy.options[i];
        if (!isStandardUuid(opt.id)) opt.id = crypto.randomUUID();
        await supabase.from('question_options').insert([
          {
            id: opt.id,
            question_id: qCopy.id,
            option_label: opt.label || `Option ${i + 1}`,
            option_value: opt.id,
            numeric_code: opt.numericCode ?? i + 1,
            display_order: i + 1,
            metadata: {},
          },
        ]);
      }
    }

    return { success: true, question: qCopy };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create question in DB.' };
  }
}

/**
 * Phase 6: Granular single question update in Supabase
 */
export async function updateQuestionInDb(params: {
  question_id: string;
  updates: Partial<Question>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const dbUpdates: any = { updated_at: new Date().toISOString() };
    if (params.updates.title !== undefined) dbUpdates.question_text = params.updates.title;
    if (params.updates.number !== undefined) dbUpdates.question_number = params.updates.number;
    if (params.updates.section !== undefined) dbUpdates.section = params.updates.section;
    if (params.updates.helpText !== undefined) dbUpdates.help_text = params.updates.helpText;
    if (params.updates.variableName !== undefined) dbUpdates.variable_name = params.updates.variableName;
    if (params.updates.variableLabel !== undefined) dbUpdates.variable_label = params.updates.variableLabel;
    if (params.updates.type !== undefined) dbUpdates.question_type = params.updates.type;
    if (params.updates.required !== undefined) dbUpdates.required = params.updates.required;
    if (params.updates.hasOtherOption !== undefined) dbUpdates.has_other_option = params.updates.hasOtherOption;
    if (params.updates.likertScale !== undefined) dbUpdates.likert_scale = params.updates.likertScale;
    if (params.updates.linkedObjective !== undefined) dbUpdates.linked_research_objective = params.updates.linkedObjective;
    if (params.updates.dataType !== undefined) dbUpdates.data_type = params.updates.dataType;
    if (params.updates.measurementLevel !== undefined) dbUpdates.measurement_level = params.updates.measurementLevel;
    if (params.updates.validationRules !== undefined) dbUpdates.validation_rules = params.updates.validationRules;
    if (params.updates.logicRule !== undefined) dbUpdates.conditional_logic = params.updates.logicRule;
    if (params.updates.gpsConfig !== undefined) dbUpdates.gps_config = params.updates.gpsConfig;

    const { error } = await supabase
      .from('questions')
      .update(dbUpdates)
      .eq('id', params.question_id);

    if (error) return { success: false, error: error.message };

    // If options are provided, sync options
    if (params.updates.options !== undefined && Array.isArray(params.updates.options)) {
      const { data: existingOpts } = await supabase
        .from('question_options')
        .select('id')
        .eq('question_id', params.question_id);

      const existingOptIds = new Set((existingOpts || []).map((o) => o.id));
      const currentOptIds = new Set(params.updates.options.map((o) => o.id));

      for (const optId of existingOptIds) {
        if (!currentOptIds.has(optId)) {
          await supabase.from('question_options').delete().eq('id', optId);
        }
      }

      for (let i = 0; i < params.updates.options.length; i++) {
        const opt = params.updates.options[i];
        if (!isStandardUuid(opt.id)) opt.id = crypto.randomUUID();

        const optPayload = {
          id: opt.id,
          question_id: params.question_id,
          option_label: opt.label || `Option ${i + 1}`,
          option_value: opt.id,
          numeric_code: opt.numericCode ?? i + 1,
          display_order: i + 1,
          metadata: {},
        };

        if (existingOptIds.has(opt.id)) {
          await supabase.from('question_options').update(optPayload).eq('id', opt.id);
        } else {
          await supabase.from('question_options').insert([optPayload]);
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update question in DB.' };
  }
}

/**
 * Phase 6: Granular question deletion in Supabase (cascades to options)
 */
export async function deleteQuestionInDb(questionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase.from('questions').delete().eq('id', questionId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete question from DB.' };
  }
}

// ==============================================================================
// PHASE 5: QUESTIONNAIRE VERSIONING DATABASE SERVICE
// ==============================================================================

export interface CreateQuestionnaireVersionParams {
  questionnaire_id: string; // Target questionnaire UUID
  source_version_id?: string; // Source version to branch from
  version_number?: string; // e.g. "v1.1" or "v2.0"
  version_title?: string;
  version_description?: string;
  questions?: Question[]; // Snapshot questions
  metadata?: Record<string, any>;
  is_major?: boolean;
  set_as_current?: boolean; // Defaults to true
}

export interface CreateVersionResult {
  data: {
    version: DbQuestionnaireVersion;
    questionnaire: DbQuestionnaire;
    questions: Question[];
  } | null;
  error: string | null;
  errorCode?: string | null;
  errorDetails?: string | null;
  parsedError?: FormattedSupabaseError;
}

/**
 * Predictable version number calculator
 * If highest version is v1.0 -> minor increment yields v1.1
 * If major increment requested -> yields v2.0
 */
export function calculateNextVersionNumber(
  existingVersions: { version_number: string }[],
  isMajor = false
): string {
  if (!existingVersions || existingVersions.length === 0) {
    return isMajor ? 'v2.0' : 'v1.1';
  }

  let highestMajor = 1;
  let highestMinor = 0;

  for (const ver of existingVersions) {
    const match = ver.version_number?.match(/^v?(\d+)\.(\d+)/i);
    if (match) {
      const maj = parseInt(match[1], 10);
      const min = parseInt(match[2], 10);
      if (maj > highestMajor) {
        highestMajor = maj;
        highestMinor = min;
      } else if (maj === highestMajor && min > highestMinor) {
        highestMinor = min;
      }
    }
  }

  if (isMajor) {
    return `v${highestMajor + 1}.0`;
  }
  return `v${highestMajor}.${highestMinor + 1}`;
}

/**
 * Fetch all versions belonging to a questionnaire from public.questionnaire_versions
 */
export async function fetchQuestionnaireVersions(questionnaireId: string): Promise<{
  data: DbQuestionnaireVersion[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('questionnaire_versions')
      .select('*')
      .eq('questionnaire_id', questionnaireId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[RDIP DB] fetchQuestionnaireVersions error:', error.message);
      return { data: [], error: error.message };
    }

    return { data: (data || []) as DbQuestionnaireVersion[], error: null };
  } catch (err: any) {
    console.error('[RDIP DB] fetchQuestionnaireVersions exception:', err);
    return { data: [], error: err?.message || 'Failed to fetch questionnaire versions.' };
  }
}

/**
 * Retrieve a specific version by its UUID, including its normalized questions
 */
export async function fetchQuestionnaireVersionById(versionId: string): Promise<{
  version: DbQuestionnaireVersion | null;
  questions: Question[];
  error: string | null;
}> {
  try {
    const { data: version, error: vErr } = await supabase
      .from('questionnaire_versions')
      .select('*')
      .eq('id', versionId)
      .maybeSingle();

    if (vErr || !version) {
      return {
        version: null,
        questions: [],
        error: vErr?.message || 'Version not found in Supabase.',
      };
    }

    // Phase 6: Query relational questions and options tables authoritatively
    const { data: qRows, error: qErr } = await supabase
      .from('questions')
      .select('*, options:question_options(*)')
      .eq('questionnaire_version_id', versionId)
      .order('display_order', { ascending: true });

    if (!qErr && qRows && qRows.length > 0) {
      const mappedQuestions = qRows.map(mapDbQuestionToQuestion);
      return {
        version: version as DbQuestionnaireVersion,
        questions: mappedQuestions,
        error: null,
      };
    }

    // Fallback to schema_definition.questions if no relational rows exist (e.g. legacy records)
    if (
      version.schema_definition?.questions &&
      Array.isArray(version.schema_definition.questions) &&
      version.schema_definition.questions.length > 0
    ) {
      return {
        version: version as DbQuestionnaireVersion,
        questions: version.schema_definition.questions as Question[],
        error: null,
      };
    }

    return {
      version: version as DbQuestionnaireVersion,
      questions: [],
      error: null,
    };
  } catch (err: any) {
    console.error('[RDIP DB] fetchQuestionnaireVersionById error:', err);
    return {
      version: null,
      questions: [],
      error: err?.message || 'Failed to fetch version from Supabase.',
    };
  }
}

/**
 * Switch questionnaire's current_version_id pointer
 */
export async function updateQuestionnaireCurrentVersion(
  questionnaireId: string,
  versionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      return { success: false, error: 'Authentication required to switch working version.' };
    }

    const { error: updErr } = await supabase
      .from('questionnaires')
      .update({
        current_version_id: versionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionnaireId);

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    try {
      await logAuditEvent({
        user_id: authData.user.id,
        action: 'QUESTIONNAIRE_VERSION_SWITCHED',
        entity_type: 'questionnaire',
        entity_id: questionnaireId,
        details: { new_current_version_id: versionId },
      });
    } catch (auditErr) {
      console.debug('[RDIP DB] Version switch audit note:', auditErr);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to switch current version.' };
  }
}

/**
 * Authoritative Supabase Questionnaire Version Creation (Phase 5)
 * Workflow:
 * 1. Authenticate researcher / reject field enumerators.
 * 2. Verify target questionnaire.
 * 3. Fetch existing versions, calculate next predictable version number, prevent duplicates.
 * 4. Deep-clone source questions to enforce absolute version independence.
 * 5. Insert new row in public.questionnaire_versions with status = 'draft' (never auto-published).
 * 6. Populate relational questions and options rows.
 * 7. Update questionnaire current_version_id pointer.
 * 8. Log immutable audit event.
 */
export async function createQuestionnaireVersionInDb(
  params: CreateQuestionnaireVersionParams
): Promise<CreateVersionResult> {
  try {
    // 1. Authenticated session validation
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      const parsed = formatSupabaseError(
        'Authentication required. Please sign in to create questionnaire versions.'
      );
      return {
        data: null,
        error: parsed.friendlyMessage,
        errorCode: 'AUTH_REQUIRED',
        parsedError: parsed,
      };
    }
    const userId = authData.user.id;

    // 2. Profile role validation
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.role === 'enumerator') {
      const parsed = formatSupabaseError(
        'Permission Denied: Field enumerators cannot author or branch questionnaire versions. Researcher role required.'
      );
      return {
        data: null,
        error: parsed.friendlyMessage,
        errorCode: '42501',
        parsedError: parsed,
      };
    }

    // 3. Verify target questionnaire exists
    const { data: questionnaire, error: qErr } = await supabase
      .from('questionnaires')
      .select('*')
      .eq('id', params.questionnaire_id)
      .single();

    if (qErr || !questionnaire) {
      const parsed = formatSupabaseError(
        `Target questionnaire not found in Supabase (ID: ${params.questionnaire_id}).`
      );
      return {
        data: null,
        error: parsed.friendlyMessage,
        errorCode: 'NOT_FOUND',
        parsedError: parsed,
      };
    }

    // 4. Fetch existing versions to ensure uniqueness and calculate next version if needed
    const { data: existingVersions, error: vListErr } = await supabase
      .from('questionnaire_versions')
      .select('*')
      .eq('questionnaire_id', params.questionnaire_id)
      .order('created_at', { ascending: false });

    if (vListErr) {
      console.warn('[RDIP DB] Error fetching existing versions:', vListErr.message);
    }

    const versionList = (existingVersions || []) as DbQuestionnaireVersion[];

    // Determine version number
    let targetVersionNumber = params.version_number?.trim();
    if (!targetVersionNumber) {
      targetVersionNumber = calculateNextVersionNumber(versionList, params.is_major);
    } else {
      if (!targetVersionNumber.startsWith('v') && !targetVersionNumber.startsWith('V')) {
        targetVersionNumber = `v${targetVersionNumber}`;
      }
    }

    // Check duplicate version constraint before inserting
    const isDuplicate = versionList.some(
      (v) => v.version_number?.toLowerCase() === targetVersionNumber!.toLowerCase()
    );
    if (isDuplicate) {
      const parsed = formatSupabaseError({
        message: `Version ${targetVersionNumber} already exists for questionnaire "${questionnaire.name}". Please provide a unique version number.`,
        code: '23505',
        details: 'Unique constraint violated on questionnaire_id, version_number.',
      });
      return {
        data: null,
        error: parsed.friendlyMessage,
        errorCode: '23505',
        errorDetails: parsed.technicalDetails,
        parsedError: parsed,
      };
    }

    // 5. Read source content (Critical Version Independence)
    let sourceQuestions: Question[] = [];
    let sourceVerNumber = 'v1.0';

    if (params.questions && Array.isArray(params.questions) && params.questions.length > 0) {
      sourceQuestions = params.questions;
    } else {
      // Find source version
      const sourceVerId = params.source_version_id || questionnaire.current_version_id;
      if (sourceVerId) {
        const sourceVer = versionList.find((v) => v.id === sourceVerId);
        if (sourceVer) {
          sourceVerNumber = sourceVer.version_number;
        }

        // Authoritatively query public.questions joined with question_options
        const { data: srcQRows, error: srcQErr } = await supabase
          .from('questions')
          .select('*, options:question_options(*)')
          .eq('questionnaire_version_id', sourceVerId)
          .order('display_order', { ascending: true });

        if (!srcQErr && srcQRows && srcQRows.length > 0) {
          sourceQuestions = srcQRows.map(mapDbQuestionToQuestion);
        } else if (
          sourceVer?.schema_definition?.questions &&
          Array.isArray(sourceVer.schema_definition.questions)
        ) {
          sourceQuestions = sourceVer.schema_definition.questions;
        }
      }
    }

    // Deep clone questions with new independent UUIDs to enforce strict version independence
    const idMap = new Map<string, string>();
    const clonedQuestions: Question[] = sourceQuestions.map((q) => {
      const newQId = crypto.randomUUID();
      if (q.id) idMap.set(q.id, newQId);
      return {
        ...JSON.parse(JSON.stringify(q)),
        id: newQId,
        options: q.options
          ? q.options.map((opt, optIdx) => ({
              ...JSON.parse(JSON.stringify(opt)),
              id: crypto.randomUUID(),
              numericCode: opt.numericCode ?? optIdx + 1,
            }))
          : undefined,
      };
    });

    // Update targetQuestionId in logic rules to reference cloned questions
    for (const q of clonedQuestions) {
      if (q.logicRule?.branches) {
        for (const branch of q.logicRule.branches) {
          if (branch.targetQuestionId && idMap.has(branch.targetQuestionId)) {
            branch.targetQuestionId = idMap.get(branch.targetQuestionId)!;
          }
        }
      }
    }

    // 6. Insert new version record in public.questionnaire_versions
    const newVersionId = crypto.randomUUID();
    const schemaDefinition = {
      title: params.version_title || `${questionnaire.name} (${targetVersionNumber})`,
      description: params.version_description || `Draft version created from ${sourceVerNumber}`,
      questions: clonedQuestions,
      version_number: targetVersionNumber,
      source_version_id: params.source_version_id || null,
      created_by: userId,
      created_at: new Date().toISOString(),
      metadata: {
        ...(params.metadata || {}),
        created_by: userId,
      },
    };

    const versionPayload = {
      id: newVersionId,
      questionnaire_id: params.questionnaire_id,
      version_number: targetVersionNumber,
      status: 'draft' as const, // Strict rule: new version is always draft
      title: params.version_title || `${questionnaire.name} (Draft ${targetVersionNumber})`,
      description:
        params.version_description || `Draft version branched from ${sourceVerNumber}`,
      schema_definition: schemaDefinition,
    };

    const { error: vInsertErr } = await supabase
      .from('questionnaire_versions')
      .insert([versionPayload]);

    if (vInsertErr) {
      console.error('[RDIP DB] Error inserting new version into Supabase:', vInsertErr);
      const parsed = formatSupabaseError(vInsertErr);
      return {
        data: null,
        error: parsed.friendlyMessage,
        errorCode: vInsertErr.code,
        errorDetails: vInsertErr.details || vInsertErr.message,
        parsedError: parsed,
      };
    }

    // 7. Populate relational questions and options for this version in public.questions & question_options
    if (clonedQuestions.length > 0) {
      try {
        for (let idx = 0; idx < clonedQuestions.length; idx++) {
          const q = clonedQuestions[idx];
          const fields = sanitizeQuestionFields(q, idx);

          const { error: qErr } = await supabase.from('questions').insert([
            {
              id: q.id,
              questionnaire_version_id: newVersionId,
              ...fields,
            },
          ]);

          if (qErr) {
            console.error(`[RDIP DB] Error inserting cloned question ${q.id}:`, qErr);
          }

          if (q.options && q.options.length > 0) {
            for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
              const opt = q.options[optIdx];
              const { error: optErr } = await supabase.from('question_options').insert([
                {
                  id: opt.id,
                  question_id: q.id,
                  option_label: opt.label || `Option ${optIdx + 1}`,
                  option_value: opt.id || `opt_${optIdx + 1}`,
                  numeric_code: typeof opt.numericCode === 'number' ? opt.numericCode : optIdx + 1,
                  display_order: optIdx + 1,
                  metadata: {},
                },
              ]);
              if (optErr) {
                console.error(`[RDIP DB] Error inserting cloned question option ${opt.id}:`, optErr);
              }
            }
          }
        }
      } catch (relationalPopulateErr) {
        console.warn('[RDIP DB] Relational question population note:', relationalPopulateErr);
      }
    }

    // 8. Update questionnaires.current_version_id if set_as_current is true (default)
    const shouldSetCurrent = params.set_as_current !== false;
    if (shouldSetCurrent) {
      await supabase
        .from('questionnaires')
        .update({
          current_version_id: newVersionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.questionnaire_id);
    }

    // 9. Audit event
    try {
      await logAuditEvent({
        user_id: userId,
        action: 'QUESTIONNAIRE_VERSION_CREATED',
        entity_type: 'questionnaire_version',
        entity_id: newVersionId,
        details: {
          questionnaire_id: params.questionnaire_id,
          questionnaire_name: questionnaire.name,
          version_number: targetVersionNumber,
          source_version_number: sourceVerNumber,
          is_major: Boolean(params.is_major),
          status: 'draft',
          item_count: clonedQuestions.length,
        },
      });
    } catch (auditErr) {
      console.debug('[RDIP DB] Audit log note:', auditErr);
    }

    // 10. Fetch updated questionnaire and version
    const { data: updatedQ } = await supabase
      .from('questionnaires')
      .select('*, current_version:questionnaire_versions!fk_questionnaires_current_version(*)')
      .eq('id', params.questionnaire_id)
      .maybeSingle();

    const { data: createdVersion } = await supabase
      .from('questionnaire_versions')
      .select('*')
      .eq('id', newVersionId)
      .maybeSingle();

    const returnVersion: DbQuestionnaireVersion = createdVersion
      ? {
          ...createdVersion,
          created_by: (createdVersion.schema_definition as any)?.created_by || userId,
        }
      : {
          ...versionPayload,
          created_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

    return {
      data: {
        version: returnVersion,
        questionnaire: (updatedQ || questionnaire) as DbQuestionnaire,
        questions: clonedQuestions,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('[RDIP DB] createQuestionnaireVersionInDb exception:', err);
    const parsed = formatSupabaseError(err);
    return {
      data: null,
      error: parsed.friendlyMessage,
      errorCode: parsed.code,
      errorDetails: parsed.technicalDetails,
      parsedError: parsed,
    };
  }
}

/**
 * Explicitly publish a questionnaire version.
 * Immutability rule: Status changes from 'draft' to 'published'.
 */
export async function publishQuestionnaireVersionInDb(
  versionId: string,
  questionnaireId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      return { success: false, error: 'Authentication required to publish questionnaire.' };
    }
    const userId = authData.user.id;

    // 1. Update version status to published
    const { error: vErr } = await supabase
      .from('questionnaire_versions')
      .update({
        status: 'published',
        published_by: userId,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', versionId);

    if (vErr) {
      return { success: false, error: vErr.message };
    }

    // 2. Update parent questionnaire status to published
    await supabase
      .from('questionnaires')
      .update({
        status: 'published',
        current_version_id: versionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionnaireId);

    // 3. Log publication audit event
    try {
      await logAuditEvent({
        user_id: userId,
        action: 'QUESTIONNAIRE_VERSION_PUBLISHED',
        entity_type: 'questionnaire_version',
        entity_id: versionId,
        details: { questionnaire_id: questionnaireId },
      });
    } catch (auditErr) {
      console.debug('[RDIP DB] Publication audit log notice:', auditErr);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to publish version.' };
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
