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
  createQuestionnaireInDb,
  saveQuestionnaireDraftInDb,
  CreateQuestionnaireParams,
} from '../lib/rdipDatabaseService';

export const ensureQuestionsStartWithQ1 = (items: Question[]): Question[] => {
  return items.map((q, idx) => ({
    ...q,
    number: `Q${idx + 1}`
  }));
};

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
        if (Array.isArray(parsed) && parsed.length > 0) {
          return ensureQuestionsStartWithQ1(parsed);
        }
      } catch {
        return ensureQuestionsStartWithQ1(INITIAL_QUESTIONS);
      }
    }
    return ensureQuestionsStartWithQ1(INITIAL_QUESTIONS);
  });

  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('q2');
  const [inspectorTab, setInspectorTab] = useState<'config' | 'logic' | 'metadata'>('config');

  const [surveyTitle, setSurveyTitle] = useState(() => {
    return localStorage.getItem('rdip_survey_title') || 'National Health Infrastructure Assessment Questionnaire';
  });

  const [surveyVersion, setSurveyVersion] = useState(() => {
    return localStorage.getItem('rdip_survey_version') || 'v2.0 (Active)';
  });

  const [surveyStyle, setSurveyStyle] = useState<'academic' | 'modern' | 'onepage'>('academic');
  const [surveySection, setSurveySection] = useState('Section A: Demographic Profile & Socio-Economic Status');
  const [surveySectionDesc, setSurveySectionDesc] = useState(
    'Please record verified information regarding the household head, education, and geographic facility access.'
  );
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

  // Supabase Database Integration State
  const [projectQuestionnaires, setProjectQuestionnaires] = useState<DbQuestionnaire[]>([]);
  const [activeDbQuestionnaire, setActiveDbQuestionnaire] = useState<DbQuestionnaire | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [dbSyncStatus, setDbSyncStatus] = useState<'synced' | 'local_only' | 'error'>('local_only');
  const [dbStatusToast, setDbStatusToast] = useState<string | null>(null);

  const selectedQuestion = questions.find((q) => q.id === selectedQuestionId) || questions[0];

  const questionsWithLogicCount = questions.filter((q) => q.logicRule?.enabled && q.logicRule.branches.length > 0).length;

  // Load questionnaires belonging to selected project from Supabase
  useEffect(() => {
    let isMounted = true;
    async function loadDbQuestionnaires() {
      if (!selectedProject?.id || !UUID_REGEX.test(selectedProject.id)) {
        setProjectQuestionnaires([]);
        setActiveDbQuestionnaire(null);
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
          setActiveVersionId(latest.current_version_id || latest.current_version?.id || null);

          const verNum = latest.current_version?.version_number || 'v1.0';
          const verStatus = latest.current_version?.status || 'draft';
          setSurveyVersion(`${verNum} (${verStatus.toUpperCase()})`);

          if (
            latest.current_version?.schema_definition?.questions &&
            Array.isArray(latest.current_version.schema_definition.questions) &&
            latest.current_version.schema_definition.questions.length > 0
          ) {
            const normalized = ensureQuestionsStartWithQ1(
              latest.current_version.schema_definition.questions
            );
            setQuestions(normalized);
            setSelectedQuestionId(normalized[0].id);
          }
          setDbSyncStatus('synced');
        } else {
          setActiveDbQuestionnaire(null);
          setDbSyncStatus('local_only');
        }
      } catch (err) {
        console.warn('[RDIP Studio] Supabase load notice:', err);
        if (isMounted) setDbSyncStatus('error');
      } finally {
        if (isMounted) setIsDbLoading(false);
      }
    }

    loadDbQuestionnaires();
    return () => {
      isMounted = false;
    };
  }, [selectedProject?.id]);

  const handleSelectDbQuestionnaire = (qId: string) => {
    const q = projectQuestionnaires.find((item) => item.id === qId);
    if (!q) return;

    setActiveDbQuestionnaire(q);
    setSurveyTitle(q.name);
    setActiveVersionId(q.current_version_id || q.current_version?.id || null);

    const verNum = q.current_version?.version_number || 'v1.0';
    const verStatus = q.current_version?.status || 'draft';
    setSurveyVersion(`${verNum} (${verStatus.toUpperCase()})`);

    if (
      q.current_version?.schema_definition?.questions &&
      Array.isArray(q.current_version.schema_definition.questions) &&
      q.current_version.schema_definition.questions.length > 0
    ) {
      const normalized = ensureQuestionsStartWithQ1(q.current_version.schema_definition.questions);
      setQuestions(normalized);
      setSelectedQuestionId(normalized[0].id);
    }
    setDbSyncStatus('synced');
  };

  const handleCreateQuestionnaire = async (params: CreateQuestionnaireParams) => {
    const result = await createQuestionnaireInDb(params);
    if (result.error || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to create questionnaire in Supabase.',
      };
    }

    const { questionnaire, version } = result.data;
    setProjectQuestionnaires((prev) => [questionnaire, ...prev]);
    setActiveDbQuestionnaire(questionnaire);
    setActiveVersionId(version.id);
    setSurveyTitle(questionnaire.name);
    setSurveyVersion(`${version.version_number} (DRAFT)`);

    if (
      version.schema_definition?.questions &&
      Array.isArray(version.schema_definition.questions) &&
      version.schema_definition.questions.length > 0
    ) {
      const normalized = ensureQuestionsStartWithQ1(version.schema_definition.questions);
      setQuestions(normalized);
      setSelectedQuestionId(normalized[0].id);
    }

    setDbSyncStatus('synced');
    setDbStatusToast(
      `Questionnaire "${questionnaire.name}" created in Supabase with draft version ${version.version_number}!`
    );
    setTimeout(() => setDbStatusToast(null), 4000);

    return {
      success: true,
      questionnaire,
      version,
    };
  };

  useEffect(() => {
    const handleTemplateLoaded = (event: Event) => {
      const customEvent = event as CustomEvent<Question[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        const normalized = ensureQuestionsStartWithQ1(customEvent.detail);
        setQuestions(normalized);
        if (normalized.length > 0) {
          setSelectedQuestionId(normalized[0].id);
        }
        const savedTitle = localStorage.getItem('rdip_survey_title');
        if (savedTitle) setSurveyTitle(savedTitle);
        const savedVer = localStorage.getItem('rdip_survey_version');
        if (savedVer) setSurveyVersion(savedVer);
      }
    };

    window.addEventListener('rdip_template_loaded', handleTemplateLoaded);
    return () => {
      window.removeEventListener('rdip_template_loaded', handleTemplateLoaded);
    };
  }, []);

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
    setQuestions((prev) => {
      const updated = prev.map((q) => (q.id === selectedQuestionId ? { ...q, ...updatedFields } : q));
      localStorage.setItem('rdip_active_questionnaire', JSON.stringify(updated));
      return updated;
    });
  };

  const handleAddQuestion = (
    type: QuestionType,
    defaultTitle = 'New Questionnaire Item',
    withDefaultLogic = false,
    customGpsConfig?: Partial<QuestionGpsConfig>
  ) => {
    const newId = `q-${Date.now().toString().slice(-5)}`;
    const nextIndex = questions.length + 1;
    const newNum = `Q${nextIndex}`;
    const isGeo = type === 'geolocation' || type === 'gps-coordinate';
    const newVar = isGeo ? `${newNum}_Geolocation_Coords` : `${newNum}_Variable`;

    let defaultDataType: DataType = 'Categorical';
    let defaultMeasurement: MeasurementLevel = 'Nominal';

    if (type === 'number') {
      defaultDataType = 'Numerical';
      defaultMeasurement = 'Ratio';
    } else if (isGeo) {
      defaultDataType = 'Continuous';
      defaultMeasurement = 'Ratio';
    } else if (type === 'likert') {
      defaultDataType = 'Ordinal';
      defaultMeasurement = 'Ordinal';
    } else if (type === 'paragraph' || type === 'short-text') {
      defaultDataType = 'Categorical';
      defaultMeasurement = 'Nominal';
    }

    const newQuestion: Question = {
      id: newId,
      number: newNum,
      title: defaultTitle,
      variableName: newVar,
      variableLabel: isGeo ? 'Geospatial Geolocation Coordinates (WGS84)' : defaultTitle,
      type,
      required: true,
      dataType: defaultDataType,
      measurementLevel: defaultMeasurement,
      options:
        type === 'multiple-choice' || type === 'checkboxes' || type === 'dropdown'
          ? [
              { id: 'opt-1', label: 'Option A', numericCode: 1 },
              { id: 'opt-2', label: 'Option B', numericCode: 2 },
              { id: 'opt-3', label: 'Option C', numericCode: 3 }
            ]
          : type === 'likert'
          ? [
              { id: 'opt-1', label: 'Strongly Disagree', numericCode: 1 },
              { id: 'opt-2', label: 'Disagree', numericCode: 2 },
              { id: 'opt-3', label: 'Neutral', numericCode: 3 },
              { id: 'opt-4', label: 'Agree', numericCode: 4 },
              { id: 'opt-5', label: 'Strongly Agree', numericCode: 5 }
            ]
          : [],
      linkedObjective: isGeo
        ? 'Objective 1: Assess emergency medical readiness and facility distribution'
        : 'Objective 2: Evaluate socio-demographic disparities in healthcare accessibility',
      dataTypeConstraint: isGeo
        ? 'Geospatial WGS84 (Lat, Lng, Alt, Acc)'
        : defaultDataType === 'Numerical'
        ? 'Numeric (Continuous)'
        : 'Categorical (Nominal)',
      validationRules: type === 'number' ? { min: 0, max: 100 } : isGeo ? { max: customGpsConfig?.accuracyThresholdMeters ?? 15 } : undefined,
      gpsConfig: isGeo ? {
        accuracyThresholdMeters: customGpsConfig?.accuracyThresholdMeters ?? 15,
        requireAltitude: customGpsConfig?.requireAltitude ?? true,
        allowManualEntry: customGpsConfig?.allowManualEntry ?? true,
        captureMode: customGpsConfig?.captureMode ?? 'point'
      } : undefined,
      logicRule: withDefaultLogic && questions.length > 0 ? {
        enabled: true,
        branches: [
          {
            id: `branch-${Date.now()}-if`,
            branchType: 'IF',
            matchType: 'ALL',
            clauses: [
              {
                id: `cl-${Date.now()}`,
                sourceVariable: questions[questions.length - 1].variableName,
                operator: 'is_not_empty',
                value: ''
              }
            ],
            action: 'show'
          },
          {
            id: `branch-${Date.now()}-else`,
            branchType: 'ELSE',
            clauses: [],
            action: 'hide'
          }
        ]
      } : undefined
    };

    const updated = ensureQuestionsStartWithQ1([...questions, newQuestion]);
    setQuestions(updated);
    setSelectedQuestionId(newId);
    if (withDefaultLogic) {
      setInspectorTab('logic');
    }
    localStorage.setItem('rdip_active_questionnaire', JSON.stringify(updated));
  };

  const handleDuplicateQuestion = (id: string) => {
    const target = questions.find((q) => q.id === id);
    if (!target) return;
    const newId = `q-${Date.now().toString().slice(-5)}`;
    const dup: Question = {
      ...target,
      id: newId,
      number: `Q${questions.length + 1}`,
      variableName: `${target.variableName}_Copy`,
      title: `${target.title} (Duplicate)`
    };
    const updated = ensureQuestionsStartWithQ1([...questions, dup]);
    setQuestions(updated);
    setSelectedQuestionId(newId);
    localStorage.setItem('rdip_active_questionnaire', JSON.stringify(updated));
  };

  const handleDeleteQuestion = (id: string) => {
    if (questions.length <= 1) return;
    const filtered = questions.filter((q) => q.id !== id);
    const updated = ensureQuestionsStartWithQ1(filtered);
    setQuestions(updated);
    if (selectedQuestionId === id) {
      setSelectedQuestionId(updated[0].id);
    }
    localStorage.setItem('rdip_active_questionnaire', JSON.stringify(updated));
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === questions.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...questions];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    const updated = ensureQuestionsStartWithQ1(reordered);
    setQuestions(updated);
    localStorage.setItem('rdip_active_questionnaire', JSON.stringify(updated));
  };

  const handleAddOption = () => {
    if (!selectedQuestion) return;
    const nextCode = (selectedQuestion.options?.length || 0) + 1;
    const newOption: QuestionOption = {
      id: `opt-${Date.now().toString().slice(-4)}`,
      label: `Option ${nextCode}`,
      numericCode: nextCode
    };
    handleUpdateSelected({
      options: [...(selectedQuestion.options || []), newOption]
    });
  };

  const handleUpdateOption = (optId: string, label: string) => {
    if (!selectedQuestion) return;
    const updated = selectedQuestion.options.map((o) => (o.id === optId ? { ...o, label } : o));
    handleUpdateSelected({ options: updated });
  };

  const handleDeleteOption = (optId: string) => {
    if (!selectedQuestion || selectedQuestion.options.length <= 1) return;
    const updated = selectedQuestion.options.filter((o) => o.id !== optId);
    handleUpdateSelected({ options: updated });
  };

  const handleSave = async () => {
    setIsSavingDb(true);

    // Save to local cache
    localStorage.setItem('rdip_active_questionnaire', JSON.stringify(questions));
    localStorage.setItem('rdip_survey_title', surveyTitle);
    localStorage.setItem('rdip_survey_version', surveyVersion);
    localStorage.setItem('rdip_survey_style', surveyStyle);
    localStorage.setItem('rdip_survey_last_saved', new Date().toLocaleTimeString());

    if (activeDbQuestionnaire?.id) {
      const res = await saveQuestionnaireDraftInDb({
        questionnaire_id: activeDbQuestionnaire.id,
        version_id: activeVersionId || undefined,
        name: surveyTitle,
        questions,
        metadata: {
          style: surveyStyle,
          section: surveySection,
          sectionDesc: surveySectionDesc,
        },
      });

      if (!res.success) {
        setDbStatusToast(`Save notice: ${res.error || 'Saved locally; database sync failed.'}`);
      } else {
        setDbSyncStatus('synced');
        setDbStatusToast('✓ Authoritative draft version saved to Supabase (public.questionnaires & questionnaire_versions)!');
      }
    } else if (selectedProject?.id && UUID_REGEX.test(selectedProject.id) && currentUser?.role !== 'enumerator') {
      setIsCreateModalOpen(true);
    } else {
      setDbStatusToast('Draft saved to local cache. (Connect to a Supabase project to persist to cloud database)');
    }

    setIsSavingDb(false);
    setIsSavedToast(true);
    setTimeout(() => {
      setIsSavedToast(false);
      setDbStatusToast(null);
    }, 4000);
  };

  const handleCreateNewVersion = () => {
    const nextVer = `v${(parseFloat(surveyVersion.replace('v', '')) + 0.1).toFixed(1)} (Active)`;
    setSurveyVersion(nextVer);
    localStorage.setItem('rdip_survey_version', nextVer);
    localStorage.setItem('rdip_active_questionnaire', JSON.stringify(questions));
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 3000);
  };

  const isEnumerator = currentUser?.role === 'enumerator';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f9f9ff]">
      {/* Field Enumerator Read-Only Banner */}
      {isEnumerator && (
        <div className="bg-amber-100/90 border-b border-amber-300 px-4 py-2 text-amber-900 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-amber-700">
              admin_panel_settings
            </span>
            <span className="font-semibold">Field Enumerator Read-Only Mode:</span>
            <span>
              Under RDIP database policies, questionnaire authoring and version publishing are restricted to Researchers.
            </span>
          </div>
          <span className="text-[11px] font-mono bg-white/70 px-2 py-0.5 rounded border border-amber-300">
            RLS Enforcement Active
          </span>
        </div>
      )}

      {/* Primary Studio Header Bar */}
      <div className="h-14 sm:h-16 border-b border-[#c4c6cf]/60 bg-white flex items-center justify-between px-3 sm:px-4 md:px-6 shrink-0 z-20 shadow-xs">
        {/* Left: Survey Identity, Title, Project Context and Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#1a365d]/10 text-[#1a365d] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">quiz</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {/* Project Context Pill */}
            {selectedProject && (
              <div
                className="hidden lg:flex items-center gap-1.5 bg-[#f1f3ff] border border-[#c4c6cf]/80 px-2.5 py-1 rounded-lg text-xs shrink-0 max-w-[200px]"
                title={`Parent Research Project: ${selectedProject.title}`}
              >
                <span className="material-symbols-outlined text-[15px] text-[#1a365d]">folder</span>
                <span className="font-bold text-[#002045] truncate">
                  {selectedProject.projectCode || 'PROJ'}
                </span>
              </div>
            )}

            {/* Supabase Questionnaire Switcher / Input */}
            {projectQuestionnaires.length > 0 ? (
              <div className="flex items-center gap-1 shrink-0">
                <select
                  id="studio-questionnaire-selector"
                  value={activeDbQuestionnaire?.id || ''}
                  onChange={(e) => handleSelectDbQuestionnaire(e.target.value)}
                  className="text-xs font-bold text-[#002045] bg-[#f9f9ff] border border-[#c4c6cf] hover:border-[#1a365d] rounded-lg px-2 py-1 outline-none max-w-[200px] truncate cursor-pointer"
                  title="Switch between Supabase questionnaires in this project"
                >
                  {projectQuestionnaires.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name} ({q.current_version?.version_number || 'v1.0'})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input
                type="text"
                value={surveyTitle}
                onChange={(e) => setSurveyTitle(e.target.value)}
                disabled={isEnumerator}
                title="Click to edit questionnaire title"
                className="text-xs sm:text-sm md:text-base font-bold text-[#002045] bg-transparent border border-transparent hover:border-[#c4c6cf] focus:border-[#1a365d] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1a365d] rounded px-1.5 py-0.5 min-w-[110px] max-w-[150px] sm:max-w-[200px] md:max-w-xs truncate transition-all"
              />
            )}

            {/* "+ New Questionnaire" Action Button */}
            {!isEnumerator && (
              <button
                id="studio-create-questionnaire-btn"
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-2.5 py-1 bg-[#006a68]/10 text-[#006a68] hover:bg-[#006a68]/20 border border-[#006a68]/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                title="Create a new questionnaire in Supabase PostgreSQL"
              >
                <span className="material-symbols-outlined text-[15px]">add_circle</span>
                <span className="hidden sm:inline">+ New Questionnaire</span>
                <span className="sm:hidden">+ New</span>
              </button>
            )}

            {/* Version Badge */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded bg-[#dde2f3] text-[#002045] border border-[#adc7f7]">
                {surveyVersion}
              </span>
            </div>
          </div>

          {/* Database Synchronization Status Badge */}
          {dbSyncStatus === 'synced' ? (
            <div className="hidden xl:flex items-center gap-1 text-[11px] text-[#006a68] font-medium bg-[#91f0ed]/25 border border-[#006a68]/30 px-2 py-0.5 rounded-full shrink-0">
              <span className="material-symbols-outlined text-[13px]">cloud_done</span>
              <span>Supabase DB (Draft)</span>
            </div>
          ) : (
            <div className="hidden xl:flex items-center gap-1 text-[11px] text-amber-800 font-medium bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full shrink-0">
              <span className="material-symbols-outlined text-[13px]">cloud_off</span>
              <span>Local Draft</span>
            </div>
          )}
        </div>

        {/* Right: Primary Quick Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="px-2.5 sm:px-3 py-1.5 bg-[#006a68]/10 text-[#006a68] border border-[#006a68]/30 hover:bg-[#006a68]/20 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
            title="Generate field enumerator and web survey links"
          >
            <span className="material-symbols-outlined text-[17px]">share</span>
            <span className="hidden md:inline">Share</span>
          </button>

          <button
            onClick={() => setShowSurveyPreview(true)}
            className="px-2.5 sm:px-3 py-1.5 text-[#002045] text-xs font-semibold hover:bg-[#f1f3ff] rounded-lg transition-colors flex items-center gap-1.5 border border-[#c4c6cf] shrink-0 whitespace-nowrap cursor-pointer"
            title="Preview survey as respondent"
          >
            <span className="material-symbols-outlined text-[17px]">visibility</span>
            <span className="hidden sm:inline">Preview</span>
          </button>

          <button
            id="studio-save-draft-btn"
            onClick={handleSave}
            disabled={isEnumerator || isSavingDb}
            className="px-3 sm:px-4 py-1.5 bg-[#1a365d] text-white text-xs font-semibold hover:bg-[#002045] disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs shrink-0 whitespace-nowrap active:scale-95 cursor-pointer"
            title={activeDbQuestionnaire ? 'Save draft changes to Supabase' : 'Save draft locally / to project'}
          >
            <span className={`material-symbols-outlined text-[17px] ${isSavingDb ? 'animate-spin' : ''}`}>
              {isSavingDb ? 'refresh' : 'save'}
            </span>
            <span>{isSavingDb ? 'Saving to DB...' : 'Save Draft'}</span>
          </button>
        </div>
      </div>

      {/* Studio Sub-Navigation Ribbon (Dedicated Section Views & Presets) */}
      <div className="h-11 sm:h-12 border-b border-[#c4c6cf]/60 bg-[#f9f9ff] px-3 sm:px-4 md:px-6 flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-10 select-none overflow-x-auto no-scrollbar">
        {/* Left: View Tabs */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            onClick={() => setMobileActiveTab('canvas')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              mobileActiveTab === 'canvas'
                ? 'bg-white text-[#002045] shadow-xs border border-[#c4c6cf]/60'
                : 'text-[#43474e] hover:bg-[#f1f3ff]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] text-[#1a365d]">format_list_bulleted</span>
            <span>Questions</span>
            <span className="bg-[#dde2f3] text-[#002045] text-[10px] font-bold px-1.5 py-0.2 rounded-full font-mono">
              {questions.length}
            </span>
          </button>

          <button
            onClick={() => setShowLogicMatrixModal(true)}
            className="px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap text-[#6b21a8] bg-[#6b21a8]/10 hover:bg-[#6b21a8]/20 border border-[#6b21a8]/30 cursor-pointer"
            title="Open complete branching logic flowchart matrix"
          >
            <span className="material-symbols-outlined text-[16px]">alt_route</span>
            <span>Logic Matrix</span>
            {questionsWithLogicCount > 0 && (
              <span className="bg-[#6b21a8] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full font-mono">
                {questionsWithLogicCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowLogicImportExportModal(true)}
            className="px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap text-[#006a68] bg-[#006a68]/10 hover:bg-[#006a68]/20 border border-[#006a68]/30 cursor-pointer"
            title="Import or export questionnaire logic definition as JSON"
          >
            <span className="material-symbols-outlined text-[16px]">sync_alt</span>
            <span className="hidden sm:inline">JSON Config</span>
            <span className="sm:hidden">JSON</span>
          </button>
        </div>

        {/* Right: Layout Preset & Responsive Panel Switchers */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Appearance Style Selector */}
          <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-[#c4c6cf]/60 text-xs shadow-xs shrink-0">
            <button
              onClick={() => setSurveyStyle('academic')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                surveyStyle === 'academic' ? 'bg-[#1a365d] text-white shadow-xs' : 'text-[#43474e] hover:text-[#002045]'
              }`}
              title="Academic Standard layout"
            >
              Academic
            </button>
            <button
              onClick={() => setSurveyStyle('modern')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                surveyStyle === 'modern' ? 'bg-[#1a365d] text-white shadow-xs' : 'text-[#43474e] hover:text-[#002045]'
              }`}
              title="Modern Clean layout"
            >
              Modern
            </button>
            <button
              onClick={() => setSurveyStyle('onepage')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                surveyStyle === 'onepage' ? 'bg-[#1a365d] text-white shadow-xs' : 'text-[#43474e] hover:text-[#002045]'
              }`}
              title="One-Page compact layout"
            >
              One-Page
            </button>
          </div>

          {/* Desktop Panel Toggles */}
          <div className="hidden lg:flex items-center gap-1 border-l border-[#c4c6cf]/60 pl-2 shrink-0">
            <button
              onClick={() => setIsQuestionBankOpen(!isQuestionBankOpen)}
              className={`p-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                isQuestionBankOpen
                  ? 'bg-[#dde2f3] text-[#002045]'
                  : 'text-[#74777f] hover:bg-[#f1f3ff]'
              }`}
              title={isQuestionBankOpen ? 'Collapse Question Bank' : 'Expand Question Bank'}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isQuestionBankOpen ? 'left_panel_close' : 'left_panel_open'}
              </span>
            </button>

            <button
              onClick={() => setIsInspectorOpen(!isInspectorOpen)}
              className={`p-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                isInspectorOpen
                  ? 'bg-[#dde2f3] text-[#002045]'
                  : 'text-[#74777f] hover:bg-[#f1f3ff]'
              }`}
              title={isInspectorOpen ? 'Collapse Inspector' : 'Expand Inspector'}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isInspectorOpen ? 'right_panel_close' : 'right_panel_open'}
              </span>
            </button>
          </div>

          {/* Mobile View Switcher */}
          <div className="flex lg:hidden items-center gap-0.5 bg-white p-0.5 rounded-lg border border-[#c4c6cf]/60 text-[11px] font-semibold shadow-xs shrink-0">
            <button
              onClick={() => setMobileActiveTab('bank')}
              className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                mobileActiveTab === 'bank' ? 'bg-[#1a365d] text-white' : 'text-[#43474e]'
              }`}
            >
              + Add
            </button>
            <button
              onClick={() => setMobileActiveTab('canvas')}
              className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                mobileActiveTab === 'canvas' ? 'bg-[#1a365d] text-white' : 'text-[#43474e]'
              }`}
            >
              Canvas
            </button>
            <button
              onClick={() => setMobileActiveTab('inspector')}
              className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                mobileActiveTab === 'inspector' ? 'bg-[#1a365d] text-white' : 'text-[#43474e]'
              }`}
            >
              Inspect
            </button>
          </div>
        </div>
      </div>

      {/* Builder Workspace: Multi-Column Responsive Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Panel: Question Bank */}
        <div
          className={`${
            mobileActiveTab === 'bank'
              ? 'flex w-full absolute inset-0 bg-white z-20'
              : isQuestionBankOpen
              ? 'hidden lg:flex w-64'
              : 'hidden'
          } border-r border-[#c4c6cf]/60 bg-white flex-col shrink-0 overflow-y-auto transition-all duration-200`}
        >
          <div className="p-3.5 border-b border-[#c4c6cf]/40 flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#002045] uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#1a365d]">add_box</span>
              Question Bank
            </h2>
            {/* Mobile Done button */}
            <button
              onClick={() => setMobileActiveTab('canvas')}
              className="lg:hidden text-xs text-[#1a365d] font-semibold hover:underline flex items-center gap-0.5"
            >
              <span>Back to Canvas</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
          <div className="p-4 flex flex-col gap-2 overflow-y-auto">
            {/* Question Bank Search */}
            <div className="relative mb-1">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#74777f] text-[15px]">
                search
              </span>
              <input
                type="text"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                placeholder="Search types (e.g. location, GPS)..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#f9f9ff] border border-[#c4c6cf]/80 rounded-lg focus:border-[#1a365d] focus:bg-white outline-none"
              />
              {bankSearch && (
                <button
                  onClick={() => setBankSearch('')}
                  className="absolute right-2 top-2 text-[#74777f] hover:text-[#002045]"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>

            {/* Geospatial & Coordinates Category */}
            {(!bankSearch ||
              'geospatial coordinates location gps geolocation latitude longitude elevation mapping site facility'
                .toLowerCase()
                .includes(bankSearch.toLowerCase().trim())) && (
              <div className="pt-1 pb-2 border-b border-[#c4c6cf]/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#006a68] tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-[#006a68]">pin_drop</span>
                    Geospatial & Geolocation
                  </span>
                  <span className="bg-[#006a68]/15 text-[#006a68] text-[9px] font-bold px-1.5 py-0.2 rounded-full font-mono">
                    WGS84 GPS
                  </span>
                </div>

                <button
                  onClick={() =>
                    handleAddQuestion(
                      'geolocation',
                      'Capture current device geolocation coordinates (Latitude, Longitude, Altitude, Accuracy) with live visual map',
                      false,
                      { captureMode: 'point', accuracyThresholdMeters: 15, requireAltitude: true, allowManualEntry: true }
                    )
                  }
                  className="w-full p-2.5 border border-[#006a68]/40 rounded-xl bg-[#006a68]/5 hover:bg-[#006a68]/10 hover:border-[#006a68] transition-all flex items-start gap-2.5 text-left group cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#006a68]/20 text-[#006a68] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[18px]">my_location</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[#002045] flex items-center justify-between">
                      <span>Geolocation API Capture</span>
                      <span className="text-[9px] bg-[#006a68]/20 text-[#006a68] px-1 rounded font-mono">LIVE API</span>
                    </div>
                    <p className="text-[10px] text-[#43474e] mt-0.5 leading-tight">
                      Real-time device GNSS coordinates with interactive map & radar visualizer.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() =>
                    handleAddQuestion(
                      'geolocation',
                      'Record verified geolocation pin coordinates of the surveyed healthcare facility or site entrance',
                      false,
                      { captureMode: 'facility', accuracyThresholdMeters: 10, requireAltitude: true, allowManualEntry: true }
                    )
                  }
                  className="w-full p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#006a68] transition-all flex items-start gap-2.5 text-left group cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#002045]/10 text-[#002045] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[18px]">apartment</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#161c27]">Facility / Site Geolocation</div>
                    <p className="text-[10px] text-[#74777f] mt-0.5 leading-tight">
                      Clinic, hospital, school, or waterpoint GPS pin.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() =>
                    handleAddQuestion(
                      'geolocation',
                      'Record spatial geolocation coordinates for surveyed household dwelling unit',
                      false,
                      { captureMode: 'boundary', accuracyThresholdMeters: 20, requireAltitude: false, allowManualEntry: true }
                    )
                  }
                  className="w-full p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#006a68] transition-all flex items-start gap-2.5 text-left group cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#002045]/10 text-[#002045] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[18px]">cottage</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#161c27]">Household / Plot Geotag</div>
                    <p className="text-[10px] text-[#74777f] mt-0.5 leading-tight">
                      Dwelling unit or enumeration cluster spatial pin.
                    </p>
                  </div>
                </button>
              </div>
            )}

            <p className="text-[11px] text-[#74777f] mb-1 font-medium">Standard question field types:</p>

            {(!bankSearch || 'geolocation gps location coordinates map'.includes(bankSearch.toLowerCase())) && (
              <button
                onClick={() =>
                  handleAddQuestion(
                    'geolocation',
                    'Record current geolocation coordinates',
                    false,
                    { captureMode: 'point', accuracyThresholdMeters: 15, requireAltitude: true, allowManualEntry: true }
                  )
                }
                className="p-2.5 border border-[#006a68]/40 rounded-xl bg-[#006a68]/5 hover:bg-[#006a68]/10 hover:border-[#006a68] transition-all flex items-center gap-2.5 text-left group cursor-pointer"
              >
                <span className="material-symbols-outlined text-[#006a68] group-hover:text-[#002045] text-[18px]">
                  pin_drop
                </span>
                <span className="text-xs font-bold text-[#002045]">Geolocation (GPS & Map)</span>
              </button>
            )}

            {(!bankSearch || 'multiple choice single radio select'.includes(bankSearch.toLowerCase())) && (
              <button
                onClick={() => handleAddQuestion('multiple-choice', 'Select primary category')}
                className="p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#1a365d] transition-all flex items-center gap-2.5 text-left group cursor-pointer"
              >
                <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] text-[18px]">
                  radio_button_checked
                </span>
                <span className="text-xs font-semibold text-[#161c27]">Multiple Choice (Single)</span>
              </button>
            )}

            {(!bankSearch || 'checkboxes multi-select factors'.includes(bankSearch.toLowerCase())) && (
              <button
                onClick={() => handleAddQuestion('checkboxes', 'Select all qualifying factors')}
                className="p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#1a365d] transition-all flex items-center gap-2.5 text-left group cursor-pointer"
              >
                <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] text-[18px]">
                  check_box
                </span>
                <span className="text-xs font-semibold text-[#161c27]">Checkboxes (Multi-select)</span>
              </button>
            )}

            {(!bankSearch || 'dropdown menu select list'.includes(bankSearch.toLowerCase())) && (
              <button
                onClick={() => handleAddQuestion('dropdown', 'Select from standardized list')}
                className="p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#1a365d] transition-all flex items-center gap-2.5 text-left group cursor-pointer"
              >
                <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] text-[18px]">
                  arrow_drop_down_circle
                </span>
                <span className="text-xs font-semibold text-[#161c27]">Dropdown Menu</span>
              </button>
            )}

            {(!bankSearch || 'likert scale agreement rating'.includes(bankSearch.toLowerCase())) && (
              <button
                onClick={() => handleAddQuestion('likert', 'Rate level of agreement')}
                className="p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#1a365d] transition-all flex items-center gap-2.5 text-left group cursor-pointer"
              >
                <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] text-[18px]">
                  linear_scale
                </span>
                <span className="text-xs font-semibold text-[#161c27]">Likert Scale (3/5/7 pt)</span>
              </button>
            )}

            {(!bankSearch || 'numeric ratio number count measure measurement'.includes(bankSearch.toLowerCase())) && (
              <button
                onClick={() => handleAddQuestion('number', 'Enter exact numeric count or measurement')}
                className="p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#1a365d] transition-all flex items-center gap-2.5 text-left group cursor-pointer"
              >
                <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] text-[18px]">
                  pin
                </span>
                <span className="text-xs font-semibold text-[#161c27]">Numeric / Ratio Input</span>
              </button>
            )}

            {(!bankSearch || 'short text single line string'.includes(bankSearch.toLowerCase())) && (
              <button
                onClick={() => handleAddQuestion('short-text', 'Provide short single-line answer')}
                className="p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#1a365d] transition-all flex items-center gap-2.5 text-left group cursor-pointer"
              >
                <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] text-[18px]">
                  short_text
                </span>
                <span className="text-xs font-semibold text-[#161c27]">Short Text</span>
              </button>
            )}

            {(!bankSearch || 'paragraph narrative text area qualitative'.includes(bankSearch.toLowerCase())) && (
              <button
                onClick={() => handleAddQuestion('paragraph', 'Provide detailed qualitative response')}
                className="p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#1a365d] transition-all flex items-center gap-2.5 text-left group cursor-pointer"
              >
                <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] text-[18px]">
                  subject
                </span>
                <span className="text-xs font-semibold text-[#161c27]">Paragraph / Narrative</span>
              </button>
            )}

            {(!bankSearch || 'date time calendar clock timestamp'.includes(bankSearch.toLowerCase())) && (
              <button
                onClick={() => handleAddQuestion('date-time', 'Date and time of occurrence')}
                className="p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#1a365d] transition-all flex items-center gap-2.5 text-left group cursor-pointer"
              >
                <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] text-[18px]">
                  calendar_today
                </span>
                <span className="text-xs font-semibold text-[#161c27]">Date & Time</span>
              </button>
            )}

            {/* Logical Conditions & Branching Category in Bank */}
            <div className="pt-3 mt-2 border-t border-[#c4c6cf]/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-[#6b21a8] tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">alt_route</span>
                  Flow & Logic Engine
                </span>
                {questionsWithLogicCount > 0 && (
                  <span className="bg-[#6b21a8]/15 text-[#6b21a8] text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                    {questionsWithLogicCount} Active
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  setInspectorTab('logic');
                }}
                className="w-full p-2.5 border border-[#6b21a8]/40 rounded-xl bg-[#6b21a8]/5 hover:bg-[#6b21a8]/10 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-[#6b21a8]">
                  <span className="material-symbols-outlined text-[18px]">rule</span>
                  <span>IF-THEN-ELSE Condition</span>
                </div>
                <p className="text-[10px] text-[#43474e] mt-1">
                  Configure branching for {selectedQuestion?.number || 'selected item'}
                </p>
              </button>

              <button
                onClick={() => handleAddQuestion('multiple-choice', 'Conditional Follow-up Item', true)}
                className="w-full p-2 border border-dashed border-[#6b21a8]/60 rounded-lg text-left hover:bg-[#f1f3ff] transition-colors flex items-center gap-2 text-xs text-[#002045]"
              >
                <span className="material-symbols-outlined text-[16px] text-[#6b21a8]">add</span>
                <span className="font-semibold text-[11px]">+ Append Branched Question</span>
              </button>

              <button
                onClick={() => setShowLogicImportExportModal(true)}
                className="w-full p-2 bg-[#006a68]/5 hover:bg-[#006a68]/15 text-[#006a68] border border-[#006a68]/30 rounded-lg text-left transition-colors flex items-center justify-between text-xs cursor-pointer"
                title="Export or upload logic flow JSON definition"
              >
                <span className="flex items-center gap-1.5 font-bold text-[11px]">
                  <span className="material-symbols-outlined text-[15px]">sync_alt</span>
                  <span>JSON Flow Config</span>
                </span>
                <span className="text-[10px] bg-[#006a68]/10 text-[#006a68] px-1.5 py-0.5 rounded font-mono">
                  Export / Import
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Center Panel: Canvas */}
        <div
          className={`${
            mobileActiveTab === 'canvas' ? 'flex' : 'hidden lg:flex'
          } flex-1 min-w-0 bg-[#f1f3ff]/50 overflow-y-auto p-3 sm:p-5 md:p-6 lg:p-8`}
        >
          <div className="max-w-3xl mx-auto flex flex-col gap-4 pb-28">
            {/* Section Header */}
            <div className="bg-white p-6 rounded-xl card-shadow border-t-4 border-[#002045] border border-[#c4c6cf]/40">
              <input
                type="text"
                value={surveySection}
                onChange={(e) => setSurveySection(e.target.value)}
                placeholder="Section Title"
                className="w-full text-base md:text-lg font-bold text-[#002045] bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-[#1a365d] rounded p-1 mb-2"
              />
              <textarea
                value={surveySectionDesc}
                onChange={(e) => setSurveySectionDesc(e.target.value)}
                rows={2}
                placeholder="Section Description..."
                className="w-full text-xs text-[#43474e] bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-[#1a365d] rounded p-1 resize-none"
              />
            </div>

            {/* Questions List */}
            {questions.map((question, index) => {
              const isActive = question.id === selectedQuestionId;
              const hasActiveLogic = question.logicRule?.enabled && question.logicRule.branches.length > 0;

              return (
                <div
                  key={question.id}
                  onClick={() => setSelectedQuestionId(question.id)}
                  className={`bg-white p-6 rounded-xl card-shadow transition-all relative cursor-pointer border ${
                    isActive
                      ? 'border-2 border-[#1a365d] shadow-md ring-2 ring-[#1a365d]/10'
                      : 'border-[#c4c6cf]/50 hover:border-[#74777f]'
                  }`}
                >
                  {/* Item Order Index */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#002045] bg-[#d6e3ff] px-2.5 py-1 rounded font-mono">
                        {question.number}
                      </span>
                      <div>
                        <p className="text-sm md:text-base font-bold text-[#161c27]">
                          {question.title}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-[#74777f] font-mono mt-0.5">
                          <span>Var: {question.variableName}</span>
                          <span>•</span>
                          <span className="text-[#1a365d] font-semibold">{question.dataType || 'Categorical'} ({question.measurementLevel || 'Nominal'})</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {hasActiveLogic && (
                        <span className="text-[10px] bg-[#6b21a8]/15 text-[#6b21a8] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">alt_route</span>
                          Logic Active
                        </span>
                      )}
                      {question.required && (
                        <span className="text-[10px] bg-[#ba1a1a]/10 text-[#ba1a1a] font-bold px-2 py-0.5 rounded">
                          Required
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Logic Expression Badge if active */}
                  {hasActiveLogic && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedQuestionId(question.id);
                        setInspectorTab('logic');
                      }}
                      className="my-2.5 p-2 bg-[#fdf4ff] border border-[#d8b4fe] rounded-lg flex items-center justify-between text-[11px] text-[#6b21a8] hover:bg-[#fae8ff] transition-colors cursor-pointer"
                      title="Click to edit IF/ELIF/ELSE logic rules"
                    >
                      <div className="flex items-center gap-1.5 font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                        <span className="material-symbols-outlined text-[16px] shrink-0 text-[#7e22ce]">rule</span>
                        <span className="font-bold shrink-0">CONDITION:</span>
                        <span className="text-[#3b0764] truncate">{formatLogicExpression(question.logicRule)}</span>
                      </div>
                      <span className="text-[10px] font-bold text-[#7e22ce] hover:underline shrink-0 ml-2">
                        Edit Logic →
                      </span>
                    </div>
                  )}

                  {/* Question Content preview based on type */}
                  <div className="pl-6 md:pl-8 space-y-2 mt-3">
                    {question.type === 'number' && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          disabled
                          placeholder="Numeric value (e.g., 34)"
                          className="w-48 border border-[#c4c6cf] bg-[#f9f9ff] text-xs rounded-lg h-9 px-3 text-[#74777f] cursor-not-allowed font-mono"
                        />
                        {question.validationRules && (
                          <span className="text-[11px] text-[#74777f]">
                            Range: [{question.validationRules.min ?? 0} - {question.validationRules.max ?? '∞'}]
                          </span>
                        )}
                      </div>
                    )}

                    {question.type === 'short-text' && (
                      <input
                        type="text"
                        disabled
                        placeholder="Short text response..."
                        className="w-full max-w-sm border border-[#c4c6cf] bg-[#f9f9ff] text-xs rounded-lg h-9 px-3 text-[#74777f] cursor-not-allowed"
                      />
                    )}

                    {question.type === 'paragraph' && (
                      <textarea
                        disabled
                        rows={2}
                        placeholder="Long narrative response..."
                        className="w-full border border-[#c4c6cf] bg-[#f9f9ff] text-xs rounded-lg p-2 text-[#74777f] cursor-not-allowed resize-none"
                      />
                    )}

                    {question.type === 'dropdown' && (
                      <select disabled className="w-64 border border-[#c4c6cf] bg-[#f9f9ff] text-xs rounded-lg h-9 px-2 text-[#74777f]">
                        <option>Select an option...</option>
                        {question.options.map((opt) => (
                          <option key={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    )}

                    {(question.type === 'multiple-choice' || question.type === 'checkboxes') && (
                      <div className="flex flex-col gap-2">
                        {question.options.map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2.5 text-xs text-[#161c27]">
                            <span className="material-symbols-outlined text-[#74777f] text-[18px]">
                              {question.type === 'checkboxes' ? 'check_box_outline_blank' : 'radio_button_unchecked'}
                            </span>
                            <span>{opt.label}</span>
                            {opt.numericCode !== undefined && (
                              <span className="text-[10px] text-[#74777f] font-mono">[{opt.numericCode}]</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {question.type === 'likert' && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {question.options.map((opt) => (
                          <div
                            key={opt.id}
                            className="px-3 py-1.5 rounded-lg border border-[#c4c6cf] bg-[#f9f9ff] text-xs text-[#002045] font-medium"
                          >
                            {opt.label}
                          </div>
                        ))}
                      </div>
                    )}

                    {question.type === 'date-time' && (
                      <div className="flex items-center gap-2 text-xs text-[#74777f] bg-[#f9f9ff] border border-[#c4c6cf] p-2 rounded-lg max-w-xs">
                        <span className="material-symbols-outlined text-sm">calendar_today</span>
                        <span>YYYY-MM-DD (ISO 8601)</span>
                      </div>
                    )}

                    {(question.type === 'geolocation' || question.type === 'gps-coordinate') && (
                      <GeolocationFieldRenderer
                        question={question}
                        isReadOnly={false}
                        autoCapture={false}
                      />
                    )}
                  </div>

                  {/* Active Question Actions Footer */}
                  {isActive && (
                    <div className="mt-5 pt-3 border-t border-[#c4c6cf]/40 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveQuestion(index, 'up');
                          }}
                          disabled={index === 0}
                          className="p-1.5 text-[#43474e] hover:text-[#002045] hover:bg-[#f1f3ff] rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                          title="Move Question Up"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveQuestion(index, 'down');
                          }}
                          disabled={index === questions.length - 1}
                          className="p-1.5 text-[#43474e] hover:text-[#002045] hover:bg-[#f1f3ff] rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                          title="Move Question Down"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateQuestion(question.id);
                          }}
                          className="p-1.5 text-[#43474e] hover:text-[#002045] hover:bg-[#f1f3ff] rounded transition-colors cursor-pointer shrink-0"
                          title="Duplicate Question"
                        >
                          <span className="material-symbols-outlined text-[18px]">content_copy</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteQuestion(question.id);
                          }}
                          className="p-1.5 text-[#ba1a1a] hover:bg-[#ffdad6] rounded transition-colors cursor-pointer shrink-0"
                          title="Delete Question"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedQuestionId(question.id);
                            setInspectorTab('logic');
                            setMobileActiveTab('inspector');
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                            hasActiveLogic
                              ? 'bg-[#6b21a8]/15 text-[#6b21a8] hover:bg-[#6b21a8]/25'
                              : 'text-[#43474e] hover:bg-[#f1f3ff] border border-[#c4c6cf]/60'
                          }`}
                          title="Configure conditional visibility and skip logic"
                        >
                          <span className="material-symbols-outlined text-[16px]">alt_route</span>
                          <span>{hasActiveLogic ? 'Edit Logic' : '+ Add IF-ELSE'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-[#43474e] font-medium">Mandatory</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateSelected({ required: !question.required });
                          }}
                          className={`w-9 h-5 rounded-full transition-colors relative ${
                            question.required ? 'bg-[#1a365d]' : 'bg-[#c4c6cf]'
                          }`}
                        >
                          <div
                            className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${
                              question.required ? 'right-1' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Append Question */}
            <div
              onClick={() => handleAddQuestion('multiple-choice')}
              className="border-2 border-dashed border-[#c4c6cf] rounded-xl p-8 flex flex-col items-center justify-center text-[#74777f] gap-2 bg-white/50 hover:bg-white hover:border-[#1a365d] transition-all cursor-pointer group"
            >
              <span className="material-symbols-outlined text-[28px] group-hover:text-[#1a365d] transition-colors">
                add_circle
              </span>
              <span className="text-xs font-semibold">Click to append new question to this module</span>
            </div>
          </div>
        </div>

        {/* Right Panel: Properties Inspector */}
        <div
          className={`${
            mobileActiveTab === 'inspector'
              ? 'flex w-full absolute inset-0 bg-white z-20'
              : isInspectorOpen
              ? 'hidden lg:flex w-80 md:w-96'
              : 'hidden'
          } border-l border-[#c4c6cf]/60 bg-white flex-col shrink-0 overflow-y-auto transition-all duration-200`}
        >
          {/* Header & Tabs */}
          <div className="border-b border-[#c4c6cf]/40 bg-[#f9f9ff]">
            <div className="p-3.5 flex items-center justify-between border-b border-[#c4c6cf]/20">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setMobileActiveTab('canvas')}
                  className="lg:hidden p-1 -ml-1 text-[#002045] hover:bg-[#dde2f3] rounded transition-colors mr-1"
                  title="Return to canvas"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                </button>
                <h2 className="text-xs font-bold text-[#002045] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#1a365d]">tune</span>
                  Inspector
                </h2>
              </div>
              <span className="text-[10px] font-mono font-bold text-[#1a365d] bg-[#dde2f3] px-2 py-0.5 rounded">
                {selectedQuestion?.number}
              </span>
            </div>

            {/* Tab Selector */}
            <div className="grid grid-cols-3 p-1.5 gap-1 bg-[#f1f3ff] text-xs font-semibold">
              <button
                onClick={() => setInspectorTab('config')}
                className={`py-1.5 px-1.5 rounded-lg text-center transition-colors flex items-center justify-center gap-1 whitespace-nowrap text-[11px] sm:text-xs ${
                  inspectorTab === 'config'
                    ? 'bg-white text-[#002045] shadow-xs'
                    : 'text-[#43474e] hover:text-[#002045]'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">settings</span>
                <span>Config</span>
              </button>

              <button
                onClick={() => setInspectorTab('logic')}
                className={`py-1.5 px-1.5 rounded-lg text-center transition-colors flex items-center justify-center gap-1 whitespace-nowrap text-[11px] sm:text-xs relative ${
                  inspectorTab === 'logic'
                    ? 'bg-white text-[#6b21a8] font-bold shadow-xs'
                    : 'text-[#43474e] hover:text-[#6b21a8]'
                }`}
              >
                <span className="material-symbols-outlined text-[14px] text-[#6b21a8]">alt_route</span>
                <span>Logic</span>
                {selectedQuestion?.logicRule?.enabled && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6b21a8] animate-pulse" />
                )}
              </button>

              <button
                onClick={() => setInspectorTab('metadata')}
                className={`py-1.5 px-1.5 rounded-lg text-center transition-colors flex items-center justify-center gap-1 whitespace-nowrap text-[11px] sm:text-xs ${
                  inspectorTab === 'metadata'
                    ? 'bg-white text-[#002045] shadow-xs'
                    : 'text-[#43474e] hover:text-[#002045]'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">analytics</span>
                <span>Metadata</span>
              </button>
            </div>
          </div>

          <div className="p-4 space-y-6">
            {/* TAB 1: Item Config */}
            {inspectorTab === 'config' && (
              <div className="space-y-5">
                {/* Basic Setup */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[#002045] border-b border-[#c4c6cf]/30 pb-1.5 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-[#1a365d]">edit_note</span>
                    Question Setup
                  </h3>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#43474e] mb-1">
                      Question Prompt Text
                    </label>
                    <textarea
                      rows={3}
                      value={selectedQuestion?.title || ''}
                      onChange={(e) => handleUpdateSelected({ title: e.target.value })}
                      className="w-full p-2 text-xs border border-[#c4c6cf] rounded-lg focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#43474e] mb-1">
                      Variable Name (SPSS / R Export)
                    </label>
                    <input
                      type="text"
                      value={selectedQuestion?.variableName || ''}
                      onChange={(e) => handleUpdateSelected({ variableName: e.target.value })}
                      className="w-full p-2 text-xs font-mono border border-[#c4c6cf] rounded-lg focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#43474e] mb-1">
                      Question Type
                    </label>
                    <select
                      value={selectedQuestion?.type || 'multiple-choice'}
                      onChange={(e) => handleUpdateSelected({ type: e.target.value as any })}
                      className="w-full p-2 text-xs border border-[#c4c6cf] rounded-lg focus:border-[#1a365d] outline-none bg-white"
                    >
                      <option value="multiple-choice">Multiple Choice (Single)</option>
                      <option value="checkboxes">Checkboxes (Multi-select)</option>
                      <option value="dropdown">Dropdown Selection</option>
                      <option value="likert">Likert Scale</option>
                      <option value="number">Numeric / Continuous</option>
                      <option value="short-text">Short Text</option>
                      <option value="paragraph">Paragraph Narrative</option>
                      <option value="date-time">Date & Time</option>
                      <option value="geolocation">Geolocation (GPS & Map)</option>
                      <option value="gps-coordinate">GPS Coordinates</option>
                    </select>
                  </div>
                </div>

                {/* GPS / Geospatial Settings */}
                {(selectedQuestion?.type === 'geolocation' || selectedQuestion?.type === 'gps-coordinate') && (
                  <div className="space-y-3 pt-2 border-t border-[#c4c6cf]/30">
                    <div className="flex items-center justify-between pb-1">
                      <h3 className="text-xs font-bold text-[#002045] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-[#006a68]">pin_drop</span>
                        Geospatial & GPS Settings
                      </h3>
                      <span className="text-[10px] bg-[#006a68]/10 text-[#006a68] font-mono font-bold px-1.5 py-0.5 rounded">
                        WGS84
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#43474e] mb-1">
                        Spatial Capture Mode
                      </label>
                      <select
                        value={selectedQuestion.gpsConfig?.captureMode || 'point'}
                        onChange={(e) =>
                          handleUpdateSelected({
                            gpsConfig: {
                              ...(selectedQuestion.gpsConfig || {}),
                              captureMode: e.target.value as any
                            }
                          })
                        }
                        className="w-full p-2 text-xs border border-[#c4c6cf] rounded-lg focus:border-[#1a365d] outline-none bg-white"
                      >
                        <option value="point">Single GPS Point (Coordinates & Geostamp)</option>
                        <option value="facility">Health Facility / Site Geolocation Pin</option>
                        <option value="boundary">Household / Plot Boundary Geotag</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#43474e] mb-1">
                        Required Accuracy Threshold (Meters)
                      </label>
                      <select
                        value={selectedQuestion.gpsConfig?.accuracyThresholdMeters || 15}
                        onChange={(e) =>
                          handleUpdateSelected({
                            gpsConfig: {
                              ...(selectedQuestion.gpsConfig || {}),
                              accuracyThresholdMeters: Number(e.target.value)
                            },
                            validationRules: {
                              ...(selectedQuestion.validationRules || {}),
                              max: Number(e.target.value)
                            }
                          })
                        }
                        className="w-full p-2 text-xs border border-[#c4c6cf] rounded-lg focus:border-[#1a365d] outline-none bg-white"
                      >
                        <option value={5}>&lt; 5m (High Precision - Survey Grade)</option>
                        <option value={10}>&lt; 10m (Recommended Field Protocol)</option>
                        <option value={15}>&lt; 15m (Standard Mobile GNSS)</option>
                        <option value={25}>&lt; 25m (Permissive / Tree Canopy)</option>
                        <option value={50}>&lt; 50m (Rural / Low Satellite Lock)</option>
                      </select>
                      <p className="text-[10px] text-[#74777f] mt-1">
                        Enumerator app will warn or reject if GNSS accuracy error exceeds this limit.
                      </p>
                    </div>

                    <div className="space-y-2 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-[#161c27]">
                        <input
                          type="checkbox"
                          checked={selectedQuestion.gpsConfig?.requireAltitude !== false}
                          onChange={(e) =>
                            handleUpdateSelected({
                              gpsConfig: {
                                ...(selectedQuestion.gpsConfig || {}),
                                requireAltitude: e.target.checked
                              }
                            })
                          }
                          className="w-4 h-4 text-[#006a68] rounded border-[#c4c6cf]"
                        />
                        <span>Record Altitude / Elevation above sea level</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-xs text-[#161c27]">
                        <input
                          type="checkbox"
                          checked={selectedQuestion.gpsConfig?.allowManualEntry !== false}
                          onChange={(e) =>
                            handleUpdateSelected({
                              gpsConfig: {
                                ...(selectedQuestion.gpsConfig || {}),
                                allowManualEntry: e.target.checked
                              }
                            })
                          }
                          className="w-4 h-4 text-[#006a68] rounded border-[#c4c6cf]"
                        />
                        <span>Allow Manual Lat/Lng Fallback (indoors / sensor failure)</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Response Options */}
                {(selectedQuestion?.type === 'multiple-choice' ||
                  selectedQuestion?.type === 'checkboxes' ||
                  selectedQuestion?.type === 'dropdown' ||
                  selectedQuestion?.type === 'likert') && (
                  <div className="space-y-3 pt-2 border-t border-[#c4c6cf]/30">
                    <div className="flex items-center justify-between pb-1.5">
                      <h3 className="text-xs font-bold text-[#002045]">Response Options</h3>
                      <button
                        onClick={handleAddOption}
                        className="text-[11px] font-bold text-[#1a365d] hover:underline"
                      >
                        + Add Option
                      </button>
                    </div>

                    <div className="space-y-2">
                      {selectedQuestion.options.map((opt) => (
                        <div key={opt.id} className="flex items-center gap-1.5 group">
                          <span className="material-symbols-outlined text-[14px] text-[#74777f] cursor-grab">
                            drag_indicator
                          </span>
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) => handleUpdateOption(opt.id, e.target.value)}
                            className="flex-1 p-1.5 text-xs border border-[#c4c6cf] rounded focus:border-[#1a365d] outline-none"
                          />
                          <button
                            onClick={() => handleDeleteOption(opt.id)}
                            className="text-[#74777f] hover:text-[#ba1a1a] p-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: IF-THEN-ELSE Logic Condition Builder */}
            {inspectorTab === 'logic' && (
              <div>
                <LogicConditionBuilder
                  currentQuestion={selectedQuestion}
                  allQuestions={questions}
                  onUpdateLogic={(updatedLogic) => handleUpdateSelected({ logicRule: updatedLogic })}
                  onOpenLogicManager={() => setShowLogicImportExportModal(true)}
                />
              </div>
            )}

            {/* TAB 3: Statistical Metadata */}
            {inspectorTab === 'metadata' && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[#002045] border-b border-[#c4c6cf]/30 pb-1.5">
                    Statistical Metadata & Objective Link
                  </h3>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#43474e] mb-1">
                      Variable Description / Label
                    </label>
                    <input
                      type="text"
                      value={selectedQuestion?.variableLabel || ''}
                      onChange={(e) => handleUpdateSelected({ variableLabel: e.target.value })}
                      placeholder="Descriptive label for data dictionary"
                      className="w-full p-2 text-xs border border-[#c4c6cf] rounded-lg focus:border-[#1a365d] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#43474e] mb-1">
                      Link to Research Objective
                    </label>
                    <select
                      value={selectedQuestion?.linkedObjective || 'Objective 1: Assess emergency medical readiness and facility distribution'}
                      onChange={(e) => handleUpdateSelected({ linkedObjective: e.target.value })}
                      className="w-full p-2 text-xs border border-[#c4c6cf] rounded-lg focus:border-[#1a365d] outline-none bg-white"
                    >
                      <option value="Objective 1: Assess emergency medical readiness and facility distribution">
                        Objective 1: Emergency Readiness
                      </option>
                      <option value="Objective 2: Evaluate socio-demographic disparities in healthcare accessibility">
                        Objective 2: Socio-Demographic Disparities
                      </option>
                      <option value="Objective 3: Determine supply chain resiliency and stockout frequencies">
                        Objective 3: Supply Chain Resiliency
                      </option>
                      <option value="Objective 4: Model predictors of maternal and infant primary care satisfaction">
                        Objective 4: Patient Satisfaction Model
                      </option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#43474e] mb-1">
                        Data Type
                      </label>
                      <select
                        value={selectedQuestion?.dataType || 'Categorical'}
                        onChange={(e) => handleUpdateSelected({ dataType: e.target.value as DataType })}
                        className="w-full p-2 text-xs border border-[#c4c6cf] rounded-lg focus:border-[#1a365d] outline-none bg-white"
                      >
                        <option value="Categorical">Categorical</option>
                        <option value="Numerical">Numerical</option>
                        <option value="Ordinal">Ordinal</option>
                        <option value="Continuous">Continuous</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#43474e] mb-1">
                        Measurement Level
                      </label>
                      <select
                        value={selectedQuestion?.measurementLevel || 'Nominal'}
                        onChange={(e) => handleUpdateSelected({ measurementLevel: e.target.value as MeasurementLevel })}
                        className="w-full p-2 text-xs border border-[#c4c6cf] rounded-lg focus:border-[#1a365d] outline-none bg-white"
                      >
                        <option value="Nominal">Nominal</option>
                        <option value="Ordinal">Ordinal</option>
                        <option value="Interval">Interval</option>
                        <option value="Ratio">Ratio</option>
                      </select>
                    </div>
                  </div>

                  {selectedQuestion?.type === 'number' && (
                    <div className="p-3 bg-[#f1f3ff] rounded-xl border border-[#c4c6cf]/50 space-y-2">
                      <span className="text-[11px] font-bold text-[#002045]">Numeric Boundaries</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-[#43474e]">Minimum</label>
                          <input
                            type="number"
                            value={selectedQuestion.validationRules?.min ?? 0}
                            onChange={(e) =>
                              handleUpdateSelected({
                                validationRules: {
                                  ...selectedQuestion.validationRules,
                                  min: Number(e.target.value)
                                }
                              })
                            }
                            className="w-full p-1.5 text-xs bg-white border border-[#c4c6cf] rounded font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#43474e]">Maximum</label>
                          <input
                            type="number"
                            value={selectedQuestion.validationRules?.max ?? 100}
                            onChange={(e) =>
                              handleUpdateSelected({
                                validationRules: {
                                  ...selectedQuestion.validationRules,
                                  max: Number(e.target.value)
                                }
                              })
                            }
                            className="w-full p-1.5 text-xs bg-white border border-[#c4c6cf] rounded font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Toast */}
      {isSavedToast && (
        <div className="fixed bottom-6 right-6 z-[110] bg-[#002045] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 border border-[#91f0ed]/30">
          <span className="material-symbols-outlined text-[#91f0ed] text-[20px]">cloud_done</span>
          <div className="text-xs">
            <span className="font-bold block text-white">Questionnaire {surveyVersion} Saved & Deployed!</span>
            <span className="text-[#c4c6cf] text-[11px]">Enumerators will automatically receive these questions on their next sync or login.</span>
          </div>
        </div>
      )}

      {/* Public Survey Preview Modal */}
      <PublicSurveyModal
        isOpen={showSurveyPreview}
        onClose={() => setShowSurveyPreview(false)}
        questions={questions}
        surveyTitle={surveyTitle}
      />

      {/* Share & Field Dispatch Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#161c27]/50 backdrop-blur-xs"
            onClick={() => setIsShareModalOpen(false)}
          />
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-[#c4c6cf]/40 animate-in zoom-in-95 space-y-0">
            {/* Modal Header */}
            <div className="bg-[#1a365d] text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                  <span className="material-symbols-outlined text-xl text-[#91f0ed]">share</span>
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">Survey Links & Field Dispatch</h2>
                  <p className="text-xs text-white/80">{surveyTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Option 1: Enumerator Offline Field Link */}
              <div className="p-4 bg-[#f1f3ff] rounded-xl border border-[#c4c6cf]/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#006a68] text-[20px]">tablet_mac</span>
                    <span className="font-bold text-[#002045] text-sm">1. Field Enumerator Offline Link (PWA)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#006a68]/15 text-[#006a68]">
                    For Field Staff
                  </span>
                </div>
                <p className="text-[11px] text-[#43474e]">
                  Give this link to your enumerators in the field. Works offline, records battery & GPS, and syncs encrypted batches to Supabase.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/?mode=field&qnr=QNR-2024-001`}
                    className="flex-1 p-2 font-mono text-[11px] bg-white border border-[#c4c6cf] rounded-lg text-[#002045] select-all outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/?mode=field&qnr=QNR-2024-001`);
                      setCopiedFieldLink(true);
                      setTimeout(() => setCopiedFieldLink(false), 2500);
                    }}
                    className={`px-3.5 py-2 rounded-lg font-semibold flex items-center gap-1 shrink-0 transition-colors ${
                      copiedFieldLink ? 'bg-[#006a68] text-white' : 'bg-[#1a365d] hover:bg-[#002045] text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {copiedFieldLink ? 'done' : 'content_copy'}
                    </span>
                    <span>{copiedFieldLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Option 2: Public Respondent Link */}
              <div className="p-4 bg-[#f9f9ff] rounded-xl border border-[#c4c6cf]/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#1a365d] text-[20px]">public</span>
                    <span className="font-bold text-[#002045] text-sm">2. Public Respondent Web Survey</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#dde2f3] text-[#1a365d]">
                    Web Survey
                  </span>
                </div>
                <p className="text-[11px] text-[#43474e]">
                  Direct browser link for self-administered online surveys (email invitations, social links, or public participants).
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/?survey=QNR-2024-001`}
                    className="flex-1 p-2 font-mono text-[11px] bg-white border border-[#c4c6cf] rounded-lg text-[#002045] select-all outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/?survey=QNR-2024-001`);
                      setCopiedPublicLink(true);
                      setTimeout(() => setCopiedPublicLink(false), 2500);
                    }}
                    className={`px-3.5 py-2 rounded-lg font-semibold flex items-center gap-1 shrink-0 transition-colors ${
                      copiedPublicLink ? 'bg-[#006a68] text-white' : 'bg-white border border-[#c4c6cf] hover:border-[#1a365d] text-[#1a365d]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {copiedPublicLink ? 'done' : 'content_copy'}
                    </span>
                    <span>{copiedPublicLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* QR Code Quick Scan */}
              <div className="flex items-center gap-4 p-3 bg-white border border-[#c4c6cf]/40 rounded-xl">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&margin=2&data=${encodeURIComponent(
                    `${window.location.origin}/?mode=field&qnr=QNR-2024-001`
                  )}`}
                  alt="Enumerator Field QR"
                  className="w-16 h-16 object-contain rounded border border-[#1a365d]/20 shrink-0"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-[#002045] block text-xs">Scan & Open on Phone/Tablet</span>
                  <p className="text-[11px] text-[#43474e]">
                    Open your mobile camera to test the field collector offline view immediately.
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <div className="pt-2 border-t border-[#c4c6cf]/40 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="px-5 py-2 bg-[#1a365d] text-white rounded-lg font-semibold hover:bg-[#002045]"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logic Flow Matrix & Branching Map Modal */}
      {showLogicMatrixModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#161c27]/60 backdrop-blur-xs"
            onClick={() => setShowLogicMatrixModal(false)}
          />
          <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-[#c4c6cf]/40 animate-in zoom-in-95 flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="bg-[#4c1d95] text-white p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                  <span className="material-symbols-outlined text-2xl text-[#d8b4fe]">alt_route</span>
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">Survey Branching & Flow Logic Matrix</h2>
                  <p className="text-xs text-white/80">Complete IF-THEN-ELSE execution graph for {surveyTitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowLogicMatrixModal(false);
                    setShowLogicImportExportModal(true);
                  }}
                  className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-white/20"
                  title="Export logic flow or upload logic JSON definition"
                >
                  <span className="material-symbols-outlined text-[16px]">sync_alt</span>
                  <span>Export / Import JSON</span>
                </button>
                <button
                  onClick={() => setShowLogicMatrixModal(false)}
                  className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              <div className="flex items-center justify-between bg-[#fdf4ff] p-3 rounded-xl border border-[#d8b4fe]/60">
                <div className="flex items-center gap-2 text-[#581c87]">
                  <span className="material-symbols-outlined text-[20px]">info</span>
                  <span className="font-semibold text-xs">
                    {questionsWithLogicCount} of {questions.length} questions have conditional IF-THEN-ELSE execution branches.
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[#7e22ce] bg-white px-2 py-0.5 rounded border border-[#d8b4fe]">
                  Deterministic Evaluation
                </span>
              </div>

              {/* Table of all questions and their logic rules */}
              <div className="border border-[#c4c6cf]/60 rounded-xl overflow-hidden bg-white shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f1f3ff] text-[#002045] font-bold border-b border-[#c4c6cf]/60">
                      <th className="p-3 w-16">Item</th>
                      <th className="p-3 w-48">Variable & Prompt</th>
                      <th className="p-3 w-32">Status</th>
                      <th className="p-3">Logical Expression (IF-ELIF-ELSE)</th>
                      <th className="p-3 w-24 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#c4c6cf]/40">
                    {questions.map((q) => {
                      const hasLogic = q.logicRule?.enabled && q.logicRule.branches.length > 0;
                      return (
                        <tr
                          key={q.id}
                          className={`hover:bg-[#f9f9ff] transition-colors ${
                            q.id === selectedQuestionId ? 'bg-[#f5f3ff]' : ''
                          }`}
                        >
                          <td className="p-3 font-mono font-bold text-[#1a365d] align-top">
                            {q.number}
                          </td>
                          <td className="p-3 align-top">
                            <div className="font-mono font-bold text-[#002045]">{q.variableName}</div>
                            <div className="text-[11px] text-[#43474e] line-clamp-1 mt-0.5">{q.title}</div>
                          </td>
                          <td className="p-3 align-top">
                            {hasLogic ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#6b21a8]/15 text-[#6b21a8] inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#6b21a8]"></span>
                                Conditional
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#e2e8f0] text-[#64748b]">
                                Always Visible
                              </span>
                            )}
                          </td>
                          <td className="p-3 align-top">
                            {hasLogic ? (
                              <div className="font-mono text-[11px] text-[#4c1d95] bg-[#faf5ff] p-2 rounded border border-[#e9d5ff] space-y-1">
                                {q.logicRule?.branches.map((b, bIdx) => (
                                  <div key={b.id} className="flex items-start gap-1">
                                    <span className="font-bold text-[#7e22ce] shrink-0">
                                      {b.branchType}
                                    </span>
                                    {b.clauses.length > 0 ? (
                                      <span className="text-[#3b0764]">
                                        ({b.clauses.map(c => `${c.sourceVariable} ${c.operator} ${c.value ?? ''}`).join(` ${b.matchType} `)})
                                      </span>
                                    ) : null}
                                    <span className="font-bold text-[#1a365d] shrink-0">
                                      → {b.action.toUpperCase()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[#74777f] text-[11px] italic">
                                Rendered sequentially without branch gate.
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right align-top">
                            <button
                              onClick={() => {
                                setSelectedQuestionId(q.id);
                                setInspectorTab('logic');
                                setShowLogicMatrixModal(false);
                              }}
                              className="px-2.5 py-1 bg-[#6b21a8] hover:bg-[#581c87] text-white rounded font-semibold text-[11px] transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#f9f9ff] border-t border-[#c4c6cf]/40 flex flex-wrap gap-2 justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    downloadLogicFlowJSON(questions, surveyTitle);
                  }}
                  className="px-3 py-1.5 bg-[#4c1d95]/10 hover:bg-[#4c1d95]/20 text-[#4c1d95] border border-[#4c1d95]/30 rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">file_download</span>
                  <span>Quick Export JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogicMatrixModal(false);
                    setShowLogicImportExportModal(true);
                  }}
                  className="px-3 py-1.5 bg-[#006a68]/10 hover:bg-[#006a68]/20 text-[#006a68] border border-[#006a68]/30 rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">file_upload</span>
                  <span>Import Logic JSON</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowLogicMatrixModal(false)}
                className="px-5 py-2 bg-[#1a365d] text-white rounded-lg font-semibold hover:bg-[#002045] cursor-pointer text-xs"
              >
                Close Matrix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logic Flow JSON Export & Import Modal */}
      <LogicImportExportModal
        isOpen={showLogicImportExportModal}
        onClose={() => setShowLogicImportExportModal(false)}
        questions={questions}
        surveyTitle={surveyTitle}
        onApplyImportedQuestions={handleApplyImportedQuestions}
      />

      {/* Supabase Authoritative Questionnaire Creation Modal */}
      <CreateQuestionnaireModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        projects={projects}
        selectedProjectId={selectedProject?.id}
        currentUser={
          currentUser || {
            id: 'anon-researcher',
            name: 'Researcher',
            email: 'researcher@rdip.org',
            role: 'researcher',
            institution: 'Research Lab',
          }
        }
        onCreateQuestionnaire={handleCreateQuestionnaire}
      />

      {/* Database Operation Notification Toast */}
      {dbStatusToast && (
        <div
          id="rdip-db-status-toast"
          className="fixed bottom-6 left-6 z-[140] bg-[#002045] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-[#91f0ed]/30 animate-in slide-in-from-bottom-5"
        >
          <span className="material-symbols-outlined text-[#91f0ed] text-[20px]">cloud_sync</span>
          <span className="text-xs font-semibold">{dbStatusToast}</span>
          <button
            type="button"
            onClick={() => setDbStatusToast(null)}
            className="text-white/60 hover:text-white ml-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Toast Notification for Logic Import & Actions */}
      {importToastMessage && (
        <div className="fixed bottom-6 right-6 z-[140] bg-[#002045] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-white/20 animate-in slide-in-from-bottom-5">
          <span className="material-symbols-outlined text-[#34d399] text-[20px]">task_alt</span>
          <span className="text-xs font-semibold">{importToastMessage}</span>
          <button
            onClick={() => setImportToastMessage(null)}
            className="text-white/60 hover:text-white ml-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
};
