-- RDIP Phase 8: Fix questionnaire assignment RLS recursion and align with deployed schema.
-- The deployed questionnaire_assignments table does not contain project_id.
-- Project context is derived through questionnaires.project_id.

CREATE OR REPLACE FUNCTION public.can_create_questionnaire_assignment(
  p_questionnaire_id uuid,
  p_questionnaire_version_id uuid,
  p_enumerator_id uuid,
  p_assigned_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      AND p.status = 'active'
      AND lower(coalesce(p.role::text, '')) = 'researcher'
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.questionnaire_versions v
    WHERE v.id = p_questionnaire_version_id
      AND v.questionnaire_id = p_questionnaire_id
      AND v.status = 'published'
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles ep
    WHERE ep.id = p_enumerator_id
      AND lower(coalesce(ep.role::text, '')) = 'enumerator'
      AND ep.status = 'active'
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = v_project_id
      AND pm.user_id = p_enumerator_id
      AND pm.status = 'active'
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.can_create_questionnaire_assignment(uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_create_questionnaire_assignment(uuid, uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "researchers can create questionnaire assignments" ON public.questionnaire_assignments;

CREATE POLICY "researchers can create questionnaire assignments"
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

COMMENT ON FUNCTION public.can_create_questionnaire_assignment(uuid, uuid, uuid, uuid) IS
  'RLS-safe Phase 8 authorization for assigning a published questionnaire version to an active enumerator who belongs to the questionnaire project.';
