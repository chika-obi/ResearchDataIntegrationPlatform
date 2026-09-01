import React, { useState } from 'react';
import { QualityIssue } from '../types';
import { INITIAL_QUALITY_ISSUES } from '../data/mockData';

export const DataQualityView: React.FC = () => {
  const [issues, setIssues] = useState<QualityIssue[]>(INITIAL_QUALITY_ISSUES);
  const [isScanning, setIsScanning] = useState(false);
  const [qualityScore, setQualityScore] = useState(92);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [selectedIssueDetail, setSelectedIssueDetail] = useState<QualityIssue | null>(null);

  const handleRunScan = () => {
    setIsScanning(true);
    setScanMessage('Running multi-pass anomaly detection and skip logic validation...');
    setTimeout(() => {
      setIsScanning(false);
      setQualityScore(94);
      setScanMessage('Data quality scan completed. 12,450 records validated.');
      setTimeout(() => setScanMessage(null), 3500);
    }, 1800);
  };

  const handleAction = (id: string, action: 'reviewed' | 'excluded' | 'kept') => {
    setIssues((prev) =>
      prev.map((iss) => (iss.id === id ? { ...iss, status: action } : iss))
    );
  };

  const handleExportLog = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'RecordID,IssueType,Severity,Details,Status\n' +
      issues
        .map((i) => `"${i.recordId}","${i.issueType}","${i.severity}","${i.details}","${i.status}"`)
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'rdip_data_quality_audit_log.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-[1280px] mx-auto p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#002045] tracking-tight">
            Data Quality & Validation Engine
          </h1>
          <p className="text-[#43474e] text-sm md:text-base mt-1">
            Project Alpha: Phase 2 Household Survey
          </p>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={handleExportLog}
            className="flex items-center gap-1.5 px-4 py-2 border border-[#c4c6cf] rounded-lg text-xs font-semibold text-[#002045] hover:bg-[#f1f3ff] transition-colors bg-white shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Export Log</span>
          </button>
          <button
            onClick={handleRunScan}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-[#1a365d] hover:bg-[#002045] transition-colors shadow-sm active:scale-95"
          >
            <span className={`material-symbols-outlined text-[18px] ${isScanning ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{isScanning ? 'Scanning...' : 'Run Scan'}</span>
          </button>
        </div>
      </div>

      {/* Scan Feedback Banner */}
      {scanMessage && (
        <div className="p-3 bg-[#e3e8f9] border border-[#adc7f7] rounded-xl text-xs font-semibold text-[#002045] flex items-center gap-2 animate-in fade-in">
          <span className="material-symbols-outlined text-[18px] text-[#006a68]">verified</span>
          <span>{scanMessage}</span>
        </div>
      )}

      {/* Bento Grid Top Row: Score & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Score Card */}
        <div className="bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-base font-bold text-[#002045]">Overall Quality Score</h3>
            <span className="material-symbols-outlined text-[#74777f]">info</span>
          </div>
          <div className="flex items-end gap-3 mb-4">
            <span className="text-5xl md:text-6xl font-bold tracking-tight text-[#006a68] font-mono leading-none">
              {qualityScore}%
            </span>
            <span className="px-2.5 py-0.5 rounded bg-[#91f0ed]/30 text-[#006e6d] text-xs font-bold uppercase tracking-wider border border-[#91f0ed] mb-1">
              GOOD
            </span>
          </div>
          <div className="w-full bg-[#dde2f3] h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-[#006a68] h-full rounded-full transition-all duration-700"
              style={{ width: `${qualityScore}%` }}
            />
          </div>
          <p className="text-xs text-[#43474e] mt-3">Based on 12,450 total records processed.</p>
        </div>

        {/* 3 Metric Subcards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute right-[-10px] top-[-10px] opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-symbols-outlined text-[90px]">warning</span>
            </div>
            <h4 className="text-xs font-bold text-[#43474e] uppercase tracking-wider">
              Flagged Issues
            </h4>
            <div className="text-3xl font-bold text-[#161c27]">32</div>
            <div className="flex items-center gap-1 text-[#ba1a1a] text-xs font-medium">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span>+4 since yesterday</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute right-[-10px] top-[-10px] opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-symbols-outlined text-[90px]">task_alt</span>
            </div>
            <h4 className="text-xs font-bold text-[#43474e] uppercase tracking-wider">
              Clean Records
            </h4>
            <div className="text-3xl font-bold text-[#161c27]">12,418</div>
            <div className="flex items-center gap-1 text-[#006a68] text-xs font-medium">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>99.7% of dataset</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute right-[-10px] top-[-10px] opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-symbols-outlined text-[90px]">schedule</span>
            </div>
            <h4 className="text-xs font-bold text-[#43474e] uppercase tracking-wider">
              Last Scan
            </h4>
            <div className="text-2xl font-bold text-[#161c27]">14 mins ago</div>
            <div className="flex items-center gap-1 text-[#43474e] text-xs">
              <span className="material-symbols-outlined text-sm">sync</span>
              <span>Auto-sync enabled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Flagged Issues Table Section */}
      <div className="bg-white rounded-xl card-shadow border border-[#c4c6cf]/40 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-[#c4c6cf]/40 flex justify-between items-center bg-[#f9f9ff]">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-[#002045]">
              Action Required: Flagged Issues
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-[#ffdad6] text-[#93000a] text-xs font-bold">
              {issues.filter((i) => i.status === 'pending').length}
            </span>
          </div>
          <button
            onClick={() => setIssues(INITIAL_QUALITY_ISSUES)}
            className="text-xs text-[#1a365d] hover:underline font-semibold"
          >
            Reset Filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#c4c6cf]/40 bg-[#f1f3ff]/50 text-xs font-semibold text-[#43474e] uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center"></th>
                <th className="py-3 px-4">Issue Type</th>
                <th className="py-3 px-4">Record ID</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-[#c4c6cf]/30">
              {issues.map((issue) => {
                const isExcluded = issue.status === 'excluded';
                const isKept = issue.status === 'kept';
                return (
                  <tr
                    key={issue.id}
                    className={`hover:bg-[#f1f3ff]/40 transition-colors ${
                      isExcluded ? 'opacity-40 line-through bg-slate-50' : isKept ? 'bg-[#006a68]/5' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`material-symbols-outlined text-[20px] ${
                          issue.issueType === 'Outlier Detected'
                            ? 'text-[#ba1a1a]'
                            : 'text-[#e88532]'
                        }`}
                      >
                        {issue.issueType === 'Outlier Detected' ? 'warning' : 'error'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#161c27]">{issue.issueType}</span>
                        {issue.countFound && (
                          <span className="px-2 py-0.5 rounded bg-[#dde2f3] text-[#002045] font-bold text-[10px]">
                            {issue.countFound} Found
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#74777f] whitespace-nowrap">
                      {issue.recordId}
                    </td>
                    <td className="py-3.5 px-4 text-[#43474e] max-w-md truncate" title={issue.details}>
                      {issue.details}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedIssueDetail(issue)}
                          className="px-2.5 py-1 border border-[#c4c6cf] rounded text-xs font-semibold text-[#002045] hover:bg-[#f1f3ff] transition-colors"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => handleAction(issue.id, 'kept')}
                          className="px-2.5 py-1 border border-[#006a68]/40 rounded text-xs font-semibold text-[#006a68] hover:bg-[#006a68]/10 transition-colors"
                        >
                          Keep
                        </button>
                        <button
                          onClick={() => handleAction(issue.id, 'excluded')}
                          className="px-2.5 py-1 border border-[#ba1a1a]/40 rounded text-xs font-semibold text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors"
                        >
                          Exclude
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-[#f9f9ff] flex justify-center border-t border-[#c4c6cf]/40">
          <span className="text-xs font-semibold text-[#1a365d]">
            Showing 4 priority flagged items of 32 total anomalies
          </span>
        </div>
      </div>

      {/* Review Modal */}
      {selectedIssueDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#161c27]/40 backdrop-blur-xs"
            onClick={() => setSelectedIssueDetail(null)}
          />
          <div className="relative bg-white w-full max-w-lg rounded-xl shadow-2xl p-6 border border-[#c4c6cf]/40 animate-in zoom-in-95 space-y-4">
            <div className="flex justify-between items-start border-b border-[#c4c6cf]/40 pb-3">
              <div>
                <span className="text-xs font-mono bg-[#dde2f3] text-[#002045] px-2 py-0.5 rounded font-bold">
                  {selectedIssueDetail.recordId}
                </span>
                <h3 className="text-lg font-bold text-[#002045] mt-1.5">
                  {selectedIssueDetail.issueType}
                </h3>
              </div>
              <button
                onClick={() => setSelectedIssueDetail(null)}
                className="text-[#74777f] hover:text-[#002045] p-1"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-3 bg-[#f9f9ff] rounded-lg border border-[#c4c6cf]/40 text-xs text-[#161c27] space-y-2">
              <div className="font-semibold text-[#002045]">Validation Breakdown:</div>
              <p className="text-[#43474e] leading-relaxed">{selectedIssueDetail.details}</p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#c4c6cf]/40">
              <button
                onClick={() => {
                  handleAction(selectedIssueDetail.id, 'excluded');
                  setSelectedIssueDetail(null);
                }}
                className="px-4 py-2 rounded-lg bg-[#ba1a1a] text-white text-xs font-semibold hover:bg-[#93000a]"
              >
                Exclude from Sample
              </button>
              <button
                onClick={() => {
                  handleAction(selectedIssueDetail.id, 'kept');
                  setSelectedIssueDetail(null);
                }}
                className="px-4 py-2 rounded-lg bg-[#006a68] text-white text-xs font-semibold hover:bg-[#00504e]"
              >
                Retain / Mark Verified
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
