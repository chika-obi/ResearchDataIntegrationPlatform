import React, { useState, useEffect } from 'react';
import { DbQuestionnaire, DbQuestionnaireVersion } from '../types';
import {
  fetchQuestionnaireVersions,
  updateQuestionnaireCurrentVersion,
  publishQuestionnaireVersionInDb,
  formatSupabaseError,
  FormattedSupabaseError,
} from '../lib/rdipDatabaseService';

interface VersionHistoryModalProps {
  questionnaire: DbQuestionnaire;
  activeVersionId: string | null;
  onClose: () => void;
  onSelectVersion: (versionId: string) => Promise<void>;
  onCreateNewVersionClick: () => void;
  isEnumerator?: boolean;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  questionnaire,
  activeVersionId,
  onClose,
  onSelectVersion,
  onCreateNewVersionClick,
  isEnumerator = false,
}) => {
  const [versions, setVersions] = useState<DbQuestionnaireVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<FormattedSupabaseError | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [publishConfirmVersion, setPublishConfirmVersion] = useState<DbQuestionnaireVersion | null>(null);

  const loadVersions = async () => {
    setLoading(true);
    setErrorDetails(null);
    const res = await fetchQuestionnaireVersions(questionnaire.id);
    if (res.error) {
      setErrorDetails(formatSupabaseError(res.error));
    } else {
      setVersions(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadVersions();
  }, [questionnaire.id]);

  const handleSetCurrent = async (version: DbQuestionnaireVersion) => {
    if (isEnumerator) return;
    setActionInProgressId(version.id);
    setErrorDetails(null);

    const res = await updateQuestionnaireCurrentVersion(questionnaire.id, version.id);
    if (!res.success) {
      setErrorDetails(formatSupabaseError(res.error || 'Failed to update current working version.'));
    } else {
      setSuccessToast(`✓ Current working version updated to ${version.version_number}`);
      setTimeout(() => setSuccessToast(null), 3000);
      await loadVersions();
    }
    setActionInProgressId(null);
  };

  const handleOpenVersion = async (versionId: string) => {
    setActionInProgressId(versionId);
    setErrorDetails(null);
    try {
      await onSelectVersion(versionId);
      onClose();
    } catch (err: any) {
      setErrorDetails(formatSupabaseError(err));
    } finally {
      setActionInProgressId(null);
    }
  };

  const requestPublish = (version: DbQuestionnaireVersion) => {
    if (isEnumerator || version.status !== 'draft') return;
    setErrorDetails(null);
    setPublishConfirmVersion(version);
  };

  const handlePublishVersion = async () => {
    if (!publishConfirmVersion || isEnumerator) return;

    const version = publishConfirmVersion;
    setPublishConfirmVersion(null);
    setActionInProgressId(version.id);
    setErrorDetails(null);

    try {
      // Lightweight client-side preflight. Database RLS/triggers remain authoritative.
      const questionCount = Array.isArray(version.schema_definition?.questions)
        ? version.schema_definition.questions.length
        : 0;

      if (questionCount === 0) {
        setErrorDetails({
          title: 'Questionnaire Cannot Be Published',
          friendlyMessage: 'This draft does not contain any questions. Add at least one question before publishing.',
          code: 'PUBLISH_VALIDATION',
          actionHint: 'Open the draft, add the required questions and options, save the draft, then publish it.',
        });
        return;
      }

      if (version.status !== 'draft') {
        setErrorDetails({
          title: 'Version Is Not a Draft',
          friendlyMessage: `Version ${version.version_number} is already ${version.status.toUpperCase()} and cannot be published again.`,
          code: 'INVALID_VERSION_STATUS',
        });
        return;
      }

      const res = await publishQuestionnaireVersionInDb(version.id, questionnaire.id);
      if (!res.success) {
        setErrorDetails(formatSupabaseError(res.error || 'Failed to publish questionnaire version.'));
        return;
      }

      setSuccessToast(`✓ ${version.version_number} published successfully in Supabase`);
      await loadVersions();

      // Reload the published version through the parent so Questionnaire Studio
      // immediately reflects PUBLISHED / read-only state without changing layout.
      await onSelectVersion(version.id);
      onClose();
    } catch (err: any) {
      setErrorDetails(formatSupabaseError(err));
    } finally {
      setActionInProgressId(null);
    }
  };

  return (
    <div
      id="version-history-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#002045]/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="version-history-modal-container"
        className="bg-white rounded-2xl shadow-2xl border border-[#c4c6cf]/60 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="bg-[#1a365d] text-white p-4 sm:p-5 relative shrink-0">
          <button
            id="version-history-close-btn"
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
              <span className="material-symbols-outlined text-2xl text-[#91f0ed]">history</span>
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Questionnaire Version History</h2>
              <p className="text-xs text-white/80 font-mono">
                {questionnaire.name} • Supabase public.questionnaire_versions
              </p>
            </div>
          </div>
        </div>

        {/* Action Header Ribbon */}
        <div className="bg-[#f1f3ff] border-b border-[#c4c6cf]/60 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[#43474e]">
            Found <span className="font-bold text-[#002045]">{versions.length}</span> recorded version{versions.length === 1 ? '' : 's'}
          </div>

          {!isEnumerator && (
            <button
              id="version-history-create-new-btn"
              type="button"
              onClick={() => {
                onClose();
                onCreateNewVersionClick();
              }}
              className="px-3 py-1.5 bg-[#006a68] hover:bg-[#00514f] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">fork_right</span>
              <span>+ Create New Version</span>
            </button>
          )}
        </div>

        {/* Error Alert Box */}
        {errorDetails && (
          <div className="p-4 mx-4 sm:mx-6 mt-4 bg-red-50 border border-red-300 rounded-xl text-red-900 text-xs flex items-start gap-2.5">
            <span className="material-symbols-outlined text-red-600 text-lg shrink-0 mt-0.5">error</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold">{errorDetails.friendlyMessage}</p>
              {errorDetails.technicalDetails && (
                <p className="text-[11px] font-mono text-red-700 mt-1 whitespace-pre-wrap">
                  {errorDetails.technicalDetails}
                </p>
              )}
              {errorDetails.actionHint && (
                <p className="text-[11px] text-red-800 mt-1">{errorDetails.actionHint}</p>
              )}
            </div>
          </div>
        )}

        {/* Success Toast */}
        {successToast && (
          <div className="p-3 mx-4 sm:mx-6 mt-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
            <span className="font-semibold">{successToast}</span>
          </div>
        )}

        {/* Versions List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-[#74777f]">
              <span className="material-symbols-outlined text-3xl animate-spin text-[#1a365d]">progress_activity</span>
              <p className="text-xs mt-2 font-semibold">Querying public.questionnaire_versions...</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="py-12 text-center bg-gray-50 border border-dashed border-[#c4c6cf] rounded-xl">
              <span className="material-symbols-outlined text-4xl text-gray-400">inventory_2</span>
              <p className="text-xs font-semibold text-[#43474e] mt-2">No version records found in Supabase.</p>
              <p className="text-[11px] text-[#74777f] mt-1">Create an initial version to begin tracking revisions.</p>
            </div>
          ) : (
            versions.map((ver) => {
              const isActiveInStudio = ver.id === activeVersionId;
              const isCurrentInDb = ver.id === questionnaire.current_version_id;
              const isPublished = ver.status === 'published';
              const isDraft = ver.status === 'draft';
              const itemCount =
                ver.schema_definition?.questions && Array.isArray(ver.schema_definition.questions)
                  ? ver.schema_definition.questions.length
                  : 0;

              return (
                <div
                  key={ver.id}
                  id={`version-card-${ver.version_number.replace('.', '-')}`}
                  className={`p-4 rounded-xl border transition-all ${
                    isActiveInStudio
                      ? 'bg-[#f1f3ff] border-[#1a365d] ring-1 ring-[#1a365d]/30'
                      : 'bg-white border-[#c4c6cf]/70 hover:border-[#1a365d]/50 hover:bg-[#fafbff]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Version Metadata */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-[#002045]">{ver.version_number}</span>

                        {isPublished ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">lock</span>
                            PUBLISHED
                          </span>
                        ) : isDraft ? (
                          <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">edit_note</span>
                            DRAFT
                          </span>
                        ) : (
                          <span className="text-[10px] bg-gray-100 text-gray-700 border border-gray-300 font-bold px-2 py-0.5 rounded-full">
                            {ver.status.toUpperCase()}
                          </span>
                        )}

                        {isActiveInStudio && (
                          <span className="text-[10px] bg-[#1a365d] text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">visibility</span>
                            Active in Studio
                          </span>
                        )}

                        {isCurrentInDb && (
                          <span className="text-[10px] bg-[#006a68]/15 text-[#006a68] border border-[#006a68]/30 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">star</span>
                            Current Version
                          </span>
                        )}
                      </div>

                      {ver.title && ver.title !== ver.version_number && (
                        <p className="text-xs font-semibold text-[#1a365d] mt-1.5 truncate">{ver.title}</p>
                      )}

                      {ver.description && (
                        <p className="text-[11px] text-[#43474e] mt-0.5 line-clamp-2">{ver.description}</p>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-[#74777f] font-mono mt-2">
                        <span>{itemCount} question{itemCount === 1 ? '' : 's'}</span>
                        <span>•</span>
                        <span>Created: {ver.created_at ? new Date(ver.created_at).toLocaleDateString() : 'Recent'}</span>
                        {ver.published_at && (
                          <>
                            <span>•</span>
                            <span>Published: {new Date(ver.published_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap justify-end">
                      {!isActiveInStudio && (
                        <button
                          type="button"
                          onClick={() => handleOpenVersion(ver.id)}
                          disabled={actionInProgressId === ver.id}
                          className="px-3 py-1.5 bg-[#002045] hover:bg-[#1a365d] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[15px]">file_open</span>
                          <span>Open in Studio</span>
                        </button>
                      )}

                      {isDraft && !isEnumerator && (
                        <button
                          id={`publish-version-${ver.version_number.replace('.', '-')}`}
                          type="button"
                          onClick={() => requestPublish(ver)}
                          disabled={actionInProgressId === ver.id}
                          className="px-2.5 py-1.5 bg-[#006a68] hover:bg-[#00514f] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title="Publish this draft questionnaire version"
                        >
                          <span className="material-symbols-outlined text-[15px]">publish</span>
                          <span>Publish</span>
                        </button>
                      )}

                      {!isCurrentInDb && !isEnumerator && !isPublished && (
                        <button
                          type="button"
                          onClick={() => handleSetCurrent(ver)}
                          disabled={actionInProgressId === ver.id}
                          className="px-2.5 py-1.5 text-[#006a68] hover:bg-[#006a68]/10 border border-[#006a68]/30 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title="Set this version as public.questionnaires.current_version_id"
                        >
                          <span className="material-symbols-outlined text-[15px]">check_box</span>
                          <span>Make Current</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#f9f9ff] border-t border-[#c4c6cf]/60 p-4 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-[#74777f]">
            Database Table: <span className="font-mono font-semibold text-[#002045]">public.questionnaire_versions</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-[#43474e] hover:bg-[#f1f3ff] rounded-lg border border-[#c4c6cf] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Publish Confirmation */}
      {publishConfirmVersion && (
        <div
          id="publish-confirmation-overlay"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#002045]/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            id="publish-confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-confirmation-title"
            className="bg-white rounded-2xl shadow-2xl border border-[#c4c6cf]/60 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
          >
            <div className="bg-[#1a365d] text-white p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#91f0ed]">publish</span>
                </div>
                <div>
                  <h3 id="publish-confirmation-title" className="text-base font-bold">Publish Questionnaire Version</h3>
                  <p className="text-xs text-white/80">This action changes the version lifecycle state.</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="bg-[#f1f3ff] border border-[#c4c6cf]/70 rounded-xl p-3">
                <p className="text-xs font-bold text-[#002045]">{questionnaire.name}</p>
                <p className="text-sm font-mono font-bold text-[#1a365d] mt-1">{publishConfirmVersion.version_number}</p>
                <p className="text-[11px] text-[#43474e] mt-1">Current status: DRAFT</p>
              </div>

              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-950">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] mt-0.5">lock</span>
                  <p>
                    Publishing will make this version <strong>read-only</strong>. Future changes must be made by creating a new draft version.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#f9f9ff] border-t border-[#c4c6cf]/60 p-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPublishConfirmVersion(null)}
                className="px-4 py-2 text-xs font-semibold text-[#43474e] hover:bg-[#f1f3ff] rounded-lg border border-[#c4c6cf] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-publish-version-btn"
                type="button"
                onClick={handlePublishVersion}
                className="px-4 py-2 bg-[#006a68] hover:bg-[#00514f] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">publish</span>
                Publish {publishConfirmVersion.version_number}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};