-- RDIP Phase 8: Enumerator membership hardening
-- Assignments may only target an active enumerator who is an active member of the same project.

DROP POLICY IF EXISTS "researchers can create questionnaire assignments" ON public.questionnaire_assignments;

CREATE POLICY "researchers can create questionnaire assignments"
ON public.questionnaire_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  assigned_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'active'
      AND lower(coalesce(p.role::text, '')) = 'researcher'
  )
  AND EXISTS (
    SELECT 1 FROM public.questionnaire_versions v
    WHERE v.id = questionnaire_version_id
      AND v.questionnaire_id = questionnaire_id
      AND v.status = 'published'
  )
  AND EXISTS (
    SELECT 1 FROM public.questionnaires q
    WHERE q.id = questionnaire_id
      AND q.project_id = project_id
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles ep
    WHERE ep.id = enumerator_id
      AND ep.role = 'enumerator'
      AND ep.status = 'active'
  )
  AND EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = project_id
      AND pm.user_id = enumerator_id
      AND pm.status = 'active'
  )
);

COMMENT ON POLICY "researchers can create questionnaire assignments" ON public.questionnaire_assignments IS
  'Researchers may assign only published questionnaire versions to active enumerator profiles who are active members of the same project.';
