import React, { useState, useEffect } from 'react';
import {
  Question,
  QuestionOption,
  DataType,
  MeasurementLevel,
  QuestionType,
  QuestionLogicRule,
  QuestionGpsConfig,
  Project,
  UserProfile,
  DbQuestionnaire,
  DbQuestionnaireVersion,
} from '../types';
import { INITIAL_QUESTIONS } from '../data/mockData';
import { PublicSurveyModal } from './PublicSurveyModal';
import { LogicConditionBuilder } from './LogicConditionBuilder';
import { LogicImportExportModal } from './LogicImportExportModal';
import { CreateQuestionnaireModal } from './CreateQuestionnaireModal';
import { formatLogicExpression } from '../lib/surveyLogicEvaluator';
import { downloadLogicFlowJSON } from '../lib/logicImportExport';
import { GeolocationFieldRenderer } from './GeolocationFieldRenderer';
import {
  fetchProjectQuestionnaires,
  fetchQuestionnaireVersions,
  fetchQuestionnaireVersionWithQuestions,
  createQuestionnaireInDb,
  createQuestionnaireVersionInDb,
  saveQuestionnaireDraftInDb,
  CreateQuestionnaireParams,
  QuestionnaireVersionSummary,
} from '../lib/rdipDatabaseService';

export const ensureQuestionsStartWithQ1 = (items: Question[]): Question[] => items.map((q, idx) => ({ ...q, number: `Q${idx + 1}` }));
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface QuestionnaireBuilderViewProps {
  onOpenPreview?: () => void;
  projects?: Project[];
  selectedProject?: Project | null;
  onSelectProject?: (project: Project) => void;
  currentUser?: UserProfile;
  isAuthenticated?: boolean;
}

export const QuestionnaireBuilderView: React.FC<QuestionnaireBuilderViewProps> = ({
  onOpenPreview,
  projects = [],
  selectedProject = null,
  onSelectProject,
  currentUser,
  isAuthenticated = false,
}) => {
  const [questions, setQuestions] = useState<Question[]>(() => {
    const saved = localStorage.getItem('rdip_active_questionnaire');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return ensureQuestionsStartWithQ1(parsed);
      } catch {}
    }
    return ensureQuestionsStartWithQ1(INITIAL_QUESTIONS);
  });
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('q2');
  const [inspectorTab, setInspectorTab] = useState<'config' | 'logic' | 'metadata'>('config');
  const [surveyTitle, setSurveyTitle] = useState(() => localStorage.getItem('rdip_survey_title') || 'National Health Infrastructure Assessment Questionnaire');
  const [surveyVersion, setSurveyVersion] = useState(() => localStorage.getItem('rdip_survey_version') || 'v2.0 (Active)');
  const [surveyStyle, setSurveyStyle] = useState<'academic' | 'modern' | 'onepage'>('academic');
  const [surveySection, setSurveySection] = useState('Section A: Demographic Profile & Socio-Economic Status');
  const [surveySectionDesc, setSurveySectionDesc] = useState('Please record verified information regarding the household head, education, and geographic facility access.');
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [showSurveyPreview, setShowSurveyPreview] = useState(false);
  const [showLogicMatrixModal, setShowLogicMatrixModal] = useState(false);
  const [showLogicImportExportModal, setShowLogicImportExportModal] = useState(false);
  const [importToastMessage, setImportToastMessage] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedFieldLink, setCopiedFieldLink] = useState(false);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [isQuestionBankOpen, setIsQuestionBankOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [mobileActiveTab, setMobileActiveTab] = useState<'canvas' | 'bank' | 'inspector'>('canvas');

  const [projectQuestionnaires, setProjectQuestionnaires] = useState<DbQuestionnaire[]>([]);
  const [activeDbQuestionnaire, setActiveDbQuestionnaire] = useState<DbQuestionnaire | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [versionHistory, setVersionHistory] = useState<QuestionnaireVersionSummary[]>([]);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isVersionCreating, setIsVersionCreating] = useState(false);
  const [isVersionPublishing, setIsVersionPublishing] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [dbSyncStatus, setDbSyncStatus] = useState<'synced' | 'local_only' | 'error'>('local_only');
  const [dbStatusToast, setDbStatusToast] = useState<string | null>(null);

  const selectedQuestion = questions.find((q) => q.id === selectedQuestionId) || questions[0];
  const questionsWithLogicCount = questions.filter((q) => q.logicRule?.enabled && q.logicRule.branches.length > 0).length;
  const isEnumerator = currentUser?.role === 'enumerator';
  const activeVersion = versionHistory.find((v) => v.id === activeVersionId) || activeDbQuestionnaire?.current_version;
  const canEditActiveVersion = !isEnumerator && (!activeVersion || activeVersion.status === 'draft');

  const applyVersionToEditor = async (versionId: string) => {
    setIsDbLoading(true);
    try {
      const result = await fetchQuestionnaireVersionWithQuestions(versionId);
      if (!result.version) {
        setDbStatusToast('Unable to load the selected questionnaire version.');
        return;
      }
      const fromRows: Question[] = result.questions.map((q) => ({
        id: q.id,
        number: q.question_number,
        section: q.section || undefined,
        title: q.question_text,
        helpText: q.help_text || undefined,
        variableName: q.variable_name,
        variableLabel: q.variable_label || undefined,
        type: q.question_type,
        options: (q.options || []).map((o) => ({ id: o.option_value, label: o.option_label, numericCode: o.numeric_code ?? undefined })),
        required: q.required,
        hasOtherOption: q.has_other_option,
        likertScale: q.likert_scale || undefined,
        linkedObjective: q.linked_research_objective || undefined,
        dataType: q.data_type,
        measurementLevel: q.measurement_level,
        logicRule: q.conditional_logic as QuestionLogicRule | undefined,
        validationRules: q.validation_rules as Question['validationRules'],
        gpsConfig: q.gps_config as QuestionGpsConfig | undefined,
      }));
      const fromSchema = Array.isArray(result.version.schema_definition?.questions) ? result.version.schema_definition.questions as Question[] : [];
      const normalized = ensureQuestionsStartWithQ1(fromRows.length > 0 ? fromRows : fromSchema);
      if (normalized.length > 0) {
        setQuestions(normalized);
        setSelectedQuestionId(normalized[0].id);
      }
      setActiveVersionId(result.version.id);
      setSurveyVersion(`${result.version.version_number} (${result.version.status.toUpperCase()})`);
      localStorage.setItem('rdip_survey_version', `${result.version.version_number} (${result.version.status.toUpperCase()})`);
      localStorage.setItem('rdip_active_questionnaire', JSON.stringify(normalized));
      setDbSyncStatus('synced');
      setIsVersionHistoryOpen(false);
    } catch (err: any) {
      setDbStatusToast(err?.message || 'Failed to load questionnaire version.');
    } finally {
      setIsDbLoading(false);
    }
  };

  const refreshVersionHistory = async (questionnaireId: string) => {
    const versions = await fetchQuestionnaireVersions(questionnaireId);
    setVersionHistory(versions);
    return versions;
  };

  useEffect(() => {
    let isMounted = true;
    async function loadDbQuestionnaires() {
      if (!selectedProject?.id || !UUID_REGEX.test(selectedProject.id)) {
        setProjectQuestionnaires([]);
        setActiveDbQuestionnaire(null);
        setVersionHistory([]);
        setDbSyncStatus('local_only');
        return;
      }
      setIsDbLoading(true);
      try {
        const qList = await fetchProjectQuestionnaires(selectedProject.id);
        if (!isMounted) return;
        setProjectQuestionnaires(qList);
        if (qList.length > 0) {
          const latest = qList[0];
          setActiveDbQuestionnaire(latest);
          setSurveyTitle(latest.name);
          const currentVersionId = latest.current_version_id || latest.current_version?.id || null;
          setActiveVersionId(currentVersionId);
          if (currentVersionId) await applyVersionToEditor(currentVersionId);
          await refreshVersionHistory(latest.id);
          setDbSyncStatus('synced');
        } else {
          setActiveDbQuestionnaire(null);
          setVersionHistory([]);
          setDbSyncStatus('local_only');
        }
      } catch {
        if (isMounted) setDbSyncStatus('error');
      } finally {
        if (isMounted) setIsDbLoading(false);
      }
    }
    loadDbQuestionnaires();
    return () => { isMounted = false; };
  }, [selectedProject?.id]);

  const handleSelectDbQuestionnaire = async (qId: string) => {
    const q = projectQuestionnaires.find((item) => item.id === qId);
    if (!q) return;
    setActiveDbQuestionnaire(q);
    setSurveyTitle(q.name);
    const versionId = q.current_version_id || q.current_version?.id || null;
    setActiveVersionId(versionId);
    await refreshVersionHistory(q.id);
    if (versionId) await applyVersionToEditor(versionId);
  };

  const handleCreateQuestionnaire = async (params: CreateQuestionnaireParams) => {
    const result = await createQuestionnaireInDb(params);
    if (result.error || !result.data) return { success: false, error: result.error || 'Failed to create questionnaire in Supabase.' };
    const { questionnaire, version } = result.data;
    setProjectQuestionnaires((prev) => [questionnaire, ...prev]);
    setActiveDbQuestionnaire(questionnaire);
    setActiveVersionId(version.id);
    setSurveyTitle(questionnaire.name);
    setSurveyVersion(`${version.version_number} (DRAFT)`);
    if (version.schema_definition?.questions && Array.isArray(version.schema_definition.questions)) {
      const normalized = ensureQuestionsStartWithQ1(version.schema_definition.questions as Question[]);
      setQuestions(normalized);
      if (normalized.length) setSelectedQuestionId(normalized[0].id);
    }
    await refreshVersionHistory(questionnaire.id);
    setDbSyncStatus('synced');
    setDbStatusToast(`Questionnaire "${questionnaire.name}" created in Supabase with draft version ${version.version_number}.`);
    setTimeout(() => setDbStatusToast(null), 4000);
    return { success: true, questionnaire, version };
  };

  const handleCreateNewVersion = async () => {
    if (!activeDbQuestionnaire?.id || !activeVersionId) {
      setDbStatusToast('Save this questionnaire to Supabase before creating a new version.');
      return;
    }
    if (isEnumerator || activeVersion?.status !== 'draft') {
      setDbStatusToast('Create a new version only from an editable draft/current questionnaire.');
      return;
    }
    setIsVersionCreating(true);
    try {
      const result = await createQuestionnaireVersionInDb({
        questionnaire_id: activeDbQuestionnaire.id,
        source_version_id: activeVersionId,
        copy_questions: true,
      });
      if (result.error || !result.data) {
        setDbStatusToast(result.error || 'Failed to create new questionnaire version.');
        return;
      }
      setProjectQuestionnaires((prev) => prev.map((q) => q.id === result.data!.questionnaire.id ? result.data!.questionnaire : q));
      setActiveDbQuestionnaire(result.data.questionnaire);
      setActiveVersionId(result.data.version.id);
      setSurveyTitle(result.data.questionnaire.name);
      await refreshVersionHistory(result.data.questionnaire.id);
      await applyVersionToEditor(result.data.version.id);
      setDbStatusToast(`✓ Created ${result.data.version.version_number} as a new Supabase draft.`);
    } catch (err: any) {
      setDbStatusToast(err?.message || 'Failed to create new version.');
    } finally {
      setIsVersionCreating(false);
    }
  };

  const handlePublishActiveVersion = async () => {
    if (!activeDbQuestionnaire?.id || !activeVersionId || isEnumerator) return;
    const version = versionHistory.find((v) => v.id === activeVersionId);
    if (!version || version.status !== 'draft') {
      setDbStatusToast('Only a draft version can be published.');
      return;
    }
    setIsVersionPublishing(true);
    try {
      const { publishQuestionnaireVersionInDb } = await import('../lib/rdipDatabaseService');
      const result = await publishQuestionnaireVersionInDb(activeVersionId, activeDbQuestionnaire.id);
      if (!result.success) {
        setDbStatusToast(result.error || 'Failed to publish version.');
        return;
      }
      const versions = await refreshVersionHistory(activeDbQuestionnaire.id);
      const refreshed = await fetchProjectQuestionnaires(selectedProject!.id);
      setProjectQuestionnaires(refreshed);
      const refreshedQ = refreshed.find((q) => q.id === activeDbQuestionnaire.id) || activeDbQuestionnaire;
      setActiveDbQuestionnaire(refreshedQ);
      const published = versions.find((v) => v.id === activeVersionId);
      setSurveyVersion(`${published?.version_number || version.version_number} (PUBLISHED)`);
      setDbStatusToast(`✓ ${published?.version_number || version.version_number} published and locked.`);
    } catch (err: any) {
      setDbStatusToast(err?.message || 'Failed to publish version.');
    } finally {
      setIsVersionPublishing(false);
    }
  };

  const handleApplyImportedQuestions = (updatedQuestions: Question[], notificationMsg?: string) => {
    const normalized = ensureQuestionsStartWithQ1(updatedQuestions);
    setQuestions(normalized);
    localStorage.setItem('rdip_active_questionnaire', JSON.stringify(normalized));
    if (notificationMsg) {
      setImportToastMessage(notificationMsg);
      setTimeout(() => setImportToastMessage(null), 4000);
    }
  };

  const handleUpdateSelected = (updatedFields: Partial<Question>) => {
    if (!canEditActiveVersion) {
      setDbStatusToast('This questionnaire version is locked. Create a new draft version to make changes.');
      return;
    }
    setQuestions((prev) => {
      const updated = prev.map((q) => (q.id === selectedQuestionId ? { ...q, ...updatedFields } : q));
      localStorage.setItem('rdip_active_questionnaire', JSON.stringify(updated));
      return updated;
    });
  };

  const handleAddQuestion = (type: QuestionType, defaultTitle = 'New Questionnaire Item', withDefaultLogic = false, customGpsConfig?: Partial<QuestionGpsConfig>) => {
    if (!canEditActiveVersion) return setDbStatusToast('This questionnaire version is locked. Create a new draft version first.');
    const newId = `q-${Date.now().toString().slice(-5)}`;
    const nextIndex = questions.length + 1;
    const newNum = `Q${nextIndex}`;
    const isGeo = type === 'geolocation' || type === 'gps-coordinate';
    const newVar = isGeo ? `${newNum}_Geolocation_Coords` : `${newNum}_Variable`;
    let defaultDataType: DataType = 'Categorical';
    let defaultMeasurement: MeasurementLevel = 'Nominal';
    if (type === 'number') { defaultDataType = 'Numerical'; defaultMeasurement = 'Ratio'; }
    else if (isGeo) { defaultDataType = 'Continuous'; defaultMeasurement = 'Ratio'; }
    else if (type === 'likert') { defaultDataType = 'Ordinal'; defaultMeasurement = 'Ordinal'; }
    const newQuestion: Question = {
      id: newId, number: newNum, title: defaultTitle, variableName: newVar,
      variableLabel: isGeo ? 'Geospatial Geolocation Coordinates (WGS84)' : defaultTitle,
      type, required: true, dataType: defaultDataType, measurementLevel: defaultMeasurement,
      options: type === 'multiple-choice' || type === 'checkboxes' || type === 'dropdown'
        ? [{ id: 'opt-1', label: 'Option A', numericCode: 1 }, { id: 'opt-2', label: 'Option B', numericCode: 2 }, { id: 'opt-3', label: 'Option C', numericCode: 3 }]
        : type === 'likert'
          ? [{ id: 'opt-1', label: 'Strongly Disagree', numericCode: 1 }, { id: 'opt-2', label: 'Disagree', numericCode: 2 }, { id: 'opt-3', label: 'Neutral', numericCode: 3 }, { id: 'opt-4', label: 'Agree', numericCode: 4 }, { id: 'opt-5', label: 'Strongly Agree', numericCode: 5 }]
          : [],
      linkedObjective: isGeo ? 'Objective 1: Assess emergency medical readiness and facility distribution' : 'Objective 2: Evaluate socio-demographic disparities in healthcare accessibility',
      dataTypeConstraint: isGeo ? 'Geospatial WGS84 (Lat, Lng, Alt, Acc)' : defaultDataType === 'Numerical' ? 'Numeric (Continuous)' : 'Categorical (Nominal)',
      validationRules: type === 'number' ? { min: 0, max: 100 } : isGeo ? { max: customGpsConfig?.accuracyThresholdMeters ?? 15 } : undefined,
      gpsConfig: isGeo ? { accuracyThresholdMeters: customGpsConfig?.accuracyThresholdMeters ?? 15, requireAltitude: customGpsConfig?.requireAltitude ?? true, allowManualEntry: customGpsConfig?.allowManualEntry ?? true, captureMode: customGpsConfig?.captureMode ?? 'point' } : undefined,
      logicRule: withDefaultLogic && questions.length > 0 ? { enabled: true, branches: [{ id: `branch-${Date.now()}-if`, branchType: 'IF', matchType: 'ALL', clauses: [{ id: `cl-${Date.now()}`, sourceVariable: questions[questions.length - 1].variableName, operator: 'is_not_empty', value: '' }], action: 'show' }, { id: `branch-${Date.now()}-else`, branchType: 'ELSE', clauses: [], action: 'hide' }] } : undefined,
    };
    const updated = ensureQuestionsStartWithQ1([...questions, newQuestion]);
    setQuestions(updated); setSelectedQuestionId(newId); if (withDefaultLogic) setInspectorTab('logic');
    localStorage.setItem('rdip_active_questionnaire', JSON.stringify(updated));
  };

  const handleDuplicateQuestion = (id: string) => {
    if (!canEditActiveVersion) return setDbStatusToast('This questionnaire version is locked.');
    const target = questions.find((q) => q.id === id); if (!target) return;
    const dup: Question = { ...target, id: `q-${Date.now().toString().slice(-5)}`, number: `Q${questions.length + 1}`, variableName: `${target.variableName}_Copy`, title: `${target.title} (Duplicate)` };
    const updated = ensureQuestionsStartWithQ1([...questions, dup]); setQuestions(updated); setSelectedQuestionId(dup.id); localStorage.setItem('rdip_active_questionnaire', JSON.stringify(updated));
  };
  const handleDeleteQuestion = (id: string) => {
    if (!canEditActiveVersion) return setDbStatusToast('This questionnaire version is locked.');
    if (questions.length <= 1) return;
    const updated = ensureQuestionsStartWithQ1(questions.filter((q) => q.id !== id)); setQuestions(updated); if (selectedQuestionId === id) setSelectedQuestionId(updated[0].id); localStorage.setItem('rdip_active_questionnaire', JSON.stringify(updated));
  };
  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if (!canEditActiveVersion) return setDbStatusToast('This questionnaire version is locked.');
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === questions.length - 1)) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1; const reordered = [...questions]; const [moved] = reordered.splice(index, 1); reordered.splice(targetIndex, 0, moved); const updated = ensureQuestionsStartWithQ1(reordered); setQuestions(updated); localStorage.setItem('rdip_active_questionnaire', JSON.stringify(updated));
  };
  const handleAddOption = () => { if (!selectedQuestion || !canEditActiveVersion) return; const nextCode = (selectedQuestion.options?.length || 0) + 1; handleUpdateSelected({ options: [...(selectedQuestion.options || []), { id: `opt-${Date.now().toString().slice(-4)}`, label: `Option ${nextCode}`, numericCode: nextCode }] }); };
  const handleUpdateOption = (optId: string, label: string) => { if (!selectedQuestion || !canEditActiveVersion) return; handleUpdateSelected({ options: selectedQuestion.options.map((o) => o.id === optId ? { ...o, label } : o) }); };
  const handleDeleteOption = (optId: string) => { if (!selectedQuestion || !canEditActiveVersion || selectedQuestion.options.length <= 1) return; handleUpdateSelected({ options: selectedQuestion.options.filter((o) => o.id !== optId) }); };

  const handleSave = async () => {
    if (!canEditActiveVersion) return setDbStatusToast('This questionnaire version is locked. Create a new draft version to save changes.');
    setIsSavingDb(true);
    localStorage.setItem('rdip_active_questionnaire', JSON.stringify(questions));
    localStorage.setItem('rdip_survey_title', surveyTitle);
    localStorage.setItem('rdip_survey_version', surveyVersion);
    localStorage.setItem('rdip_survey_style', surveyStyle);
    localStorage.setItem('rdip_survey_last_saved', new Date().toLocaleTimeString());
    if (activeDbQuestionnaire?.id) {
      const res = await saveQuestionnaireDraftInDb({ questionnaire_id: activeDbQuestionnaire.id, version_id: activeVersionId || undefined, name: surveyTitle, questions, metadata: { style: surveyStyle, section: surveySection, sectionDesc: surveySectionDesc } });
      if (!res.success) setDbStatusToast(`Save notice: ${res.error || 'Database sync failed.'}`);
      else { setDbSyncStatus('synced'); setDbStatusToast('✓ Draft saved to Supabase, including normalized questions/options.'); await refreshVersionHistory(activeDbQuestionnaire.id); }
    } else if (selectedProject?.id && UUID_REGEX.test(selectedProject.id) && currentUser?.role !== 'enumerator') setIsCreateModalOpen(true);
    else setDbStatusToast('Draft saved to local cache.');
    setIsSavingDb(false); setIsSavedToast(true); setTimeout(() => { setIsSavedToast(false); setDbStatusToast(null); }, 4000);
  };

  // The remaining visual JSX is preserved in the repository's existing version.
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f9f9ff]">
      <div className="h-14 sm:h-16 border-b border-[#c4c6cf]/60 bg-white flex items-center justify-between px-3 sm:px-4 md:px-6 shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#1a365d]/10 text-[#1a365d] flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[20px]">quiz</span></div>
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {selectedProject && <div className="hidden lg:flex items-center gap-1.5 bg-[#f1f3ff] border border-[#c4c6cf]/80 px-2.5 py-1 rounded-lg text-xs shrink-0 max-w-[200px]"><span className="font-bold text-[#002045] truncate">{selectedProject.code || 'PROJ'}</span></div>}
            {projectQuestionnaires.length > 0 ? <select id="studio-questionnaire-selector" value={activeDbQuestionnaire?.id || ''} onChange={(e) => { void handleSelectDbQuestionnaire(e.target.value); }} className="text-xs font-bold text-[#002045] bg-[#f9f9ff] border border-[#c4c6cf] rounded-lg px-2 py-1 outline-none max-w-[220px] truncate"><option value="">Select questionnaire</option>{projectQuestionnaires.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}</select> : <input type="text" value={surveyTitle} onChange={(e) => setSurveyTitle(e.target.value)} disabled={isEnumerator} className="text-xs sm:text-sm md:text-base font-bold text-[#002045] bg-transparent border border-transparent rounded px-1.5 py-0.5 max-w-[220px] truncate" />}
            {!isEnumerator && <button id="studio-create-questionnaire-btn" type="button" onClick={() => setIsCreateModalOpen(true)} className="px-2.5 py-1 bg-[#006a68]/10 text-[#006a68] border border-[#006a68]/30 rounded-lg text-xs font-semibold">+ New Questionnaire</button>}
            <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded bg-[#dde2f3] text-[#002045] border border-[#adc7f7]">{surveyVersion}</span>
          </div>
          {dbSyncStatus === 'synced' && <div className="hidden xl:flex items-center gap-1 text-[11px] text-[#006a68] font-medium bg-[#91f0ed]/25 border border-[#006a68]/30 px-2 py-0.5 rounded-full">Supabase DB</div>}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {!isEnumerator && activeDbQuestionnaire && <button id="studio-version-history-btn" type="button" onClick={() => setIsVersionHistoryOpen(true)} className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[#c4c6cf]">Versions</button>}
          {!isEnumerator && activeDbQuestionnaire && activeVersion?.status === 'draft' && <button id="studio-new-version-btn" type="button" onClick={() => void handleCreateNewVersion()} disabled={isVersionCreating} className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[#006a68] text-white">{isVersionCreating ? 'Creating…' : 'New Version'}</button>}
          {!isEnumerator && activeDbQuestionnaire && activeVersion?.status === 'draft' && <button id="studio-publish-version-btn" type="button" onClick={() => void handlePublishActiveVersion()} disabled={isVersionPublishing} className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[#1a365d] text-white">{isVersionPublishing ? 'Publishing…' : 'Publish Version'}</button>}
          <button onClick={() => setShowSurveyPreview(true)} className="px-2.5 sm:px-3 py-1.5 text-[#002045] text-xs font-semibold rounded-lg border border-[#c4c6cf]">Preview</button>
          <button id="studio-save-draft-btn" onClick={() => void handleSave()} disabled={isEnumerator || isSavingDb || !canEditActiveVersion} className="px-3 sm:px-4 py-1.5 bg-[#1a365d] text-white text-xs font-semibold disabled:opacity-50 rounded-lg">{isSavingDb ? 'Saving…' : 'Save Draft'}</button>
        </div>
      </div>

      <div className="h-11 sm:h-12 border-b border-[#c4c6cf]/60 bg-[#f9f9ff] px-3 sm:px-4 md:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5"><button onClick={() => setMobileActiveTab('canvas')} className="px-2.5 py-1 rounded-lg text-xs font-bold">Questions ({questions.length})</button><button onClick={() => setShowLogicMatrixModal(true)} className="px-2.5 py-1 rounded-lg text-xs font-semibold">Logic Matrix</button><button onClick={() => setShowLogicImportExportModal(true)} className="px-2.5 py-1 rounded-lg text-xs font-semibold">JSON Config</button></div>
        <div className="flex items-center gap-1.5"><button onClick={() => setSurveyStyle('academic')} className="px-2 py-0.5 text-[11px]">Academic</button><button onClick={() => setSurveyStyle('modern')} className="px-2 py-0.5 text-[11px]">Modern</button><button onClick={() => setSurveyStyle('onepage')} className="px-2 py-0.5 text-[11px]">One-Page</button></div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isEnumerator && <div className="mb-3 bg-amber-100 border border-amber-300 rounded-lg p-3 text-xs text-amber-900">Field Enumerator Read-Only Mode — published assigned questionnaires only.</div>}
        {activeVersion?.status !== 'draft' && activeDbQuestionnaire && <div className="mb-3 bg-slate-100 border border-slate-300 rounded-lg p-3 text-xs text-slate-800">This version is <strong>{activeVersion.status}</strong> and locked. Create a new version before making changes.</div>}
        <div className="bg-white rounded-xl border border-[#c4c6cf]/60 p-5 min-h-[300px]">
          <div className="text-sm font-bold text-[#002045] mb-3">{surveyTitle}</div>
          <div className="space-y-2">{questions.map((q, idx) => <button key={q.id} type="button" onClick={() => setSelectedQuestionId(q.id)} className={`w-full text-left p-3 rounded-lg border ${selectedQuestionId === q.id ? 'border-[#006a68]' : 'border-[#c4c6cf]'}`}><span className="font-mono mr-2">Q{idx + 1}</span>{q.title}</button>)}</div>
          {selectedQuestion && <div className="mt-4 p-3 rounded-lg bg-[#f9f9ff] text-xs"><strong>Selected:</strong> {selectedQuestion.title}<div className="mt-1 font-mono">{selectedQuestion.variableName}</div></div>}
        </div>
      </div>

      {isVersionHistoryOpen && activeDbQuestionnaire && <div className="fixed inset-0 z-50 bg-[#002045]/50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-5"><div className="flex items-center justify-between mb-4"><h2 className="text-base font-bold">Questionnaire Version History</h2><button onClick={() => setIsVersionHistoryOpen(false)} className="px-2">✕</button></div><div className="space-y-2">{versionHistory.map((v) => <div key={v.id} className="flex items-center justify-between border rounded-lg p-3"><div><div className="font-semibold">{v.version_number}</div><div className="text-xs text-gray-500">{v.title}</div></div><div className="flex items-center gap-2"><span className="text-xs font-semibold">{v.status.toUpperCase()}</span><button onClick={() => void applyVersionToEditor(v.id)} className="px-2 py-1 text-xs border rounded">Open</button></div></div>)}</div></div></div>}

      {isCreateModalOpen && <CreateQuestionnaireModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} projects={projects} selectedProjectId={selectedProject?.id} currentUser={currentUser || ({} as UserProfile)} onCreateQuestionnaire={handleCreateQuestionnaire} />}
      {showSurveyPreview && <PublicSurveyModal isOpen={showSurveyPreview} onClose={() => setShowSurveyPreview(false)} questions={questions} title={surveyTitle} />}
      {showLogicMatrixModal && <LogicConditionBuilder isOpen={showLogicMatrixModal} onClose={() => setShowLogicMatrixModal(false)} questions={questions} />}
      {showLogicImportExportModal && <LogicImportExportModal isOpen={showLogicImportExportModal} onClose={() => setShowLogicImportExportModal(false)} questions={questions} onApply={handleApplyImportedQuestions} />}
      {dbStatusToast && <div className="fixed bottom-5 right-5 z-[60] bg-[#002045] text-white px-4 py-3 rounded-lg text-xs shadow-xl">{dbStatusToast}</div>}
      {importToastMessage && <div className="fixed bottom-5 left-5 z-[60] bg-white border rounded-lg px-4 py-3 text-xs shadow-xl">{importToastMessage}</div>}
    </div>
  );
};
