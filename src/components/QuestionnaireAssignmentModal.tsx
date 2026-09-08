import React from 'react';
import { QuestionnaireAssignmentModal as QuestionnaireAssignmentModalV2 } from './QuestionnaireAssignmentModalV2';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * UI shell for the questionnaire-assignment dialog.
 * Keeps the existing V2 implementation intact while providing viewport-safe
 * scrolling and predictable notification/modal stacking.
 */
export const QuestionnaireAssignmentModal: React.FC<Props> = (props) => {
  if (!props.isOpen) return <QuestionnaireAssignmentModalV2 {...props} />;

  return (
    <div className="rdip-assignment-modal-layer">
      <style>{`
        .rdip-assignment-modal-layer > .fixed.inset-0 {
          z-index: 90 !important;
        }

        .rdip-assignment-modal-layer > .fixed.inset-0 > .relative {
          max-height: calc(100vh - 2rem);
          display: flex;
          flex-direction: column;
        }

        .rdip-assignment-modal-layer > .fixed.inset-0 > .relative > form,
        .rdip-assignment-modal-layer > .fixed.inset-0 > .relative > .p-6 {
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
        }

        .rdip-assignment-modal-layer > .fixed.inset-0 > .relative > form > [role="alert"] {
          position: sticky;
          top: 0;
          z-index: 5;
        }
      `}</style>
      <QuestionnaireAssignmentModalV2 {...props} />
    </div>
  );
};
