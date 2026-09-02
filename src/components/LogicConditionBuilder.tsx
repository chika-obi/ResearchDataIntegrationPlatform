import React from 'react';
import {
  Question,
  QuestionLogicRule,
  LogicBranch,
  LogicClause,
  LogicOperator,
  LogicAction
} from '../types';
import { formatLogicExpression } from '../lib/surveyLogicEvaluator';

interface LogicConditionBuilderProps {
  currentQuestion: Question;
  allQuestions: Question[];
  onUpdateLogic: (updatedLogic: QuestionLogicRule) => void;
}

export const LogicConditionBuilder: React.FC<LogicConditionBuilderProps> = ({
  currentQuestion,
  allQuestions,
  onUpdateLogic
}) => {
  const currentLogic: QuestionLogicRule = currentQuestion.logicRule || {
    enabled: false,
    branches: []
  };

  // Available source questions that come before or equal to this question
  const currentIdx = allQuestions.findIndex((q) => q.id === currentQuestion.id);
  const eligibleSourceQuestions = allQuestions.filter(
    (q, idx) => idx !== currentIdx && q.variableName
  );

  const handleToggleEnabled = (enabled: boolean) => {
    if (enabled && (!currentLogic.branches || currentLogic.branches.length === 0)) {
      // Initialize with default IF - THEN SHOW and ELSE - HIDE branch
      const firstSource = eligibleSourceQuestions[0] || currentQuestion;
      const initialBranch: LogicBranch = {
        id: `branch-${Date.now()}-if`,
        branchType: 'IF',
        matchType: 'ALL',
        clauses: [
          {
            id: `clause-${Date.now()}`,
            sourceVariable: firstSource.variableName,
            operator: 'equals',
            value: firstSource.options?.[0]?.label || '1'
          }
        ],
        action: 'show'
      };
      const fallbackElseBranch: LogicBranch = {
        id: `branch-${Date.now()}-else`,
        branchType: 'ELSE',
        clauses: [],
        action: 'hide'
      };
      onUpdateLogic({
        enabled: true,
        branches: [initialBranch, fallbackElseBranch]
      });
    } else {
      onUpdateLogic({
        ...currentLogic,
        enabled
      });
    }
  };

  const handleAddElifBranch = () => {
    const firstSource = eligibleSourceQuestions[0] || currentQuestion;
    const newElif: LogicBranch = {
      id: `branch-${Date.now()}-elif`,
      branchType: 'ELIF',
      matchType: 'ALL',
      clauses: [
        {
          id: `clause-${Date.now()}`,
          sourceVariable: firstSource.variableName,
          operator: 'equals',
          value: firstSource.options?.[0]?.label || ''
        }
      ],
      action: 'show'
    };

    // Insert before ELSE if ELSE exists, otherwise append
    const branches = [...(currentLogic.branches || [])];
    const elseIndex = branches.findIndex((b) => b.branchType === 'ELSE');
    if (elseIndex !== -1) {
      branches.splice(elseIndex, 0, newElif);
    } else {
      branches.push(newElif);
    }

    onUpdateLogic({
      ...currentLogic,
      branches
    });
  };

  const handleAddElseBranch = () => {
    const hasElse = currentLogic.branches.some((b) => b.branchType === 'ELSE');
    if (hasElse) return;

    const newElse: LogicBranch = {
      id: `branch-${Date.now()}-else`,
      branchType: 'ELSE',
      clauses: [],
      action: 'hide'
    };

    onUpdateLogic({
      ...currentLogic,
      branches: [...currentLogic.branches, newElse]
    });
  };

  const handleDeleteBranch = (branchId: string) => {
    const updated = currentLogic.branches.filter((b) => b.id !== branchId);
    onUpdateLogic({
      ...currentLogic,
      branches: updated
    });
  };

  const handleUpdateBranch = (branchId: string, updates: Partial<LogicBranch>) => {
    const updated = currentLogic.branches.map((b) =>
      b.id === branchId ? { ...b, ...updates } : b
    );
    onUpdateLogic({
      ...currentLogic,
      branches: updated
    });
  };

  const handleAddClause = (branchId: string) => {
    const firstSource = eligibleSourceQuestions[0] || currentQuestion;
    const newClause: LogicClause = {
      id: `clause-${Date.now()}`,
      sourceVariable: firstSource.variableName,
      operator: 'equals',
      value: firstSource.options?.[0]?.label || ''
    };

    const updated = currentLogic.branches.map((b) => {
      if (b.id === branchId) {
        return {
          ...b,
          clauses: [...b.clauses, newClause]
        };
      }
      return b;
    });

    onUpdateLogic({
      ...currentLogic,
      branches: updated
    });
  };

  const handleUpdateClause = (
    branchId: string,
    clauseId: string,
    updates: Partial<LogicClause>
  ) => {
    const updated = currentLogic.branches.map((b) => {
      if (b.id === branchId) {
        const updatedClauses = b.clauses.map((c) =>
          c.id === clauseId ? { ...c, ...updates } : c
        );
        return { ...b, clauses: updatedClauses };
      }
      return b;
    });

    onUpdateLogic({
      ...currentLogic,
      branches: updated
    });
  };

  const handleDeleteClause = (branchId: string, clauseId: string) => {
    const updated = currentLogic.branches.map((b) => {
      if (b.id === branchId) {
        return {
          ...b,
          clauses: b.clauses.filter((c) => c.id !== clauseId)
        };
      }
      return b;
    });

    onUpdateLogic({
      ...currentLogic,
      branches: updated
    });
  };

  // Quick Preset Handlers
  const applyPreset = (presetType: 'skip_unemployed' | 'followup_health' | 'distance_threshold') => {
    if (presetType === 'skip_unemployed') {
      const q3 = allQuestions.find((q) => q.variableName.includes('Employment') || q.number === 'Q3');
      const targetVar = q3 ? q3.variableName : (eligibleSourceQuestions[0]?.variableName || 'Q3_Employment_Status');
      
      onUpdateLogic({
        enabled: true,
        branches: [
          {
            id: `branch-${Date.now()}-1`,
            branchType: 'IF',
            matchType: 'ALL',
            clauses: [
              {
                id: `cl-${Date.now()}-1`,
                sourceVariable: targetVar,
                operator: 'equals',
                value: 'Formal Full-time Salary Employee'
              }
            ],
            action: 'show'
          },
          {
            id: `branch-${Date.now()}-2`,
            branchType: 'ELIF',
            matchType: 'ALL',
            clauses: [
              {
                id: `cl-${Date.now()}-2`,
                sourceVariable: targetVar,
                operator: 'equals',
                value: 'Agricultural Producer / Farmer'
              }
            ],
            action: 'show'
          },
          {
            id: `branch-${Date.now()}-3`,
            branchType: 'ELSE',
            clauses: [],
            action: 'hide'
          }
        ]
      });
    } else if (presetType === 'distance_threshold') {
      const q4 = allQuestions.find((q) => q.variableName.includes('Distance') || q.number === 'Q4');
      const targetVar = q4 ? q4.variableName : (eligibleSourceQuestions[0]?.variableName || 'Q4_Clinic_Distance_KM');

      onUpdateLogic({
        enabled: true,
        branches: [
          {
            id: `branch-${Date.now()}-1`,
            branchType: 'IF',
            matchType: 'ALL',
            clauses: [
              {
                id: `cl-${Date.now()}-1`,
                sourceVariable: targetVar,
                operator: 'greater_than',
                value: 5
              }
            ],
            action: 'show'
          },
          {
            id: `branch-${Date.now()}-2`,
            branchType: 'ELSE',
            clauses: [],
            action: 'hide'
          }
        ]
      });
    }
  };

  const hasElse = currentLogic.branches?.some((b) => b.branchType === 'ELSE');

  return (
    <div className="space-y-4">
      {/* Header & Master Toggle */}
      <div className="flex items-center justify-between p-3.5 bg-[#f1f3ff] rounded-xl border border-[#c4c6cf]/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#002045] text-[#91f0ed] flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">alt_route</span>
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#002045]">Conditional Logic & Branching</h4>
            <p className="text-[10px] text-[#43474e]">
              Define IF / ELIF / ELSE visibility & flow rules
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleToggleEnabled(!currentLogic.enabled)}
          className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer ${
            currentLogic.enabled ? 'bg-[#006a68]' : 'bg-[#c4c6cf]'
          }`}
        >
          <div
            className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${
              currentLogic.enabled ? 'right-1' : 'left-1'
            }`}
          />
        </button>
      </div>

      {!currentLogic.enabled ? (
        <div className="p-4 rounded-xl border border-dashed border-[#c4c6cf] text-center space-y-3 bg-white">
          <span className="material-symbols-outlined text-3xl text-[#74777f]">account_tree</span>
          <div>
            <p className="text-xs font-bold text-[#002045]">No Logic Conditions Configured</p>
            <p className="text-[11px] text-[#74777f] mt-0.5">
              This question is displayed unconditionally to all survey respondents.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleToggleEnabled(true)}
            className="px-3 py-1.5 bg-[#1a365d] hover:bg-[#002045] text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Enable IF-THEN-ELSE Rules</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Presets Bar */}
          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
            <span className="text-[#74777f] font-semibold">Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset('skip_unemployed')}
              className="px-2 py-0.5 bg-white border border-[#c4c6cf] rounded-md hover:border-[#006a68] text-[#002045] font-medium transition-colors"
            >
              💼 Employment Filter
            </button>
            <button
              type="button"
              onClick={() => applyPreset('distance_threshold')}
              className="px-2 py-0.5 bg-white border border-[#c4c6cf] rounded-md hover:border-[#006a68] text-[#002045] font-medium transition-colors"
            >
              📍 Distance &gt; 5km Filter
            </button>
          </div>

          {/* Logic Branches List */}
          <div className="space-y-3">
            {currentLogic.branches.map((branch, branchIndex) => {
              const isIf = branch.branchType === 'IF';
              const isElif = branch.branchType === 'ELIF';
              const isElse = branch.branchType === 'ELSE';

              const branchBadgeColor = isIf
                ? 'bg-[#1a365d] text-white'
                : isElif
                ? 'bg-[#6b21a8] text-white'
                : 'bg-[#43474e] text-white';

              const cardBorderColor = isIf
                ? 'border-[#1a365d]/40'
                : isElif
                ? 'border-[#6b21a8]/40'
                : 'border-[#74777f]/40';

              return (
                <div
                  key={branch.id}
                  className={`bg-white rounded-xl border ${cardBorderColor} shadow-xs p-3.5 space-y-3 transition-all`}
                >
                  {/* Branch Title Bar */}
                  <div className="flex items-center justify-between border-b border-[#c4c6cf]/30 pb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded tracking-wider ${branchBadgeColor}`}
                      >
                        {branch.branchType}
                      </span>
                      <span className="text-xs font-bold text-[#002045]">
                        {isIf
                          ? 'Initial Condition'
                          : isElif
                          ? `Else If Condition #${branchIndex}`
                          : 'Fallback Default (When no prior conditions match)'}
                      </span>
                    </div>

                    {!isIf && (
                      <button
                        type="button"
                        onClick={() => handleDeleteBranch(branch.id)}
                        className="text-[#74777f] hover:text-[#ba1a1a] p-1 rounded transition-colors"
                        title="Delete Branch"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}
                  </div>

                  {/* If / Elif Condition Clauses */}
                  {!isElse && (
                    <div className="space-y-2.5">
                      {/* Match type selector if multiple clauses */}
                      {branch.clauses.length > 1 && (
                        <div className="flex items-center gap-2 text-[11px] text-[#43474e]">
                          <span>Match</span>
                          <select
                            value={branch.matchType || 'ALL'}
                            onChange={(e) =>
                              handleUpdateBranch(branch.id, {
                                matchType: e.target.value as 'ALL' | 'ANY'
                              })
                            }
                            className="p-1 rounded bg-[#f1f3ff] border border-[#c4c6cf] font-bold text-[#002045] text-xs outline-none"
                          >
                            <option value="ALL">ALL (AND) Conditions</option>
                            <option value="ANY">ANY (OR) Condition</option>
                          </select>
                        </div>
                      )}

                      {/* Clauses list */}
                      {branch.clauses.map((clause, clauseIdx) => {
                        const selectedSourceQ = allQuestions.find(
                          (q) => q.variableName === clause.sourceVariable
                        );

                        return (
                          <div
                            key={clause.id}
                            className="bg-[#f9f9ff] p-2.5 rounded-lg border border-[#c4c6cf]/40 space-y-2"
                          >
                            <div className="flex items-center justify-between text-[11px] font-semibold text-[#74777f]">
                              <span>
                                Clause #{clauseIdx + 1}
                                {clauseIdx > 0 && (
                                  <strong className="text-[#006a68] ml-1">
                                    [{branch.matchType || 'AND'}]
                                  </strong>
                                )}
                              </span>
                              {branch.clauses.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClause(branch.id, clause.id)}
                                  className="text-[#ba1a1a] hover:underline text-[10px]"
                                >
                                  Remove
                                </button>
                              )}
                            </div>

                            {/* Source Question & Operator & Value */}
                            <div className="grid grid-cols-1 gap-2">
                              <div>
                                <label className="text-[10px] text-[#74777f] font-medium block mb-0.5">
                                  When Question Variable:
                                </label>
                                <select
                                  value={clause.sourceVariable}
                                  onChange={(e) =>
                                    handleUpdateClause(branch.id, clause.id, {
                                      sourceVariable: e.target.value,
                                      value: ''
                                    })
                                  }
                                  className="w-full p-1.5 text-xs bg-white border border-[#c4c6cf] rounded focus:border-[#006a68] outline-none font-mono"
                                >
                                  {eligibleSourceQuestions.map((q) => (
                                    <option key={q.id} value={q.variableName}>
                                      {q.number}: {q.title.slice(0, 32)}... ({q.variableName})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-[#74777f] font-medium block mb-0.5">
                                    Operator:
                                  </label>
                                  <select
                                    value={clause.operator}
                                    onChange={(e) =>
                                      handleUpdateClause(branch.id, clause.id, {
                                        operator: e.target.value as LogicOperator
                                      })
                                    }
                                    className="w-full p-1.5 text-xs bg-white border border-[#c4c6cf] rounded focus:border-[#006a68] outline-none"
                                  >
                                    <option value="equals">is equal to (==)</option>
                                    <option value="not_equals">is not equal to (!=)</option>
                                    <option value="contains">contains text</option>
                                    <option value="greater_than">greater than (&gt;)</option>
                                    <option value="less_than">less than (&lt;)</option>
                                    <option value="is_empty">is empty / skipped</option>
                                    <option value="is_not_empty">is answered (not empty)</option>
                                  </select>
                                </div>

                                {clause.operator !== 'is_empty' && clause.operator !== 'is_not_empty' && (
                                  <div>
                                    <label className="text-[10px] text-[#74777f] font-medium block mb-0.5">
                                      Compare Value:
                                    </label>
                                    {selectedSourceQ?.options && selectedSourceQ.options.length > 0 ? (
                                      <select
                                        value={clause.value || ''}
                                        onChange={(e) =>
                                          handleUpdateClause(branch.id, clause.id, {
                                            value: e.target.value
                                          })
                                        }
                                        className="w-full p-1.5 text-xs bg-white border border-[#c4c6cf] rounded focus:border-[#006a68] outline-none"
                                      >
                                        <option value="">Select option value...</option>
                                        {selectedSourceQ.options.map((opt) => (
                                          <option key={opt.id} value={opt.label}>
                                            {opt.label} {opt.numericCode ? `[${opt.numericCode}]` : ''}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        type={selectedSourceQ?.type === 'number' ? 'number' : 'text'}
                                        value={clause.value ?? ''}
                                        placeholder="Enter value to compare..."
                                        onChange={(e) =>
                                          handleUpdateClause(branch.id, clause.id, {
                                            value: e.target.value
                                          })
                                        }
                                        className="w-full p-1.5 text-xs bg-white border border-[#c4c6cf] rounded focus:border-[#006a68] outline-none"
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => handleAddClause(branch.id)}
                        className="text-[11px] text-[#006a68] hover:underline font-bold flex items-center gap-1 mt-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span>
                        <span>Add AND/OR condition clause</span>
                      </button>
                    </div>
                  )}

                  {/* THEN Action Selector */}
                  <div className="pt-2 border-t border-[#c4c6cf]/30 bg-[#f1f3ff] p-2.5 rounded-lg space-y-1.5">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-[#002045]">
                      <span className="material-symbols-outlined text-[15px] text-[#006a68]">
                        play_arrow
                      </span>
                      <span>THEN Action:</span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      <select
                        value={branch.action}
                        onChange={(e) =>
                          handleUpdateBranch(branch.id, {
                            action: e.target.value as LogicAction
                          })
                        }
                        className="w-full p-1.5 text-xs bg-white border border-[#c4c6cf] rounded-lg font-bold text-[#002045] focus:border-[#006a68] outline-none"
                      >
                        <option value="show">👁️ SHOW this question</option>
                        <option value="hide">🚫 HIDE this question</option>
                        <option value="skip_to">⏩ SKIP TO another question</option>
                        <option value="require">⚠️ Make this question Required</option>
                        <option value="end_survey">🛑 Disqualify / End Survey</option>
                      </select>

                      {branch.action === 'skip_to' && (
                        <div>
                          <label className="text-[10px] text-[#74777f] font-medium block mb-0.5">
                            Target Question to Jump To:
                          </label>
                          <select
                            value={branch.targetQuestionId || ''}
                            onChange={(e) =>
                              handleUpdateBranch(branch.id, {
                                targetQuestionId: e.target.value
                              })
                            }
                            className="w-full p-1.5 text-xs bg-white border border-[#c4c6cf] rounded focus:border-[#006a68] outline-none font-mono"
                          >
                            <option value="">Select target question...</option>
                            {allQuestions
                              .filter((q) => q.id !== currentQuestion.id)
                              .map((q) => (
                                <option key={q.id} value={q.id}>
                                  {q.number}: {q.title.slice(0, 30)}...
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add ELIF / ELSE Controls */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              type="button"
              onClick={handleAddElifBranch}
              className="px-3 py-1.5 rounded-lg border border-[#6b21a8]/40 bg-[#6b21a8]/10 hover:bg-[#6b21a8]/20 text-[#6b21a8] text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">add_circle</span>
              <span>+ Add ELIF Branch</span>
            </button>

            {!hasElse && (
              <button
                type="button"
                onClick={handleAddElseBranch}
                className="px-3 py-1.5 rounded-lg border border-[#43474e]/40 bg-[#43474e]/10 hover:bg-[#43474e]/20 text-[#43474e] text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">add_circle</span>
                <span>+ Add ELSE Fallback</span>
              </button>
            )}
          </div>

          {/* Code Expression Visualizer Preview */}
          <div className="bg-[#002045] rounded-xl p-3 text-white space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#91f0ed] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">code</span>
                Evaluated Logic Expression
              </span>
              <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white/80">
                Live Rule Engine
              </span>
            </div>

            <pre className="font-mono text-[11px] text-[#dde2f3] bg-[#00142b] p-2.5 rounded-lg whitespace-pre-wrap leading-relaxed border border-white/10">
              {formatLogicExpression(currentLogic, allQuestions)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
