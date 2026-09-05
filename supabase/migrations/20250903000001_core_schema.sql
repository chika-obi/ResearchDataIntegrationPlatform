-- ==============================================================================
-- RESEARCH DATA INTEGRATION PLATFORM (RDIP)
-- Migration 001: Core Database Schema
-- Description: Production-grade PostgreSQL schema supporting multi-tenant,
--              multi-project, versioned questionnaires, enumerator assignments,
--              immutable audit logging, and Supabase Auth integration.
--              Includes relational composite integrity constraints and triggers
--              guaranteeing response and assignment referential consistency.
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- NOTE:
-- Supabase Auth owns auth.users in a managed Supabase project.
-- This migration intentionally does not create or alter auth.users.
-- public.profiles references the existing Supabase auth.users table below.

-- 2. Custom Enumerated Types
DO $$ BEGIN
    CREATE TYPE user_platform_role AS ENUM (
        'super_admin',
        'researcher',
        'research_assistant',
        'enumerator',
        'data_manager',
        'analyst',
        'respondent'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_account_status AS ENUM (
        'active',
        'suspended',
        'pending_verification',
        'inactive'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE project_lifecycle_status AS ENUM (
        'draft',
        'active',
        'collection',
        'analysis',
        'completed',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE project_member_role AS ENUM (
        'owner',
        'co_investigator',
        'research_assistant',
        'data_manager',
        'analyst',
        'field_supervisor',
        'viewer'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE questionnaire_lifecycle_status AS ENUM (
        'draft',
        'testing',
        'published',
        'closed',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE version_lifecycle_status AS ENUM (
        'draft',
        'published',
        'deprecated',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE question_field_type AS ENUM (
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
        'gps-coordinate'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE statistical_data_type AS ENUM (
        'Categorical',
        'Numerical',
        'Ordinal',
        'Continuous'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE measurement_scale_level AS ENUM (
        'Nominal',
        'Ordinal',
        'Interval',
        'Ratio'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE assignment_status AS ENUM (
        'active',
        'paused',
        'revoked',
        'completed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE response_sync_status AS ENUM (
        'draft',
        'submitted',
        'pending_sync',
        'synced',
        'conflict',
        'rejected',
        'locked'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE quality_issue_type AS ENUM (
        'incomplete_response',
        'outlier',
        'conflicting_answers',
        'duplicate_submission',
        'validation_error',
        'gps_anomaly'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE quality_issue_severity AS ENUM (
        'low',
        'medium',
        'high',
        'critical'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Utility Trigger for Automatically Updating updated_at Timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;


-- ==============================================================================
-- TABLE 1: PROFILES (User Profiles associated with Supabase auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    avatar_url TEXT,
    institution VARCHAR(255) DEFAULT 'Research Institute',
    department VARCHAR(255),
    role user_platform_role NOT NULL DEFAULT 'researcher',
    status user_account_status NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Self-contained role protection trigger (prevents non-super_admins from escalating roles/status)
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
DECLARE
    v_caller_is_admin BOOLEAN := FALSE;
BEGIN
    IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status) THEN
        IF auth.uid() IS NOT NULL THEN
            SELECT (p.role = 'super_admin' AND p.status = 'active') INTO v_caller_is_admin
            FROM public.profiles p
            WHERE p.id = auth.uid();

            IF NOT COALESCE(v_caller_is_admin, FALSE) THEN
                RAISE EXCEPTION 'Security violation: Only active super administrators can modify user platform roles or account status.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();


-- ==============================================================================
-- TABLE 2: PROJECTS (Individual Research Studies)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    project_code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    research_topic VARCHAR(255),
    research_design VARCHAR(255),
    institution VARCHAR(255) DEFAULT 'Research Institute',
    status project_lifecycle_status NOT NULL DEFAULT 'draft',
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    quality_score INTEGER NOT NULL DEFAULT 100 CHECK (quality_score >= 0 AND quality_score <= 100),
    research_objectives JSONB DEFAULT '[]'::jsonb,
    start_date DATE,
    end_date DATE,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);

CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==============================================================================
-- TABLE 3: PROJECT_MEMBERS (Collaborative Team Access Control)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role project_member_role NOT NULL DEFAULT 'research_assistant',
    permissions JSONB NOT NULL DEFAULT '{"can_edit": false, "can_analyze": true, "can_export": false, "can_manage_enumerators": false}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_member UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);

CREATE TRIGGER trg_project_members_updated_at
BEFORE UPDATE ON public.project_members
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==============================================================================
-- TABLE 4: QUESTIONNAIRES (Belongs to exactly one project)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.questionnaires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status questionnaire_lifecycle_status NOT NULL DEFAULT 'draft',
    current_version_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_questionnaires_id_project UNIQUE (id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_questionnaires_project ON public.questionnaires(project_id);
CREATE INDEX IF NOT EXISTS idx_questionnaires_status ON public.questionnaires(status);

CREATE TRIGGER trg_questionnaires_updated_at
BEFORE UPDATE ON public.questionnaires
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==============================================================================
-- TABLE 5: QUESTIONNAIRE_VERSIONS (Strict Versioning & Schema Immutability)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.questionnaire_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    questionnaire_id UUID NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
    version_number VARCHAR(50) NOT NULL,
    status version_lifecycle_status NOT NULL DEFAULT 'draft',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    schema_definition JSONB DEFAULT '{}'::jsonb,
    published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_questionnaire_version UNIQUE (questionnaire_id, version_number),
    CONSTRAINT uq_qversions_id_questionnaire UNIQUE (id, questionnaire_id)
);

CREATE INDEX IF NOT EXISTS idx_qversions_questionnaire ON public.questionnaire_versions(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_qversions_status ON public.questionnaire_versions(status);

CREATE TRIGGER trg_questionnaire_versions_updated_at
BEFORE UPDATE ON public.questionnaire_versions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Circular foreign key constraint back to questionnaires.current_version_id
DO $$ BEGIN
    ALTER TABLE public.questionnaires
    ADD CONSTRAINT fk_questionnaires_current_version
    FOREIGN KEY (current_version_id)
    REFERENCES public.questionnaire_versions(id)
    ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Questionnaire Version Immutability Trigger:
-- Once published, archived, or deprecated, the schema definition, questionnaire association,
-- title, description, and version number CANNOT be mutated. Only forward status transitions are permitted.
CREATE OR REPLACE FUNCTION public.check_questionnaire_version_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('published', 'archived', 'deprecated') THEN
        IF NEW.status NOT IN ('published', 'archived', 'deprecated') THEN
            RAISE EXCEPTION 'Immutability violation: Cannot revert a published or archived version (%) back to %.', OLD.version_number, NEW.status;
        END IF;

        IF NEW.version_number IS DISTINCT FROM OLD.version_number
           OR NEW.questionnaire_id IS DISTINCT FROM OLD.questionnaire_id
           OR NEW.schema_definition IS DISTINCT FROM OLD.schema_definition
           OR NEW.title IS DISTINCT FROM OLD.title
           OR NEW.description IS DISTINCT FROM OLD.description THEN
            RAISE EXCEPTION 'Immutability violation: Cannot modify schema definition, title, description, or version number of a published version (%). Create a new revision version instead.', OLD.version_number;
        END IF;
    END IF;

    IF OLD.status <> 'published' AND NEW.status = 'published' THEN
        IF NEW.published_at IS NULL THEN
            NEW.published_at := NOW();
        END IF;
        IF NEW.published_by IS NULL THEN
            NEW.published_by := auth.uid();
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_qversions_immutability ON public.questionnaire_versions;
CREATE TRIGGER trg_qversions_immutability
BEFORE UPDATE ON public.questionnaire_versions
FOR EACH ROW EXECUTE FUNCTION public.check_questionnaire_version_immutability();

-- Questionnaire Version Deletion Protection Trigger:
-- Prohibits deletion of published/archived versions and any version with existing survey responses.
CREATE OR REPLACE FUNCTION public.check_questionnaire_version_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('published', 'archived', 'deprecated') THEN
        RAISE EXCEPTION 'Immutability violation: Cannot delete a published, archived, or deprecated questionnaire version (%). Production instruments must remain preserved.', OLD.version_number;
    END IF;

    IF EXISTS (SELECT 1 FROM public.responses WHERE questionnaire_version_id = OLD.id) THEN
        RAISE EXCEPTION 'Integrity violation: Cannot delete questionnaire version % because historical survey responses reference it.', OLD.version_number;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_qversions_delete_protect ON public.questionnaire_versions;
CREATE TRIGGER trg_qversions_delete_protect
BEFORE DELETE ON public.questionnaire_versions
FOR EACH ROW EXECUTE FUNCTION public.check_questionnaire_version_deletion();


-- ==============================================================================
-- TABLE 6: QUESTIONS (Belongs to a specific Questionnaire Version)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    questionnaire_version_id UUID NOT NULL REFERENCES public.questionnaire_versions(id) ON DELETE CASCADE,
    question_number VARCHAR(50) NOT NULL,
    section VARCHAR(255),
    question_text TEXT NOT NULL,
    help_text TEXT,
    variable_name VARCHAR(100) NOT NULL,
    variable_label TEXT,
    question_type question_field_type NOT NULL,
    data_type statistical_data_type NOT NULL DEFAULT 'Categorical',
    measurement_level measurement_scale_level NOT NULL DEFAULT 'Nominal',
    required BOOLEAN NOT NULL DEFAULT true,
    has_other_option BOOLEAN DEFAULT false,
    likert_scale INTEGER,
    linked_research_objective TEXT,
    validation_rules JSONB DEFAULT '{}'::jsonb,
    conditional_logic JSONB DEFAULT '{}'::jsonb,
    gps_config JSONB DEFAULT '{}'::jsonb,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_questions_id_version UNIQUE (id, questionnaire_version_id)
);

CREATE INDEX IF NOT EXISTS idx_questions_version ON public.questions(questionnaire_version_id);
CREATE INDEX IF NOT EXISTS idx_questions_varname ON public.questions(variable_name);
CREATE INDEX IF NOT EXISTS idx_questions_order ON public.questions(questionnaire_version_id, display_order);

CREATE TRIGGER trg_questions_updated_at
BEFORE UPDATE ON public.questions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Questions Immutability Trigger: Prohibit insert/update/delete in published versions
CREATE OR REPLACE FUNCTION public.check_question_immutability()
RETURNS TRIGGER AS $$
DECLARE
    v_version_status version_lifecycle_status;
    v_version_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_version_id := OLD.questionnaire_version_id;
    ELSE
        v_version_id := NEW.questionnaire_version_id;
    END IF;

    SELECT status INTO v_version_status
    FROM public.questionnaire_versions
    WHERE id = v_version_id;

    IF v_version_status IN ('published', 'archived', 'deprecated') THEN
        RAISE EXCEPTION 'Immutability violation: Cannot % questions in a published, archived, or deprecated questionnaire version. Please create a new draft revision to modify questions.', TG_OP;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_questions_immutability ON public.questions;
CREATE TRIGGER trg_questions_immutability
BEFORE INSERT OR UPDATE OR DELETE ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.check_question_immutability();


-- ==============================================================================
-- TABLE 7: QUESTION_OPTIONS (Categorical Coding & Numeric Scale Codes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    option_label VARCHAR(500) NOT NULL,
    option_value VARCHAR(255) NOT NULL,
    numeric_code INTEGER,
    display_order INTEGER NOT NULL DEFAULT 1,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_options_qid ON public.question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_question_options_order ON public.question_options(question_id, display_order);

-- Question Options Immutability Trigger: Prohibit mutating options in published versions
CREATE OR REPLACE FUNCTION public.check_question_option_immutability()
RETURNS TRIGGER AS $$
DECLARE
    v_version_status version_lifecycle_status;
    v_question_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_question_id := OLD.question_id;
    ELSE
        v_question_id := NEW.question_id;
    END IF;

    SELECT qv.status INTO v_version_status
    FROM public.questions q
    JOIN public.questionnaire_versions qv ON qv.id = q.questionnaire_version_id
    WHERE q.id = v_question_id;

    IF v_version_status IN ('published', 'archived', 'deprecated') THEN
        RAISE EXCEPTION 'Immutability violation: Cannot % question options in a published questionnaire version. Please create a new draft version.', TG_OP;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_question_options_immutability ON public.question_options;
CREATE TRIGGER trg_question_options_immutability
BEFORE INSERT OR UPDATE OR DELETE ON public.question_options
FOR EACH ROW EXECUTE FUNCTION public.check_question_option_immutability();


-- ==============================================================================
-- TABLE 8: VARIABLES (Data Dictionary / Codebook Foundation)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    questionnaire_id UUID REFERENCES public.questionnaires(id) ON DELETE SET NULL,
    question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
    variable_name VARCHAR(100) NOT NULL,
    variable_label TEXT NOT NULL,
    data_type statistical_data_type NOT NULL DEFAULT 'Categorical',
    measurement_level measurement_scale_level NOT NULL DEFAULT 'Nominal',
    possible_values JSONB DEFAULT '[]'::jsonb,
    codes JSONB DEFAULT '[]'::jsonb,
    missing_value_rules JSONB DEFAULT '{"code": "999", "label": "Not Applicable"}'::jsonb,
    research_objective TEXT,
    hypothesis_relationship TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_variable_name UNIQUE (project_id, variable_name)
);

CREATE INDEX IF NOT EXISTS idx_variables_project ON public.variables(project_id);
CREATE INDEX IF NOT EXISTS idx_variables_varname ON public.variables(variable_name);

CREATE TRIGGER trg_variables_updated_at
BEFORE UPDATE ON public.variables
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==============================================================================
-- TABLE 9: QUESTIONNAIRE_ASSIGNMENTS (Strict Enumerator Access Control)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.questionnaire_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    questionnaire_id UUID NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
    questionnaire_version_id UUID REFERENCES public.questionnaire_versions(id) ON DELETE SET NULL,
    enumerator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status assignment_status NOT NULL DEFAULT 'active',
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    permissions JSONB NOT NULL DEFAULT '{"can_collect": true, "can_view_history": true, "can_edit_drafts": true}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_questionnaire_enumerator UNIQUE (questionnaire_id, enumerator_id),
    CONSTRAINT fk_qassignments_version_questionnaire
        FOREIGN KEY (questionnaire_version_id, questionnaire_id)
        REFERENCES public.questionnaire_versions(id, questionnaire_id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_qassign_enumerator ON public.questionnaire_assignments(enumerator_id);
CREATE INDEX IF NOT EXISTS idx_qassign_questionnaire ON public.questionnaire_assignments(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_qassign_status ON public.questionnaire_assignments(status);

CREATE TRIGGER trg_questionnaire_assignments_updated_at
BEFORE UPDATE ON public.questionnaire_assignments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Assignment Integrity Trigger: Prohibits self-assignment, checks active user and questionnaire status
CREATE OR REPLACE FUNCTION public.validate_assignment_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_q_project_id UUID;
    v_ver_questionnaire_id UUID;
    v_enumerator_role user_platform_role;
    v_enumerator_status user_account_status;
BEGIN
    -- 1. Prevent self-assignment for non-super_admins
    IF auth.uid() IS NOT NULL AND NEW.enumerator_id = auth.uid() THEN
        IF NOT public.is_super_admin(auth.uid()) THEN
            RAISE EXCEPTION 'Security violation: Enumerators cannot self-assign questionnaires.';
        END IF;
    END IF;

    -- 2. Verify enumerator exists and is active
    SELECT role, status INTO v_enumerator_role, v_enumerator_status
    FROM public.profiles
    WHERE id = NEW.enumerator_id;

    IF v_enumerator_role IS NULL THEN
        RAISE EXCEPTION 'Integrity violation: Enumerator profile % does not exist.', NEW.enumerator_id;
    END IF;

    IF v_enumerator_status <> 'active' THEN
        RAISE EXCEPTION 'Security violation: Cannot assign questionnaires to an inactive or suspended user (status: %).', v_enumerator_status;
    END IF;

    -- 3. Verify questionnaire exists
    SELECT project_id INTO v_q_project_id
    FROM public.questionnaires
    WHERE id = NEW.questionnaire_id;

    IF v_q_project_id IS NULL THEN
        RAISE EXCEPTION 'Integrity violation: Questionnaire % does not exist.', NEW.questionnaire_id;
    END IF;

    -- 4. Verify version belongs to questionnaire if version is specified
    IF NEW.questionnaire_version_id IS NOT NULL THEN
        SELECT questionnaire_id INTO v_ver_questionnaire_id
        FROM public.questionnaire_versions
        WHERE id = NEW.questionnaire_version_id;

        IF v_ver_questionnaire_id IS NULL THEN
            RAISE EXCEPTION 'Integrity violation: Questionnaire version % does not exist.', NEW.questionnaire_version_id;
        END IF;

        IF v_ver_questionnaire_id <> NEW.questionnaire_id THEN
            RAISE EXCEPTION 'Referential integrity violation: Questionnaire version % does not belong to questionnaire %.',
                NEW.questionnaire_version_id, NEW.questionnaire_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_assignment_integrity ON public.questionnaire_assignments;
CREATE TRIGGER trg_validate_assignment_integrity
BEFORE INSERT OR UPDATE ON public.questionnaire_assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_assignment_integrity();


-- ==============================================================================
-- TABLE 10: RESPONSES (Primary Survey Submission Records)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    questionnaire_id UUID NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
    questionnaire_version_id UUID NOT NULL REFERENCES public.questionnaire_versions(id) ON DELETE RESTRICT,
    enumerator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    respondent_id VARCHAR(100) NOT NULL DEFAULT ('RESP-' || substr(md5(random()::text), 1, 8)),
    collection_status response_sync_status NOT NULL DEFAULT 'submitted',
    collected_offline BOOLEAN NOT NULL DEFAULT false,
    gps_coordinates JSONB,
    telemetry JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_responses_questionnaire_project
        FOREIGN KEY (questionnaire_id, project_id)
        REFERENCES public.questionnaires(id, project_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_responses_version_questionnaire
        FOREIGN KEY (questionnaire_version_id, questionnaire_id)
        REFERENCES public.questionnaire_versions(id, questionnaire_id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_responses_project ON public.responses(project_id);
CREATE INDEX IF NOT EXISTS idx_responses_questionnaire ON public.responses(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_responses_version ON public.responses(questionnaire_version_id);
CREATE INDEX IF NOT EXISTS idx_responses_enumerator ON public.responses(enumerator_id);
CREATE INDEX IF NOT EXISTS idx_responses_status ON public.responses(collection_status);
CREATE INDEX IF NOT EXISTS idx_responses_submitted ON public.responses(submitted_at DESC);

CREATE TRIGGER trg_responses_updated_at
BEFORE UPDATE ON public.responses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Response Referential & Authorization Integrity Trigger:
-- Guarantees that questionnaire belongs to project, version belongs to questionnaire,
-- and that an enumerator can only create/update their own responses for questionnaires actively assigned to them.
CREATE OR REPLACE FUNCTION public.validate_response_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_q_project_id UUID;
    v_ver_questionnaire_id UUID;
    v_ver_status version_lifecycle_status;
    v_caller_role user_platform_role;
    v_is_assigned BOOLEAN;
BEGIN
    -- 1. Relational verification: Questionnaire belongs to Project
    SELECT project_id INTO v_q_project_id
    FROM public.questionnaires
    WHERE id = NEW.questionnaire_id;

    IF v_q_project_id IS NULL THEN
        RAISE EXCEPTION 'Integrity violation: Questionnaire % does not exist.', NEW.questionnaire_id;
    END IF;

    IF v_q_project_id <> NEW.project_id THEN
        RAISE EXCEPTION 'Referential integrity violation: Questionnaire % belongs to Project %, not Project %.',
            NEW.questionnaire_id, v_q_project_id, NEW.project_id;
    END IF;

    -- 2. Relational verification: Questionnaire Version belongs to Questionnaire
    SELECT questionnaire_id, status INTO v_ver_questionnaire_id, v_ver_status
    FROM public.questionnaire_versions
    WHERE id = NEW.questionnaire_version_id;

    IF v_ver_questionnaire_id IS NULL THEN
        RAISE EXCEPTION 'Integrity violation: Questionnaire version % does not exist.', NEW.questionnaire_version_id;
    END IF;

    IF v_ver_questionnaire_id <> NEW.questionnaire_id THEN
        RAISE EXCEPTION 'Referential integrity violation: Questionnaire version % belongs to Questionnaire %, not Questionnaire %.',
            NEW.questionnaire_version_id, v_ver_questionnaire_id, NEW.questionnaire_id;
    END IF;

    -- 3. Caller role & isolation enforcement if initiated in an authenticated session
    IF auth.uid() IS NOT NULL THEN
        SELECT role INTO v_caller_role
        FROM public.profiles
        WHERE id = auth.uid();

        IF v_caller_role = 'enumerator' THEN
            -- An enumerator CANNOT record a response on behalf of someone else
            IF NEW.enumerator_id IS DISTINCT FROM auth.uid() THEN
                RAISE EXCEPTION 'Security violation: Enumerators can only record responses under their own user identity (%).', auth.uid();
            END IF;

            -- Check active assignment to this questionnaire
            v_is_assigned := public.is_assigned_enumerator(NEW.questionnaire_id, auth.uid());
            IF NOT v_is_assigned THEN
                RAISE EXCEPTION 'Security violation: Enumerator % is not actively assigned to Questionnaire %.', auth.uid(), NEW.questionnaire_id;
            END IF;

            -- Enumerators can only submit against published versions
            IF v_ver_status <> 'published' THEN
                RAISE EXCEPTION 'Security violation: Enumerators cannot submit responses to non-published questionnaire version % (status: %).',
                    NEW.questionnaire_version_id, v_ver_status;
            END IF;

            -- Prevent updating another enumerator's response or locked responses
            IF TG_OP = 'UPDATE' THEN
                IF OLD.enumerator_id IS DISTINCT FROM auth.uid() THEN
                    RAISE EXCEPTION 'Security violation: Enumerators cannot modify responses collected by another user.';
                END IF;
                IF OLD.collection_status NOT IN ('draft', 'pending_sync') THEN
                    RAISE EXCEPTION 'Security violation: Cannot modify a response once marked as submitted or synced.';
                END IF;
            END IF;
        ELSE
            -- For researchers/managers: verify designated enumerator exists if provided
            IF NEW.enumerator_id IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1
                    FROM public.profiles
                    WHERE id = NEW.enumerator_id
                      AND status = 'active'
                ) THEN
                    RAISE EXCEPTION 'Integrity violation: Designated enumerator % does not exist or is inactive.', NEW.enumerator_id;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_response_integrity ON public.responses;
CREATE TRIGGER trg_validate_response_integrity
BEFORE INSERT OR UPDATE ON public.responses
FOR EACH ROW EXECUTE FUNCTION public.validate_response_integrity();


-- ==============================================================================
-- TABLE 11: RESPONSE_ANSWERS (Normalized Responses for Statistical Queries)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.response_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID NOT NULL REFERENCES public.responses(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
    variable_name VARCHAR(100) NOT NULL,
    answer_value JSONB NOT NULL,
    text_value TEXT,
    numeric_value NUMERIC,
    boolean_value BOOLEAN,
    date_value TIMESTAMPTZ,
    gps_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resp_answers_response ON public.response_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_resp_answers_question ON public.response_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_resp_answers_varname ON public.response_answers(variable_name);
CREATE INDEX IF NOT EXISTS idx_resp_answers_numval ON public.response_answers(numeric_value) WHERE numeric_value IS NOT NULL;

-- Response Answers Referential Integrity Trigger:
-- Enforces that question_id belongs to the parent response's questionnaire version
CREATE OR REPLACE FUNCTION public.validate_response_answer_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_resp_version_id UUID;
    v_resp_enumerator_id UUID;
    v_resp_status response_sync_status;
    v_q_version_id UUID;
    v_q_varname VARCHAR(100);
    v_caller_role user_platform_role;
BEGIN
    SELECT questionnaire_version_id, enumerator_id, collection_status
    INTO v_resp_version_id, v_resp_enumerator_id, v_resp_status
    FROM public.responses
    WHERE id = NEW.response_id;

    IF v_resp_version_id IS NULL THEN
        RAISE EXCEPTION 'Integrity violation: Parent response % does not exist.', NEW.response_id;
    END IF;

    -- Verify question belongs to the exact questionnaire version of the parent response
    IF NEW.question_id IS NOT NULL THEN
        SELECT questionnaire_version_id, variable_name
        INTO v_q_version_id, v_q_varname
        FROM public.questions
        WHERE id = NEW.question_id;

        IF v_q_version_id IS NULL THEN
            RAISE EXCEPTION 'Integrity violation: Question % does not exist.', NEW.question_id;
        END IF;

        IF v_q_version_id <> v_resp_version_id THEN
            RAISE EXCEPTION 'Referential integrity violation: Question % belongs to questionnaire version %, but parent response is for version %.',
                NEW.question_id, v_q_version_id, v_resp_version_id;
        END IF;

        IF NEW.variable_name IS NULL OR NEW.variable_name = '' THEN
            NEW.variable_name := v_q_varname;
        END IF;
    END IF;

    -- Caller isolation check
    IF auth.uid() IS NOT NULL THEN
        SELECT role INTO v_caller_role
        FROM public.profiles
        WHERE id = auth.uid();

        IF v_caller_role = 'enumerator' THEN
            IF v_resp_enumerator_id IS DISTINCT FROM auth.uid() THEN
                RAISE EXCEPTION 'Security violation: Enumerators cannot modify answers for responses belonging to another user.';
            END IF;

            IF TG_OP = 'UPDATE' AND v_resp_status NOT IN ('draft', 'pending_sync') THEN
                RAISE EXCEPTION 'Security violation: Enumerators cannot modify answers for responses that have been submitted or locked.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_response_answer_integrity ON public.response_answers;
CREATE TRIGGER trg_validate_response_answer_integrity
BEFORE INSERT OR UPDATE ON public.response_answers
FOR EACH ROW EXECUTE FUNCTION public.validate_response_answer_integrity();


-- ==============================================================================
-- TABLE 12: DATA_QUALITY_ISSUES (Automated Data Quality & Anomaly Engine)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.data_quality_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    response_id UUID REFERENCES public.responses(id) ON DELETE CASCADE,
    variable_name VARCHAR(100),
    issue_type quality_issue_type NOT NULL,
    severity quality_issue_severity NOT NULL DEFAULT 'medium',
    details TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    flag_metadata JSONB DEFAULT '{}'::jsonb,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_dq_project ON public.data_quality_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_dq_status ON public.data_quality_issues(status);
CREATE INDEX IF NOT EXISTS idx_dq_severity ON public.data_quality_issues(severity);


-- ==============================================================================
-- TABLE 13: STATISTICAL_ANALYSES (Statistical Test Run Persistence)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.statistical_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    analysis_type VARCHAR(100) NOT NULL,
    statistical_test VARCHAR(100) NOT NULL,
    variables_used TEXT[] NOT NULL DEFAULT '{}',
    parameters JSONB DEFAULT '{}'::jsonb,
    results JSONB NOT NULL DEFAULT '{}'::jsonb,
    p_value NUMERIC,
    confidence_interval JSONB,
    effect_size JSONB,
    assumptions JSONB,
    interpretation TEXT,
    executed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stat_project ON public.statistical_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_stat_test ON public.statistical_analyses(statistical_test);


-- ==============================================================================
-- TABLE 14: AUDIT_LOGS (Immutable Activity and Security Ledger)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);

-- Strict Immutability Trigger for Audit Logs (Append-Only Ledger)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Security violation: Audit logs are append-only and strictly immutable. Updates and deletions are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();


-- ==============================================================================
-- AUTOMATIC PROFILE PROVISIONING TRIGGER (auth.users -> public.profiles)
-- ==============================================================================

-- Security Hardened: A new user registering through Supabase Auth CANNOT self-assign
-- privileged roles such as 'super_admin', 'data_manager', 'analyst', or 'research_assistant'.
-- Normal signups default strictly to 'researcher' (or 'enumerator' if specifically invited).
-- Elevated platform role elevation requires explicit administrative action.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_requested_role TEXT;
    v_assigned_role user_platform_role;
BEGIN
    v_requested_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', ''));

    IF v_requested_role = 'enumerator' THEN
        v_assigned_role := 'enumerator'::user_platform_role;
    ELSE
        v_assigned_role := 'researcher'::user_platform_role;
    END IF;

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        role,
        institution
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
            split_part(NEW.email, '@', 1)
        ),
        COALESCE(
            NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), ''),
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
        ),
        v_assigned_role,
        COALESCE(
            NULLIF(TRIM(NEW.raw_user_meta_data->>'institution'), ''),
            'Research Institute'
        )
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        institution = EXCLUDED.institution,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();