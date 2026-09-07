import React, { useState, useEffect, useRef } from 'react';
import { Project, UserProfile, Question, DbQuestionnaire, DbQuestionnaireVersion } from '../types';
import {
  CreateQuestionnaireParams,
  FormattedSupabaseError,
  formatSupabaseError,
} from '../lib/rdipDatabaseService';

interface CreateQuestionnaireModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  selectedProjectId?: string;
  currentUser: UserProfile;
  initialError?: FormattedSupabaseError | null;
  onCreateQuestionnaire: (
    params: CreateQuestionnaireParams
  ) => Promise<{
    success: boolean;
    error?: string;
    errorCode?: string;
    errorDetails?: string;
    parsedError?: FormattedSupabaseError;
    warning?: string;
    questionnaire?: DbQuestionnaire;
    version?: DbQuestionnaireVersion;
    questions?: Question[];
  }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CreateQuestionnaireModal: React.FC<CreateQuestionnaireModalProps> = ({
  isOpen,
  onClose,
  projects = [],
  selectedProjectId,
  currentUser,
  initialError,
  onCreateQuestionnaire,
}) => {
  const [projectId, setProjectId] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [versionNumber, setVersionNumber] = useState<string>('v1.0');
  const [templateType, setTemplateType] = useState<'standard' | 'health' | 'blank'>('standard');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorDetails, setErrorDetails] = useState<FormattedSupabaseError | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdRecord, setCreatedRecord] = useState<{
    id: string;
    name: string;
    version: string;
    status: string;
  } | null>(null);

  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wasSuccessfulRef = useRef<boolean>(false);

  // Filter projects to those with real Supabase UUIDs
  const validDbProjects = (projects || []).filter((p) => p.id && UUID_REGEX.test(p.id));

  // Cleanup auto-close timer on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (wasSuccessfulRef.current) {
        setName('');
        setDescription('');
        setVersionNumber('v1.0');
        setTemplateType('standard');
        setErrorMessage(null);
        setErrorDetails(null);
        setSuccessMessage(null);
        setCreatedRecord(null);
        wasSuccessfulRef.current = false;
      }
      setIsLoading(false);

      if (initialError) {
        setErrorDetails(initialError);
        setErrorMessage(initialError.friendlyMessage);
      }

      if (selectedProjectId && UUID_REGEX.test(selectedProjectId)) {
        setProjectId(selectedProjectId);
      } else if (validDbProjects.length > 0) {
        setProjectId(validDbProjects[0].id);
      } else if (projects.length > 0) {
        setProjectId(projects[0].id);
      }
    } else {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    }
  }, [isOpen, selectedProjectId, projects.length, initialError]);

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
      const parsed = formatSupabaseError(
        'Permission Denied: Field enumerators cannot author questionnaires. Researcher role required.'
      );
      setErrorDetails(parsed);
      setErrorMessage(parsed.friendlyMessage);
      return;
    }

    if (!name.trim()) {
      const parsed = formatSupabaseError('Please enter a descriptive questionnaire title.');
      setErrorDetails(parsed);
      setErrorMessage(parsed.friendlyMessage);
      return;
    }

    if (!projectId) {
      const parsed = formatSupabaseError('Please select a target research project.');
      setErrorDetails(parsed);
      setErrorMessage(parsed.friendlyMessage);
      return;
    }

    if (!isSelectedProjectValidUUID) {
      const parsed = formatSupabaseError(
        'Selected project does not have a valid Supabase database UUID. Please select an authoritative project stored in Supabase public.projects.'
      );
      setErrorDetails(parsed);
      setErrorMessage(parsed.friendlyMessage);
      return;
    }

    // 1. Show loading state ("Saving to Supabase...")
    setIsLoading(true);
    setErrorMessage(null);
    setErrorDetails(null);
    setSuccessMessage(null);
    setCreatedRecord(null);

    try {
      const questions = getStarterQuestions(templateType);
      // 2. Wait for actual Supabase operation
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

      // 3. Do not show success if the Supabase operation fails
      if (!result.success || !result.questionnaire) {
        setIsLoading(false);
        const parsed =
          result.parsedError ||
          formatSupabaseError({
            message: result.error || 'Failed to create questionnaire in Supabase.',
            code: result.errorCode,
            details: result.errorDetails,
          });
        setErrorDetails(parsed);
        setErrorMessage(parsed.friendlyMessage);
        return;
      }

      // 4. Supabase successfully returned the record
      wasSuccessfulRef.current = true;
      setIsLoading(false);
      setErrorMessage(null);
      setErrorDetails(null);
      setSuccessMessage('Questionnaire created successfully.');
      setCreatedRecord({
        id: result.questionnaire.id,
        name: result.questionnaire.name,
        version: result.version?.version_number || versionNumber.trim() || 'v1.0',
        status: result.questionnaire.status || 'draft',
      });

      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
      autoCloseTimerRef.current = setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: any) {
      setIsLoading(false);
      const parsed = formatSupabaseError(err);
      setErrorDetails(parsed);
      setErrorMessage(parsed.friendlyMessage);
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

          {/* User-friendly Supabase Error Alert Box */}
          {errorDetails && (
            <div
              id="create-questionnaire-error-alert"
              role="alert"
              aria-live="assertive"
              className="p-4 bg-red-50/95 border-2 border-red-300 rounded-xl text-red-950 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-700 shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-lg">error</span>
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-red-950 uppercase tracking-wide">
                        {errorDetails.title}
                      </h4>
                      {errorDetails.code && (
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-red-100 text-red-800 rounded border border-red-200">
                          {errorDetails.code}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">edit</span>
                        Form Remains Editable
                      </span>
                    </div>

                    <p className="text-xs text-red-900 leading-relaxed font-medium">
                      {errorDetails.friendlyMessage}
                    </p>

                    {errorDetails.actionHint && (
                      <div className="text-[11px] text-red-950 bg-white/80 p-2.5 rounded-lg border border-red-200 flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-amber-600 shrink-0 mt-0.5">
                          lightbulb
                        </span>
                        <span>
                          <strong>Recommended Action:</strong> {errorDetails.actionHint}
                        </span>
                      </div>
                    )}

                    {errorDetails.technicalDetails && (
                      <details className="text-[11px] text-red-800/80 mt-1">
                        <summary className="cursor-pointer font-medium hover:text-red-950 select-none flex items-center gap-1">
                          <span>View Technical Details</span>
                          <span className="material-symbols-outlined text-[14px]">expand_more</span>
                        </summary>
                        <pre className="mt-1 p-2 bg-white/90 border border-red-200 rounded font-mono text-[10px] whitespace-pre-wrap break-all text-red-900">
                          {errorDetails.technicalDetails}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setErrorDetails(null);
                    setErrorMessage(null);
                  }}
                  className="text-red-400 hover:text-red-800 p-1 rounded-lg hover:bg-red-100 transition-colors cursor-pointer shrink-0"
                  title="Dismiss error alert"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>
          )}

          {/* Success Confirmation Banner / View */}
          {successMessage && (
            <div
              id="create-questionnaire-success-confirmation"
              role="status"
              aria-live="polite"
              className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="flex items-center gap-2.5 text-emerald-800">
                <span className="material-symbols-outlined text-emerald-600 text-2xl">
                  task_alt
                </span>
                <div>
                  <p className="text-sm font-bold text-emerald-950">
                    {successMessage}
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    Authoritative record inserted into Supabase table <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded text-emerald-900 font-semibold">public.questionnaires</code>
                  </p>
                </div>
              </div>

              {createdRecord && (
                <div className="bg-white/95 border border-emerald-200 rounded-lg p-3 space-y-2 text-xs text-[#161c27]">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#74777f] font-medium">Database Questionnaire UUID:</span>
                    <span className="font-mono font-bold text-emerald-800 select-all bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      {createdRecord.id}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#74777f] font-medium">Instrument Title:</span>
                    <span className="font-semibold text-[#002045]">
                      {createdRecord.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#74777f] font-medium">Initial Version:</span>
                    <span className="font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      {createdRecord.version} (status: {createdRecord.status})
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-emerald-800 flex items-center gap-1.5 font-medium">
                  <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
                  Opening Questionnaire Studio...
                </span>
                <button
                  type="button"
                  id="create-questionnaire-open-studio-btn"
                  onClick={() => {
                    if (autoCloseTimerRef.current) {
                      clearTimeout(autoCloseTimerRef.current);
                    }
                    onClose();
                  }}
                  className="px-3.5 py-1.5 bg-[#006a68] text-white rounded-lg text-xs font-semibold hover:bg-[#004f4e] transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <span>Open Studio Now</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
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
              {(projects || []).map((p) => {
                const isValidUUID = p.id && UUID_REGEX.test(p.id);
                return (
                  <option key={p.id} value={p.id}>
                    {p.projectCode || 'PROJ'} — {p.title} {isValidUUID ? '✓ (Supabase DB)' : '⚠️ (Local Only)'}
                  </option>
                );
              })}
            </select>
            {!isSelectedProjectValidUUID && (projects || []).length > 0 && (
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
            <div className="flex items-center gap-3">
              <button
                id="create-questionnaire-cancel-btn"
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-[#43474e] hover:text-[#161c27] font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              {(name || description) && !isLoading && (
                <button
                  id="create-questionnaire-clear-btn"
                  type="button"
                  onClick={() => {
                    setName('');
                    setDescription('');
                    setErrorDetails(null);
                    setErrorMessage(null);
                  }}
                  className="text-xs text-[#73777f] hover:text-red-700 underline underline-offset-2 transition-colors cursor-pointer"
                  title="Clear inputs to start fresh"
                >
                  Clear Draft
                </button>
              )}
            </div>

            <button
              id="create-questionnaire-submit-btn"
              type="submit"
              disabled={isLoading || isEnumerator || !isSelectedProjectValidUUID || !name.trim() || Boolean(successMessage)}
              className="px-5 py-2.5 bg-[#006a68] text-white rounded-lg font-semibold hover:bg-[#004f4e] shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50 text-xs cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">
                    refresh
                  </span>
                  <span>Saving to Supabase...</span>
                </>
              ) : successMessage ? (
                <>
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Questionnaire Created</span>
                </>
              ) : errorDetails ? (
                <>
                  <span className="material-symbols-outlined text-[16px]">sync</span>
                  <span>Retry Creation in DB</span>
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
