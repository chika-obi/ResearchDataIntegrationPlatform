-- RDIP Phase 8: Final fix for questionnaire assignment RLS recursion.
-- Uses the deployed questionnaire_assignments schema (no project_id column).
-- This migration removes every existing policy on questionnaire_assignments so
-- an older policy cannot continue to trigger recursive evaluation.

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'questionnaire_assignments'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.questionnaire_assignments',
      policy_record.policyname
    );
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.can_create_questionnaire_assignment(
  p_questionnaire_id uuid,
  p_questionnaire_version_id uuid,
  p_enumerator_id uuid,
  p_assigned_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_project_id uuid;
BEGIN
  IF p_assigned_by IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  SELECT q.project_id
    INTO v_project_id
  FROM public.questionnaires q
  WHERE q.id = p_questionnaire_id;

  IF v_project_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_assigned_by
      AND p.status::text = 'active'
      AND lower(p.role::text) = 'researcher'
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.questionnaire_versions v
    WHERE v.id = p_questionnaire_version_id
      AND v.questionnaire_id = p_questionnaire_id
      AND v.status::text = 'published'
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles ep
    WHERE ep.id = p_enumerator_id
      AND lower(ep.role::text) = 'enumerator'
      AND ep.status::text = 'active'
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = v_project_id
      AND pm.user_id = p_enumerator_id
      AND pm.status::text = 'active'
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL
ON FUNCTION public.can_create_questionnaire_assignment(uuid, uuid, uuid, uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.can_create_questionnaire_assignment(uuid, uuid, uuid, uuid)
TO authenticated;

CREATE POLICY "questionnaire_assignments_select_own"
ON public.questionnaire_assignments
FOR SELECT
TO authenticated
USING (assigned_by = auth.uid());

CREATE POLICY "questionnaire_assignments_select_assigned"
ON public.questionnaire_assignments
FOR SELECT
TO authenticated
USING (enumerator_id = auth.uid());

CREATE POLICY "questionnaire_assignments_insert_researcher"
ON public.questionnaire_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_create_questionnaire_assignment(
    questionnaire_id,
    questionnaire_version_id,
    enumerator_id,
    assigned_by
  )
);

COMMENT ON TABLE public.questionnaire_assignments IS
  'RDIP Phase 8 authoritative assignments of published questionnaire versions to enumerators.';
