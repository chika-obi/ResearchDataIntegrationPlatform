import React, { useState, useEffect } from 'react';
import { Project, UserProfile, Question, DbQuestionnaire, DbQuestionnaireVersion } from '../types';
import { CreateQuestionnaireParams } from '../lib/rdipDatabaseService';

interface CreateQuestionnaireModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  selectedProjectId?: string;
  currentUser: UserProfile;
  onCreateQuestionnaire: (
    params: CreateQuestionnaireParams
  ) => Promise<{
    success: boolean;
    error?: string;
    questionnaire?: DbQuestionnaire;
    version?: DbQuestionnaireVersion;
  }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CreateQuestionnaireModal: React.FC<CreateQuestionnaireModalProps> = ({
  isOpen,
  onClose,
  projects,
  selectedProjectId,
  currentUser,
  onCreateQuestionnaire,
}) => {
  const [projectId, setProjectId] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [versionNumber, setVersionNumber] = useState<string>('v1.0');
  const [templateType, setTemplateType] = useState<'standard' | 'health' | 'blank'>('standard');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter projects to those with real Supabase UUIDs
  const validDbProjects = projects.filter((p) => p.id && UUID_REGEX.test(p.id));

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setName('');
      setDescription('');
      setVersionNumber('v1.0');

      if (selectedProjectId && UUID_REGEX.test(selectedProjectId)) {
        setProjectId(selectedProjectId);
      } else if (validDbProjects.length > 0) {
        setProjectId(validDbProjects[0].id);
      } else if (projects.length > 0) {
        setProjectId(projects[0].id);
      }
    }
  }, [isOpen, selectedProjectId, projects.length]);

  if (!isOpen) return null;

  const isEnumerator = currentUser.role === 'enumerator';
  const isSelectedProjectValidUUID = projectId && UUID_REGEX.test(projectId);

  const getStarterQuestions = (template: 'standard' | 'health' | 'blank'): Question[] => {
    if (template === 'blank') {
      return [
        {
          id: 'q1',
          number: 'Q1',
          section: 'Section A: General',
          title: 'Primary Assessment Variable',
          type: 'short-text',
          variableName: 'PRIM_VAR_01',
          variableLabel: 'Primary Assessment Variable',
          required: true,
          dataType: 'Categorical',
          measurementLevel: 'Nominal',
        },
      ];
    }

    if (template === 'health') {
      return [
        {
          id: 'q1',
          number: 'Q1',
          section: 'Section A: Facility Identification',
          title: 'Health Facility Operational Status',
          type: 'multiple-choice',
          variableName: 'FAC_STATUS',
          variableLabel: 'Operational status of healthcare post',
          required: true,
          dataType: 'Categorical',
          measurementLevel: 'Nominal',
          options: [
            { id: 'opt_func', label: 'Fully Functional', numericCode: 1 },
            { id: 'opt_part', label: 'Partially Operational', numericCode: 2 },
            { id: 'opt_temp', label: 'Temporarily Closed', numericCode: 3 },
          ],
        },
        {
          id: 'q2',
          number: 'Q2',
          section: 'Section A: Facility Identification',
          title: 'Current Cold-Chain Vaccine Storage Temperature (°C)',
          type: 'number',
          variableName: 'COLD_CHAIN_TEMP',
          variableLabel: 'Temperature in storage unit',
          required: true,
          dataType: 'Numerical',
          measurementLevel: 'Interval',
        },
        {
          id: 'q3',
          number: 'Q3',
          section: 'Section B: Clinical Readiness',
          title: 'Adequacy of essential medicines and diagnostic testing supplies',
          type: 'likert',
          variableName: 'MED_SUPPLY_RATING',
          variableLabel: '5-point Likert readiness scale',
          required: true,
          likertScale: 5,
          dataType: 'Ordinal',
          measurementLevel: 'Ordinal',
        },
      ];
    }

    // Default 'standard' academic protocol
    return [
      {
        id: 'q1',
        number: 'Q1',
        section: 'Section A: Demographics',
        title: 'Participant Primary Age Group',
        type: 'multiple-choice',
        variableName: 'AGE_GROUP',
        variableLabel: 'Categorical age cohort',
        required: true,
        dataType: 'Categorical',
        measurementLevel: 'Ordinal',
        options: [
          { id: 'age_18_29', label: '18–29 Years', numericCode: 1 },
          { id: 'age_30_49', label: '30–49 Years', numericCode: 2 },
          { id: 'age_50_64', label: '50–64 Years', numericCode: 3 },
          { id: 'age_65_plus', label: '65 Years or Older', numericCode: 4 },
        ],
      },
      {
        id: 'q2',
        number: 'Q2',
        section: 'Section A: Demographics',
        title: 'Geographic Ward / Community Sampling Cluster Code',
        type: 'short-text',
        variableName: 'CLUSTER_CODE',
        variableLabel: 'Sampling cluster identifier',
        required: true,
        dataType: 'Categorical',
        measurementLevel: 'Nominal',
      },
      {
        id: 'q3',
        number: 'Q3',
        section: 'Section B: Standard Measurement Scale',
        title: 'Satisfaction with community health and municipal infrastructure services',
        type: 'likert',
        variableName: 'COMM_SATISFACTION',
        variableLabel: 'Overall satisfaction 5-point Likert scale',
        required: true,
        likertScale: 5,
        dataType: 'Ordinal',
        measurementLevel: 'Ordinal',
      },
    ];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEnumerator) {
      setErrorMessage('Permission Denied: Field enumerators cannot author questionnaires.');
      return;
    }

    if (!name.trim()) {
      setErrorMessage('Please enter a descriptive questionnaire title.');
      return;
    }

    if (!projectId) {
      setErrorMessage('Please select a target research project.');
      return;
    }

    if (!isSelectedProjectValidUUID) {
      setErrorMessage(
        'Selected project does not have a valid Supabase database UUID. Please select an authoritative project stored in Supabase public.projects.'
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const questions = getStarterQuestions(templateType);
      const result = await onCreateQuestionnaire({
        project_id: projectId,
        name: name.trim(),
        description: description.trim() || null,
        version_number: versionNumber.trim() || 'v1.0',
        questions,
        metadata: {
          template: templateType,
          author_name: currentUser.name,
          author_email: currentUser.email,
        },
      });

      if (!result.success) {
        setErrorMessage(result.error || 'Failed to create questionnaire in Supabase.');
      } else {
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred during questionnaire creation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="create-questionnaire-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#002045]/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="create-questionnaire-modal-container"
        className="bg-white rounded-2xl shadow-2xl border border-[#c4c6cf]/60 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="bg-[#1a365d] text-white p-5 relative">
          <button
            id="create-questionnaire-close-btn"
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
              <span className="material-symbols-outlined text-2xl text-[#91f0ed]">
                assignment_add
              </span>
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Create New Questionnaire</h2>
              <p className="text-xs text-white/80">
                Authoritative Supabase PostgreSQL Registration (Draft Versioning)
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Permission warning for enumerators */}
          {isEnumerator && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-amber-700 text-lg shrink-0 mt-0.5">
                gpp_maybe
              </span>
              <div>
                <p className="font-semibold">Enumerator Account Detected</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Under RDIP security policies, enumerators are restricted to survey field execution.
                  Questionnaires may only be authored by researchers or administrators.
                </p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-red-700 text-lg shrink-0 mt-0.5">
                error
              </span>
              <div className="text-[11px]">
                <p className="font-semibold">Creation Error</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Project Selector */}
          <div>
            <label className="block font-semibold text-[#161c27] mb-1.5 flex items-center justify-between">
              <span>Parent Research Project</span>
              <span className="text-[10px] font-normal text-[#74777f]">
                Required (Foreign Key: project_id)
              </span>
            </label>
            <select
              id="create-questionnaire-project-select"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={isLoading || isEnumerator}
              className={`w-full p-2.5 rounded-lg border text-xs outline-none bg-white transition-colors ${
                isSelectedProjectValidUUID
                  ? 'border-[#c4c6cf] focus:border-[#1a365d]'
                  : 'border-red-300 bg-red-50/30'
              }`}
            >
              {projects.map((p) => {
                const isValidUUID = p.id && UUID_REGEX.test(p.id);
                return (
                  <option key={p.id} value={p.id}>
                    {p.projectCode || 'PROJ'} — {p.title} {isValidUUID ? '✓ (Supabase DB)' : '⚠️ (Local Only)'}
                  </option>
                );
              })}
            </select>
            {!isSelectedProjectValidUUID && projects.length > 0 && (
              <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                The selected project has a non-UUID ID. Please select a project saved in Supabase public.projects.
              </p>
            )}
          </div>

          {/* Questionnaire Title */}
          <div>
            <label className="block font-semibold text-[#161c27] mb-1.5">
              Questionnaire Title / Instrument Name
            </label>
            <input
              id="create-questionnaire-name-input"
              type="text"
              required
              disabled={isLoading || isEnumerator}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Primary Healthcare Operational Readiness Protocol"
              className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
            />
          </div>

          {/* Protocol Description */}
          <div>
            <label className="block font-semibold text-[#161c27] mb-1.5">
              Research Description & Objectives
            </label>
            <textarea
              id="create-questionnaire-description-input"
              rows={2}
              disabled={isLoading || isEnumerator}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Structured assessment protocol evaluating diagnostic supply chains and clinical facilities."
              className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none resize-none"
            />
          </div>

          {/* Version & Template Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#161c27] mb-1.5">
                Initial Version Code
              </label>
              <input
                id="create-questionnaire-version-input"
                type="text"
                disabled={isLoading || isEnumerator}
                value={versionNumber}
                onChange={(e) => setVersionNumber(e.target.value)}
                placeholder="v1.0"
                className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none font-mono"
              />
              <span className="text-[10px] text-[#74777f] mt-0.5 block">
                Created as Status: <strong className="text-amber-700">draft</strong> (Unpublished)
              </span>
            </div>

            <div>
              <label className="block font-semibold text-[#161c27] mb-1.5">
                Starter Structure Template
              </label>
              <select
                id="create-questionnaire-template-select"
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value as any)}
                disabled={isLoading || isEnumerator}
                className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"
              >
                <option value="standard">Academic Assessment (3 Core Items)</option>
                <option value="health">Public Health Surveillance (3 Items)</option>
                <option value="blank">Blank Instrument (1 Prompt)</option>
              </select>
              <span className="text-[10px] text-[#74777f] mt-0.5 block">
                Pre-configures initial questions
              </span>
            </div>
          </div>

          {/* Security & Lifecycle Verification Notice */}
          <div className="p-3 bg-[#e8f0fe]/60 border border-[#c4c6cf]/50 rounded-xl text-[#002045] space-y-1.5 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-[#1a365d]">
              <span className="material-symbols-outlined text-[15px]">verified_user</span>
              <span>Supabase RLS & Immutability Rules</span>
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-[#43474e]">
              <li>
                <strong>Author:</strong> {currentUser.name} ({currentUser.email})
              </li>
              <li>
                <strong>Database Target:</strong> <code className="bg-white/80 px-1 py-0.5 rounded text-[10px]">public.questionnaires</code> + <code className="bg-white/80 px-1 py-0.5 rounded text-[10px]">public.questionnaire_versions</code>
              </li>
              <li>
                <strong>Version Lifecycle:</strong> Initial status will be set to <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded text-[10px]">draft</code>. Drafts must be explicitly published by a researcher before enumerators can collect data.
              </li>
            </ul>
          </div>

          {/* Modal Action Buttons */}
          <div className="pt-3 border-t border-[#c4c6cf]/40 flex justify-between items-center">
            <button
              id="create-questionnaire-cancel-btn"
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-[#43474e] hover:text-[#161c27] font-semibold text-xs"
            >
              Cancel
            </button>

            <button
              id="create-questionnaire-submit-btn"
              type="submit"
              disabled={isLoading || isEnumerator || !isSelectedProjectValidUUID || !name.trim()}
              className="px-5 py-2.5 bg-[#006a68] text-white rounded-lg font-semibold hover:bg-[#004f4e] shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50 text-xs"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">
                    refresh
                  </span>
                  <span>Writing to Supabase...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                  <span>Create Questionnaire in DB</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
