-- ==============================================================================
-- RESEARCH DATA INTEGRATION PLATFORM (RDIP)
-- Migration 002: Row Level Security (RLS) & Granular Access Control
-- Description: Hardened multi-role access control enforcing least-privilege,
--              strict project isolation, enumerator response isolation,
--              referential consistency, data dictionary confidentiality,
--              and immutable audit log protection.
-- ==============================================================================


-- ==============================================================================
-- 1. ENABLE ROW LEVEL SECURITY ACROSS ALL 14 CORE SCHEMA TABLES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_quality_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statistical_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 2. SECURITY DEFINER HELPER FUNCTIONS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 2.1 Check whether a user is an active super administrator
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = p_user_id
          AND p.role = 'super_admin'
          AND p.status = 'active'
    );
END;
$$;


-- ------------------------------------------------------------------------------
-- 2.2 Check whether a user owns a project
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_project_owner(
    p_project_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_project_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.projects AS pr
        WHERE pr.id = p_project_id
          AND pr.owner_id = p_user_id
    );
END;
$$;


-- ------------------------------------------------------------------------------
-- 2.3 Check basic project access
-- Super Admin, Project Owner, or Active Project Member
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_project_access(
    p_project_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_project_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF public.is_super_admin(p_user_id) THEN
        RETURN TRUE;
    END IF;

    IF public.is_project_owner(p_project_id, p_user_id) THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.project_members AS pm
        WHERE pm.project_id = p_project_id
          AND pm.user_id = p_user_id
          AND pm.status = 'active'
    );
END;
$$;


-- ------------------------------------------------------------------------------
-- 2.4 Check project editing permission
-- Owner, Super Admin, Co-Investigator, Data Manager,
-- or explicit can_edit permission.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_edit_project(
    p_project_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_project_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF public.is_super_admin(p_user_id) THEN
        RETURN TRUE;
    END IF;

    IF public.is_project_owner(p_project_id, p_user_id) THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.project_members AS pm
        WHERE pm.project_id = p_project_id
          AND pm.user_id = p_user_id
          AND pm.status = 'active'
          AND (
              pm.role IN (
                  'co_investigator',
                  'data_manager'
              )
              OR COALESCE(
                  (pm.permissions ->> 'can_edit')::BOOLEAN,
                  FALSE
              ) = TRUE
          )
    );
END;
$$;


-- ------------------------------------------------------------------------------
-- 2.5 Check statistical analysis / data quality permission
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_analyze_project(
    p_project_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_project_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF public.is_super_admin(p_user_id) THEN
        RETURN TRUE;
    END IF;

    IF public.is_project_owner(p_project_id, p_user_id) THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.project_members AS pm
        WHERE pm.project_id = p_project_id
          AND pm.user_id = p_user_id
          AND pm.status = 'active'
          AND (
              pm.role IN (
                  'co_investigator',
                  'analyst',
                  'data_manager'
              )
              OR COALESCE(
                  (pm.permissions ->> 'can_analyze')::BOOLEAN,
                  FALSE
              ) = TRUE
          )
    );
END;
$$;


-- ------------------------------------------------------------------------------
-- 2.6 Check enumerator-management permission
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_manage_enumerators(
    p_project_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_project_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF public.is_super_admin(p_user_id) THEN
        RETURN TRUE;
    END IF;

    IF public.is_project_owner(p_project_id, p_user_id) THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.project_members AS pm
        WHERE pm.project_id = p_project_id
          AND pm.user_id = p_user_id
          AND pm.status = 'active'
          AND (
              pm.role IN (
                  'co_investigator',
                  'field_supervisor',
                  'data_manager'
              )
              OR COALESCE(
                  (pm.permissions ->> 'can_manage_enumerators')::BOOLEAN,
                  FALSE
              ) = TRUE
          )
    );
END;
$$;


-- ------------------------------------------------------------------------------
-- 2.7 Check active questionnaire assignment for enumerator
-- Only active assignments within their valid date window are accepted.
-- Enumerators can collect only from published questionnaires.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_assigned_enumerator(
    p_questionnaire_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_questionnaire_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.questionnaire_assignments AS qa
        JOIN public.questionnaires AS q
          ON q.id = qa.questionnaire_id
        JOIN public.profiles AS p
          ON p.id = qa.enumerator_id
        WHERE qa.questionnaire_id = p_questionnaire_id
          AND qa.enumerator_id = p_user_id
          AND qa.status = 'active'
          AND p.role = 'enumerator'
          AND p.status = 'active'
          AND q.status = 'published'
          AND (
              qa.start_date IS NULL
              OR qa.start_date <= CURRENT_DATE
          )
          AND (
              qa.end_date IS NULL
              OR qa.end_date >= CURRENT_DATE
          )
    );
END;
$$;


-- ==============================================================================
-- 3. PROFILES RLS POLICIES
-- ==============================================================================

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;


-- ------------------------------------------------------------------------------
-- Profile visibility
--
-- Users can see:
-- 1. Their own profile.
-- 2. Profiles in projects they have legitimate access to.
-- 3. Enumerators assigned to questionnaires in projects they manage.
-- 4. Super Admins can see all profiles.
--
-- This prevents enumerators from browsing the entire platform user directory.
-- ------------------------------------------------------------------------------

CREATE POLICY "profiles_select_policy"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    id = auth.uid()

    OR public.is_super_admin(auth.uid())

    OR EXISTS (
        SELECT 1
        FROM public.project_members AS pm_viewer
        JOIN public.project_members AS pm_target
          ON pm_target.project_id = pm_viewer.project_id
        WHERE pm_viewer.user_id = auth.uid()
          AND pm_viewer.status = 'active'
          AND pm_target.user_id = profiles.id
          AND pm_target.status = 'active'
    )

    OR EXISTS (
        SELECT 1
        FROM public.questionnaire_assignments AS qa
        JOIN public.questionnaires AS q
          ON q.id = qa.questionnaire_id
        WHERE qa.enumerator_id = profiles.id
          AND public.can_manage_enumerators(
              q.project_id,
              auth.uid()
          )
    )
);


-- Profiles are provisioned by the Supabase Auth trigger.
-- Direct profile creation is therefore not permitted to ordinary clients.
CREATE POLICY "profiles_insert_policy"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_super_admin(auth.uid())
);


-- Users may update their own basic profile fields.
-- Super Admins may update any profile.
--
-- The profile protection trigger in migration 001 remains the final
-- database-level control preventing unauthorized role/status escalation.
CREATE POLICY "profiles_update_policy"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    id = auth.uid()
    OR public.is_super_admin(auth.uid())
)
WITH CHECK (
    id = auth.uid()
    OR public.is_super_admin(auth.uid())
);


CREATE POLICY "profiles_delete_policy"
ON public.profiles
FOR DELETE
TO authenticated
USING (
    public.is_super_admin(auth.uid())
);


-- ==============================================================================
-- 4. PROJECTS RLS POLICIES
-- ==============================================================================

DROP POLICY IF EXISTS "projects_select_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_update_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_policy" ON public.projects;


-- Project visibility is restricted to legitimate project members/owners.
-- Enumerators do not receive project-level access through this policy.
CREATE POLICY "projects_select_policy"
ON public.projects
FOR SELECT
TO authenticated
USING (
    public.has_project_access(id, auth.uid())
);


-- Only researchers, data managers, and super administrators may create projects.
CREATE POLICY "projects_insert_policy"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = auth.uid()
          AND p.status = 'active'
          AND p.role IN (
              'researcher',
              'data_manager',
              'super_admin'
          )
    )
);


CREATE POLICY "projects_update_policy"
ON public.projects
FOR UPDATE
TO authenticated
USING (
    public.can_edit_project(id, auth.uid())
)
WITH CHECK (
    public.can_edit_project(id, auth.uid())
);


CREATE POLICY "projects_delete_policy"
ON public.projects
FOR DELETE
TO authenticated
USING (
    public.is_project_owner(id, auth.uid())
    OR public.is_super_admin(auth.uid())
);


-- ==============================================================================
-- 5. PROJECT MEMBERS RLS POLICIES
-- ==============================================================================

DROP POLICY IF EXISTS "project_members_select_policy" ON public.project_members;
DROP POLICY IF EXISTS "project_members_insert_policy" ON public.project_members;
DROP POLICY IF EXISTS "project_members_update_policy" ON public.project_members;
DROP POLICY IF EXISTS "project_members_delete_policy" ON public.project_members;


CREATE POLICY "project_members_select_policy"
ON public.project_members
FOR SELECT
TO authenticated
USING (
    public.has_project_access(project_id, auth.uid())
);


-- Only project owners or super administrators can add collaborators.
CREATE POLICY "project_members_insert_policy"
ON public.project_members
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_project_owner(project_id, auth.uid())
    OR public.is_super_admin(auth.uid())
);


-- Only project owners or super administrators can modify
-- collaborator roles and permissions.
CREATE POLICY "project_members_update_policy"
ON public.project_members
FOR UPDATE
TO authenticated
USING (
    public.is_project_owner(project_id, auth.uid())
    OR public.is_super_admin(auth.uid())
)
WITH CHECK (
    public.is_project_owner(project_id, auth.uid())
    OR public.is_super_admin(auth.uid())
);


CREATE POLICY "project_members_delete_policy"
ON public.project_members
FOR DELETE
TO authenticated
USING (
    public.is_project_owner(project_id, auth.uid())
    OR public.is_super_admin(auth.uid())
);


-- ==============================================================================
-- 6. QUESTIONNAIRES RLS POLICIES
-- ==============================================================================

DROP POLICY IF EXISTS "questionnaires_select_policy" ON public.questionnaires;
DROP POLICY IF EXISTS "questionnaires_insert_policy" ON public.questionnaires;
DROP POLICY IF EXISTS "questionnaires_update_policy" ON public.questionnaires;
DROP POLICY IF EXISTS "questionnaires_delete_policy" ON public.questionnaires;


-- Researchers/project members see questionnaires in projects they can access.
-- Enumerators see only questionnaires to which they have active assignments.
CREATE POLICY "questionnaires_select_policy"
ON public.questionnaires
FOR SELECT
TO authenticated
USING (
    public.has_project_access(project_id, auth.uid())
    OR public.is_assigned_enumerator(id, auth.uid())
);


CREATE POLICY "questionnaires_insert_policy"
ON public.questionnaires
FOR INSERT
TO authenticated
WITH CHECK (
    public.can_edit_project(project_id, auth.uid())
);


CREATE POLICY "questionnaires_update_policy"
ON public.questionnaires
FOR UPDATE
TO authenticated
USING (
    public.can_edit_project(project_id, auth.uid())
)
WITH CHECK (
    public.can_edit_project(project_id, auth.uid())
);


CREATE POLICY "questionnaires_delete_policy"
ON public.questionnaires
FOR DELETE
TO authenticated
USING (
    public.is_project_owner(project_id, auth.uid())
    OR public.is_super_admin(auth.uid())
);


-- ==============================================================================
-- 7. QUESTIONNAIRE VERSIONS RLS POLICIES
-- ==============================================================================

DROP POLICY IF EXISTS "qversions_select_policy" ON public.questionnaire_versions;
DROP POLICY IF EXISTS "qversions_insert_policy" ON public.questionnaire_versions;
DROP POLICY IF EXISTS "qversions_update_policy" ON public.questionnaire_versions;
DROP POLICY IF EXISTS "qversions_delete_policy" ON public.questionnaire_versions;


-- Project users can see versions belonging to projects they can access.
-- Enumerators can see only published versions of questionnaires assigned to them.
CREATE POLICY "qversions_select_policy"
ON public.questionnaire_versions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.questionnaires AS q
        WHERE q.id = questionnaire_versions.questionnaire_id
          AND public.has_project_access(
              q.project_id,
              auth.uid()
          )
    )

    OR (
        status = 'published'
        AND public.is_assigned_enumerator(
            questionnaire_id,
            auth.uid()
        )
    )
);


-- Only users with project edit permission may create versions.
CREATE POLICY "qversions_insert_policy"
ON public.questionnaire_versions
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.questionnaires AS q
        WHERE q.id = questionnaire_versions.questionnaire_id
          AND public.can_edit_project(
              q.project_id,
              auth.uid()
          )
    )
);


-- Version updates are restricted to authorized project editors.
-- Migration 001's immutability trigger provides an additional
-- database-level protection for published/deprecated/archived versions.
CREATE POLICY "qversions_update_policy"
ON public.questionnaire_versions
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.questionnaires AS q
        WHERE q.id = questionnaire_versions.questionnaire_id
          AND public.can_edit_project(
              q.project_id,
              auth.uid()
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.questionnaires AS q
        WHERE q.id = questionnaire_versions.questionnaire_id
          AND public.can_edit_project(
              q.project_id,
              auth.uid()
          )
    )
);


-- Only draft versions may be deleted.
-- Published/deprecated/archived versions remain protected by migration 001.
CREATE POLICY "qversions_delete_policy"
ON public.questionnaire_versions
FOR DELETE
TO authenticated
USING (
    status = 'draft'
    AND EXISTS (
        SELECT 1
        FROM public.questionnaires AS q
        WHERE q.id = questionnaire_versions.questionnaire_id
          AND (
              public.is_project_owner(
                  q.project_id,
                  auth.uid()
              )
              OR public.is_super_admin(auth.uid())
          )
    )
);


-- ==============================================================================
-- 8. QUESTIONS RLS POLICIES
-- ==============================================================================

DROP POLICY IF EXISTS "questions_select_policy" ON public.questions;
DROP POLICY IF EXISTS "questions_insert_policy" ON public.questions;
DROP POLICY IF EXISTS "questions_update_policy" ON public.questions;
DROP POLICY IF EXISTS "questions_delete_policy" ON public.questions;


-- Users can read questions only when they can read the corresponding
-- questionnaire version.
CREATE POLICY "questions_select_policy"
ON public.questions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.questionnaire_versions AS qv
        JOIN public.questionnaires AS q
          ON q.id = qv.questionnaire_id
        WHERE qv.id = questions.questionnaire_version_id
          AND (
              public.has_project_access(
                  q.project_id,
                  auth.uid()
              )
              OR (
                  qv.status = 'published'
                  AND public.is_assigned_enumerator(
                      q.id,
                      auth.uid()
                  )
              )
          )
    )
);


-- Questions can only be created in draft versions by authorized editors.
CREATE POLICY "questions_insert_policy"
ON public.questions
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.questionnaire_versions AS qv
        JOIN public.questionnaires AS q
          ON q.id = qv.questionnaire_id
        WHERE qv.id = questions.questionnaire_version_id
          AND qv.status = 'draft'
          AND public.can_edit_project(
              q.project_id,
              auth.uid()
          )
    )
);


-- Questions can only be updated while the parent version is draft.
CREATE POLICY "questions_update_policy"
ON public.questions
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.questionnaire_versions AS qv
        JOIN public.questionnaires AS q
          ON q.id = qv.questionnaire_id
        WHERE qv.id = questions.questionnaire_version_id
          AND qv.status = 'draft'
          AND public.can_edit_project(
              q.project_id,
              auth.uid()
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.questionnaire_versions AS qv
        JOIN public.questionnaires AS q
          ON q.id = qv.questionnaire_id
        WHERE qv.id = questions.questionnaire_version_id
          AND qv.status = 'draft'
          AND public.can_edit_project(
              q.project_id,
              auth.uid()
          )
    )
);


-- Questions can only be deleted from draft versions by authorized editors.
CREATE POLICY "questions_delete_policy"
ON public.questions
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.questionnaire_versions AS qv
        JOIN public.questionnaires AS q
          ON q.id = qv.questionnaire_id
        WHERE qv.id = questions.questionnaire_version_id
          AND qv.status = 'draft'
          AND public.can_edit_project(
              q.project_id,
              auth.uid()
          )
    )
);


-- ==============================================================================
-- 9. QUESTION OPTIONS RLS POLICIES
-- ==============================================================================

DROP POLICY IF EXISTS "question_options_select_policy" ON public.question_options;
DROP POLICY IF EXISTS "question_options_insert_policy" ON public.question_options;
DROP POLICY IF EXISTS "question_options_update_policy" ON public.question_options;
DROP POLICY IF EXISTS "question_options_delete_policy" ON public.question_options;


-- Options follow the visibility of their parent question/version.
CREATE POLICY "question_options_select_policy"
ON public.question_options
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.questions AS q
        JOIN public.questionnaire_versions AS qv
          ON qv.id = q.questionnaire_version_id
        JOIN public.questionnaires AS qnr
          ON qnr.id = qv.questionnaire_id
        WHERE q.id = question_options.question_id
          AND (
              public.has_project_access(
                  qnr.project_id,
                  auth.uid()
              )
              OR (
                  qv.status = 'published'
                  AND public.is_assigned_enumerator(
                      qnr.id,
                      auth.uid()
                  )
              )
          )
    )
);


CREATE POLICY "question_options_insert_policy"
ON public.question_options
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.questions AS q
        JOIN public.questionnaire_versions AS qv
          ON qv.id = q.questionnaire_version_id
        JOIN public.questionnaires AS qnr
          ON qnr.id = qv.questionnaire_id
        WHERE q.id = question_options.question_id
          AND qv.status = 'draft'
          AND public.can_edit_project(
              qnr.project_id,
              auth.uid()
          )
    )
);


CREATE POLICY "question_options_update_policy"
ON public.question_options
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.questions AS q
        JOIN public.questionnaire_versions AS qv
          ON qv.id = q.questionnaire_version_id
        JOIN public.questionnaires AS qnr
          ON qnr.id = qv.questionnaire_id
        WHERE q.id = question_options.question_id
          AND qv.status = 'draft'
          AND public.can_edit_project(
              qnr.project_id,
              auth.uid()
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.questions AS q
        JOIN public.questionnaire_versions AS qv
          ON qv.id = q.questionnaire_version_id
        JOIN public.questionnaires AS qnr
          ON qnr.id = qv.questionnaire_id
        WHERE q.id = question_options.question_id
          AND qv.status = 'draft'
          AND public.can_edit_project(
              qnr.project_id,
              auth.uid()
          )
    )
);


CREATE POLICY "question_options_delete_policy"
ON public.question_options
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.questions AS q
        JOIN public.questionnaire_versions AS qv
          ON qv.id = q.questionnaire_version_id
        JOIN public.questionnaires AS qnr
          ON qnr.id = qv.questionnaire_id
        WHERE q.id = question_options.question_id
          AND qv.status = 'draft'
          AND public.can_edit_project(
              qnr.project_id,
              auth.uid()
          )
    )
);


-- ==============================================================================
-- 10. VARIABLES / DATA DICTIONARY / CODEBOOK
-- ==============================================================================

DROP POLICY IF EXISTS "variables_select_policy" ON public.variables;
DROP POLICY IF EXISTS "variables_insert_policy" ON public.variables;
DROP POLICY IF EXISTS "variables_update_policy" ON public.variables;
DROP POLICY IF EXISTS "variables_delete_policy" ON public.variables;


-- Enumerators do NOT have project access through this table.
-- Therefore they cannot discover the research codebook.
CREATE POLICY "variables_select_policy"
ON public.variables
FOR SELECT
TO authenticated
USING (
    public.has_project_access(
        project_id,
        auth.uid()
    )
);


CREATE POLICY "variables_insert_policy"
ON public.variables
FOR INSERT
TO authenticated
WITH CHECK (
    public.can_edit_project(
        project_id,
        auth.uid()
    )
);


CREATE POLICY "variables_update_policy"
ON public.variables
FOR UPDATE
TO authenticated
USING (
    public.can_edit_project(
        project_id,
        auth.uid()
    )
)
WITH CHECK (
    public.can_edit_project(
        project_id,
        auth.uid()
    )
);


CREATE POLICY "variables_delete_policy"
ON public.variables
FOR DELETE
TO authenticated
USING (
    public.can_edit_project(
        project_id,
        auth.uid()
    )
);


-- ==============================================================================
-- 11. QUESTIONNAIRE ASSIGNMENTS
-- ==============================================================================

DROP POLICY IF EXISTS "assignments_select_policy" ON public.questionnaire_assignments;
DROP POLICY IF EXISTS "assignments_insert_policy" ON public.questionnaire_assignments;
DROP POLICY IF EXISTS "assignments_update_policy" ON public.questionnaire_assignments;
DROP POLICY IF EXISTS "assignments_delete_policy" ON public.questionnaire_assignments;


-- Enumerators can see ONLY their own assignments.
-- Authorized project managers can see assignments belonging to their projects.
CREATE POLICY "assignments_select_policy"
ON public.questionnaire_assignments
FOR SELECT
TO authenticated
USING (
    enumerator_id = auth.uid()

    OR EXISTS (
        SELECT 1
        FROM public.questionnaires AS q
        WHERE q.id = questionnaire_assignments.questionnaire_id
          AND public.has_project_access(
              q.project_id,
              auth.uid()
          )
    )
);


-- Only authorized project managers can create assignments.
-- An enumerator cannot assign themselves.
CREATE POLICY "assignments_insert_policy"
ON public.questionnaire_assignments
FOR INSERT
TO authenticated
WITH CHECK (
    enumerator_id <> auth.uid()

    AND EXISTS (
        SELECT 1
        FROM public.profiles AS ep
        WHERE ep.id = enumerator_id
          AND ep.role = 'enumerator'
          AND ep.status = 'active'
    )

    AND EXISTS (
        SELECT 1
        FROM public.questionnaires AS q
        WHERE q.id = questionnaire_assignments.questionnaire_id
          AND public.can_manage_enumerators(
              q.project_id,
              auth.uid()
          )
    )

    AND (
        questionnaire_version_id IS NULL

        OR EXISTS (
            SELECT 1
            FROM public.questionnaire_versions AS qv
            WHERE qv.id = questionnaire_assignments.questionnaire_version_id
              AND qv.questionnaire_id =
                  questionnaire_assignments.questionnaire_id
        )
    )
);


-- Only authorized project managers can modify assignments.
CREATE POLICY "assignments_update_policy"
ON public.questionnaire_assignments
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.questionnaires AS q
        WHERE q.id = questionnaire_assignments.questionnaire_id
          AND public.can_manage_enumerators(
              q.project_id,
              auth.uid()
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.questionnaires AS q
        WHERE q.id = questionnaire_assignments.questionnaire_id
          AND public.can_manage_enumerators(
              q.project_id,
              auth.uid()
          )
    )

    AND (
        questionnaire_version_id IS NULL

        OR EXISTS (
            SELECT 1
            FROM public.questionnaire_versions AS qv
            WHERE qv.id = questionnaire_assignments.questionnaire_version_id
              AND qv.questionnaire_id =
                  questionnaire_assignments.questionnaire_id
        )
    )

    AND EXISTS (
        SELECT 1
        FROM public.profiles AS ep
        WHERE ep.id = questionnaire_assignments.enumerator_id
          AND ep.role = 'enumerator'
          AND ep.status = 'active'
    )
);


CREATE POLICY "assignments_delete_policy"
ON public.questionnaire_assignments
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.questionnaires AS q
        WHERE q.id = questionnaire_assignments.questionnaire_id
          AND public.can_manage_enumerators(
              q.project_id,
              auth.uid()
          )
    )
);


-- ==============================================================================
-- 12. RESPONSES
-- ==============================================================================

DROP POLICY IF EXISTS "responses_select_policy" ON public.responses;
DROP POLICY IF EXISTS "responses_insert_policy" ON public.responses;
DROP POLICY IF EXISTS "responses_update_policy" ON public.responses;
DROP POLICY IF EXISTS "responses_delete_policy" ON public.responses;


-- ------------------------------------------------------------------------------
-- Response visibility
--
-- Researchers/project members:
--     See responses belonging to projects they can access.
--
-- Enumerators:
--     See ONLY responses they personally collected.
-- ------------------------------------------------------------------------------

CREATE POLICY "responses_select_policy"
ON public.responses
FOR SELECT
TO authenticated
USING (
    public.has_project_access(
        project_id,
        auth.uid()
    )

    OR (
        enumerator_id = auth.uid()
        AND public.is_assigned_enumerator(
            questionnaire_id,
            auth.uid()
        )
    )
);


-- ------------------------------------------------------------------------------
-- Response insertion
--
-- Project editors can create responses for legitimate project/questionnaire/
-- version combinations.
--
-- Enumerators can create responses only for their active published assignment.
-- ------------------------------------------------------------------------------

CREATE POLICY "responses_insert_policy"
ON public.responses
FOR INSERT
TO authenticated
WITH CHECK (
    (
        public.can_edit_project(
            project_id,
            auth.uid()
        )

        AND EXISTS (
            SELECT 1
            FROM public.questionnaires AS q
            WHERE q.id = responses.questionnaire_id
              AND q.project_id = responses.project_id
        )

        AND EXISTS (
            SELECT 1
            FROM public.questionnaire_versions AS qv
            WHERE qv.id = responses.questionnaire_version_id
              AND qv.questionnaire_id =
                  responses.questionnaire_id
        )
    )

    OR (
        enumerator_id = auth.uid()

        AND public.is_assigned_enumerator(
            questionnaire_id,
            auth.uid()
        )

        AND EXISTS (
            SELECT 1
            FROM public.questionnaires AS q
            WHERE q.id = responses.questionnaire_id
              AND q.project_id = responses.project_id
              AND q.status = 'published'
        )

        AND EXISTS (
            SELECT 1
            FROM public.questionnaire_versions AS qv
            WHERE qv.id = responses.questionnaire_version_id
              AND qv.questionnaire_id =
                  responses.questionnaire_id
              AND qv.status = 'published'
        )
    )
);


-- ------------------------------------------------------------------------------
-- Response updates
--
-- Enumerators may update their own collection records while they are still
-- in draft/pending_sync state.
--
-- Project editors may update legitimate project responses.
-- ------------------------------------------------------------------------------

CREATE POLICY "responses_update_policy"
ON public.responses
FOR UPDATE
TO authenticated
USING (
    public.can_edit_project(
        project_id,
        auth.uid()
    )

    OR (
        enumerator_id = auth.uid()
        AND collection_status IN (
            'draft',
            'pending_sync'
        )
        AND public.is_assigned_enumerator(
            questionnaire_id,
            auth.uid()
        )
    )
)
WITH CHECK (
    public.can_edit_project(
        project_id,
        auth.uid()
    )

    OR (
        enumerator_id = auth.uid()
        AND collection_status IN (
            'draft',
            'pending_sync',
            'submitted'
        )
        AND public.is_assigned_enumerator(
            questionnaire_id,
            auth.uid()
        )

        AND EXISTS (
            SELECT 1
            FROM public.questionnaires AS q
            WHERE q.id = responses.questionnaire_id
              AND q.project_id = responses.project_id
        )

        AND EXISTS (
            SELECT 1
            FROM public.questionnaire_versions AS qv
            WHERE qv.id = responses.questionnaire_version_id
              AND qv.questionnaire_id =
                  responses.questionnaire_id
        )
    )
);


-- Only project owners and super administrators can delete responses.
CREATE POLICY "responses_delete_policy"
ON public.responses
FOR DELETE
TO authenticated
USING (
    public.is_project_owner(
        project_id,
        auth.uid()
    )
    OR public.is_super_admin(auth.uid())
);


-- ==============================================================================
-- 13. RESPONSE ANSWERS
-- ==============================================================================

DROP POLICY IF EXISTS "response_answers_select_policy" ON public.response_answers;
DROP POLICY IF EXISTS "response_answers_insert_policy" ON public.response_answers;
DROP POLICY IF EXISTS "response_answers_update_policy" ON public.response_answers;
DROP POLICY IF EXISTS "response_answers_delete_policy" ON public.response_answers;


-- Answers inherit visibility from their parent response.
CREATE POLICY "response_answers_select_policy"
ON public.response_answers
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.responses AS r
        WHERE r.id = response_answers.response_id
          AND (
              public.has_project_access(
                  r.project_id,
                  auth.uid()
              )

              OR (
                  r.enumerator_id = auth.uid()
                  AND public.is_assigned_enumerator(
                      r.questionnaire_id,
                      auth.uid()
                  )
              )
          )
    )
);


-- ------------------------------------------------------------------------------
-- Answer insertion
--
-- The parent response must be accessible to the current user.
-- If question_id is supplied, that question must belong to the exact
-- questionnaire version used by the parent response.
-- ------------------------------------------------------------------------------

CREATE POLICY "response_answers_insert_policy"
ON public.response_answers
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.responses AS r
        WHERE r.id = response_answers.response_id
          AND (
              public.can_edit_project(
                  r.project_id,
                  auth.uid()
              )

              OR (
                  r.enumerator_id = auth.uid()
                  AND r.collection_status IN (
                      'draft',
                      'pending_sync'
                  )
                  AND public.is_assigned_enumerator(
                      r.questionnaire_id,
                      auth.uid()
                  )
              )
          )

          AND (
              response_answers.question_id IS NULL

              OR EXISTS (
                  SELECT 1
                  FROM public.questions AS q
                  WHERE q.id = response_answers.question_id
                    AND q.questionnaire_version_id =
                        r.questionnaire_version_id
              )
          )
    )
);


CREATE POLICY "response_answers_update_policy"
ON public.response_answers
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.responses AS r
        WHERE r.id = response_answers.response_id
          AND (
              public.can_edit_project(
                  r.project_id,
                  auth.uid()
              )

              OR (
                  r.enumerator_id = auth.uid()
                  AND r.collection_status IN (
                      'draft',
                      'pending_sync'
                  )
                  AND public.is_assigned_enumerator(
                      r.questionnaire_id,
                      auth.uid()
                  )
              )
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.responses AS r
        WHERE r.id = response_answers.response_id
          AND (
              public.can_edit_project(
                  r.project_id,
                  auth.uid()
              )

              OR (
                  r.enumerator_id = auth.uid()
                  AND r.collection_status IN (
                      'draft',
                      'pending_sync'
                  )
                  AND public.is_assigned_enumerator(
                      r.questionnaire_id,
                      auth.uid()
                  )
              )
          )

          AND (
              response_answers.question_id IS NULL

              OR EXISTS (
                  SELECT 1
                  FROM public.questions AS q
                  WHERE q.id = response_answers.question_id
                    AND q.questionnaire_version_id =
                        r.questionnaire_version_id
              )
          )
    )
);


-- Enumerators can delete only answers belonging to their own draft responses.
-- Authorized project editors may delete answers from their project responses.
CREATE POLICY "response_answers_delete_policy"
ON public.response_answers
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.responses AS r
        WHERE r.id = response_answers.response_id
          AND (
              public.can_edit_project(
                  r.project_id,
                  auth.uid()
              )

              OR (
                  r.enumerator_id = auth.uid()
                  AND r.collection_status = 'draft'
                  AND public.is_assigned_enumerator(
                      r.questionnaire_id,
                      auth.uid()
                  )
              )
          )
    )
);


-- ==============================================================================
-- 14. DATA QUALITY ISSUES
-- ==============================================================================

DROP POLICY IF EXISTS "dq_issues_policy" ON public.data_quality_issues;
DROP POLICY IF EXISTS "dq_issues_select_policy" ON public.data_quality_issues;
DROP POLICY IF EXISTS "dq_issues_insert_policy" ON public.data_quality_issues;
DROP POLICY IF EXISTS "dq_issues_update_policy" ON public.data_quality_issues;
DROP POLICY IF EXISTS "dq_issues_delete_policy" ON public.data_quality_issues;


-- Enumerators have no access to the research data-quality workspace.
CREATE POLICY "dq_issues_select_policy"
ON public.data_quality_issues
FOR SELECT
TO authenticated
USING (
    public.has_project_access(
        project_id,
        auth.uid()
    )
);


CREATE POLICY "dq_issues_insert_policy"
ON public.data_quality_issues
FOR INSERT
TO authenticated
WITH CHECK (
    public.can_analyze_project(
        project_id,
        auth.uid()
    )
    OR public.can_edit_project(
        project_id,
        auth.uid()
    )
);


CREATE POLICY "dq_issues_update_policy"
ON public.data_quality_issues
FOR UPDATE
TO authenticated
USING (
    public.can_analyze_project(
        project_id,
        auth.uid()
    )
)
WITH CHECK (
    public.can_analyze_project(
        project_id,
        auth.uid()
    )
);


CREATE POLICY "dq_issues_delete_policy"
ON public.data_quality_issues
FOR DELETE
TO authenticated
USING (
    public.is_project_owner(
        project_id,
        auth.uid()
    )
    OR public.is_super_admin(auth.uid())
);


-- ==============================================================================
-- 15. STATISTICAL ANALYSES
-- ==============================================================================

DROP POLICY IF EXISTS "statistical_analyses_policy" ON public.statistical_analyses;
DROP POLICY IF EXISTS "stat_analyses_select_policy" ON public.statistical_analyses;
DROP POLICY IF EXISTS "stat_analyses_insert_policy" ON public.statistical_analyses;
DROP POLICY IF EXISTS "stat_analyses_update_policy" ON public.statistical_analyses;
DROP POLICY IF EXISTS "stat_analyses_delete_policy" ON public.statistical_analyses;


-- Only authorized project users can view statistical analyses.
-- Enumerators cannot access the statistical engine.
CREATE POLICY "stat_analyses_select_policy"
ON public.statistical_analyses
FOR SELECT
TO authenticated
USING (
    public.can_analyze_project(
        project_id,
        auth.uid()
    )
);


CREATE POLICY "stat_analyses_insert_policy"
ON public.statistical_analyses
FOR INSERT
TO authenticated
WITH CHECK (
    public.can_analyze_project(
        project_id,
        auth.uid()
    )
);


CREATE POLICY "stat_analyses_update_policy"
ON public.statistical_analyses
FOR UPDATE
TO authenticated
USING (
    public.can_analyze_project(
        project_id,
        auth.uid()
    )
)
WITH CHECK (
    public.can_analyze_project(
        project_id,
        auth.uid()
    )
);


CREATE POLICY "stat_analyses_delete_policy"
ON public.statistical_analyses
FOR DELETE
TO authenticated
USING (
    public.can_edit_project(
        project_id,
        auth.uid()
    )
);


-- ==============================================================================
-- 16. AUDIT LOGS
-- Append-only security and activity ledger
-- ==============================================================================

DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_policy" ON public.audit_logs;


-- Users may append audit records only for themselves.
-- NULL user_id is allowed for controlled system-generated events.
CREATE POLICY "audit_logs_insert_policy"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    OR user_id IS NULL
);


-- Users can view their own audit records.
-- Super administrators can review the complete audit ledger.
CREATE POLICY "audit_logs_select_policy"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
);


-- No UPDATE policy.
-- No DELETE policy.
--
-- RLS therefore denies ordinary UPDATE/DELETE operations.
-- Migration 001 additionally provides database-trigger enforcement
-- through trg_audit_logs_immutable.
-- ==============================================================================


-- ==============================================================================
-- 17. FUNCTION EXECUTION PRIVILEGES
-- Least-privilege function execution
-- ==============================================================================

-- Remove inherited/default execution privileges from application clients.
REVOKE EXECUTE
ON ALL FUNCTIONS IN SCHEMA public
FROM PUBLIC, anon, authenticated;


-- Explicitly expose ONLY the security-definer helper functions required
-- by RLS expressions.
GRANT EXECUTE
ON FUNCTION public.is_super_admin(UUID)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.is_project_owner(UUID, UUID)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.has_project_access(UUID, UUID)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.can_edit_project(UUID, UUID)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.can_analyze_project(UUID, UUID)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.can_manage_enumerators(UUID, UUID)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.is_assigned_enumerator(UUID, UUID)
TO authenticated;


-- ==============================================================================
-- 18. TABLE AND SEQUENCE PRIVILEGES
-- ==============================================================================

-- Supabase clients require schema usage and table privileges.
-- Actual row access remains controlled by RLS policies above.
GRANT USAGE
ON SCHEMA public
TO anon, authenticated;


GRANT ALL
ON ALL TABLES IN SCHEMA public
TO authenticated;


GRANT ALL
ON ALL SEQUENCES IN SCHEMA public
TO authenticated;


-- ==============================================================================
-- 19. DEFAULT PRIVILEGE HARDENING
-- ==============================================================================
--
-- Prevent future functions created in public from automatically receiving
-- EXECUTE privileges by application roles.
--
-- These defaults complement the explicit grants above.
-- ==============================================================================

ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;


-- ==============================================================================
-- END OF MIGRATION 002
-- ==============================================================================