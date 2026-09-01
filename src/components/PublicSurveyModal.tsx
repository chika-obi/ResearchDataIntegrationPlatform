import React, { useState } from 'react';
import confetti from 'canvas-confetti';

interface PublicSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PublicSurveyModal: React.FC<PublicSurveyModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(3);
  const [selectedFocus, setSelectedFocus] = useState('mixed');
  const [responses, setResponses] = useState<Record<number, string>>({
    1: '34',
    2: 'Formal Employment (Salary/Wage)',
    3: 'mixed'
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const totalQuestions = 15;
  const progressPercent = Math.round((currentStep / totalQuestions) * 100);

  const options = [
    { id: 'quantitative', label: 'Quantitative Methods' },
    { id: 'qualitative', label: 'Qualitative Analysis' },
    { id: 'mixed', label: 'Mixed Methods Approach' },
    { id: 'theoretical', label: 'Theoretical Frameworks' },
    { id: 'other', label: 'Other / Undecided' }
  ];

  const handleNext = () => {
    if (currentStep < totalQuestions) {
      setCurrentStep((prev) => prev + 1);
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
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
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
              Global Research Institute
            </h1>
            <p className="text-[11px] text-[#43474e] leading-tight m-0 opacity-85">
              RDIP Survey Portal • Field Participant View
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
                  Question {currentStep} of {totalQuestions}
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
                <h2 className="text-lg md:text-xl font-bold text-[#161c27] mb-1.5">
                  Primary Research Focus
                </h2>
                <p className="text-sm text-[#43474e] leading-relaxed">
                  Please select the area that best describes your current primary research focus and methodological orientation. Choose one option.
                </p>
              </div>

              {/* Options */}
              <div className="flex flex-col gap-3 flex-grow">
                {options.map((opt) => {
                  const isChecked = selectedFocus === opt.id;
                  return (
                    <label
                      key={opt.id}
                      onClick={() => setSelectedFocus(opt.id)}
                      className={`relative flex items-center p-4 border rounded-xl cursor-pointer transition-all duration-150 ${
                        isChecked
                          ? 'border-[#002045] bg-[#e3e8f9]/50 shadow-xs'
                          : 'border-[#c4c6cf]/70 hover:bg-[#f1f3ff]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="research_focus"
                        value={opt.id}
                        checked={isChecked}
                        onChange={() => setSelectedFocus(opt.id)}
                        className="w-5 h-5 text-[#002045] border-[#c4c6cf] focus:ring-[#002045]"
                      />
                      <span
                        className={`ml-3.5 text-sm md:text-[15px] text-[#161c27] ${
                          isChecked ? 'font-semibold text-[#002045]' : 'font-normal'
                        }`}
                      >
                        {opt.label}
                      </span>
                    </label>
                  );
                })}
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
              Thank you for participating in the National Demographics & Research Focus Survey. Your responses have been verified and encrypted.
            </p>
            <button
              onClick={() => {
                setIsSubmitted(false);
                setCurrentStep(3);
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
              disabled={currentStep === 1}
              className={`px-6 py-2 rounded-full border border-[#c4c6cf] text-[#002045] text-sm font-semibold flex items-center gap-2 transition-colors ${
                currentStep === 1
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
              <span>{currentStep === totalQuestions ? 'Submit Survey' : 'Next'}</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};
