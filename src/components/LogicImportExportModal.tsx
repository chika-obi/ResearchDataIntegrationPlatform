import React, { useState, useRef } from 'react';
import { Question, SurveyLogicFlowExport, LogicImportResult } from '../types';
import {
  buildLogicFlowExportData,
  downloadLogicFlowJSON,
  validateLogicFlowJSON,
  applyImportedLogicFlow
} from '../lib/logicImportExport';
import { formatLogicExpression } from '../lib/surveyLogicEvaluator';

interface LogicImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  surveyTitle: string;
  onApplyImportedQuestions: (updatedQuestions: Question[], notificationMsg?: string) => void;
}

export const LogicImportExportModal: React.FC<LogicImportExportModalProps> = ({
  isOpen,
  onClose,
  questions,
  surveyTitle,
  onApplyImportedQuestions
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [copiedJson, setCopiedJson] = useState(false);
  
  // Import state
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [pastedJsonText, setPastedJsonText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedImportData, setParsedImportData] = useState<SurveyLogicFlowExport | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<LogicImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const exportData = buildLogicFlowExportData(questions, surveyTitle);
  const jsonExportString = JSON.stringify(exportData, null, 2);

  const handleCopyExportJson = () => {
    navigator.clipboard.writeText(jsonExportString);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  const handleDownloadExport = () => {
    downloadLogicFlowJSON(questions, surveyTitle);
  };

  // Process text or file upload
  const processJsonContent = (content: string, sourceName?: string) => {
    setParseError(null);
    setImportSummary(null);
    if (!content.trim()) {
      setParsedImportData(null);
      return;
    }

    const validation = validateLogicFlowJSON(content);
    if (validation.valid && validation.data) {
      setParsedImportData(validation.data);
      if (sourceName) setFileName(sourceName);
    } else {
      setParsedImportData(null);
      setParseError(validation.error || 'Invalid logic JSON format');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setPastedJsonText(content);
      processJsonContent(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setPastedJsonText(content);
        processJsonContent(content, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleApplyImport = () => {
    if (!parsedImportData) return;

    const { updatedQuestions, result } = applyImportedLogicFlow(
      questions,
      parsedImportData,
      importMode
    );

    setImportSummary(result);

    const msg = `Successfully updated logic for ${result.matchedCount} question items (${importMode === 'merge' ? 'Merged' : 'Replaced'}).`;
    onApplyImportedQuestions(updatedQuestions, msg);
  };

  // Pre-built logic templates for quick insertion
  const loadPresetTemplate = (templateType: 'distance-skip' | 'satisfaction-gate' | 'clean-all') => {
    if (templateType === 'clean-all') {
      const emptyConfig: SurveyLogicFlowExport = {
        schemaType: 'rdip_questionnaire_logic_flow',
        formatVersion: '1.0',
        exportDate: new Date().toISOString(),
        surveyTitle: 'Reset Logic Flow',
        rulesCount: 0,
        logicDefinitions: []
      };
      setParsedImportData(emptyConfig);
      setPastedJsonText(JSON.stringify(emptyConfig, null, 2));
      setFileName('reset-logic-flow.json');
      setParseError(null);
      return;
    }

    if (templateType === 'distance-skip') {
      const templateData: SurveyLogicFlowExport = {
        schemaType: 'rdip_questionnaire_logic_flow',
        formatVersion: '1.0',
        exportDate: new Date().toISOString(),
        surveyTitle: 'Distance & Primary Transit Skip Pattern',
        rulesCount: 2,
        logicDefinitions: [
          {
            questionId: 'q5',
            variableName: 'Q5_Primary_Transit_Mode',
            questionTitle: 'Primary Mode of Transportation',
            logicRule: {
              enabled: true,
              branches: [
                {
                  id: 'branch-q5-dist-check',
                  branchType: 'IF',
                  matchType: 'ALL',
                  clauses: [
                    {
                      id: 'clause-q5-1',
                      sourceVariable: 'Q4_Clinic_Distance_KM',
                      operator: 'greater_than',
                      value: 0
                    }
                  ],
                  action: 'show'
                },
                {
                  id: 'branch-q5-else',
                  branchType: 'ELSE',
                  clauses: [],
                  action: 'hide'
                }
              ]
            }
          },
          {
            questionId: 'q7',
            variableName: 'Q7_Supply_Stockout_Frequency',
            questionTitle: 'Medication stockout frequency',
            logicRule: {
              enabled: true,
              branches: [
                {
                  id: 'branch-q7-1',
                  branchType: 'IF',
                  matchType: 'ANY',
                  clauses: [
                    {
                      id: 'cl-q7-1',
                      sourceVariable: 'Q2_Facility_Designation',
                      operator: 'equals',
                      value: 'Primary Health Centre (PHC)'
                    },
                    {
                      id: 'cl-q7-2',
                      sourceVariable: 'Q2_Facility_Designation',
                      operator: 'equals',
                      value: 'Comprehensive Health Center (CHC)'
                    }
                  ],
                  action: 'show'
                },
                {
                  id: 'branch-q7-else',
                  branchType: 'ELSE',
                  clauses: [],
                  action: 'hide'
                }
              ]
            }
          }
        ]
      };

      setParsedImportData(templateData);
      setPastedJsonText(JSON.stringify(templateData, null, 2));
      setFileName('distance-skip-template.json');
      setParseError(null);
    } else if (templateType === 'satisfaction-gate') {
      const templateData: SurveyLogicFlowExport = {
        schemaType: 'rdip_questionnaire_logic_flow',
        formatVersion: '1.0',
        exportDate: new Date().toISOString(),
        surveyTitle: 'Satisfaction & Follow-up Gate Template',
        rulesCount: 1,
        logicDefinitions: [
          {
            questionId: 'q6',
            variableName: 'Q6_Primary_Care_Satisfaction',
            questionTitle: 'Overall Primary Care Satisfaction',
            logicRule: {
              enabled: true,
              branches: [
                {
                  id: 'branch-q6-filter',
                  branchType: 'IF',
                  matchType: 'ALL',
                  clauses: [
                    {
                      id: 'cl-q6-1',
                      sourceVariable: 'Q3_Emergency_Readiness_Score',
                      operator: 'greater_than',
                      value: 20
                    }
                  ],
                  action: 'show'
                },
                {
                  id: 'branch-q6-else',
                  branchType: 'ELSE',
                  clauses: [],
                  action: 'hide'
                }
              ]
            }
          }
        ]
      };

      setParsedImportData(templateData);
      setPastedJsonText(JSON.stringify(templateData, null, 2));
      setFileName('satisfaction-gate-template.json');
      setParseError(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#161c27]/60 backdrop-blur-xs"
        onClick={onClose}
      />
      <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-[#c4c6cf]/40 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#1a365d] text-white p-4.5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <span className="material-symbols-outlined text-2xl text-[#d6e3ff]">
                sync_alt
              </span>
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Questionnaire Logic Flow Manager</h2>
              <p className="text-xs text-white/80">
                Export and import JSON branching configurations & IF-THEN-ELSE execution rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#c4c6cf]/50 bg-[#f9f9ff] px-6 pt-2 gap-4">
          <button
            onClick={() => setActiveTab('export')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'export'
                ? 'border-[#1a365d] text-[#1a365d] bg-white rounded-t-lg'
                : 'border-transparent text-[#74777f] hover:text-[#002045]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">file_download</span>
            <span>Export Logic JSON</span>
            <span className="bg-[#1a365d]/10 text-[#1a365d] text-[10px] px-2 py-0.5 rounded-full font-mono">
              {exportData.rulesCount} Rules
            </span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'import'
                ? 'border-[#6b21a8] text-[#6b21a8] bg-white rounded-t-lg'
                : 'border-transparent text-[#74777f] hover:text-[#002045]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">file_upload</span>
            <span>Import Logic Definition</span>
            {parsedImportData && (
              <span className="bg-[#6b21a8]/10 text-[#6b21a8] text-[10px] px-2 py-0.5 rounded-full font-mono">
                {parsedImportData.rulesCount} Ready
              </span>
            )}
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* TAB 1: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-5">
              {/* Header Info Banner */}
              <div className="bg-[#f1f3ff] p-4 rounded-xl border border-[#c4c6cf]/60 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[#002045] font-bold text-xs">
                    <span className="material-symbols-outlined text-[18px] text-[#1a365d]">schema</span>
                    <span>Standardized Logic Flow Configuration (v1.0)</span>
                  </div>
                  <p className="text-[11px] text-[#43474e]">
                    This JSON configuration contains all IF, ELIF, and ELSE branching paths, target questions, and skip patterns for <span className="font-semibold text-[#002045]">"{surveyTitle}"</span>.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopyExportJson}
                    className="px-3 py-1.5 bg-white border border-[#c4c6cf] hover:bg-[#e2e8f0] text-[#002045] font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {copiedJson ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiedJson ? 'Copied!' : 'Copy JSON'}</span>
                  </button>

                  <button
                    onClick={handleDownloadExport}
                    className="px-3.5 py-1.5 bg-[#1a365d] hover:bg-[#002045] text-white font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>Download JSON File</span>
                  </button>
                </div>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white border border-[#c4c6cf]/60 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#74777f]">Total Logic Items</span>
                  <div className="text-xl font-bold text-[#002045] font-mono">
                    {exportData.rulesCount} <span className="text-xs font-normal text-[#74777f]">/ {questions.length} questions</span>
                  </div>
                </div>

                <div className="p-3 bg-white border border-[#c4c6cf]/60 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#74777f]">Total Branch Clauses</span>
                  <div className="text-xl font-bold text-[#6b21a8] font-mono">
                    {exportData.logicDefinitions.reduce(
                      (acc, item) => acc + (item.logicRule.branches?.length || 0),
                      0
                    )}
                  </div>
                </div>

                <div className="p-3 bg-white border border-[#c4c6cf]/60 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#74777f]">Export Format</span>
                  <div className="text-xs font-bold text-[#006a68] font-mono mt-1">
                    JSON Schema v1.0 (Portable)
                  </div>
                </div>
              </div>

              {/* JSON Code Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#002045] uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">code</span>
                    JSON Configuration Output
                  </span>
                  <span className="text-[10px] font-mono text-[#74777f]">
                    {jsonExportString.length} bytes
                  </span>
                </div>

                <pre className="p-4 bg-[#0e1726] text-[#e2e8f0] rounded-xl font-mono text-[11px] overflow-x-auto max-h-72 leading-relaxed border border-[#334155] select-all shadow-inner">
                  {jsonExportString}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT */}
          {activeTab === 'import' && (
            <div className="space-y-5">
              {/* Presets & Templates bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#fdf4ff] border border-[#d8b4fe] rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#7e22ce]">magic_button</span>
                  <span className="text-xs font-bold text-[#581c87]">Pre-configured Logic Templates:</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => loadPresetTemplate('distance-skip')}
                    className="px-2.5 py-1 bg-white hover:bg-[#fae8ff] border border-[#d8b4fe] text-[#7e22ce] text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Distance Skip Pattern
                  </button>
                  <button
                    onClick={() => loadPresetTemplate('satisfaction-gate')}
                    className="px-2.5 py-1 bg-white hover:bg-[#fae8ff] border border-[#d8b4fe] text-[#7e22ce] text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Satisfaction Gate
                  </button>
                  <button
                    onClick={() => loadPresetTemplate('clean-all')}
                    className="px-2.5 py-1 bg-white hover:bg-[#fee2e2] border border-[#fca5a5] text-[#ba1a1a] text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Clear All Logic
                  </button>
                </div>
              </div>

              {/* Upload Dropzone (Supports Drag & Drop AND Click) */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-[#6b21a8] bg-[#6b21a8]/10 scale-[1.01]'
                    : fileName
                    ? 'border-[#006a68] bg-[#006a68]/5'
                    : 'border-[#c4c6cf] hover:border-[#6b21a8] hover:bg-[#f9f9ff]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="flex flex-col items-center justify-center space-y-2">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      fileName ? 'bg-[#006a68]/10 text-[#006a68]' : 'bg-[#f1f3ff] text-[#1a365d]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-2xl">
                      {fileName ? 'task' : 'upload_file'}
                    </span>
                  </div>

                  <div>
                    <span className="font-bold text-xs text-[#002045]">
                      {fileName ? `Loaded: ${fileName}` : 'Drop JSON file here or click to browse'}
                    </span>
                    <p className="text-[11px] text-[#74777f] mt-0.5">
                      Supports exported .json logic definitions or full questionnaire exports
                    </p>
                  </div>
                </div>
              </div>

              {/* Direct Paste JSON Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[#002045] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">edit_note</span>
                    Or Paste JSON Logic Configuration
                  </label>
                  {pastedJsonText && (
                    <button
                      onClick={() => {
                        setPastedJsonText('');
                        setParsedImportData(null);
                        setFileName(null);
                        setParseError(null);
                      }}
                      className="text-[10px] text-[#ba1a1a] hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <textarea
                  rows={4}
                  value={pastedJsonText}
                  onChange={(e) => {
                    setPastedJsonText(e.target.value);
                    processJsonContent(e.target.value);
                  }}
                  placeholder='Paste JSON configuration here (e.g. { "schemaType": "rdip_questionnaire_logic_flow", ... })'
                  className="w-full p-3 font-mono text-[11px] border border-[#c4c6cf] rounded-xl focus:border-[#6b21a8] focus:ring-1 focus:ring-[#6b21a8] outline-none resize-y bg-[#fafafa]"
                />
              </div>

              {/* Error Display */}
              {parseError && (
                <div className="p-3 bg-[#fee2e2] text-[#ba1a1a] border border-[#fca5a5] rounded-xl text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{parseError}</span>
                </div>
              )}

              {/* Parsed Inspection Preview */}
              {parsedImportData && (
                <div className="space-y-3 bg-[#f8fafc] p-4 rounded-xl border border-[#cbd5e1]">
                  <div className="flex items-center justify-between border-b border-[#cbd5e1] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#006a68]">verified</span>
                      <span className="font-bold text-xs text-[#002045]">
                        Ready to Import ({parsedImportData.rulesCount} Rules Defined)
                      </span>
                    </div>

                    {/* Import Mode Selector: Merge vs Replace */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-[#43474e]">Apply Mode:</span>
                      <div className="flex bg-white rounded-lg p-0.5 border border-[#c4c6cf]">
                        <button
                          onClick={() => setImportMode('merge')}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${
                            importMode === 'merge'
                              ? 'bg-[#1a365d] text-white shadow-2xs'
                              : 'text-[#43474e] hover:text-[#002045]'
                          }`}
                        >
                          Merge Matching
                        </button>
                        <button
                          onClick={() => setImportMode('replace')}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${
                            importMode === 'replace'
                              ? 'bg-[#ba1a1a] text-white shadow-2xs'
                              : 'text-[#43474e] hover:text-[#002045]'
                          }`}
                        >
                          Replace All
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Matching Breakdown Table */}
                  <div className="max-h-48 overflow-y-auto divide-y divide-[#e2e8f0] text-[11px]">
                    {parsedImportData.logicDefinitions.map((def, idx) => {
                      const matchedQ = questions.find(
                        (q) =>
                          (def.variableName &&
                            q.variableName?.toLowerCase().trim() === def.variableName.toLowerCase().trim()) ||
                          q.id === def.questionId
                      );

                      return (
                        <div key={idx} className="py-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {matchedQ ? (
                              <span className="text-[#006a68] font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                                <span className="font-mono">{matchedQ.number}</span> ({matchedQ.variableName})
                              </span>
                            ) : (
                              <span className="text-[#ba1a1a] font-semibold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[15px]">warning</span>
                                <span className="font-mono">{def.variableName || def.questionId}</span> (Unmatched)
                              </span>
                            )}
                          </div>

                          <div className="font-mono text-[#6b21a8] text-[10px] bg-white px-2 py-0.5 rounded border border-[#e2e8f0] max-w-xs truncate">
                            {formatLogicExpression(def.logicRule)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Import Feedback Result Banner */}
              {importSummary && (
                <div className="p-3 bg-[#e6f4ea] text-[#137333] border border-[#a8dab5] rounded-xl text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span className="font-bold">
                      Import Applied Successfully! {importSummary.matchedCount} questions updated.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#f9f9ff] border-t border-[#c4c6cf]/40 flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#43474e] hover:text-[#002045] hover:bg-[#f1f3ff] rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>

          {activeTab === 'export' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyExportJson}
                className="px-4 py-2 border border-[#c4c6cf] text-[#002045] hover:bg-[#f1f3ff] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                {copiedJson ? 'Copied to Clipboard' : 'Copy JSON'}
              </button>
              <button
                type="button"
                onClick={handleDownloadExport}
                className="px-5 py-2 bg-[#1a365d] text-white rounded-lg text-xs font-bold hover:bg-[#002045] transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Download JSON File
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!parsedImportData}
              onClick={handleApplyImport}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                parsedImportData
                  ? 'bg-[#6b21a8] hover:bg-[#581c87] text-white'
                  : 'bg-[#e2e8f0] text-[#94a3b8] cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">publish</span>
              <span>Apply Logic Definition ({importMode === 'merge' ? 'Merge' : 'Replace All'})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
