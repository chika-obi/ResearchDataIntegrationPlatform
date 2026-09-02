import { Question, LogicBranch, LogicClause, QuestionLogicRule } from '../types';

/**
 * Evaluates a single condition clause against collected survey answers
 */
export function evaluateClause(clause: LogicClause, answers: Record<string, any>): boolean {
  if (!clause.sourceVariable) return true;
  const actualValue = answers[clause.sourceVariable];

  switch (clause.operator) {
    case 'equals':
      if (actualValue === undefined || actualValue === null) return false;
      return String(actualValue).trim().toLowerCase() === String(clause.value).trim().toLowerCase();

    case 'not_equals':
      if (actualValue === undefined || actualValue === null) return true;
      return String(actualValue).trim().toLowerCase() !== String(clause.value).trim().toLowerCase();

    case 'contains':
      if (actualValue === undefined || actualValue === null) return false;
      if (Array.isArray(actualValue)) {
        return actualValue.some((item) =>
          String(item).toLowerCase().includes(String(clause.value).toLowerCase())
        );
      }
      return String(actualValue).toLowerCase().includes(String(clause.value).toLowerCase());

    case 'greater_than': {
      const numActual = Number(actualValue);
      const numTarget = Number(clause.value);
      return !isNaN(numActual) && !isNaN(numTarget) && numActual > numTarget;
    }

    case 'less_than': {
      const numActual = Number(actualValue);
      const numTarget = Number(clause.value);
      return !isNaN(numActual) && !isNaN(numTarget) && numActual < numTarget;
    }

    case 'is_empty':
      return actualValue === undefined || actualValue === null || actualValue === '' || (Array.isArray(actualValue) && actualValue.length === 0);

    case 'is_not_empty':
      return actualValue !== undefined && actualValue !== null && actualValue !== '' && (!Array.isArray(actualValue) || actualValue.length > 0);

    default:
      return true;
  }
}

/**
 * Evaluates an entire branch (IF or ELIF) with multiple clauses (AND/OR)
 */
export function evaluateBranch(branch: LogicBranch, answers: Record<string, any>): boolean {
  if (branch.branchType === 'ELSE') return true;
  if (!branch.clauses || branch.clauses.length === 0) return true;

  const matchType = branch.matchType || 'ALL';

  if (matchType === 'ALL') {
    return branch.clauses.every((clause) => evaluateClause(clause, answers));
  } else {
    return branch.clauses.some((clause) => evaluateClause(clause, answers));
  }
}

/**
 * Evaluates the full IF - ELIF - ELSE chain for a question
 * Returns { isVisible: boolean, action: LogicAction, targetQuestionId?: string }
 */
export function evaluateQuestionLogic(
  rule: QuestionLogicRule | undefined,
  answers: Record<string, any>
): { isVisible: boolean; triggeredBranch?: LogicBranch; action?: string; targetQuestionId?: string } {
  if (!rule || !rule.enabled || !rule.branches || rule.branches.length === 0) {
    return { isVisible: true };
  }

  // Iterate sequentially: IF -> ELIF(s) -> ELSE
  for (const branch of rule.branches) {
    const isSatisfied = evaluateBranch(branch, answers);
    if (isSatisfied) {
      if (branch.action === 'hide') {
        return { isVisible: false, triggeredBranch: branch, action: 'hide' };
      }
      if (branch.action === 'show') {
        return { isVisible: true, triggeredBranch: branch, action: 'show' };
      }
      if (branch.action === 'skip_to') {
        return {
          isVisible: true,
          triggeredBranch: branch,
          action: 'skip_to',
          targetQuestionId: branch.targetQuestionId
        };
      }
      if (branch.action === 'end_survey') {
        return {
          isVisible: true,
          triggeredBranch: branch,
          action: 'end_survey'
        };
      }
      return { isVisible: true, triggeredBranch: branch, action: branch.action };
    }
  }

  // Default if no branch matched
  return { isVisible: true };
}

/**
 * Generates a clean human-readable representation of the IF-ELIF-ELSE rule
 */
export function formatLogicExpression(rule: QuestionLogicRule | undefined, allQuestions: Question[] = []): string {
  if (!rule || !rule.enabled || !rule.branches || rule.branches.length === 0) {
    return 'No conditional rules active (Always visible)';
  }

  return rule.branches
    .map((branch) => {
      const branchLabel = branch.branchType;
      const actionText =
        branch.action === 'show'
          ? 'THEN SHOW Question'
          : branch.action === 'hide'
          ? 'THEN HIDE Question'
          : branch.action === 'skip_to'
          ? `THEN SKIP TO ${allQuestions?.find((q) => q.id === branch.targetQuestionId)?.number || branch.targetQuestionId || 'Next Section'}`
          : branch.action === 'require'
          ? 'THEN MAKE REQUIRED'
          : 'THEN END SURVEY';

      if (branch.branchType === 'ELSE') {
        return `ELSE ${actionText}`;
      }

      const clausesText = branch.clauses
        .map((c) => {
          const qObj = allQuestions?.find((q) => q.variableName === c.sourceVariable);
          const varLabel = qObj ? `${qObj.number} (${c.sourceVariable})` : c.sourceVariable || 'Variable';
          const opLabel =
            c.operator === 'equals'
              ? '=='
              : c.operator === 'not_equals'
              ? '!='
              : c.operator === 'greater_than'
              ? '>'
              : c.operator === 'less_than'
              ? '<'
              : c.operator === 'contains'
              ? 'contains'
              : c.operator === 'is_empty'
              ? 'is empty'
              : 'is not empty';
          const valLabel =
            c.operator === 'is_empty' || c.operator === 'is_not_empty'
              ? ''
              : ` "${c.value ?? ''}"`;
          return `${varLabel} ${opLabel}${valLabel}`;
        })
        .join(branch.matchType === 'ANY' ? ' OR ' : ' AND ');

      return `${branchLabel} (${clausesText || 'True'}) ${actionText}`;
    })
    .join('\n');
}
