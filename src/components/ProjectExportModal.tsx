import React, { useState, useMemo } from 'react';
import { Project } from '../types';
import {
  ExportFormat,
  ExportScope,
  ExportOptions,
  getCollectedDataForProject,
  generateProjectCSV,
  generateProjectJSON,
  downloadFile
} from '../lib/projectDataExporter';

interface ProjectExportModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onExportSuccess?: (fileName: string) => void;
}

export const ProjectExportModal: React.FC<ProjectExportModalProps> = ({
  project,
  isOpen,
  onClose,
  onExportSuccess
}) => {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [scope, setScope] = useState<ExportScope>('bundle');
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeGps, setIncludeGps] = useState(true);
  const [includeEnumeratorInfo, setIncludeEnumeratorInfo] = useState(true);
  const [includeObjectives, setIncludeObjectives] = useState(true);
  const [activeTab, setActiveTab] = useState<'configure' | 'preview'>('configure');
  const [copied, setCopied] = useState(false);

  // Retrieve collected data for this project
  const collectedRecords = useMemo(() => {
    return getCollectedDataForProject(project);
  }, [project]);

  const options: ExportOptions = useMemo(
    () => ({
      format,
      scope,
      includeNotes,
      includeGps,
      includeEnumeratorInfo,
      includeObjectives
    }),
    [format, scope, includeNotes, includeGps, includeEnumeratorInfo, includeObjectives]
  );

  // Generate the formatted content string
  const exportedContent = useMemo(() => {
    if (format === 'csv') {
      return generateProjectCSV(project, collectedRecords, options);
    } else {
      return generateProjectJSON(project, collectedRecords, options);
    }
  }, [project, collectedRecords, options, format]);

  if (!isOpen) return null;

  const dateStamp = new Date().toISOString().slice(0, 10);
  const sanitizedTitle = project.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  const fileName = `${project.code}_${sanitizedTitle}_${scope}_${dateStamp}.${format}`;
  const mimeType = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;';

  const handleDownload = () => {
    downloadFile(exportedContent, fileName, mimeType);
    if (onExportSuccess) {
      onExportSuccess(fileName);
    }
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(exportedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#002045]/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-[#c4c6cf]/60 my-auto overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#c4c6cf]/40 bg-[#f9f9ff] flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1a365d] text-white flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[22px]">download_for_offline</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#1a365d]/10 text-[#1a365d] uppercase tracking-wider">
                  Data Export Hub
                </span>
                <span className="text-xs font-mono font-bold text-[#74777f]">
                  {project.code}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#002045] mt-0.5 line-clamp-1">
                Export Project & Survey Data
              </h3>
              <p className="text-xs text-[#43474e] line-clamp-1">
                {project.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#74777f] hover:text-[#002045] p-1.5 rounded-full hover:bg-[#dde2f3] transition-colors cursor-pointer"
            title="Close modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Sub-Header Tabs */}
        <div className="flex items-center border-b border-[#c4c6cf]/40 bg-white px-5 pt-2 gap-4">
          <button
            onClick={() => setActiveTab('configure')}
            className={`pb-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'configure'
                ? 'border-[#1a365d] text-[#1a365d]'
                : 'border-transparent text-[#74777f] hover:text-[#002045]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Export Configuration</span>
          </button>

          <button
            onClick={() => setActiveTab('preview')}
            className={`pb-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'preview'
                ? 'border-[#1a365d] text-[#1a365d]'
                : 'border-transparent text-[#74777f] hover:text-[#002045]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">visibility</span>
            <span>Preview Structured Output</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-[#dde2f3] text-[#002045] rounded-full font-mono font-bold">
              {format.toUpperCase()}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs text-[#161c27]">
          {activeTab === 'configure' ? (
            <>
              {/* 1. File Format Selection */}
              <div>
                <label className="block text-[11px] font-bold text-[#002045] uppercase tracking-wider mb-2">
                  1. Output File Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormat('csv')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      format === 'csv'
                        ? 'border-[#1a365d] bg-[#1a365d]/5 ring-1 ring-[#1a365d]'
                        : 'border-[#c4c6cf]/60 bg-[#f9f9ff] hover:bg-white'
                    }`}
                  >
                    <span
                      className={`p-2 rounded-lg shrink-0 ${
                        format === 'csv'
                          ? 'bg-[#1a365d] text-white'
                          : 'bg-[#dde2f3] text-[#1a365d]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">table_chart</span>
                    </span>
                    <div>
                      <div className="font-bold text-xs text-[#002045] flex items-center gap-1.5">
                        <span>CSV Spreadsheet</span>
                        {format === 'csv' && (
                          <span className="text-[10px] bg-[#1a365d] text-white px-1.5 rounded">Selected</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#43474e] mt-0.5 leading-snug">
                        Standard RFC 4180 CSV with UTF-8 BOM. Ready for Excel, R, SPSS, Stata, or Python.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormat('json')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      format === 'json'
                        ? 'border-[#1a365d] bg-[#1a365d]/5 ring-1 ring-[#1a365d]'
                        : 'border-[#c4c6cf]/60 bg-[#f9f9ff] hover:bg-white'
                    }`}
                  >
                    <span
                      className={`p-2 rounded-lg shrink-0 ${
                        format === 'json'
                          ? 'bg-[#1a365d] text-white'
                          : 'bg-[#dde2f3] text-[#1a365d]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">data_object</span>
                    </span>
                    <div>
                      <div className="font-bold text-xs text-[#002045] flex items-center gap-1.5">
                        <span>JSON Document</span>
                        {format === 'json' && (
                          <span className="text-[10px] bg-[#1a365d] text-white px-1.5 rounded">Selected</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#43474e] mt-0.5 leading-snug">
                        Structured nested JSON tree with typed objects, geolocation coordinates, and audit metadata.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Export Scope Selection */}
              <div>
                <label className="block text-[11px] font-bold text-[#002045] uppercase tracking-wider mb-2">
                  2. Dataset Scope
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setScope('bundle')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      scope === 'bundle'
                        ? 'border-[#1a365d] bg-[#1a365d]/5 ring-1 ring-[#1a365d]'
                        : 'border-[#c4c6cf]/60 bg-[#f9f9ff] hover:bg-white'
                    }`}
                  >
                    <div className="font-bold text-xs text-[#002045] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-[#1a365d]">dataset</span>
                      <span>Full Bundle</span>
                    </div>
                    <p className="text-[11px] text-[#74777f] mt-1 leading-snug">
                      Project metadata + all collected survey records.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('responses')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      scope === 'responses'
                        ? 'border-[#1a365d] bg-[#1a365d]/5 ring-1 ring-[#1a365d]'
                        : 'border-[#c4c6cf]/60 bg-[#f9f9ff] hover:bg-white'
                    }`}
                  >
                    <div className="font-bold text-xs text-[#002045] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-[#1a365d]">ballot</span>
                      <span>Responses Only</span>
                    </div>
                    <p className="text-[11px] text-[#74777f] mt-1 leading-snug">
                      Tabular records with respondent answers only.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('metadata')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      scope === 'metadata'
                        ? 'border-[#1a365d] bg-[#1a365d]/5 ring-1 ring-[#1a365d]'
                        : 'border-[#c4c6cf]/60 bg-[#f9f9ff] hover:bg-white'
                    }`}
                  >
                    <div className="font-bold text-xs text-[#002045] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-[#1a365d]">description</span>
                      <span>Metadata Only</span>
                    </div>
                    <p className="text-[11px] text-[#74777f] mt-1 leading-snug">
                      Project protocol, objectives, IRB notes & KPIs.
                    </p>
                  </button>
                </div>
              </div>

              {/* 3. Field Inclusion Options */}
              <div className="bg-[#f9f9ff] p-4 rounded-xl border border-[#c4c6cf]/60 space-y-3">
                <label className="block text-[11px] font-bold text-[#002045] uppercase tracking-wider">
                  3. Field Customization & Telemetry Filters
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-[#c4c6cf]/40 cursor-pointer hover:bg-[#f1f3ff]">
                    <input
                      type="checkbox"
                      checked={includeNotes}
                      onChange={(e) => setIncludeNotes(e.target.checked)}
                      className="rounded text-[#1a365d] focus:ring-[#1a365d] h-4 w-4"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-[#002045]">Contextual Notes & IRB Protocol</span>
                      <p className="text-[10px] text-[#74777f]">Include field notes attached to this project</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-[#c4c6cf]/40 cursor-pointer hover:bg-[#f1f3ff]">
                    <input
                      type="checkbox"
                      checked={includeGps}
                      onChange={(e) => setIncludeGps(e.target.checked)}
                      className="rounded text-[#1a365d] focus:ring-[#1a365d] h-4 w-4"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-[#002045]">GPS Geolocation & Accuracy</span>
                      <p className="text-[10px] text-[#74777f]">Lat, Long, and GPS precision meters</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-[#c4c6cf]/40 cursor-pointer hover:bg-[#f1f3ff]">
                    <input
                      type="checkbox"
                      checked={includeEnumeratorInfo}
                      onChange={(e) => setIncludeEnumeratorInfo(e.target.checked)}
                      className="rounded text-[#1a365d] focus:ring-[#1a365d] h-4 w-4"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-[#002045]">Enumerator Agent Identity</span>
                      <p className="text-[10px] text-[#74777f]">Enumerator ID and field agent name</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-[#c4c6cf]/40 cursor-pointer hover:bg-[#f1f3ff]">
                    <input
                      type="checkbox"
                      checked={includeObjectives}
                      onChange={(e) => setIncludeObjectives(e.target.checked)}
                      className="rounded text-[#1a365d] focus:ring-[#1a365d] h-4 w-4"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-[#002045]">Research Objectives</span>
                      <p className="text-[10px] text-[#74777f]">Target academic & policy research goals</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Dataset Summary Pill */}
              <div className="p-3 bg-[#e3e8f9]/50 rounded-xl border border-[#adc7f7] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#002045]">
                  <span className="material-symbols-outlined text-[18px] text-[#1a365d]">analytics</span>
                  <span>
                    Ready to export <strong>{collectedRecords.length} structured records</strong> for {project.code}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[#1a365d] font-bold">
                  {(new Blob([exportedContent]).size / 1024).toFixed(1)} KB
                </span>
              </div>
            </>
          ) : (
            /* Preview Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#43474e] font-semibold">
                  File name:{' '}
                  <span className="font-mono text-[#1a365d] font-bold">{fileName}</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1 bg-white hover:bg-[#f1f3ff] border border-[#c4c6cf] rounded-lg text-xs font-bold text-[#002045] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                  <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
                </button>
              </div>

              <div className="relative bg-[#001733] text-[#e3e8f9] rounded-xl p-3 sm:p-4 font-mono text-[11px] leading-relaxed max-h-[360px] overflow-auto border border-[#002045]">
                <pre className="whitespace-pre overflow-x-auto select-all">
                  {exportedContent.slice(0, 3500)}
                  {exportedContent.length > 3500 && (
                    <span className="text-[#88a0c4] italic block mt-2">
                      ... [{exportedContent.length - 3500} additional characters truncated in live preview. Click 'Download' for complete file]
                    </span>
                  )}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#c4c6cf]/40 bg-[#f9f9ff] flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-[#74777f] font-mono">
            {collectedRecords.length} Records • Format: .{format.toUpperCase()}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-[#c4c6cf] text-[#43474e] hover:bg-[#e3e8f9] transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1a365d] text-white hover:bg-[#002045] transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Download {format.toUpperCase()} File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
