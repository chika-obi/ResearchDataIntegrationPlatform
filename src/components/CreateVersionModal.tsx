import React, { useState, useEffect } from 'react';
import { DbQuestionnaire, DbQuestionnaireVersion, Question } from '../types';
import {
  fetchQuestionnaireVersions,
  calculateNextVersionNumber,
  createQuestionnaireVersionInDb,
  formatSupabaseError,
  FormattedSupabaseError,
  CreateVersionResult,
} from '../lib/rdipDatabaseService';

interface CreateVersionModalProps {
  questionnaire: DbQuestionnaire;
  sourceVersion: DbQuestionnaireVersion | null;
  currentQuestions: Question[];
  onClose: () => void;
  onVersionCreated: (result: {
    version: DbQuestionnaireVersion;
    questionnaire: DbQuestionnaire;
    questions: Question[];
  }) => void;
  isEnumerator?: boolean;
}

export const CreateVersionModal: React.FC<CreateVersionModalProps> = ({
  questionnaire,
  sourceVersion,
  currentQuestions,
  onClose,
  onVersionCreated,
  isEnumerator = false,
}) => {
  const [existingVersions, setExistingVersions] = useState<DbQuestionnaireVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(true);

  const [incrementType, setIncrementType] = useState<'minor' | 'major' | 'custom'>('minor');
  const [calculatedMinor, setCalculatedMinor] = useState('v1.1');
  const [calculatedMajor, setCalculatedMajor] = useState('v2.0');
  const [customVersion, setCustomVersion] = useState('');

  const [versionTitle, setVersionTitle] = useState('');
  const [versionDescription, setVersionDescription] = useState('');
  const [setAsCurrent, setSetAsCurrent] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorDetails, setErrorDetails] = useState<FormattedSupabaseError | null>(null);

  useEffect(() => {
    const fetchVersions = async () => {
      setIsLoadingVersions(true);
      const res = await fetchQuestionnaireVersions(questionnaire.id);
      const vers = res.data || [];
      setExistingVersions(vers);

      const nextMin = calculateNextVersionNumber(vers, false);
      const nextMaj = calculateNextVersionNumber(vers, true);
      setCalculatedMinor(nextMin);
      setCalculatedMajor(nextMaj);
      setCustomVersion(nextMin);

      setVersionTitle(`${questionnaire.name} (Draft ${nextMin})`);
      setVersionDescription(
        `Draft revision branched from ${sourceVersion?.version_number || 'previous version'}`
      );
      setIsLoadingVersions(false);
    };

    fetchVersions();
  }, [questionnaire.id, questionnaire.name, sourceVersion?.version_number]);

  const targetVersionNumber =
    incrementType === 'minor'
      ? calculatedMinor
      : incrementType === 'major'
      ? calculatedMajor
      : customVersion.trim();

  const handleIncrementChange = (type: 'minor' | 'major' | 'custom') => {
    setIncrementType(type);
    const chosenVer =
      type === 'minor' ? calculatedMinor : type === 'major' ? calculatedMajor : customVersion;
    setVersionTitle(`${questionnaire.name} (Draft ${chosenVer})`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEnumerator) return;

    if (!targetVersionNumber) {
      setErrorDetails(formatSupabaseError('Please specify a valid version number.'));
      return;
    }

    // Check duplicate locally first
    const isDuplicate = existingVersions.some(
      (v) => v.version_number?.toLowerCase() === targetVersionNumber.toLowerCase()
    );
    if (isDuplicate) {
      setErrorDetails(
        formatSupabaseError(
          `Version ${targetVersionNumber} already exists for this questionnaire. Please specify a unique version number.`
        )
      );
      return;
    }

    setIsSubmitting(true);
    setErrorDetails(null);

    try {
      const result: CreateVersionResult = await createQuestionnaireVersionInDb({
        questionnaire_id: questionnaire.id,
        source_version_id: sourceVersion?.id || undefined,
        version_number: targetVersionNumber,
        version_title: versionTitle.trim() || undefined,
        version_description: versionDescription.trim() || undefined,
        questions: currentQuestions,
        set_as_current: setAsCurrent,
      });

      if (!result.data || result.error) {
        const parsed =
          result.parsedError ||
          formatSupabaseError(result.error || 'Failed to insert new version into Supabase.');
        setErrorDetails(parsed);
        setIsSubmitting(false);
        return;
      }

      // Success
      setIsSubmitting(false);
      onVersionCreated(result.data);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorDetails(formatSupabaseError(err));
    }
  };

  return (
    <div
      id="create-version-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#002045]/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="create-version-modal-container"
        className="bg-white rounded-2xl shadow-2xl border border-[#c4c6cf]/60 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="bg-[#1a365d] text-white p-4 sm:p-5 relative shrink-0">
          <button
            id="create-version-close-btn"
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
              <span className="material-symbols-outlined text-2xl text-[#91f0ed]">fork_right</span>
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Create New Draft Version</h2>
              <p className="text-xs text-white/80">
                Authoritative Supabase Revisions (public.questionnaire_versions)
              </p>
            </div>
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {/* Enumerator Notice */}
          {isEnumerator && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-700 text-lg shrink-0 mt-0.5">gpp_maybe</span>
              <div>
                <p className="font-bold">Enumerator Account Restricted</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Questionnaire versioning and authoring require a researcher role.
                </p>
              </div>
            </div>
          )}

          {/* Source Context Card */}
          <div className="p-3.5 bg-[#f1f3ff] border border-[#adc7f7]/60 rounded-xl flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-[#43474e]">Source Questionnaire</p>
              <p className="text-xs font-bold text-[#002045] mt-0.5 truncate">{questionnaire.name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] font-semibold text-[#43474e]">Branching From</p>
              <span className="inline-flex items-center gap-1 font-mono font-bold text-xs bg-white text-[#1a365d] px-2 py-0.5 rounded border border-[#adc7f7]">
                {sourceVersion?.version_number || 'v1.0'}
                {sourceVersion?.status && (
                  <span className="text-[10px] text-[#006a68] uppercase font-sans">
                    ({sourceVersion.status})
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Error Alert Box */}
          {errorDetails && (
            <div
              id="create-version-error-alert"
              className="p-3.5 bg-red-50 border border-red-300 rounded-xl text-red-900 flex items-start gap-2.5 animate-in fade-in"
            >
              <span className="material-symbols-outlined text-red-600 text-lg shrink-0 mt-0.5">
                error
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs">{errorDetails.friendlyMessage}</p>
                {errorDetails.technicalDetails && (
                  <p className="text-[11px] font-mono text-red-700 mt-1 whitespace-pre-wrap">
                    {errorDetails.technicalDetails}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Version Increment Selector */}
          <div>
            <label className="block text-xs font-bold text-[#002045] mb-2">
              Version Numbering <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleIncrementChange('minor')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  incrementType === 'minor'
                    ? 'bg-[#1a365d] text-white border-[#1a365d] shadow-xs'
                    : 'bg-white text-[#002045] border-[#c4c6cf] hover:bg-[#f1f3ff]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm">{calculatedMinor}</span>
                  <span className="text-[10px] font-semibold opacity-90">Minor</span>
                </div>
                <p className="text-[10px] opacity-80 mt-1">Revisions & additions</p>
              </button>

              <button
                type="button"
                onClick={() => handleIncrementChange('major')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  incrementType === 'major'
                    ? 'bg-[#1a365d] text-white border-[#1a365d] shadow-xs'
                    : 'bg-white text-[#002045] border-[#c4c6cf] hover:bg-[#f1f3ff]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm">{calculatedMajor}</span>
                  <span className="text-[10px] font-semibold opacity-90">Major</span>
                </div>
                <p className="text-[10px] opacity-80 mt-1">Structural overhaul</p>
              </button>

              <button
                type="button"
                onClick={() => handleIncrementChange('custom')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  incrementType === 'custom'
                    ? 'bg-[#1a365d] text-white border-[#1a365d] shadow-xs'
                    : 'bg-white text-[#002045] border-[#c4c6cf] hover:bg-[#f1f3ff]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm">Custom</span>
                  <span className="text-[10px] font-semibold opacity-90">Manual</span>
                </div>
                <p className="text-[10px] opacity-80 mt-1">Specify custom tag</p>
              </button>
            </div>

            {incrementType === 'custom' && (
              <div className="mt-2.5">
                <input
                  id="custom-version-input"
                  type="text"
                  value={customVersion}
                  onChange={(e) => {
                    setCustomVersion(e.target.value);
                    setVersionTitle(`${questionnaire.name} (Draft ${e.target.value})`);
                  }}
                  placeholder="e.g. v1.2 or v2.5"
                  className="w-full px-3 py-2 bg-white border border-[#c4c6cf] rounded-lg text-xs font-mono font-bold text-[#002045] focus:outline-hidden focus:border-[#1a365d]"
                  required
                />
              </div>
            )}
          </div>

          {/* Version Title */}
          <div>
            <label className="block text-xs font-bold text-[#002045] mb-1">Version Title</label>
            <input
              type="text"
              value={versionTitle}
              onChange={(e) => setVersionTitle(e.target.value)}
              placeholder="e.g. Baseline Survey (Draft v1.1)"
              className="w-full px-3 py-2 bg-white border border-[#c4c6cf] rounded-lg text-xs text-[#002045] focus:outline-hidden focus:border-[#1a365d]"
            />
          </div>

          {/* Change Notes / Description */}
          <div>
            <label className="block text-xs font-bold text-[#002045] mb-1">
              Changelog / Revision Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={versionDescription}
              onChange={(e) => setVersionDescription(e.target.value)}
              placeholder="Describe modifications planned for this draft..."
              className="w-full px-3 py-2 bg-white border border-[#c4c6cf] rounded-lg text-xs text-[#002045] focus:outline-hidden focus:border-[#1a365d]"
            />
          </div>

          {/* Independent Snapshot Overview */}
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-emerald-700 text-lg shrink-0 mt-0.5">
              content_copy
            </span>
            <div className="text-[11px] leading-relaxed">
              <p className="font-bold text-emerald-900">
                Independent Snapshot ({currentQuestions.length} Questions & Options)
              </p>
              <p className="text-emerald-800 mt-0.5">
                All questions, choices, validation rules, and skip logic will be deep-copied into a
                new independent record in <span className="font-mono font-semibold">public.questionnaire_versions</span> with status <span className="font-mono font-semibold">DRAFT</span>.
              </p>
              <p className="text-emerald-800 mt-0.5 font-semibold">
                Editing this new version will NEVER mutate previous versions.
              </p>
            </div>
          </div>

          {/* Set As Current Working Version Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="set-as-current-version-checkbox"
              type="checkbox"
              checked={setAsCurrent}
              onChange={(e) => setSetAsCurrent(e.target.checked)}
              className="w-4 h-4 text-[#1a365d] rounded border-[#c4c6cf] focus:ring-[#1a365d]"
            />
            <label htmlFor="set-as-current-version-checkbox" className="text-xs font-semibold text-[#002045] cursor-pointer">
              Set as current working version in database (<span className="font-mono text-[11px]">current_version_id</span>)
            </label>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#c4c6cf]/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-[#43474e] hover:bg-[#f1f3ff] rounded-lg border border-[#c4c6cf] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              id="create-version-submit-btn"
              type="submit"
              disabled={isSubmitting || isEnumerator || isLoadingVersions}
              className="px-5 py-2 bg-[#1a365d] hover:bg-[#002045] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  <span>Saving Version to Supabase...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  <span>Create Version {targetVersionNumber}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
