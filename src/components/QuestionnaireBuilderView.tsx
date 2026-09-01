import React, { useState } from 'react';
import { Question, QuestionOption, DataType, MeasurementLevel, QuestionType } from '../types';
import { INITIAL_QUESTIONS } from '../data/mockData';
import { PublicSurveyModal } from './PublicSurveyModal';

interface QuestionnaireBuilderViewProps {
  onOpenPreview?: () => void;
}

export const QuestionnaireBuilderView: React.FC<QuestionnaireBuilderViewProps> = () => {
  const [questions, setQuestions] = useState<Question[]>(INITIAL_QUESTIONS);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('q2');
  const [surveyTitle, setSurveyTitle] = useState('National Health Infrastructure Assessment Questionnaire');
  const [surveyVersion, setSurveyVersion] = useState('v2.0 (Active)');
  const [surveyStyle, setSurveyStyle] = useState<'academic' | 'modern' | 'onepage'>('academic');
  const [surveySection, setSurveySection] = useState('Section A: Demographic Profile & Socio-Economic Status');
  const [surveySectionDesc, setSurveySectionDesc] = useState(
    'Please record verified information regarding the household head, education, and geographic facility access.'
  );
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [showSurveyPreview, setShowSurveyPreview] = useState(false);

  const selectedQuestion = questions.find((q) => q.id === selectedQuestionId) || questions[0];

  const handleUpdateSelected = (updatedFields: Partial<Question>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === selectedQuestionId ? { ...q, ...updatedFields } : q))
    );
  };

  const handleAddQuestion = (
    type: QuestionType,
    defaultTitle = 'New Questionnaire Item'
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
      validationRules: type === 'number' ? { min: 0, max: 100 } : undefined
    };

    setQuestions([...questions, newQuestion]);
    setSelectedQuestionId(newId);
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
    setQuestions([...questions, dup]);
    setSelectedQuestionId(newId);
  };

  const handleDeleteQuestion = (id: string) => {
    if (questions.length <= 1) return;
    const updated = questions.filter((q) => q.id !== id);
    setQuestions(updated);
    if (selectedQuestionId === id) {
      setSelectedQuestionId(updated[0].id);
    }
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
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 2500);
  };

  const handleCreateNewVersion = () => {
    const nextVer = `v${(parseFloat(surveyVersion.replace('v', '')) + 0.1).toFixed(1)}`;
    setSurveyVersion(nextVer);
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 2500);
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
                  <div className="flex items-start justify-between gap-3 mb-3">
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

                    <div className="flex items-center gap-1">
                      {question.required && (
                        <span className="text-[10px] bg-[#ba1a1a]/10 text-[#ba1a1a] font-bold px-2 py-0.5 rounded">
                          Required
                        </span>
                      )}
                    </div>
                  </div>

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
        <div className="w-80 border-l border-[#c4c6cf]/60 bg-white flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-[#c4c6cf]/40 bg-[#f9f9ff] flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#002045] uppercase tracking-wider">
              Properties Inspector
            </h2>
            <span className="text-[10px] font-mono font-bold text-[#1a365d] bg-[#dde2f3] px-2 py-0.5 rounded">
              {selectedQuestion?.number}
            </span>
          </div>

          <div className="p-4 space-y-6">
            {/* Basic Setup */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#002045] border-b border-[#c4c6cf]/30 pb-1.5">
                Item Configuration
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
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#c4c6cf]/30 pb-1.5">
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

            {/* Variable Metadata & Statistical Constraints */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#002045] border-b border-[#c4c6cf]/30 pb-1.5">
                Statistical Metadata & Objective Link
              </h3>

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
            </div>
          </div>
        </div>
      </div>

      {/* Save Toast */}
      {isSavedToast && (
        <div className="fixed bottom-6 right-6 z-[110] bg-[#002045] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
          <span className="material-symbols-outlined text-[#91f0ed] text-[20px]">check_circle</span>
          <span className="text-xs font-semibold">Questionnaire schema {surveyVersion} deployed to edge cache</span>
        </div>
      )}

      {/* Public Survey Preview Modal */}
      <PublicSurveyModal
        isOpen={showSurveyPreview}
        onClose={() => setShowSurveyPreview(false)}
      />
    </div>
  );
};
