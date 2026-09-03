import React, { useState } from 'react';
import { Project, Question } from '../types';
import { SURVEY_TEMPLATES, SurveyTemplate } from '../data/surveyTemplates';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    newProject: Omit<
      Project,
      'id' | 'code' | 'progress' | 'enumeratorsCount' | 'responsesCount' | 'qualityScore'
    >,
    templateQuestions?: Question[]
  ) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate
}) => {
  const [activeMode, setActiveMode] = useState<'template' | 'blank'>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('public-health');
  const [title, setTitle] = useState(SURVEY_TEMPLATES[0].defaultTitle);
  const [institution, setInstitution] = useState(SURVEY_TEMPLATES[0].defaultInstitution);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('2025-12-31');
  const [description, setDescription] = useState(SURVEY_TEMPLATES[0].description);
  const [notes, setNotes] = useState(SURVEY_TEMPLATES[0].defaultNotes);
  const [status, setStatus] = useState<'Active' | 'Pending Approval' | 'Draft'>('Active');
  const [researchObjectives, setResearchObjectives] = useState<string[]>(
    SURVEY_TEMPLATES[0].researchObjectives
  );
  const [showQuestionPreview, setShowQuestionPreview] = useState(false);

  if (!isOpen) return null;

  const currentTemplate = SURVEY_TEMPLATES.find((t) => t.id === selectedTemplateId) || null;

  const handleSelectTemplate = (template: SurveyTemplate) => {
    setSelectedTemplateId(template.id);
    setTitle(template.defaultTitle);
    setInstitution(template.defaultInstitution);
    setDescription(template.description);
    setNotes(template.defaultNotes);
    setResearchObjectives(template.researchObjectives);
  };

  const handleSwitchToBlank = () => {
    setActiveMode('blank');
    setSelectedTemplateId('');
    setTitle('');
    setInstitution('');
    setDescription('');
    setNotes('');
    setResearchObjectives([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !institution.trim()) return;

    const chosenQuestions =
      activeMode === 'template' && currentTemplate ? currentTemplate.questions : undefined;

    onCreate(
      {
        title: title.trim(),
        institution: institution.trim(),
        startDate,
        endDate: endDate || '2025-12-31',
        description: description.trim() || 'New research initiative.',
        notes: notes.trim() || undefined,
        status: status as any,
        researchObjectives: researchObjectives.length > 0 ? researchObjectives : undefined
      },
      chosenQuestions
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#002045]/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-[#c4c6cf]/60 animate-in fade-in zoom-in-95 my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#c4c6cf]/40 flex justify-between items-center bg-[#f9f9ff]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1a365d] text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#002045]">Create New Research Project</h2>
              <p className="text-xs text-[#43474e]">Configure protocol, contextual notes, and survey structure</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#74777f] hover:text-[#002045] p-1.5 rounded-full hover:bg-[#e3e8f9] transition-colors"
            title="Close modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-6 pt-3 pb-0 bg-[#f9f9ff] border-b border-[#c4c6cf]/30 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveMode('template');
              if (!selectedTemplateId) {
                handleSelectTemplate(SURVEY_TEMPLATES[0]);
              }
            }}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
              activeMode === 'template'
                ? 'border-[#1a365d] text-[#1a365d] bg-white shadow-2xs'
                : 'border-transparent text-[#74777f] hover:text-[#002045]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">auto_stories</span>
            <span>Use Pre-Defined Template</span>
            <span className="bg-[#006a68]/10 text-[#006a68] text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              Recommended
            </span>
          </button>

          <button
            type="button"
            onClick={handleSwitchToBlank}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
              activeMode === 'blank'
                ? 'border-[#1a365d] text-[#1a365d] bg-white shadow-2xs'
                : 'border-transparent text-[#74777f] hover:text-[#002045]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">edit_note</span>
            <span>Start from Scratch</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Template Selection Grid when in Template Mode */}
          {activeMode === 'template' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#002045] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-[#006a68]">dataset</span>
                  <span>Select Survey Structure Template</span>
                </label>
                {currentTemplate && (
                  <button
                    type="button"
                    onClick={() => setShowQuestionPreview(!showQuestionPreview)}
                    className="text-[11px] font-semibold text-[#1a365d] hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>{showQuestionPreview ? 'Hide Questions' : `Preview ${currentTemplate.questions.length} Questions (Q1–Q${currentTemplate.questions.length})`}</span>
                    <span className="material-symbols-outlined text-[14px]">
                      {showQuestionPreview ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SURVEY_TEMPLATES.map((tmpl) => {
                  const isSelected = selectedTemplateId === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                        isSelected
                          ? 'border-2 border-[#1a365d] bg-[#f1f3ff] shadow-xs'
                          : 'border-[#c4c6cf]/60 bg-white hover:border-[#74777f] hover:bg-[#f9f9ff]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`p-1.5 rounded-lg flex items-center justify-center ${
                              isSelected ? 'bg-[#1a365d] text-white' : 'bg-slate-100 text-[#002045]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">{tmpl.icon}</span>
                          </span>
                          <h4 className="text-xs font-bold text-[#002045] leading-tight">{tmpl.name}</h4>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#006a68]/10 text-[#006a68] shrink-0">
                          {tmpl.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#43474e] line-clamp-2 leading-relaxed">
                        {tmpl.tagline}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Collapsible Questions Preview */}
              {showQuestionPreview && currentTemplate && (
                <div className="p-3.5 bg-[#f9f9ff] border border-[#c4c6cf]/50 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-[#002045] border-b border-[#c4c6cf]/30 pb-1.5">
                    <span>Pre-configured Questions in {currentTemplate.name}:</span>
                    <span className="font-mono text-[11px] text-[#006a68]">Always starts with Q1</span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {currentTemplate.questions.map((q) => (
                      <div
                        key={q.id}
                        className="p-2 bg-white rounded-lg border border-[#c4c6cf]/30 flex items-center justify-between text-xs gap-2"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="px-1.5 py-0.5 rounded bg-[#1a365d] text-white font-mono font-bold text-[10px] shrink-0">
                            {q.number}
                          </span>
                          <span className="truncate text-[#161c27] font-medium">{q.title}</span>
                        </div>
                        <span className="text-[10px] text-[#74777f] uppercase font-mono shrink-0">
                          {q.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Project Title */}
          <div>
            <label className="block text-xs font-bold text-[#002045] mb-1.5 uppercase tracking-wide">
              Project Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. National Literacy & Digital Skills Survey 2025"
              className="w-full px-3.5 py-2.5 bg-[#f9f9ff] rounded-xl border border-[#c4c6cf] focus:border-[#1a365d] focus:ring-2 focus:ring-[#1a365d]/15 text-xs font-medium text-[#161c27] outline-none transition-all"
            />
          </div>

          {/* Institution */}
          <div>
            <label className="block text-xs font-bold text-[#002045] mb-1.5 uppercase tracking-wide">
              Lead Institution / Funding Body *
            </label>
            <input
              type="text"
              required
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. Ministry of Public Health & Global Health Initiative"
              className="w-full px-3.5 py-2.5 bg-[#f9f9ff] rounded-xl border border-[#c4c6cf] focus:border-[#1a365d] focus:ring-2 focus:ring-[#1a365d]/15 text-xs font-medium text-[#161c27] outline-none transition-all"
            />
          </div>

          {/* Dates & Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#002045] mb-1.5 uppercase tracking-wide">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#f9f9ff] rounded-xl border border-[#c4c6cf] focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] text-xs font-medium text-[#161c27] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#002045] mb-1.5 uppercase tracking-wide">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#f9f9ff] rounded-xl border border-[#c4c6cf] focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] text-xs font-medium text-[#161c27] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#002045] mb-1.5 uppercase tracking-wide">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#f9f9ff] rounded-xl border border-[#c4c6cf] focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] text-xs font-semibold text-[#161c27] outline-none cursor-pointer"
              >
                <option value="Active">Active Collection</option>
                <option value="Draft">Design / Draft</option>
                <option value="Pending Approval">Pending IRB Approval</option>
              </select>
            </div>
          </div>

          {/* Contextual Notes Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#002045] uppercase tracking-wide flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-[#1a365d]">sticky_note_2</span>
                <span>Contextual Notes & Research Protocol</span>
              </label>
              <span className="text-[10px] text-[#74777f]">Attach field instructions, IRB protocols, or sampling methodology</span>
            </div>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Field protocol audited under IRB approval. Requires dual enumerator verification across 14 rural health centers..."
              className="w-full px-3.5 py-2.5 bg-[#f9f9ff] rounded-xl border border-[#c4c6cf] focus:border-[#1a365d] focus:ring-2 focus:ring-[#1a365d]/15 text-xs text-[#161c27] outline-none resize-none transition-all leading-relaxed"
            />
          </div>

          {/* Project Description */}
          <div>
            <label className="block text-xs font-bold text-[#002045] mb-1.5 uppercase tracking-wide">
              Project Description & Abstract
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of research scope, target demographics, and analytical hypothesis..."
              className="w-full px-3.5 py-2.5 bg-[#f9f9ff] rounded-xl border border-[#c4c6cf] focus:border-[#1a365d] focus:ring-2 focus:ring-[#1a365d]/15 text-xs text-[#161c27] outline-none resize-none transition-all leading-relaxed"
            />
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-[#c4c6cf]/40 flex items-center justify-between gap-3">
            <div className="text-[11px] text-[#74777f]">
              {activeMode === 'template' && currentTemplate
                ? `Template applies ${currentTemplate.questions.length} structured survey questions`
                : 'Creating empty project'}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#002045] border border-[#c4c6cf] hover:bg-[#f1f3ff] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#1a365d] hover:bg-[#002045] text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Create Project</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
