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

        /* Keep the assignment form usable on short screens. */
        .rdip-assignment-modal-layer > .fixed.inset-0 > .relative > form {
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
          display: flex;
          flex-direction: column;
        }

        /* Put validation/error feedback below the form content, not over the header. */
        .rdip-assignment-modal-layer > .fixed.inset-0 > .relative > form > [role="alert"] {
          order: 10;
          position: static;
          z-index: auto;
          flex-shrink: 0;
        }

        /* Keep the action buttons at the very bottom after the feedback message. */
        .rdip-assignment-modal-layer > .fixed.inset-0 > .relative > form > div:last-child {
          order: 20;
          flex-shrink: 0;
        }

        /* Success feedback follows the assignment details, immediately before Done. */
        .rdip-assignment-modal-layer > .fixed.inset-0 > .relative > .p-6:not(form) {
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
          display: flex;
          flex-direction: column;
        }

        .rdip-assignment-modal-layer > .fixed.inset-0 > .relative > .p-6:not(form) > div:first-child {
          order: 10;
          flex-shrink: 0;
        }

        .rdip-assignment-modal-layer > .fixed.inset-0 > .relative > .p-6:not(form) > div:last-child {
          order: 20;
          flex-shrink: 0;
        }
      `}</style>
      <QuestionnaireAssignmentModalV2 {...props} />
    </div>
  );
};
