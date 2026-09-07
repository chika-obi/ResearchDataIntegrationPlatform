import React, { useEffect, useState } from 'react';
import { DbProfile, DbProject, DbQuestionnaire, DbQuestionnaireVersion } from '../types';
import { supabase } from '../lib/supabase';

interface Props { isOpen: boolean; onClose: () => void; }

export const QuestionnaireAssignmentModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [projects, setProjects] = useState<DbProject[]>([]);
  const [questionnaires, setQuestionnaires] = useState<DbQuestionnaire[]>([]);
  const [versions, setVersions] = useState<DbQuestionnaireVersion[]>([]);
  const [enumerators, setEnumerators] = useState<DbProfile[]>([]);
  const [projectId, setProjectId] = useState('');
  const [questionnaireId, setQuestionnaireId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [enumeratorId, setEnumeratorId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; questionnaire: string; version: string; enumerator: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setProjectId(''); setQuestionnaireId(''); setVersionId(''); setEnumeratorId('');
    setStartDate(''); setEndDate(''); setError(null); setSuccess(null);
    const loadProjects = async () => {
      setLoading(true);
      const { data, error: e } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (e) setError(`Unable to load research projects: ${e.message}`); else setProjects((data || []) as DbProject[]);
      setLoading(false);
    };
    loadProjects();
  }, [isOpen]);

  useEffect(() => {
    if (!projectId) { setQuestionnaires([]); setVersions([]); setEnumerators([]); return; }
    let cancelled = false;
    const load = async () => {
      setError(null);
      const [qResult, mResult] = await Promise.all([
        supabase.from('questionnaires').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('project_members').select('user_id').eq('project_id', projectId).eq('status', 'active')
      ]);
      if (cancelled) return;
      if (qResult.error) setError(`Unable to load questionnaires: ${qResult.error.message}`); else setQuestionnaires((qResult.data || []) as DbQuestionnaire[]);
      if (mResult.error) { setError(`Unable to load project enumerators: ${mResult.error.message}`); setEnumerators([]); }
      else {
        const ids = (mResult.data || []).map((m: { user_id: string }) => m.user_id).filter(Boolean);
        if (!ids.length) setEnumerators([]);
        else {
          const p = await supabase.from('profiles').select('id,email,full_name,phone,avatar_url,institution,department,role,status').in('id', ids).eq('role', 'enumerator').eq('status', 'active').order('full_name');
          if (p.error) { setError(`Unable to load eligible enumerators: ${p.error.message}`); setEnumerators([]); }
          else setEnumerators((p.data || []) as DbProfile[]);
        }
      }
    };
    setQuestionnaireId(''); setVersionId(''); setEnumeratorId(''); setVersions([]); load();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!questionnaireId) { setVersions([]); setVersionId(''); return; }
    let cancelled = false;
    const load = async () => {
      setLoadingVersions(true); setError(null);
      const { data, error: e } = await supabase.from('questionnaire_versions').select('*').eq('questionnaire_id', questionnaireId).order('created_at', { ascending: false });
      if (!cancelled) { if (e) { setError(`Unable to load questionnaire versions: ${e.message}`); setVersions([]); } else setVersions((data || []) as DbQuestionnaireVersion[]); setLoadingVersions(false); }
    };
    load(); return () => { cancelled = true; };
  }, [questionnaireId]);

  if (!isOpen) return null;

  const selectedVersion = versions.find(v => v.id === versionId);
  const selectedQuestionnaire = questionnaires.find(q => q.id === questionnaireId);
  const selectedEnumerator = enumerators.find(e => e.id === enumeratorId);
  const canSubmit = !!projectId && !!questionnaireId && selectedVersion?.status === 'published' && !!enumeratorId && !saving;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null);
    if (!selectedVersion || selectedVersion.status !== 'published') { setError('Only a published questionnaire version can be assigned.'); return; }
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) { setError('Authentication error: Please sign in again.'); return; }
    setSaving(true);
    const { data, error: e } = await supabase.from('questionnaire_assignments').insert({
      project_id: projectId, questionnaire_id: questionnaireId, questionnaire_version_id: versionId,
      enumerator_id: enumeratorId, assigned_by: auth.user.id, status: 'active',
      start_date: startDate ? new Date(`${startDate}T00:00:00`).toISOString() : null,
      end_date: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : null,
      permissions: { can_collect: true, can_view_history: true, can_edit_drafts: false }
    }).select('id').single();
    setSaving(false);
    if (e || !data) {
      if (e?.code === '23505') setError('This published questionnaire version is already actively assigned to this enumerator.');
      else if (e?.code === '42501') setError('Supabase security policy denied this assignment. Confirm your researcher role and project permissions.');
      else setError(e?.message || 'The assignment could not be saved to Supabase.');
      return;
    }
    setSuccess({ id: data.id, questionnaire: selectedQuestionnaire?.name || 'Questionnaire', version: selectedVersion.version_number, enumerator: selectedEnumerator?.full_name || 'Enumerator' });
  };

  return <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-[#161c27]/45 backdrop-blur-xs" onClick={() => !saving && onClose()} />
    <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-[#c4c6cf]/40 animate-in zoom-in-95">
      <div className="bg-[#1a365d] text-white p-5 flex justify-between items-center">
        <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20"><span className="material-symbols-outlined text-xl text-[#91f0ed]">assignment_ind</span></div><div><h2 className="text-base font-bold tracking-tight">Assign Questionnaire</h2><p className="text-xs text-white/80">Assign a published research instrument to a field enumerator</p></div></div>
        <button disabled={saving} onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 disabled:opacity-40"><span className="material-symbols-outlined text-[20px]">close</span></button>
      </div>
      {success ? <div className="p-6 space-y-5"><div className="p-4 rounded-xl bg-[#006a68]/10 border border-[#006a68]/30 flex items-start gap-3"><span className="material-symbols-outlined text-[#006a68] text-2xl">verified</span><div><h3 className="text-sm font-bold text-[#002045]">Questionnaire assigned successfully.</h3><p className="text-xs text-[#43474e] mt-1">The assignment has been saved to Supabase.</p></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"><div className="p-3 bg-[#f9f9ff] rounded-lg border border-[#c4c6cf]/40"><span className="text-[#74777f] block">Questionnaire</span><strong className="text-[#002045]">{success.questionnaire}</strong></div><div className="p-3 bg-[#f9f9ff] rounded-lg border border-[#c4c6cf]/40"><span className="text-[#74777f] block">Version</span><strong className="text-[#002045]">{success.version} · PUBLISHED</strong></div><div className="p-3 bg-[#f9f9ff] rounded-lg border border-[#c4c6cf]/40"><span className="text-[#74777f] block">Enumerator</span><strong className="text-[#002045]">{success.enumerator}</strong></div><div className="p-3 bg-[#f9f9ff] rounded-lg border border-[#c4c6cf]/40"><span className="text-[#74777f] block">Assignment ID</span><code className="text-[#002045] break-all">{success.id}</code></div></div><div className="flex justify-end pt-3 border-t border-[#c4c6cf]/40"><button onClick={onClose} className="px-5 py-2 rounded-lg bg-[#1a365d] text-white text-xs font-semibold hover:bg-[#002045]">Done</button></div></div> : <form onSubmit={submit} className="p-6 space-y-5 text-xs">
        {error && <div role="alert" className="p-3 rounded-lg bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 text-[#8b1515] flex items-start gap-2"><span className="material-symbols-outlined text-[18px]">error</span><span>{error}</span></div>}
        <div><label className="block font-semibold text-[#161c27] mb-1">Research Project *</label><select required value={projectId} onChange={e => setProjectId(e.target.value)} disabled={loading || saving} className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"><option value="">{loading ? 'Loading projects...' : 'Select a research project'}</option>{projects.map(p => <option key={p.id} value={p.id}>{p.project_code} — {p.title}</option>)}</select></div>
        <div><label className="block font-semibold text-[#161c27] mb-1">Questionnaire *</label><select required value={questionnaireId} onChange={e => setQuestionnaireId(e.target.value)} disabled={!projectId || saving} className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"><option value="">Select questionnaire</option>{questionnaires.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}</select></div>
        <div><label className="block font-semibold text-[#161c27] mb-1">Questionnaire Version *</label><select required value={versionId} onChange={e => setVersionId(e.target.value)} disabled={!questionnaireId || loadingVersions || saving} className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"><option value="">{loadingVersions ? 'Loading versions...' : 'Select questionnaire version'}</option>{versions.map(v => <option key={v.id} value={v.id} disabled={v.status !== 'published'}>{v.version_number} — {v.status.toUpperCase()}{v.status !== 'published' ? ' (not assignable)' : ''}</option>)}</select><p className="mt-1 text-[11px] text-[#74777f]">Only PUBLISHED versions can be assigned.</p></div>
        <div><label className="block font-semibold text-[#161c27] mb-1">Enumerator *</label><select required value={enumeratorId} onChange={e => setEnumeratorId(e.target.value)} disabled={!projectId || saving} className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"><option value="">{enumerators.length ? 'Select enumerator' : 'No active project enumerator found'}</option>{enumerators.map(e => <option key={e.id} value={e.id}>{e.full_name} — {e.email}</option>)}</select><p className="mt-1 text-[11px] text-[#74777f]">Only active enumerator profiles who are active project members are shown.</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block font-semibold text-[#161c27] mb-1">Start Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={saving} className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none" /></div><div><label className="block font-semibold text-[#161c27] mb-1">End Date</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={saving} className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none" /></div></div>
        <div className="p-3 rounded-xl bg-[#f1f3ff] border border-[#c4c6cf]/40"><div className="flex items-center gap-2 font-bold text-[#002045]"><span className="material-symbols-outlined text-[17px] text-[#006a68]">verified_user</span>Exact published version will be assigned</div><p className="mt-1 text-[11px] text-[#43474e]">The enumerator will receive this specific questionnaire version for field collection.</p></div>
        <div className="pt-3 border-t border-[#c4c6cf]/40 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg border border-[#c4c6cf] font-semibold text-[#002045] hover:bg-slate-50">Cancel</button><button type="submit" disabled={!canSubmit} className="px-5 py-2 rounded-lg bg-[#1a365d] text-white font-semibold hover:bg-[#002045] disabled:opacity-50 flex items-center gap-1.5">{saving ? <><span className="material-symbols-outlined text-[16px] animate-spin">sync</span>Saving Assignment to Supabase...</> : <><span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>Assign Questionnaire</>}</button></div>
      </form>}
    </div>
  </div>;
};
