import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Question, UserProfile } from '../types';
import { DEFAULT_QUESTIONS } from '../data/mockData';
import { pushResponseToSupabase, saveResponseToLocalDb } from '../lib/supabaseSync';
import { evaluateQuestionLogic } from '../lib/surveyLogicEvaluator';

interface OfflineSurveyCollectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile;
  onResponseCollected?: (newRecord: any) => void;
  isOfflineMode?: boolean;
}

export const OfflineSurveyCollectorModal: React.FC<OfflineSurveyCollectorModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onResponseCollected,
  isOfflineMode = true
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [submittedRecordId, setSubmittedRecordId] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load dynamically deployed questions from localStorage created by the Researcher
  const [questions, setQuestions] = useState<Question[]>(() => {
    const saved = localStorage.getItem('rdip_active_questionnaire');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse active questionnaire:', e);
      }
    }
    return DEFAULT_QUESTIONS;
  });

  const surveyTitle = localStorage.getItem('rdip_survey_title') || 'Household Health & Demographics Survey 2024';
  const surveyVersion = localStorage.getItem('rdip_survey_version') || 'Version 2.4.0';

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('rdip_active_questionnaire');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setQuestions(parsed);
          }
        } catch {}
      }
      setCurrentStepIndex(0);
      setAnswers({});
      setIsCompleted(false);
      setValidationError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Active Enumerator info
  const enumeratorName = currentUser?.name || 'Field Enumerator';
  const enumeratorId = currentUser?.id || 'EN-1048';
  const enumeratorRole = currentUser?.role || 'enumerator';

  const totalQuestions = questions.length;
  const currentQ = questions[currentStepIndex] || questions[0];
  const progressPercent = Math.round(((currentStepIndex + 1) / totalQuestions) * 100);

  // Find next visible question based on current answers evaluation
  const getNextVisibleIndex = (fromIdx: number): number => {
    for (let i = fromIdx + 1; i < questions.length; i++) {
      const q = questions[i];
      const evalRes = evaluateQuestionLogic(q.logicRule, answers);
      if (evalRes.isVisible) {
        return i;
      }
    }
    return -1; // No more visible questions -> survey finished
  };

  const getPrevVisibleIndex = (fromIdx: number): number => {
    for (let i = fromIdx - 1; i >= 0; i--) {
      const q = questions[i];
      const evalRes = evaluateQuestionLogic(q.logicRule, answers);
      if (evalRes.isVisible) {
        return i;
      }
    }
    return 0;
  };

  const handleNext = () => {
    // Basic required validation
    if (currentQ?.required && (answers[currentQ.variableName] === undefined || answers[currentQ.variableName] === '')) {
      setValidationError(`"${currentQ.title}" is required to proceed.`);
      return;
    }
    setValidationError(null);

    // Check if current question triggers a direct skip or end_survey action
    const currentEval = evaluateQuestionLogic(currentQ?.logicRule, answers);
    if (currentEval.action === 'end_survey') {
      handleSubmitResponse();
      return;
    }

    if (currentEval.action === 'skip_to' && currentEval.targetQuestionId) {
      const targetIdx = questions.findIndex((q) => q.id === currentEval.targetQuestionId);
      if (targetIdx !== -1) {
        setCurrentStepIndex(targetIdx);
        return;
      }
    }

    const nextIdx = getNextVisibleIndex(currentStepIndex);
    if (nextIdx !== -1) {
      setCurrentStepIndex(nextIdx);
    } else {
      handleSubmitResponse();
    }
  };

  const handlePrev = () => {
    setValidationError(null);
    const prevIdx = getPrevVisibleIndex(currentStepIndex);
    setCurrentStepIndex(prevIdx);
  };

  const setAnswer = (val: any) => {
    setValidationError(null);
    setAnswers((prev) => ({
      ...prev,
      [currentQ.variableName]: val,
      [currentQ.id]: val
    }));
  };

  const handleSubmitResponse = async () => {
    setIsSubmitting(true);
    const newRecordId = `REC-${Date.now().toString().slice(-5)}`;
    setSubmittedRecordId(newRecordId);

    const payload = {
      id: newRecordId,
      questionnaireId: 'QNR-2024-001',
      projectId: 'PRJ-001',
      enumeratorId: enumeratorId,
      enumeratorName: enumeratorName,
      respondentId: `RESP-${Math.floor(1000 + Math.random() * 9000)}`,
      answers: answers,
      gps: {
        latitude: 6.5244 + (Math.random() - 0.5) * 0.02,
        longitude: 3.3792 + (Math.random() - 0.5) * 0.02,
        accuracy: 4.2
      },
      batteryLevel: 88,
      collectedAt: new Date().toISOString()
    };

    // Save into database (local cache & Supabase when online)
    if (isOfflineMode) {
      saveResponseToLocalDb({ ...payload, syncStatus: 'pending' });
    } else {
      await pushResponseToSupabase(payload);
    }

    // Broadcast background sync event across the application
    try {
      window.dispatchEvent(new CustomEvent('rdip_response_synced', { detail: payload }));
    } catch {}

    if (onResponseCollected) {
      onResponseCollected(payload);
    }

    setIsSubmitting(false);
    setIsCompleted(true);
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.6 }
    });
  };

  return (
    <div className="fixed inset-0 z-[150] bg-[#002045]/70 backdrop-blur-xs flex flex-col justify-center items-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-[#f9f9ff] w-full max-w-2xl rounded-2xl shadow-2xl border border-[#c4c6cf]/60 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Enumerator & Survey Header */}
        <div className="bg-[#006a68] text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/30 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl text-[#91f0ed]">cell_tower</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold truncate leading-tight">
                  {surveyTitle}
                </h1>
                <span className="px-2 py-0.5 rounded bg-white/20 text-[10px] font-mono uppercase tracking-wider">
                  {surveyVersion}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/90 mt-1 flex-wrap">
                <span className="flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-[14px]">person</span>
                  Enumerator: <strong className="text-white underline underline-offset-2">{enumeratorName}</strong>
                </span>
                <span className="opacity-60">•</span>
                <span className="text-[11px] opacity-90 font-mono">ID: {enumeratorId}</span>
                <span className="opacity-60">•</span>
                <span className="px-1.5 py-0.2 rounded bg-black/20 text-[10px] uppercase font-bold">
                  {isOfflineMode ? 'Offline Form' : 'Cloud Direct'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors ml-2 shrink-0"
            title="Exit Field Session"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col">
          {!isCompleted ? (
            <div className="flex-1 flex flex-col space-y-5">
              {/* Progress & Variable Bar */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-[#43474e] font-semibold flex items-center gap-1.5">
                    <span>Question {currentStepIndex + 1} of {totalQuestions}</span>
                    <span className="font-mono bg-[#dde2f3] text-[#002045] px-2 py-0.5 rounded text-[11px] font-bold">
                      {currentQ?.variableName || `VAR_${currentStepIndex + 1}`}
                    </span>
                  </span>
                  <span className="font-bold text-[#006a68]">{progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-[#dde2f3] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#006a68] transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Validation alert */}
              {validationError && (
                <div className="p-3 rounded-xl bg-[#ffdad6] border border-[#ba1a1a]/30 text-[#93000a] text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{validationError}</span>
                </div>
              )}

              {/* Question Card */}
              <div className="bg-white rounded-xl border border-[#c4c6cf]/60 p-5 sm:p-6 shadow-xs flex-1 flex flex-col justify-between space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-[#006a68]/10 text-[#006a68] text-[10px] font-bold uppercase border border-[#006a68]/20">
                      {currentQ?.number || `Q${currentStepIndex + 1}`}
                    </span>
                    {currentQ?.required && (
                      <span className="text-[10px] font-bold text-[#ba1a1a] uppercase tracking-wider">
                        * Required
                      </span>
                    )}
                    {currentQ?.section && (
                      <span className="text-[10px] text-[#74777f] font-medium truncate max-w-xs">
                        {currentQ.section}
                      </span>
                    )}
                  </div>

                  <h2 className="text-base sm:text-lg font-bold text-[#002045] leading-snug mb-1">
                    {currentQ?.title}
                  </h2>

                  {currentQ?.helpText && (
                    <p className="text-xs text-[#43474e] mt-1 bg-[#f1f3ff] p-2.5 rounded-lg border border-[#c4c6cf]/30">
                      ℹ️ {currentQ.helpText}
                    </p>
                  )}
                </div>

                {/* Input Fields depending on Question Type */}
                <div className="py-2">
                  {/* Multiple Choice & Dropdown */}
                  {(currentQ?.type === 'multiple-choice' || currentQ?.type === 'dropdown') && (
                    <div className="space-y-2">
                      {currentQ.options && currentQ.options.length > 0 ? (
                        currentQ.options.map((opt) => {
                          const isSelected = answers[currentQ.variableName] === opt.label || answers[currentQ.variableName] === opt.numericCode;
                          return (
                            <label
                              key={opt.id}
                              onClick={() => setAnswer(opt.label)}
                              className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-[#006a68]/10 border-[#006a68] text-[#006a68] font-bold shadow-xs'
                                  : 'bg-[#f9f9ff] border-[#c4c6cf]/60 hover:bg-[#f1f3ff] text-[#161c27]'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                  isSelected ? 'border-[#006a68] bg-[#006a68] text-white' : 'border-[#c4c6cf]'
                                }`}>
                                  {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                                </div>
                                <span className="text-xs sm:text-sm">{opt.label}</span>
                              </div>
                              {opt.numericCode !== undefined && (
                                <span className="text-[10px] font-mono text-[#74777f] bg-white px-2 py-0.5 rounded border border-[#c4c6cf]/40">
                                  Code: {opt.numericCode}
                                </span>
                              )}
                            </label>
                          );
                        })
                      ) : (
                        <input
                          type="text"
                          value={answers[currentQ.variableName] || ''}
                          onChange={(e) => setAnswer(e.target.value)}
                          placeholder="Type answer..."
                          className="w-full p-3 text-sm rounded-xl border border-[#c4c6cf] focus:border-[#006a68] outline-none"
                        />
                      )}
                    </div>
                  )}

                  {/* Likert Scale */}
                  {currentQ?.type === 'likert' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                        {[1, 2, 3, 4, 5].map((val) => {
                          const isSelected = answers[currentQ.variableName] === val;
                          const optLabel = currentQ.options?.find(o => o.numericCode === val)?.label;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setAnswer(val)}
                              className={`p-3 sm:p-4 rounded-xl border flex flex-col items-center justify-center transition-all ${
                                isSelected
                                  ? 'bg-[#006a68] border-[#006a68] text-white font-bold shadow-md scale-105'
                                  : 'bg-[#f9f9ff] border-[#c4c6cf]/70 hover:bg-[#f1f3ff] text-[#161c27]'
                              }`}
                            >
                              <span className="text-base sm:text-lg font-bold">{val}</span>
                              <span className="text-[9px] sm:text-[10px] mt-1 text-center line-clamp-1 opacity-80">
                                {optLabel || (val === 1 ? 'Disagree' : val === 5 ? 'Agree' : '')}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Number Input */}
                  {currentQ?.type === 'number' && (
                    <div className="space-y-2">
                      <input
                        type="number"
                        autoFocus
                        value={answers[currentQ.variableName] ?? ''}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Enter numerical observation..."
                        className="w-full p-3.5 text-base rounded-xl border border-[#c4c6cf] focus:border-[#006a68] focus:ring-2 focus:ring-[#006a68]/20 outline-none bg-white font-mono"
                      />
                      {currentQ.validationRules && (
                        <p className="text-[11px] text-[#74777f]">
                          Allowed Range: {currentQ.validationRules.min ?? 0} to {currentQ.validationRules.max ?? 100}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Text & Paragraph */}
                  {(currentQ?.type === 'short-text' || currentQ?.type === 'paragraph') && (
                    <textarea
                      rows={currentQ.type === 'paragraph' ? 4 : 2}
                      autoFocus
                      value={answers[currentQ.variableName] || ''}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Type enumerator field observations..."
                      className="w-full p-3.5 text-sm rounded-xl border border-[#c4c6cf] focus:border-[#006a68] focus:ring-2 focus:ring-[#006a68]/20 outline-none bg-white"
                    />
                  )}

                  {/* Checkboxes */}
                  {currentQ?.type === 'checkboxes' && (
                    <div className="space-y-2">
                      {currentQ.options?.map((opt) => {
                        const currentArr = Array.isArray(answers[currentQ.variableName]) ? answers[currentQ.variableName] : [];
                        const isChecked = currentArr.includes(opt.label);
                        return (
                          <label
                            key={opt.id}
                            className={`flex items-center p-3 rounded-xl border cursor-pointer transition-colors ${
                              isChecked ? 'bg-[#006a68]/10 border-[#006a68]' : 'bg-[#f9f9ff] border-[#c4c6cf]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAnswer([...currentArr, opt.label]);
                                } else {
                                  setAnswer(currentArr.filter((x: string) => x !== opt.label));
                                }
                              }}
                              className="w-4 h-4 text-[#006a68] rounded"
                            />
                            <span className="ml-3 text-xs sm:text-sm text-[#161c27]">{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer Tagging info */}
                <div className="pt-3 border-t border-[#c4c6cf]/30 flex justify-between items-center text-[11px] text-[#74777f]">
                  <span>Tag: <strong className="text-[#002045] font-mono">{enumeratorName}</strong></span>
                  <span>DataType: {currentQ?.dataType || 'Categorical'}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Submission Success Screen */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4 my-auto">
              <div className="w-16 h-16 rounded-full bg-[#006a68]/10 border border-[#006a68]/30 flex items-center justify-center text-[#006a68]">
                <span className="material-symbols-outlined text-4xl">verified</span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-[#002045]">Field Survey Saved to Database</h3>
                <p className="text-xs text-[#43474e] mt-1 max-w-md">
                  Response record <strong className="font-mono text-[#006a68]">#{submittedRecordId}</strong> has been tagged with your Enumerator identity and stored in the research database repository.
                </p>
              </div>

              {/* Tagged Summary Box */}
              <div className="w-full max-w-md bg-white p-4 rounded-xl border border-[#c4c6cf]/50 text-left space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[#c4c6cf]/30">
                  <span className="text-[#74777f]">Recorded By:</span>
                  <span className="font-bold text-[#002045]">{enumeratorName} ({enumeratorId})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#c4c6cf]/30">
                  <span className="text-[#74777f]">Storage Mode:</span>
                  <span className="font-bold text-[#006a68]">
                    {isOfflineMode ? 'Encrypted Local Storage (Pending Sync)' : 'Supabase PostgreSQL Cloud'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#74777f]">Variables Recorded:</span>
                  <span className="font-mono font-bold text-[#002045]">{Object.keys(answers).length} Variables</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStepIndex(0);
                    setAnswers({});
                    setIsCompleted(false);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#006a68] text-white text-xs font-bold hover:bg-[#004e4c] transition-all flex items-center gap-2 shadow-xs"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  <span>Record Another Household</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-[#c4c6cf] text-[#002045] text-xs font-bold hover:bg-[#f1f3ff] transition-all"
                >
                  Back to Operations
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Step Navigation Bar */}
        {!isCompleted && (
          <div className="bg-white border-t border-[#c4c6cf]/60 p-3 sm:p-4 flex justify-between items-center shrink-0">
            <button
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className={`px-4 py-2 rounded-lg border border-[#c4c6cf] text-xs font-bold text-[#002045] flex items-center gap-1.5 transition-colors ${
                currentStepIndex === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#f1f3ff]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>Back</span>
            </button>

            <div className="text-[11px] text-[#74777f] hidden sm:block">
              {isOfflineMode ? '⚡ Offline Encrypted Queue' : '☁️ Connected to Cloud'}
            </div>

            <button
              onClick={handleNext}
              disabled={isSubmitting}
              className="px-6 py-2 rounded-lg bg-[#006a68] hover:bg-[#004e4c] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Saving Record...</span>
              ) : currentStepIndex === totalQuestions - 1 ? (
                <>
                  <span className="material-symbols-outlined text-sm">send</span>
                  <span>Submit Form</span>
                </>
              ) : (
                <>
                  <span>Next Question</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
