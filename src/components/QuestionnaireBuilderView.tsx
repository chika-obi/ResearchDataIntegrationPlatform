import React, { useState } from 'react';
import { Question, QuestionOption, DataType, MeasurementLevel, QuestionType, QuestionLogicRule } from '../types';
import { INITIAL_QUESTIONS } from '../data/mockData';
import { PublicSurveyModal } from './PublicSurveyModal';
import { LogicConditionBuilder } from './LogicConditionBuilder';
import { formatLogicExpression } from '../lib/surveyLogicEvaluator';

interface QuestionnaireBuilderViewProps {
  onOpenPreview?: () => void;
}

export const QuestionnaireBuilderView: React.FC<QuestionnaireBuilderViewProps> = () => {
  const [questions, setQuestions] = useState<Question[]>(() => {
    const saved = localStorage.getItem('rdip_active_questionnaire');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_QUESTIONS;
      }
    }
    return INITIAL_QUESTIONS;
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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedFieldLink, setCopiedFieldLink] = useState(false);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);

  const selectedQuestion = questions.find((q) => q.id === selectedQuestionId) || questions[0];

  const questionsWithLogicCount = questions.filter((q) => q.logicRule?.enabled && q.logicRule.branches.length > 0).length;

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
    withDefaultLogic = false
  ) => {
    const newId = `q-${Date.now().toString().slice(-5)}`;
    const newNum = `Q${questions.length + 1}`;
    const newVar = `${newNum}_Variable`;

    let defaultDataType: DataType = 'Categorical';
    let defaultMeasurement: MeasurementLevel = 'Nominal';

    if (type === 'number') {
      defaultDataType = 'Numerical';
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
      variableLabel: defaultTitle,
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
      linkedObjective: 'Objective 2: Evaluate socio-demographic disparities in healthcare accessibility',
      dataTypeConstraint: defaultDataType === 'Numerical' ? 'Numeric (Continuous)' : 'Categorical (Nominal)',
      validationRules: type === 'number' ? { min: 0, max: 100 } : undefined,
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

    const updated = [...questions, newQuestion];
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
    const updated = [...questions, dup];
    setQuestions(updated);
    setSelectedQuestionId(newId);
    localStorage.setItem('rdip_active_questionnaire', JSON.stringify(updated));
  };

  const handleDeleteQuestion = (id: string) => {
    if (questions.length <= 1) return;
    const updated = questions.filter((q) => q.id !== id);
    setQuestions(updated);
    if (selectedQuestionId === id) {
      setSelectedQuestionId(updated[0].id);
    }
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

  const handleSave = () => {
    localStorage.setItem('rdip_active_questionnaire', JSON.stringify(questions));
    localStorage.setItem('rdip_survey_title', surveyTitle);
    localStorage.setItem('rdip_survey_version', surveyVersion);
    localStorage.setItem('rdip_survey_style', surveyStyle);
    localStorage.setItem('rdip_survey_last_saved', new Date().toLocaleTimeString());
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 3000);
  };

  const handleCreateNewVersion = () => {
    const nextVer = `v${(parseFloat(surveyVersion.replace('v', '')) + 0.1).toFixed(1)} (Active)`;
    setSurveyVersion(nextVer);
    localStorage.setItem('rdip_survey_version', nextVer);
    localStorage.setItem('rdip_active_questionnaire', JSON.stringify(questions));
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-[#f9f9ff]">
      {/* Top Toolbar */}
      <div className="h-16 border-b border-[#c4c6cf]/60 bg-white flex items-center justify-between px-4 md:px-6 shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={surveyTitle}
            onChange={(e) => setSurveyTitle(e.target.value)}
            className="text-sm md:text-base font-bold text-[#002045] bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-[#1a365d] rounded px-1 max-w-xs md:max-w-md truncate"
          />

          <div className="flex items-center gap-1.5">
            <select
              value={surveyVersion}
              onChange={(e) => setSurveyVersion(e.target.value)}
              className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#dde2f3] text-[#002045] border border-[#adc7f7] outline-none"
            >
              <option value="v2.0 (Active)">v2.0 (Active)</option>
              <option value="v1.1 (Archive)">v1.1 (Archive)</option>
              <option value="v1.0 (Baseline)">v1.0 (Baseline)</option>
            </select>
            <button
              onClick={handleCreateNewVersion}
              className="text-[10px] text-[#1a365d] hover:underline font-bold px-1"
              title="Create new revision"
            >
              + Revise
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Appearance Style Selector */}
          <div className="hidden sm:flex items-center gap-1 bg-[#f1f3ff] p-1 rounded-lg border border-[#c4c6cf]/40 text-xs">
            <button
              onClick={() => setSurveyStyle('academic')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                surveyStyle === 'academic' ? 'bg-white text-[#002045] shadow-xs' : 'text-[#74777f]'
              }`}
            >
              Academic
            </button>
            <button
              onClick={() => setSurveyStyle('modern')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                surveyStyle === 'modern' ? 'bg-white text-[#002045] shadow-xs' : 'text-[#74777f]'
              }`}
            >
              Modern
            </button>
            <button
              onClick={() => setSurveyStyle('onepage')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                surveyStyle === 'onepage' ? 'bg-white text-[#002045] shadow-xs' : 'text-[#74777f]'
              }`}
            >
              One-Page
            </button>
          </div>

          <button
            onClick={() => setShowLogicMatrixModal(true)}
            className="px-3 py-1.5 bg-[#6b21a8]/10 text-[#6b21a8] border border-[#6b21a8]/30 hover:bg-[#6b21a8]/20 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            title="View full questionnaire branching logic flowchart"
          >
            <span className="material-symbols-outlined text-[18px]">alt_route</span>
            <span className="hidden md:inline">Logic Matrix</span>
            {questionsWithLogicCount > 0 && (
              <span className="bg-[#6b21a8] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {questionsWithLogicCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsShareModalOpen(true)}
            className="px-3.5 py-1.5 bg-[#006a68]/10 text-[#006a68] border border-[#006a68]/30 hover:bg-[#006a68]/20 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
            <span>Share & Enumerator Link</span>
          </button>

          <button
            onClick={() => setShowSurveyPreview(true)}
            className="px-3.5 py-1.5 text-[#002045] text-xs font-semibold hover:bg-[#f1f3ff] rounded-lg transition-colors flex items-center gap-1.5 border border-[#c4c6cf]"
          >
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            <span>Respondent Preview</span>
          </button>

          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-[#1a365d] text-white text-xs font-semibold hover:bg-[#002045] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            <span>Save & Deploy</span>
          </button>
        </div>
      </div>

      {/* Builder Workspace: 3 Columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Question Bank */}
        <div className="hidden lg:flex w-64 border-r border-[#c4c6cf]/60 bg-white flex-col shrink-0">
          <div className="p-4 border-b border-[#c4c6cf]/40">
            <h2 className="text-xs font-bold text-[#002045] uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#1a365d]">add_box</span>
              Question Bank
            </h2>
          </div>
          <div className="p-4 flex flex-col gap-2 overflow-y-auto">
            <p className="text-[11px] text-[#74777f] mb-1 font-medium">Add field type to survey canvas:</p>

            <button
              onClick={() => handleAddQuestion('multiple-choice', 'Select primary category')}
              className="p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#1a365d] transition-all flex items-center gap-2.5 text-left group"
            >
              <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] text-[18px]">
                radio_button_checked
              </span>
              <span className="text-xs font-semibold text-[#161c27]">Multiple Choice (Single)</span>
            </button>

            <button
              onClick={() => handleAddQuestion('checkboxes', 'Select all qualifying factors')}
              className="p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#1a365d] transition-all flex items-center gap-2.5 text-left group"
            >
              <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] text-[18px]">
                check_box
              </span>
              <span className="text-xs font-semibold text-[#161c27]">Checkboxes (Multi-select)</span>
            </button>

            <button
              onClick={() => handleAddQuestion('dropdown', 'Select from standardized list')}
              className="p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#1a365d] transition-all flex items-center gap-2.5 text-left group"
            >
              <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] text-[18px]">
                arrow_drop_down_circle
              </span>
              <span className="text-xs font-semibold text-[#161c27]">Dropdown Menu</span>
            </button>

            <button
              onClick={() => handleAddQuestion('likert', 'Rate level of agreement')}
              className="p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#1a365d] transition-all flex items-center gap-2.5 text-left group"
            >
              <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] text-[18px]">
                linear_scale
              </span>
              <span className="text-xs font-semibold text-[#161c27]">Likert Scale (3/5/7 pt)</span>
            </button>

            <button
              onClick={() => handleAddQuestion('number', 'Enter exact numeric count or measurement')}
              className="p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#1a365d] transition-all flex items-center gap-2.5 text-left group"
            >
              <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] text-[18px]">
                pin
              </span>
              <span className="text-xs font-semibold text-[#161c27]">Numeric / Ratio Input</span>
            </button>

            <button
              onClick={() => handleAddQuestion('short-text', 'Provide short single-line answer')}
              className="p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#1a365d] transition-all flex items-center gap-2.5 text-left group"
            >
              <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] text-[18px]">
                short_text
              </span>
              <span className="text-xs font-semibold text-[#161c27]">Short Text</span>
            </button>

            <button
              onClick={() => handleAddQuestion('paragraph', 'Provide detailed qualitative response')}
              className="p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#1a365d] transition-all flex items-center gap-2.5 text-left group"
            >
              <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] text-[18px]">
                subject
              </span>
              <span className="text-xs font-semibold text-[#161c27]">Paragraph / Narrative</span>
            </button>

            <button
              onClick={() => handleAddQuestion('date-time', 'Date and time of occurrence')}
              className="p-2.5 border border-[#c4c6cf]/60 rounded-xl bg-[#f9f9ff] hover:bg-[#f1f3ff] hover:border-[#1a365d] transition-all flex items-center gap-2.5 text-left group"
            >
              <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] text-[18px]">
                calendar_today
              </span>
              <span className="text-xs font-semibold text-[#161c27]">Date & Time</span>
            </button>

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
            </div>
          </div>
        </div>

        {/* Center Panel: Canvas */}
        <div className="flex-1 bg-[#f1f3ff]/50 overflow-y-auto p-4 md:p-6 lg:p-8">
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
                  </div>

                  {/* Active Question Actions Footer */}
                  {isActive && (
                    <div className="mt-5 pt-3 border-t border-[#c4c6cf]/40 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateQuestion(question.id);
                          }}
                          className="p-1.5 text-[#43474e] hover:text-[#002045] hover:bg-[#f1f3ff] rounded transition-colors"
                          title="Duplicate Question"
                        >
                          <span className="material-symbols-outlined text-[18px]">content_copy</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteQuestion(question.id);
                          }}
                          className="p-1.5 text-[#ba1a1a] hover:bg-[#ffdad6] rounded transition-colors"
                          title="Delete Question"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedQuestionId(question.id);
                            setInspectorTab('logic');
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
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

                      <div className="flex items-center gap-2">
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
        <div className="w-84 md:w-96 border-l border-[#c4c6cf]/60 bg-white flex flex-col shrink-0 overflow-y-auto">
          {/* Header & Tabs */}
          <div className="border-b border-[#c4c6cf]/40 bg-[#f9f9ff]">
            <div className="p-3.5 flex items-center justify-between border-b border-[#c4c6cf]/20">
              <h2 className="text-xs font-bold text-[#002045] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#1a365d]">tune</span>
                Inspector
              </h2>
              <span className="text-[10px] font-mono font-bold text-[#1a365d] bg-[#dde2f3] px-2 py-0.5 rounded">
                {selectedQuestion?.number}
              </span>
            </div>

            {/* Tab Selector */}
            <div className="grid grid-cols-3 p-1.5 gap-1 bg-[#f1f3ff] text-xs font-semibold">
              <button
                onClick={() => setInspectorTab('config')}
                className={`py-1.5 px-2 rounded-lg text-center transition-colors flex items-center justify-center gap-1 ${
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
                className={`py-1.5 px-2 rounded-lg text-center transition-colors flex items-center justify-center gap-1 relative ${
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
                className={`py-1.5 px-2 rounded-lg text-center transition-colors flex items-center justify-center gap-1 ${
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
                    </select>
                  </div>
                </div>

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
              <button
                onClick={() => setShowLogicMatrixModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
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
            <div className="p-4 bg-[#f9f9ff] border-t border-[#c4c6cf]/40 flex justify-between items-center shrink-0">
              <span className="text-[11px] text-[#43474e]">
                Logic rules are evaluated sequentially during runtime in both respondent and offline collector interfaces.
              </span>
              <button
                type="button"
                onClick={() => setShowLogicMatrixModal(false)}
                className="px-5 py-2 bg-[#1a365d] text-white rounded-lg font-semibold hover:bg-[#002045] cursor-pointer"
              >
                Close Matrix
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
