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
  Question,
} from '../types';

/**
 * RDIP Database & Repository Service
 * Provides typed, secure query abstractions over Supabase PostgreSQL tables.
 */

export async function getCurrentUserProfile(): Promise<DbProfile | null> {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (error) return null;
    return data as DbProfile;
  } catch {
    return null;
  }
}

export function mapDbProjectToProject(db: DbProject): Project {
  let status: ProjectStatus = 'Active';
  if (db.status === 'draft') status = 'Design';
  else if (db.status === 'active') status = 'Active';
  else if (db.status === 'collection') status = 'Collection';
  else if (db.status === 'analysis') status = 'Analysis';
  else if (db.status === 'completed') status = 'Complete';

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

    if (error) return { data: [], error: error.message };
    return { data: (data || []) as DbProject[], error: null };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Network error fetching projects' };
  }
}

export async function createProjectInDb(
  project: Omit<DbProject, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: DbProject | null; error: string | null }> {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return { data: null, error: 'Authentication error: Active Supabase session required. Please sign in.' };
    }

    const userId = authData.user.id;
    const userEmail = authData.user.email || '';
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('id, email, role, status')
      .eq('id', userId)
      .maybeSingle();

    if (!creatorProfile) {
      return { data: null, error: 'Active RDIP profile is required before creating a project.' };
    }
    if (creatorProfile.status !== 'active') {
      return { data: null, error: `Permission denied: Your RDIP account status is '${creatorProfile.status}'.` };
    }
    if (!['researcher', 'data_manager', 'super_admin'].includes(creatorProfile.role)) {
      return { data: null, error: `Permission denied: Your current database role is '${creatorProfile.role}'.` };
    }

    const newProjectId = crypto.randomUUID();
    const finalProjectPayload = { ...project, id: newProjectId, owner_id: userId };
    const { error: insertError } = await supabase.from('projects').insert([finalProjectPayload]);
    if (insertError) return { data: null, error: insertError.message };

    try {
      await supabase.from('project_members').insert([{
        project_id: newProjectId,
        user_id: userId,
        role: 'owner',
        permissions: { can_edit: true, can_analyze: true, can_export: true, can_manage_enumerators: true },
        status: 'active',
      }]);
    } catch {
      // Best-effort membership record; project RLS still uses owner_id.
    }

    const { data: fetchedProject } = await supabase
      .from('projects')
      .select('*')
      .eq('id', newProjectId)
      .maybeSingle();

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

    try {
      await logAuditEvent({
        user_id: userId,
        action: 'PROJECT_CREATED',
        entity_type: 'project',
        entity_id: newProjectId,
        details: { title: resultProject.title, code: resultProject.project_code },
      });
    } catch {
      // Audit is best-effort here; the project mutation remains authoritative.
    }

    return { data: resultProject, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Unexpected failure connecting to Supabase database.' };
  }
}

export async function fetchProjectMembers(projectId: string): Promise<DbProjectMember[]> {
  try {
    const { data, error } = await supabase.from('project_members').select('*, profile:profiles(*)').eq('project_id', projectId);
    if (error) return [];
    return (data || []) as DbProjectMember[];
  } catch {
    return [];
  }
}

// ==============================================================================
// 4. QUESTIONNAIRES & VERSIONING SERVICE
// ==============================================================================

export interface CreateQuestionnaireParams {
  project_id: string;
  name: string;
  description?: string | null;
  version_number?: string;
  version_title?: string;
  version_description?: string;
  questions?: Question[];
  metadata?: Record<string, any>;
}

export interface CreateQuestionnaireResult {
  data: { questionnaire: DbQuestionnaire; version: DbQuestionnaireVersion } | null;
  error: string | null;
}

export interface CreateQuestionnaireVersionParams {
  questionnaire_id: string;
  source_version_id?: string | null;
  version_number?: string;
  title?: string;
  description?: string | null;
  copy_questions?: boolean;
}

export interface CreateQuestionnaireVersionResult {
  data: { questionnaire: DbQuestionnaire; version: DbQuestionnaireVersion; source_version_id: string | null } | null;
  error: string | null;
}

export interface QuestionnaireVersionSummary extends DbQuestionnaireVersion {
  question_count?: number;
}

export async function fetchProjectQuestionnaires(projectId: string): Promise<DbQuestionnaire[]> {
  try {
    const { data, error } = await supabase
      .from('questionnaires')
      .select('*, current_version:questionnaire_versions!fk_questionnaires_current_version(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data || []) as DbQuestionnaire[];
  } catch {
    return [];
  }
}

export async function fetchQuestionnaireVersions(questionnaireId: string): Promise<QuestionnaireVersionSummary[]> {
  try {
    const { data: versions, error } = await supabase
      .from('questionnaire_versions')
      .select('*')
      .eq('questionnaire_id', questionnaireId)
      .order('created_at', { ascending: true });
    if (error) return [];

    const rows = (versions || []) as DbQuestionnaireVersion[];
    if (rows.length === 0) return [];

    const counts = await Promise.all(
      rows.map(async (version) => {
        const { count } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('questionnaire_version_id', version.id);
        return { ...version, question_count: count ?? 0 };
      })
    );
    return counts;
  } catch {
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
    if (vErr || !version) return { version: null, questions: [] };

    const { data: questions, error: qErr } = await supabase
      .from('questions')
      .select('*, options:question_options(*)')
      .eq('questionnaire_version_id', versionId)
      .order('display_order', { ascending: true });
    if (qErr) return { version: version as DbQuestionnaireVersion, questions: [] };

    return { version: version as DbQuestionnaireVersion, questions: (questions || []) as DbQuestion[] };
  } catch {
    return { version: null, questions: [] };
  }
}

function normaliseQuestionForInsert(question: Question, idx: number) {
  const validTypes = ['multiple-choice', 'checkboxes', 'short-text', 'paragraph', 'likert', 'matrix', 'dropdown', 'date-time', 'number', 'geolocation', 'gps-coordinate'];
  const validDataTypes = ['Categorical', 'Numerical', 'Ordinal', 'Continuous'];
  const validLevels = ['Nominal', 'Ordinal', 'Interval', 'Ratio'];
  const questionType = validTypes.includes(question.type) ? question.type : 'short-text';
  const dataType = question.dataType && validDataTypes.includes(question.dataType) ? question.dataType : 'Categorical';
  const measurementLevel = question.measurementLevel && validLevels.includes(question.measurementLevel) ? question.measurementLevel : 'Nominal';

  return {
    id: crypto.randomUUID(),
    question_number: question.number || `Q${idx + 1}`,
    section: question.section || null,
    question_text: question.title || `Question ${idx + 1}`,
    help_text: question.helpText || null,
    variable_name: question.variableName || `VAR_${idx + 1}`,
    variable_label: question.variableLabel || question.title || null,
    question_type: questionType,
    data_type: dataType,
    measurement_level: measurementLevel,
    required: question.required ?? true,
    has_other_option: Boolean(question.hasOtherOption),
    likert_scale: question.likertScale ? Number(question.likertScale) : null,
    linked_research_objective: question.linkedObjective || null,
    validation_rules: question.validationRules || {},
    conditional_logic: question.logicRule || {},
    gps_config: question.gpsConfig || {},
    display_order: idx + 1,
    options: question.options || [],
  };
}

async function insertNormalizedQuestionRows(versionId: string, questions: Question[]): Promise<{ success: boolean; error?: string }> {
  try {
    for (let idx = 0; idx < questions.length; idx++) {
      const q = normaliseQuestionForInsert(questions[idx], idx);
      const { error: qErr } = await supabase.from('questions').insert([{
        id: q.id,
        questionnaire_version_id: versionId,
        question_number: q.question_number,
        section: q.section,
        question_text: q.question_text,
        help_text: q.help_text,
        variable_name: q.variable_name,
        variable_label: q.variable_label,
        question_type: q.question_type,
        data_type: q.data_type,
        measurement_level: q.measurement_level,
        required: q.required,
        has_other_option: q.has_other_option,
        likert_scale: q.likert_scale,
        linked_research_objective: q.linked_research_objective,
        validation_rules: q.validation_rules,
        conditional_logic: q.conditional_logic,
        gps_config: q.gps_config,
        display_order: q.display_order,
      }]);
      if (qErr) return { success: false, error: qErr.message };

      if (q.options.length > 0) {
        const optionRows = q.options.map((opt, optIdx) => ({
          id: crypto.randomUUID(),
          question_id: q.id,
          option_label: opt.label || `Option ${optIdx + 1}`,
          option_value: opt.id || `opt_${optIdx + 1}`,
          numeric_code: typeof opt.numericCode === 'number' ? opt.numericCode : optIdx + 1,
          display_order: optIdx + 1,
        }));
        const { error: optErr } = await supabase.from('question_options').insert(optionRows);
        if (optErr) return { success: false, error: optErr.message };
      }
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to populate normalized question rows.' };
  }
}

export async function createQuestionnaireInDb(params: CreateQuestionnaireParams): Promise<CreateQuestionnaireResult> {
  try {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      return { data: null, error: 'Authentication required: You must be signed in with a researcher account to author questionnaires.' };
    }
    const userId = authData.user.id;
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!params.project_id || !UUID_REGEX.test(params.project_id)) {
      return { data: null, error: 'Invalid Project UUID: Questionnaires must be associated with a valid Supabase project record.' };
    }

    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('id, role, status')
      .eq('id', userId)
      .maybeSingle();
    if (creatorProfile) {
      if (creatorProfile.status !== 'active') {
        return { data: null, error: `Permission denied: Account status is '${creatorProfile.status}'. Active status required to create questionnaires.` };
      }
      if (creatorProfile.role === 'enumerator') {
        return { data: null, error: 'Permission denied: Field enumerators cannot author questionnaires. Researcher role required.' };
      }
    }

    const { data: projectRow, error: projErr } = await supabase
      .from('projects')
      .select('id, title, owner_id')
      .eq('id', params.project_id)
      .maybeSingle();
    if (projErr || !projectRow) {
      return { data: null, error: `Target project not found in Supabase: ${projErr?.message || 'Project does not exist or access denied.'}` };
    }

    const newQuestionnaireId = crypto.randomUUID();
    const newVersionId = crypto.randomUUID();
    const versionNumber = params.version_number || 'v1.0';
    const schemaDefinition = {
      sections: [{
        id: 'sec-a',
        title: params.metadata?.section || 'Section A: General Demographics & Core Measures',
        description: params.metadata?.sectionDesc || 'Primary protocol instrument sections',
      }],
      style: params.metadata?.style || 'academic',
      questions: params.questions || [],
      created_at: new Date().toISOString(),
    };

    const questionnairePayload = {
      id: newQuestionnaireId,
      project_id: params.project_id,
      created_by: userId,
      name: params.name.trim(),
      description: params.description ? params.description.trim() : null,
      status: 'draft' as const,
      metadata: { ...params.metadata, created_via: 'RDIP Questionnaire Studio', created_at: new Date().toISOString() },
    };
    const { error: qInsertError } = await supabase.from('questionnaires').insert([questionnairePayload]);
    if (qInsertError) return { data: null, error: `Failed to insert questionnaire: ${qInsertError.message}` };

    const versionPayload = {
      id: newVersionId,
      questionnaire_id: newQuestionnaireId,
      version_number: versionNumber,
      status: 'draft' as const,
      title: params.version_title || `${params.name.trim()} (Draft ${versionNumber})`,
      description: params.version_description || 'Initial draft version created in Questionnaire Studio',
      schema_definition: schemaDefinition,
    };
    const { error: vInsertError } = await supabase.from('questionnaire_versions').insert([versionPayload]);
    if (vInsertError) {
      await supabase.from('questionnaires').delete().eq('id', newQuestionnaireId);
      return { data: null, error: `Failed to insert initial draft version: ${vInsertError.message}` };
    }

    const { error: linkError } = await supabase
      .from('questionnaires')
      .update({ current_version_id: newVersionId })
      .eq('id', newQuestionnaireId);
    if (linkError) return { data: null, error: `Failed to link current questionnaire version: ${linkError.message}` };

    const populateResult = await insertNormalizedQuestionRows(newVersionId, params.questions || []);
    if (!populateResult.success) {
      return { data: null, error: populateResult.error || 'Failed to save questionnaire questions.' };
    }

    try {
      await logAuditEvent({
        user_id: userId,
        action: 'QUESTIONNAIRE_CREATED',
        entity_type: 'questionnaire',
        entity_id: newQuestionnaireId,
        details: { name: questionnairePayload.name, project_id: params.project_id, version_id: newVersionId, version_number: versionNumber, status: 'draft', item_count: params.questions?.length || 0 },
      });
    } catch {
      // Keep creation successful even if audit transport is unavailable.
    }

    const { data: fetchedQ } = await supabase.from('questionnaires').select('*, current_version:questionnaire_versions!fk_questionnaires_current_version(*)').eq('id', newQuestionnaireId).maybeSingle();
    const { data: fetchedV } = await supabase.from('questionnaire_versions').select('*').eq('id', newVersionId).maybeSingle();
    if (!fetchedQ || !fetchedV) return { data: null, error: 'Questionnaire was created but authoritative reload failed.' };

    return { data: { questionnaire: fetchedQ as DbQuestionnaire, version: fetchedV as DbQuestionnaireVersion }, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || 'An unexpected error occurred while creating the questionnaire in Supabase.' };
  }
}

function extractQuestionsFromSchema(schema: Record<string, any> | undefined): Question[] {
  const rawQuestions = schema?.questions;
  return Array.isArray(rawQuestions) ? (rawQuestions as Question[]) : [];
}

function bumpVersionNumber(versionNumber: string): string {
  const match = versionNumber.trim().match(/^v?(\d+)\.(\d+)$/i);
  if (!match) return 'v1.1';
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return `v${major}.${minor + 1}`;
}

export async function createQuestionnaireVersionInDb(
  params: CreateQuestionnaireVersionParams
): Promise<CreateQuestionnaireVersionResult> {
  try {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) return { data: null, error: 'Authentication required to create a new questionnaire version.' };
    const userId = authData.user.id;

    const { data: questionnaire, error: questionnaireErr } = await supabase
      .from('questionnaires')
      .select('*, current_version:questionnaire_versions!fk_questionnaires_current_version(*)')
      .eq('id', params.questionnaire_id)
      .maybeSingle();
    if (questionnaireErr || !questionnaire) {
      return { data: null, error: `Questionnaire not found: ${questionnaireErr?.message || 'The questionnaire does not exist or access is denied.'}` };
    }

    const sourceVersionId = params.source_version_id || questionnaire.current_version_id || questionnaire.current_version?.id || null;
    if (!sourceVersionId) return { data: null, error: 'No source version is available for version duplication.' };

    const { data: sourceVersion, error: sourceVersionErr } = await supabase
      .from('questionnaire_versions')
      .select('*')
      .eq('id', sourceVersionId)
      .eq('questionnaire_id', params.questionnaire_id)
      .maybeSingle();
    if (sourceVersionErr || !sourceVersion) return { data: null, error: `Source version not found: ${sourceVersionErr?.message || 'Unable to locate the selected version.'}` };

    const nextVersion = params.version_number?.trim() || bumpVersionNumber(sourceVersion.version_number);
    if (!/^v?\d+\.\d+$/.test(nextVersion)) return { data: null, error: 'Version number must use the format v1.0, v1.1, v2.0, etc.' };
    if (nextVersion === sourceVersion.version_number) return { data: null, error: `Version ${nextVersion} already exists as the source version.` };

    const { data: duplicateVersion } = await supabase
      .from('questionnaire_versions')
      .select('id')
      .eq('questionnaire_id', params.questionnaire_id)
      .eq('version_number', nextVersion)
      .maybeSingle();
    if (duplicateVersion) return { data: null, error: `Version ${nextVersion} already exists for this questionnaire.` };

    const sourceData = await fetchQuestionnaireVersionWithQuestions(sourceVersionId);
    const sourceQuestions = sourceData.questions.length > 0 ? sourceData.questions : extractQuestionsFromSchema(sourceVersion.schema_definition);
    const nextVersionId = crypto.randomUUID();

    const schemaDefinition = {
      ...(sourceVersion.schema_definition || {}),
      questions: sourceVersion.schema_definition?.questions || [],
      cloned_from_version_id: sourceVersionId,
      created_at: new Date().toISOString(),
    };

    const versionPayload = {
      id: nextVersionId,
      questionnaire_id: params.questionnaire_id,
      version_number: nextVersion,
      status: 'draft' as const,
      title: params.title?.trim() || `${questionnaire.name} (Draft ${nextVersion})`,
      description: params.description?.trim() || `Draft revision copied from ${sourceVersion.version_number}`,
      schema_definition: schemaDefinition,
    };

    const { error: insertError } = await supabase.from('questionnaire_versions').insert([versionPayload]);
    if (insertError) return { data: null, error: `Failed to create version ${nextVersion}: ${insertError.message}` };

    const shouldCopy = params.copy_questions !== false;
    if (shouldCopy && sourceQuestions.length > 0) {
      const clonedQuestions: Question[] = sourceQuestions.map((q: any, idx) => ({
        id: q.id,
        number: q.question_number || q.number || `Q${idx + 1}`,
        section: q.section || undefined,
        title: q.question_text || q.title || `Question ${idx + 1}`,
        helpText: q.help_text || q.helpText || undefined,
        variableName: q.variable_name || q.variableName || `VAR_${idx + 1}`,
        variableLabel: q.variable_label || q.variableLabel || undefined,
        type: q.question_type || q.type || 'short-text',
        options: Array.isArray(q.options) ? q.options.map((opt: any) => ({
          id: opt.option_value || opt.id || crypto.randomUUID(),
          label: opt.option_label || opt.label || '',
          numericCode: opt.numeric_code ?? opt.numericCode,
        })) : [],
        required: q.required ?? true,
        hasOtherOption: q.has_other_option ?? q.hasOtherOption,
        likertScale: q.likert_scale ?? q.likertScale ?? undefined,
        linkedObjective: q.linked_research_objective ?? q.linkedObjective ?? undefined,
        dataType: q.data_type ?? q.dataType ?? undefined,
        measurementLevel: q.measurement_level ?? q.measurementLevel ?? undefined,
        logicRule: q.conditional_logic ?? q.logicRule ?? undefined,
        validationRules: q.validation_rules ?? q.validationRules ?? undefined,
        gpsConfig: q.gps_config ?? q.gpsConfig ?? undefined,
      }));
      const populateResult = await insertNormalizedQuestionRows(nextVersionId, clonedQuestions);
      if (!populateResult.success) {
        await supabase.from('questionnaire_versions').delete().eq('id', nextVersionId);
        return { data: null, error: populateResult.error || `Failed to copy questions into ${nextVersion}.` };
      }
    }

    const { error: currentError } = await supabase
      .from('questionnaires')
      .update({ current_version_id: nextVersionId, updated_at: new Date().toISOString() })
      .eq('id', params.questionnaire_id);
    if (currentError) return { data: null, error: `Version created but current version could not be updated: ${currentError.message}` };

    try {
      await logAuditEvent({
        user_id: userId,
        action: 'QUESTIONNAIRE_VERSION_CREATED',
        entity_type: 'questionnaire_version',
        entity_id: nextVersionId,
        details: { questionnaire_id: params.questionnaire_id, source_version_id: sourceVersionId, version_number: nextVersion, status: 'draft' },
      });
    } catch {
      // Audit is best-effort.
    }

    const { data: refreshedQuestionnaire } = await supabase
      .from('questionnaires')
      .select('*, current_version:questionnaire_versions!fk_questionnaires_current_version(*)')
      .eq('id', params.questionnaire_id)
      .maybeSingle();
    const { data: refreshedVersion } = await supabase
      .from('questionnaire_versions')
      .select('*')
      .eq('id', nextVersionId)
      .maybeSingle();

    if (!refreshedQuestionnaire || !refreshedVersion) return { data: null, error: 'Version was created but authoritative reload failed.' };

    return {
      data: {
        questionnaire: refreshedQuestionnaire as DbQuestionnaire,
        version: refreshedVersion as DbQuestionnaireVersion,
        source_version_id: sourceVersionId,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Unexpected error creating questionnaire version.' };
  }
}

export async function saveQuestionnaireDraftInDb(params: {
  questionnaire_id: string;
  version_id?: string;
  name?: string;
  description?: string;
  questions: Question[];
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return { success: false, error: 'Authentication required to save questionnaire drafts in Supabase.' };

    let targetVersionId = params.version_id;
    if (!targetVersionId) {
      const { data: q } = await supabase.from('questionnaires').select('current_version_id').eq('id', params.questionnaire_id).maybeSingle();
      targetVersionId = q?.current_version_id || undefined;
    }
    if (!targetVersionId) return { success: false, error: 'No draft version is selected for saving.' };

    const { data: ver, error: verErr } = await supabase
      .from('questionnaire_versions')
      .select('status, schema_definition')
      .eq('id', targetVersionId)
      .eq('questionnaire_id', params.questionnaire_id)
      .maybeSingle();
    if (verErr || !ver) return { success: false, error: 'Selected questionnaire version was not found.' };
    if (ver.status !== 'draft') return { success: false, error: `Cannot update version: current status is '${ver.status}'. Published versions are immutable. Please create a new draft version.` };

    if (params.name || params.description !== undefined || params.metadata) {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (params.name) updates.name = params.name.trim();
      if (params.description !== undefined) updates.description = params.description?.trim() || null;
      if (params.metadata) updates.metadata = params.metadata;
      const { error: qUpdateErr } = await supabase.from('questionnaires').update(updates).eq('id', params.questionnaire_id);
      if (qUpdateErr) return { success: false, error: qUpdateErr.message };
    }

    const updatedSchema = {
      ...(ver.schema_definition || {}),
      questions: params.questions,
      last_saved_at: new Date().toISOString(),
    };
    const { error: schemaErr } = await supabase
      .from('questionnaire_versions')
      .update({ schema_definition: updatedSchema, updated_at: new Date().toISOString() })
      .eq('id', targetVersionId)
      .eq('questionnaire_id', params.questionnaire_id);
    if (schemaErr) return { success: false, error: schemaErr.message };

    // Keep normalized question and option tables synchronized with the draft snapshot.
    const { data: existingQuestions, error: existingErr } = await supabase
      .from('questions')
      .select('id')
      .eq('questionnaire_version_id', targetVersionId);
    if (existingErr) return { success: false, error: existingErr.message };

    for (const existing of existingQuestions || []) {
      const { error: deleteErr } = await supabase.from('questions').delete().eq('id', existing.id).eq('questionnaire_version_id', targetVersionId);
      if (deleteErr) return { success: false, error: deleteErr.message };
    }

    const normalizedResult = await insertNormalizedQuestionRows(targetVersionId, params.questions);
    if (!normalizedResult.success) return { success: false, error: normalizedResult.error };

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save questionnaire draft.' };
  }
}

export async function publishQuestionnaireVersionInDb(
  versionId: string,
  questionnaireId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return { success: false, error: 'Authentication required to publish questionnaire.' };
    const userId = authData.user.id;

    const { data: version, error: versionErr } = await supabase
      .from('questionnaire_versions')
      .select('*')
      .eq('id', versionId)
      .eq('questionnaire_id', questionnaireId)
      .maybeSingle();
    if (versionErr || !version) return { success: false, error: 'Selected questionnaire version was not found.' };
    if (version.status !== 'draft') return { success: false, error: `Only draft versions can be published. Current status is '${version.status}'.` };

    const { data: existingCurrent } = await supabase
      .from('questionnaires')
      .select('current_version_id')
      .eq('id', questionnaireId)
      .maybeSingle();
    const previousCurrentVersionId = existingCurrent?.current_version_id || null;

    const { error: vErr } = await supabase
      .from('questionnaire_versions')
      .update({ status: 'published', published_by: userId, published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', versionId)
      .eq('questionnaire_id', questionnaireId);
    if (vErr) return { success: false, error: vErr.message };

    const { error: qErr } = await supabase
      .from('questionnaires')
      .update({ status: 'published', current_version_id: versionId, updated_at: new Date().toISOString() })
      .eq('id', questionnaireId);
    if (qErr) return { success: false, error: qErr.message };

    // Mark the previously current version deprecated after the new version is published.
    if (previousCurrentVersionId && previousCurrentVersionId !== versionId) {
      const { data: previousVersion } = await supabase
        .from('questionnaire_versions')
        .select('status')
        .eq('id', previousCurrentVersionId)
        .maybeSingle();
      if (previousVersion?.status === 'published') {
        const { error: deprecateErr } = await supabase
          .from('questionnaire_versions')
          .update({ status: 'deprecated', updated_at: new Date().toISOString() })
          .eq('id', previousCurrentVersionId);
        if (deprecateErr) return { success: false, error: deprecateErr.message };
      }
    }

    try {
      await logAuditEvent({
        user_id: userId,
        action: 'QUESTIONNAIRE_VERSION_PUBLISHED',
        entity_type: 'questionnaire_version',
        entity_id: versionId,
        details: { questionnaire_id: questionnaireId, previous_current_version_id: previousCurrentVersionId },
      });
    } catch {
      // Audit is best-effort.
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to publish version.' };
  }
}

// ==============================================================================
// Remaining services below are preserved from the existing application.
// ==============================================================================

export async function fetchEnumeratorAssignedQuestionnaires(enumeratorId: string): Promise<DbQuestionnaireAssignment[]> {
  try {
    const { data, error } = await supabase.from('questionnaire_assignments').select('*, questionnaire:questionnaires(*)').eq('enumerator_id', enumeratorId).eq('status', 'active');
    if (error) return [];
    return (data || []) as DbQuestionnaireAssignment[];
  } catch {
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
    const { error } = await supabase.from('questionnaire_assignments').upsert({
      questionnaire_id: params.questionnaire_id,
      questionnaire_version_id: params.questionnaire_version_id,
      enumerator_id: params.enumerator_id,
      assigned_by: params.assigned_by,
      status: 'active',
      permissions: params.permissions || { can_collect: true, can_view_history: true },
    }, { onConflict: 'questionnaire_id,enumerator_id' });
    if (error) return false;
    await logAuditEvent({ user_id: params.assigned_by, action: 'ENUMERATOR_ASSIGNED', entity_type: 'questionnaire_assignment', entity_id: params.questionnaire_id, details: { enumerator_id: params.enumerator_id } });
    return true;
  } catch {
    return false;
  }
}

export async function submitSurveyResponseToDb(params: {
  project_id: string;
  questionnaire_id: string;
  questionnaire_version_id: string;
  enumerator_id?: string | null;
  respondent_id: string;
  collected_offline?: boolean;
  gps_coordinates?: any;
  telemetry?: any;
  answers: Array<{ question_id?: string; variable_name: string; answer_value: any; text_value?: string; numeric_value?: number; boolean_value?: boolean; date_value?: string; gps_value?: any }>;
}): Promise<{ success: boolean; responseId?: string; error?: string }> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return { success: false, error: 'Authentication required.' };
    const { data: response, error: responseError } = await supabase.from('responses').insert([{
      project_id: params.project_id,
      questionnaire_id: params.questionnaire_id,
      questionnaire_version_id: params.questionnaire_version_id,
      enumerator_id: params.enumerator_id || null,
      respondent_id: params.respondent_id,
      collection_status: 'submitted',
      collected_offline: Boolean(params.collected_offline),
      gps_coordinates: params.gps_coordinates || null,
      telemetry: params.telemetry || {},
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    }]).select('id').single();
    if (responseError || !response) return { success: false, error: responseError?.message || 'Failed to create response.' };
    const rows = params.answers.map((answer) => ({
      response_id: response.id,
      question_id: answer.question_id || null,
      variable_name: answer.variable_name,
      answer_value: answer.answer_value,
      text_value: answer.text_value || null,
      numeric_value: answer.numeric_value ?? null,
      boolean_value: answer.boolean_value ?? null,
      date_value: answer.date_value || null,
      gps_value: answer.gps_value || null,
    }));
    if (rows.length > 0) {
      const { error: answerError } = await supabase.from('response_answers').insert(rows);
      if (answerError) return { success: false, responseId: response.id, error: answerError.message };
    }
    return { success: true, responseId: response.id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to submit response.' };
  }
}

export async function logAuditEvent(params: {
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, any>;
}): Promise<boolean> {
  try {
    const { error } = await supabase.from('audit_logs').insert([{
      user_id: params.user_id,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id || null,
      details: params.details || {},
    }]);
    return !error;
  } catch {
    return false;
  }
}
