import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Question } from '../types';
import { evaluateQuestionLogic } from '../lib/surveyLogicEvaluator';

interface PublicSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions?: Question[];
  surveyTitle?: string;
}

export const PublicSurveyModal: React.FC<PublicSurveyModalProps> = ({
  isOpen,
  onClose,
  questions: propQuestions,
  surveyTitle: propSurveyTitle
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Load active questionnaire from props or localStorage
  const questions: Question[] = React.useMemo(() => {
    if (propQuestions && propQuestions.length > 0) return propQuestions;
    const saved = localStorage.getItem('rdip_active_questionnaire');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return [
      {
        id: 'q1',
        number: 'Q1',
        title: 'Respondent Age at Last Birthday',
        variableName: 'AGE_YEARS',
        type: 'number',
        required: true,
        dataType: 'Numerical',
        measurementLevel: 'Ratio',
        validationRules: { min: 18, max: 120 }
      },
      {
        id: 'q2',
        number: 'Q2',
        title: 'Primary Research Methodology Orientation',
        variableName: 'RESEARCH_METHOD',
        type: 'multiple-choice',
        required: true,
        dataType: 'Categorical',
        measurementLevel: 'Nominal',
        options: [
          { id: 'opt-1', label: 'Quantitative Methods', numericCode: 1 },
          { id: 'opt-2', label: 'Qualitative Analysis', numericCode: 2 },
          { id: 'opt-3', label: 'Mixed Methods Approach', numericCode: 3 },
          { id: 'opt-4', label: 'Theoretical Frameworks', numericCode: 4 }
        ]
      }
    ];
  }, [propQuestions, isOpen]);

  const surveyTitle = propSurveyTitle || localStorage.getItem('rdip_survey_title') || 'National Health Infrastructure Assessment';

  if (!isOpen) return null;

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
    // Check if current question triggers a direct skip or end_survey action
    const currentEval = evaluateQuestionLogic(currentQ?.logicRule, answers);
    if (currentEval.action === 'end_survey') {
      setIsSubmitted(true);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
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
      setIsSubmitted(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  const handlePrev = () => {
    const prevIdx = getPrevVisibleIndex(currentStepIndex);
    setCurrentStepIndex(prevIdx);
  };

  const setAnswer = (val: any) => {
    setAnswers({
      ...answers,
      [currentQ.id]: val,
      [currentQ.variableName]: val
    });
  };

  return (
    <div className="fixed inset-0 z-[120] bg-[#f9f9ff] flex flex-col antialiased overflow-y-auto animate-in fade-in">
      {/* Top Header */}
      <header className="bg-white border-b border-[#c4c6cf]/60 flex justify-between items-center w-full px-4 md:px-8 h-16 sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1a365d] flex items-center justify-center text-white font-bold">
            <span className="material-symbols-outlined text-[20px]">science</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#002045] leading-tight m-0">
              {surveyTitle}
            </h1>
            <p className="text-[11px] text-[#43474e] leading-tight m-0 opacity-85">
              RDIP Survey Portal • Active Deployment Respondent View
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-[#43474e] hover:bg-[#f1f3ff] transition-colors p-2 rounded-full cursor-pointer"
          title="Exit Survey Preview"
        >
          <span className="material-symbols-outlined text-[22px]">close</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col w-full max-w-[620px] mx-auto px-4 py-6 md:py-10">
        {!isSubmitted ? (
          <>
            {/* Progress Indicator */}
            <div className="mb-6">
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-semibold text-[#43474e]">
                  Question {currentStepIndex + 1} of {totalQuestions} • Variable: <span className="font-mono text-[#002045] font-bold">{currentQ?.variableName}</span>
                </span>
                <span className="text-xs font-bold text-[#002045]">
                  {progressPercent}% Completed
                </span>
              </div>
              <div className="w-full h-2 bg-[#dde2f3] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#002045] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Question Card */}
            <div className="bg-white rounded-xl shadow-md p-6 md:p-8 flex-grow flex flex-col border border-[#c4c6cf]/40">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded bg-[#1a365d]/10 text-[#1a365d] text-[10px] font-bold uppercase">
                    {currentQ?.number || `Q${currentStepIndex + 1}`}
                  </span>
                  {currentQ?.required && (
                    <span className="text-[10px] text-[#ba1a1a] font-semibold uppercase tracking-wider">
                      * Required
                    </span>
                  )}
                  <span className="text-[10px] text-[#74777f] font-mono">
                    [{currentQ?.dataType} / {currentQ?.measurementLevel}]
                  </span>
                </div>
                <h2 className="text-lg md:text-xl font-bold text-[#161c27] mb-1.5">
                  {currentQ?.title}
                </h2>
                {currentQ?.helpText && (
                  <p className="text-xs text-[#43474e] leading-relaxed mt-1">
                    {currentQ.helpText}
                  </p>
                )}
              </div>

              {/* Options / Input Form */}
              <div className="flex flex-col gap-3 flex-grow justify-center">
                {/* Multiple Choice */}
                {currentQ?.type === 'multiple-choice' && (
                  <div className="flex flex-col gap-2.5">
                    {currentQ.options?.map((opt) => {
                      const isChecked = answers[currentQ.id] === opt.label || answers[currentQ.id] === opt.numericCode;
                      return (
                        <label
                          key={opt.id}
                          onClick={() => setAnswer(opt.label)}
                          className={`relative flex items-center p-4 border rounded-xl cursor-pointer transition-all duration-150 ${
                            isChecked
                              ? 'border-[#002045] bg-[#e3e8f9]/50 shadow-xs font-semibold text-[#002045]'
                              : 'border-[#c4c6cf]/70 hover:bg-[#f1f3ff] text-[#161c27]'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q_${currentQ.id}`}
                            value={opt.numericCode}
                            checked={isChecked}
                            onChange={() => setAnswer(opt.label)}
                            className="w-4 h-4 text-[#002045] border-[#c4c6cf] focus:ring-[#002045]"
                          />
                          <span className="ml-3 text-sm">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Likert Scale */}
                {currentQ?.type === 'likert' && (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAnswer(val)}
                          className={`p-4 rounded-xl border flex flex-col items-center justify-center transition-all ${
                            answers[currentQ.id] === val
                              ? 'border-[#002045] bg-[#002045] text-white font-bold shadow-md'
                              : 'border-[#c4c6cf]/80 bg-[#f9f9ff] text-[#161c27] hover:bg-[#f1f3ff]'
                          }`}
                        >
                          <span className="text-lg font-bold">{val}</span>
                          <span className="text-[10px] mt-1 opacity-80 text-center">
                            {val === 1 ? 'Disagree' : val === 5 ? 'Agree' : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Number Input */}
                {currentQ?.type === 'number' && (
                  <div className="space-y-2">
                    <input
                      type="number"
                      value={answers[currentQ.id] || ''}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Enter numeric response value..."
                      className="w-full p-4 text-base border border-[#c4c6cf] rounded-xl focus:border-[#002045] focus:ring-2 focus:ring-[#002045]/20 outline-none bg-[#f9f9ff]"
                    />
                    {currentQ.validationRules && (
                      <p className="text-[11px] text-[#74777f]">
                        Range: {currentQ.validationRules.min ?? 0} – {currentQ.validationRules.max ?? 100}
                      </p>
                    )}
                  </div>
                )}

                {/* Short text & paragraph */}
                {(currentQ?.type === 'short-text' || currentQ?.type === 'paragraph') && (
                  <textarea
                    rows={currentQ.type === 'paragraph' ? 4 : 2}
                    value={answers[currentQ.id] || ''}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Enter response details..."
                    className="w-full p-3.5 text-sm border border-[#c4c6cf] rounded-xl focus:border-[#002045] focus:ring-2 focus:ring-[#002045]/20 outline-none bg-[#f9f9ff]"
                  />
                )}

                {/* Checkboxes / Dropdown Fallback */}
                {(currentQ?.type === 'checkboxes' || currentQ?.type === 'dropdown') && (
                  <div className="flex flex-col gap-2">
                    {currentQ.options?.map((opt) => (
                      <label
                        key={opt.id}
                        className="flex items-center p-3.5 border border-[#c4c6cf]/70 rounded-xl hover:bg-[#f1f3ff] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-[#002045] rounded"
                          onChange={() => setAnswer(opt.label)}
                        />
                        <span className="ml-3 text-sm text-[#161c27]">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-8 text-center border border-[#c4c6cf]/40 my-auto animate-in zoom-in-95">
            <div className="w-16 h-16 bg-[#006a68]/10 text-[#006a68] rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">task_alt</span>
            </div>
            <h2 className="text-2xl font-bold text-[#002045] mb-2">
              Submission Complete
            </h2>
            <p className="text-sm text-[#43474e] max-w-md mx-auto mb-6">
              Thank you for participating in {surveyTitle}. Your responses have been verified, timestamped, and stored in the RDIP repository.
            </p>
            <button
              onClick={() => {
                setIsSubmitted(false);
                setCurrentStepIndex(0);
                onClose();
              }}
              className="px-6 py-2.5 bg-[#1a365d] text-white rounded-lg text-sm font-semibold hover:bg-[#002045] transition-colors"
            >
              Return to Builder
            </button>
          </div>
        )}
      </main>

      {/* Sticky Bottom Actions */}
      {!isSubmitted && (
        <footer className="bg-white border-t border-[#c4c6cf]/60 px-4 py-4 md:px-8 mt-auto sticky bottom-0 z-40 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
          <div className="max-w-[620px] mx-auto flex justify-between items-center w-full">
            <button
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className={`px-6 py-2 rounded-full border border-[#c4c6cf] text-[#002045] text-sm font-semibold flex items-center gap-2 transition-colors ${
                currentStepIndex === 0
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-[#f1f3ff]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>Previous</span>
            </button>

            <button
              onClick={handleNext}
              className="px-7 py-2.5 rounded-full bg-[#1a365d] text-white text-sm font-semibold hover:bg-[#002045] transition-all flex items-center gap-2 shadow-sm active:scale-95"
            >
              <span>{currentStepIndex === totalQuestions - 1 ? 'Submit Survey' : 'Next'}</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};
