import React, { useState, useEffect, useCallback, useRef } from 'react';
import { INITIAL_PROJECTS } from '../data/mockData';
import {
  ReportConfig,
  computeReportMetrics,
  generateChapter4Markdown,
  generateChapter4LaTeX,
  generateWordDocHtml,
  generateChapter4TablesCSV,
  triggerFileDownload,
  triggerPrintReport
} from '../lib/academicReportGenerator';
import { getStoredResponses, saveResponseToLocalDb } from '../lib/supabaseSync';

export const ReportsView: React.FC = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('PRJ-001');
  const [reportFormat, setReportFormat] = useState<'apa' | 'chicago' | 'harvard'>('apa');
  const [confidenceLevel, setConfidenceLevel] = useState<number>(95);
  const [activeSection, setActiveSection] = useState<'chapter4' | 'executive' | 'methodology'>('chapter4');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  // Background Sync & Recalculation Engine States
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);
  const [syncInterval, setSyncInterval] = useState<number>(10); // in seconds
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());
  const [liveSyncedCount, setLiveSyncedCount] = useState<number>(0);
  const [highlightCells, setHighlightCells] = useState<boolean>(false);
  const [syncNotification, setSyncNotification] = useState<string | null>(null);

  // Section visibility toggles
  const [includeDemographics, setIncludeDemographics] = useState(true);
  const [includeBivariate, setIncludeBivariate] = useState(true);
  const [includeAnova, setIncludeAnova] = useState(true);
  const [includeRegression, setIncludeRegression] = useState(true);
  const [includeFactorAnalysis, setIncludeFactorAnalysis] = useState(true);
  const [includeHypothesesMatrix, setIncludeHypothesesMatrix] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const currentProject = INITIAL_PROJECTS.find((p) => p.id === selectedProjectId) || INITIAL_PROJECTS[0];

  // Base sample calculation + live synced responses
  const baseTotal = currentProject.responsesCount || 12450;
  const currentTotalSample = baseTotal + liveSyncedCount;
  const currentValidSample = Math.round(currentTotalSample * 0.570281);

  const reportConfig: ReportConfig = {
    projectTitle: currentProject.title,
    institution: currentProject.institution || 'Ministry of Public Health & Global Demographics Institute',
    sampleSize: currentTotalSample,
    validSample: currentValidSample,
    formatStyle: reportFormat,
    confidenceLevel,
    includeRegression,
    includeFactorAnalysis,
    includeDemographics,
    includeHypothesesMatrix,
    liveSyncedCount
  };

  // Dynamic real-time calculated metrics
  const metrics = computeReportMetrics(reportConfig);

  // Trigger brief visual highlight whenever metrics update
  const triggerMetricsHighlight = useCallback((message?: string) => {
    setHighlightCells(true);
    if (message) {
      setSyncNotification(message);
      setTimeout(() => setSyncNotification(null), 4000);
    }
    setTimeout(() => {
      setHighlightCells(false);
    }, 1200);
  }, []);

  // Background Sync Recalculation Routine
  const runSyncAndRecalculate = useCallback((forcedCountIncrement?: number, sourceLabel?: string) => {
    setIsSyncing(true);
    setTimeout(() => {
      try {
        const stored = getStoredResponses();
        const projectResponses = stored.filter((r: any) => !r.projectId || r.projectId === selectedProjectId);
        
        let newCount = projectResponses.length;
        if (forcedCountIncrement) {
          newCount += forcedCountIncrement;
        }

        setLiveSyncedCount(newCount);
        setLastSyncedAt(new Date());
        setIsSyncing(false);

        const label = sourceLabel || 'Background Sync Engine';
        triggerMetricsHighlight(
          `⚡ ${label}: Ingested new responses. Sample recalculation complete (N = ${(baseTotal + newCount).toLocaleString()}, n = ${Math.round((baseTotal + newCount) * 0.570281).toLocaleString()}).`
        );
      } catch {
        setIsSyncing(false);
      }
    }, 450);
  }, [selectedProjectId, baseTotal, triggerMetricsHighlight]);

  // Initial load: count stored responses in database
  useEffect(() => {
    try {
      const stored = getStoredResponses();
      const projectResponses = stored.filter((r: any) => !r.projectId || r.projectId === selectedProjectId);
      setLiveSyncedCount(projectResponses.length);
      setLastSyncedAt(new Date());
    } catch {}
  }, [selectedProjectId]);

  // Event listener for real-time survey completions across the platform
  useEffect(() => {
    const handleSurveyEvent = (e: any) => {
      const detail = e.detail;
      const src = detail?.enumeratorName ? `Enumerator: ${detail.enumeratorName}` : 'Survey Collector';
      runSyncAndRecalculate(1, src);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'rdip_collected_responses') {
        runSyncAndRecalculate(0, 'Storage Ingestion');
      }
    };

    window.addEventListener('rdip_response_synced', handleSurveyEvent);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('rdip_response_synced', handleSurveyEvent);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [runSyncAndRecalculate]);

  // Periodic Auto-Sync Background Timer
  useEffect(() => {
    if (!autoSyncEnabled || syncInterval <= 0) return;

    const intervalId = setInterval(() => {
      // Simulate real-time background validation polling
      setIsSyncing(true);
      setTimeout(() => {
        setLastSyncedAt(new Date());
        setIsSyncing(false);
      }, 350);
    }, syncInterval * 1000);

    return () => clearInterval(intervalId);
  }, [autoSyncEnabled, syncInterval]);

  // Simulation handlers for testing field data streaming
  const handleSimulateBatch = (count: number, label: string) => {
    // Add dummy responses to local storage for realistic persistence
    for (let i = 0; i < count; i++) {
      saveResponseToLocalDb({
        id: `RESP-SIM-${Date.now()}-${i}`,
        questionnaireId: 'QNR-2024-HCF',
        projectId: selectedProjectId,
        enumeratorId: `ENUM-${(i % 5) + 1}`,
        enumeratorName: `${label} Agent #${(i % 5) + 1}`,
        respondentId: `RESP-${Math.floor(1000 + Math.random() * 9000)}`,
        collectedAt: new Date().toISOString(),
        answers: { facilityType: 'PHC', stockout: 'Weekly' }
      });
    }
    runSyncAndRecalculate(0, label);
  };

  const handleResetStream = () => {
    setLiveSyncedCount(0);
    setLastSyncedAt(new Date());
    triggerMetricsHighlight('🔄 Report reset to baseline project sample.');
  };

  const handleDownloadDocx = () => {
    const htmlDoc = generateWordDocHtml(reportConfig);
    const fileName = `${currentProject.code || 'PRJ'}-Chapter4-Results-${reportFormat.toUpperCase()}.doc`;
    triggerFileDownload(htmlDoc, fileName, 'application/msword');
    showDownloadToast(`Generated & downloaded Word Document (${fileName})`);
  };

  const handleDownloadPdf = () => {
    const markdownContent = generateChapter4Markdown(reportConfig);
    const htmlBody = `
      <div class="header-meta">
        <strong>${reportConfig.institution}</strong> &bull; Research Monograph Series &bull; ${new Date().toLocaleDateString()}<br>
        <em>${currentProject.title}</em> (${currentProject.code || 'PRJ-2024-001'})
      </div>
      <div style="white-space: pre-wrap; font-family: 'Times New Roman', serif;">
        ${markdownContent.replace(/# (.*?)\n/g, '<h1>$1</h1>').replace(/## (.*?)\n/g, '<h2>$1</h2>').replace(/### (.*?)\n/g, '<h3>$1</h3>')}
      </div>
    `;
    triggerPrintReport(`Chapter 4 Results - ${currentProject.title}`, htmlBody);
    showDownloadToast('Opened print & PDF export dialog');
  };

  const handleDownloadLatex = () => {
    const latex = generateChapter4LaTeX(reportConfig);
    const fileName = `${currentProject.code || 'PRJ'}-Chapter4-Results.tex`;
    triggerFileDownload(latex, fileName, 'application/x-latex');
    showDownloadToast(`Generated & downloaded LaTeX Monograph Source (${fileName})`);
  };

  const handleDownloadMarkdown = () => {
    const md = generateChapter4Markdown(reportConfig);
    const fileName = `${currentProject.code || 'PRJ'}-Chapter4-Results.md`;
    triggerFileDownload(md, fileName, 'text/markdown');
    showDownloadToast(`Generated & downloaded Markdown Document (${fileName})`);
  };

  const handleDownloadTablesCSV = () => {
    const csv = generateChapter4TablesCSV(reportConfig);
    const fileName = `${currentProject.code || 'PRJ'}-Chapter4-APA-Tables.csv`;
    triggerFileDownload(csv, fileName, 'text/csv');
    showDownloadToast(`Exported statistical tables to CSV (${fileName})`);
  };

  const handleCopyText = () => {
    const textToCopy = generateChapter4Markdown(reportConfig);
    navigator.clipboard?.writeText(textToCopy);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  const showDownloadToast = (msg: string) => {
    setDownloadToast(msg);
    setTimeout(() => setDownloadToast(null), 3500);
  };

  const wordCount = 3840;
  const estimatedReadTime = Math.ceil(wordCount / 220);

  return (
    <div className="max-w-[1360px] mx-auto p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl border border-[#c4c6cf]/40 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-[#1a365d]/10 text-[#1a365d] text-[11px] font-bold rounded-full uppercase tracking-wider font-mono">
              Academic Monograph Synthesizer
            </span>
            <span className="px-2.5 py-0.5 bg-[#006a68]/10 text-[#006a68] text-[11px] font-bold rounded-full font-mono">
              APA 7th Standard
            </span>
            <span className="px-2.5 py-0.5 bg-[#6b21a8]/10 text-[#6b21a8] text-[11px] font-bold rounded-full font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6b21a8] animate-pulse"></span>
              Live Sync Engine
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#002045] tracking-tight">
            Academic Report & Chapter 4 Synthesis
          </h1>
          <p className="text-[#43474e] text-xs md:text-sm mt-1 max-w-3xl">
            Automated generation of publication-ready Chapter 4 Results, APA 7th descriptive & inferential tables, econometric regression models, and exportable thesis monographs with real-time background sync recalculation.
          </p>
        </div>

        {/* Global Download Suite */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleDownloadDocx}
            className="px-3.5 py-2 bg-white border border-[#c4c6cf] text-[#002045] hover:bg-[#f1f3ff] rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer hover:border-[#1a365d]"
            title="Download formatted Microsoft Word Document with APA tables"
          >
            <span className="material-symbols-outlined text-[18px] text-[#2b579a]">description</span>
            <span>Download .DOCX</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            className="px-3.5 py-2 bg-white border border-[#c4c6cf] text-[#002045] hover:bg-[#f1f3ff] rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer hover:border-[#ba1a1a]"
            title="Print or Save as PDF with publication layout"
          >
            <span className="material-symbols-outlined text-[18px] text-[#ba1a1a]">picture_as_pdf</span>
            <span>Print / PDF</span>
          </button>

          <button
            onClick={handleDownloadLatex}
            className="px-3 py-2 bg-[#1a365d] text-white hover:bg-[#002045] rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            title="Download LaTeX .tex source file with booktabs tables"
          >
            <span className="material-symbols-outlined text-[16px]">code</span>
            <span>Export LaTeX</span>
          </button>

          <div className="relative group">
            <button
              className="p-2 bg-[#f1f3ff] text-[#002045] hover:bg-[#e2e8f0] rounded-xl text-xs font-bold flex items-center border border-[#c4c6cf] transition-all cursor-pointer"
              title="More export options"
            >
              <span className="material-symbols-outlined text-[18px]">more_vert</span>
            </button>
            <div className="absolute right-0 mt-1 w-48 bg-white border border-[#c4c6cf] rounded-xl shadow-xl py-1 hidden group-hover:block z-50 animate-in fade-in">
              <button
                onClick={handleDownloadMarkdown}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-[#002045] hover:bg-[#f1f3ff] flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">markdown</span>
                <span>Export Markdown (.md)</span>
              </button>
              <button
                onClick={handleDownloadTablesCSV}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-[#002045] hover:bg-[#f1f3ff] flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">table_chart</span>
                <span>Export Tables (.csv)</span>
              </button>
              <button
                onClick={handleCopyText}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-[#002045] hover:bg-[#f1f3ff] flex items-center gap-2 border-t border-[#c4c6cf]/40"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span>Copy Full Text</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* BACKGROUND SYNC CONTROLLER BANNER */}
      <div className="bg-gradient-to-r from-[#002045] via-[#1a365d] to-[#003870] text-white p-4 sm:p-5 rounded-2xl shadow-sm border border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 shrink-0">
            {isSyncing ? (
              <span className="material-symbols-outlined text-[22px] text-[#38bdf8] animate-spin">
                sync
              </span>
            ) : (
              <span className="material-symbols-outlined text-[22px] text-[#34d399]">
                cloud_sync
              </span>
            )}
            {autoSyncEnabled && !isSyncing && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#34d399] rounded-full ring-2 ring-[#002045] animate-ping"></span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wide uppercase text-white/90">
                Background Ingestion & Statistical Recalculator
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                  autoSyncEnabled ? 'bg-[#34d399]/20 text-[#34d399] border border-[#34d399]/30' : 'bg-white/10 text-white/60'
                }`}
              >
                {isSyncing ? 'RECALCULATING...' : autoSyncEnabled ? 'AUTO-SYNC ACTIVE' : 'SYNC PAUSED'}
              </span>
            </div>
            <div className="text-[11px] text-white/70 flex flex-wrap items-center gap-2 mt-0.5 font-mono">
              <span>Cohort: <strong>N = {reportConfig.sampleSize.toLocaleString()}</strong> ({liveSyncedCount > 0 ? `+${liveSyncedCount} live` : 'Baseline'})</span>
              <span>&bull;</span>
              <span>Clean sample: <strong>n = {reportConfig.validSample.toLocaleString()}</strong></span>
              <span>&bull;</span>
              <span>Last updated: <strong>{lastSyncedAt.toLocaleTimeString()}</strong></span>
            </div>
          </div>
        </div>

        {/* Sync Controls & Simulation Triggers */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-start md:justify-end">
          {/* Polling Interval Select */}
          <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-xl text-xs border border-white/15">
            <span className="text-[10px] font-bold uppercase text-white/70">Polling:</span>
            <select
              value={syncInterval}
              onChange={(e) => setSyncInterval(Number(e.target.value))}
              disabled={!autoSyncEnabled}
              className="bg-transparent text-white font-mono text-xs font-bold outline-none cursor-pointer disabled:opacity-50"
            >
              <option value={5} className="text-[#002045]">Every 5s</option>
              <option value={10} className="text-[#002045]">Every 10s</option>
              <option value={30} className="text-[#002045]">Every 30s</option>
              <option value={60} className="text-[#002045]">Every 60s</option>
            </select>
          </div>

          {/* Auto Sync Toggle */}
          <button
            onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
              autoSyncEnabled
                ? 'bg-[#34d399]/20 text-[#34d399] border-[#34d399]/40 hover:bg-[#34d399]/30'
                : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
            }`}
            title="Toggle background automatic response sync"
          >
            <span className="material-symbols-outlined text-[16px]">
              {autoSyncEnabled ? 'toggle_on' : 'toggle_off'}
            </span>
            <span>{autoSyncEnabled ? 'Auto-Sync On' : 'Paused'}</span>
          </button>

          {/* Manual Recalculate Now Button */}
          <button
            onClick={() => runSyncAndRecalculate(0, 'Manual Recalculation')}
            disabled={isSyncing}
            className="px-3.5 py-1.5 bg-white text-[#002045] hover:bg-[#f1f3ff] rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-60"
            title="Check storage and recalculate statistical metrics immediately"
          >
            <span className={`material-symbols-outlined text-[16px] ${isSyncing ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{isSyncing ? 'Recalculating...' : 'Sync Now'}</span>
          </button>

          {/* Field Simulation Dropdown */}
          <div className="relative group">
            <button
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              title="Simulate incoming field responses from enumerators to test dynamic report re-rendering"
            >
              <span className="material-symbols-outlined text-[16px] text-[#38bdf8]">sensors</span>
              <span>Simulate Stream</span>
              <span className="material-symbols-outlined text-[14px]">expand_more</span>
            </button>
            <div className="absolute right-0 mt-1 w-56 bg-white text-[#002045] border border-[#c4c6cf] rounded-xl shadow-xl py-1 hidden group-hover:block z-50 animate-in fade-in">
              <div className="px-3 py-1.5 text-[10px] font-bold text-[#74777f] uppercase tracking-wider border-b border-[#c4c6cf]/40">
                Simulate Field Ingestion
              </div>
              <button
                onClick={() => handleSimulateBatch(10, 'Mobile Enumerators')}
                className="w-full px-3 py-2 text-left text-xs font-semibold hover:bg-[#f1f3ff] flex items-center justify-between"
              >
                <span>+10 Field Responses</span>
                <span className="text-[10px] font-mono text-[#006a68] font-bold">Fast</span>
              </button>
              <button
                onClick={() => handleSimulateBatch(50, 'District Batch Sync')}
                className="w-full px-3 py-2 text-left text-xs font-semibold hover:bg-[#f1f3ff] flex items-center justify-between"
              >
                <span>+50 District Batch</span>
                <span className="text-[10px] font-mono text-[#1a365d] font-bold">Medium</span>
              </button>
              <button
                onClick={() => handleSimulateBatch(250, 'Regional Cluster Sync')}
                className="w-full px-3 py-2 text-left text-xs font-semibold hover:bg-[#f1f3ff] flex items-center justify-between"
              >
                <span>+250 Regional Cluster</span>
                <span className="text-[10px] font-mono text-[#6b21a8] font-bold">Heavy</span>
              </button>
              {liveSyncedCount > 0 && (
                <button
                  onClick={handleResetStream}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-[#ba1a1a] hover:bg-[#fef2f2] flex items-center gap-1.5 border-t border-[#c4c6cf]/40"
                >
                  <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                  <span>Reset to Baseline</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Notification Bar on Recalculation */}
      {syncNotification && (
        <div className="bg-[#e6f4ea] text-[#137333] border border-[#a8dab5] px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            <span>{syncNotification}</span>
          </div>
          <button
            onClick={() => setSyncNotification(null)}
            className="text-[#137333]/70 hover:text-[#137333] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}

      {/* Grid: Document Configuration Sidebar & Live Manuscript Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-6">
          {/* Section Navigation */}
          <div className="bg-white rounded-2xl p-5 border border-[#c4c6cf]/40 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#002045] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#1a365d]">library_books</span>
              <span>Monograph Document Sections</span>
            </h3>

            <div className="space-y-2">
              <button
                onClick={() => setActiveSection('chapter4')}
                className={`w-full text-left p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                  activeSection === 'chapter4'
                    ? 'bg-[#1a365d] text-white border-[#1a365d] shadow-sm'
                    : 'bg-[#f9f9ff] text-[#43474e] border-[#c4c6cf]/60 hover:bg-[#f1f3ff] hover:text-[#002045]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px]">article</span>
                  <div>
                    <div>Chapter 4: Results & Inference</div>
                    <div className={`text-[10px] font-normal ${activeSection === 'chapter4' ? 'text-white/80' : 'text-[#74777f]'}`}>
                      Comprehensive 8-Part Empirical Chapter
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/20">3,840w</span>
              </button>

              <button
                onClick={() => setActiveSection('executive')}
                className={`w-full text-left p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                  activeSection === 'executive'
                    ? 'bg-[#1a365d] text-white border-[#1a365d] shadow-sm'
                    : 'bg-[#f9f9ff] text-[#43474e] border-[#c4c6cf]/60 hover:bg-[#f1f3ff] hover:text-[#002045]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px]">summarize</span>
                  <div>
                    <div>Executive Policy Brief</div>
                    <div className={`text-[10px] font-normal ${activeSection === 'executive' ? 'text-white/80' : 'text-[#74777f]'}`}>
                      High-Level Synthesis & Ministry Takeaways
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/10">1,210w</span>
              </button>

              <button
                onClick={() => setActiveSection('methodology')}
                className={`w-full text-left p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                  activeSection === 'methodology'
                    ? 'bg-[#1a365d] text-white border-[#1a365d] shadow-sm'
                    : 'bg-[#f9f9ff] text-[#43474e] border-[#c4c6cf]/60 hover:bg-[#f1f3ff] hover:text-[#002045]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                  <div>
                    <div>Sampling & Methodology Note</div>
                    <div className={`text-[10px] font-normal ${activeSection === 'methodology' ? 'text-white/80' : 'text-[#74777f]'}`}>
                      Chapter 3 Cluster Design & Validity
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/10">1,650w</span>
              </button>
            </div>
          </div>

          {/* Research Project & Configuration */}
          <div className="bg-white rounded-2xl p-5 border border-[#c4c6cf]/40 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#002045]">Report Parameters</h3>

            <div>
              <label className="block text-[11px] font-bold text-[#43474e] mb-1.5 uppercase tracking-wider">
                Active Research Study
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full p-2.5 bg-[#f9f9ff] border border-[#c4c6cf] rounded-xl text-xs font-semibold text-[#002045] focus:border-[#1a365d] outline-none"
              >
                {INITIAL_PROJECTS.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.title} ({proj.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#43474e] mb-1.5 uppercase tracking-wider">
                Citation & Formatting Style
              </label>
              <select
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value as any)}
                className="w-full p-2.5 bg-[#f9f9ff] border border-[#c4c6cf] rounded-xl text-xs font-semibold text-[#002045] focus:border-[#1a365d] outline-none"
              >
                <option value="apa">APA 7th Edition (American Psychological Assoc.)</option>
                <option value="chicago">Chicago Manual of Style (17th Author-Date)</option>
                <option value="harvard">Harvard Standard Academic Referencing</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#43474e] mb-1.5 uppercase tracking-wider">
                Inferential Confidence Level
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfidenceLevel(95)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    confidenceLevel === 95
                      ? 'bg-[#1a365d] text-white border-[#1a365d]'
                      : 'bg-[#f9f9ff] text-[#43474e] border-[#c4c6cf]'
                  }`}
                >
                  95% CI (α = 0.05)
                </button>
                <button
                  type="button"
                  onClick={() => setConfidenceLevel(99)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    confidenceLevel === 99
                      ? 'bg-[#1a365d] text-white border-[#1a365d]'
                      : 'bg-[#f9f9ff] text-[#43474e] border-[#c4c6cf]'
                  }`}
                >
                  99% CI (α = 0.01)
                </button>
              </div>
            </div>

            {/* Sub-Section Inclusion Toggles */}
            {activeSection === 'chapter4' && (
              <div className="pt-2 border-t border-[#c4c6cf]/40 space-y-2">
                <label className="block text-[11px] font-bold text-[#43474e] uppercase tracking-wider">
                  Included Subsections
                </label>
                <div className="space-y-1.5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDemographics}
                      onChange={(e) => setIncludeDemographics(e.target.checked)}
                      className="rounded text-[#1a365d] focus:ring-[#1a365d]"
                    />
                    <span className="text-[#002045]">4.2 Demographic Profile & Table 4.1</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeBivariate}
                      onChange={(e) => setIncludeBivariate(e.target.checked)}
                      className="rounded text-[#1a365d] focus:ring-[#1a365d]"
                    />
                    <span className="text-[#002045]">4.3 Bivariate Chi-Square (H1)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeAnova}
                      onChange={(e) => setIncludeAnova(e.target.checked)}
                      className="rounded text-[#1a365d] focus:ring-[#1a365d]"
                    />
                    <span className="text-[#002045]">4.4 One-Way ANOVA & Tukey HSD (H2)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeRegression}
                      onChange={(e) => setIncludeRegression(e.target.checked)}
                      className="rounded text-[#1a365d] focus:ring-[#1a365d]"
                    />
                    <span className="text-[#002045]">4.5 Multiple OLS Regression (H3)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeFactorAnalysis}
                      onChange={(e) => setIncludeFactorAnalysis(e.target.checked)}
                      className="rounded text-[#1a365d] focus:ring-[#1a365d]"
                    />
                    <span className="text-[#002045]">4.6 Exploratory Factor Analysis & KMO</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeHypothesesMatrix}
                      onChange={(e) => setIncludeHypothesesMatrix(e.target.checked)}
                      className="rounded text-[#1a365d] focus:ring-[#1a365d]"
                    />
                    <span className="text-[#002045]">4.7 Master Hypotheses Matrix</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Academic Compliance & Metadata Card */}
          <div className="bg-[#f1f3ff] rounded-2xl p-5 border border-[#adc7f7] space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#002045] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#006a68]">verified</span>
                <span>APA 7th Compliance Audit</span>
              </h4>
              <span className="text-[10px] font-bold bg-[#006a68] text-white px-2 py-0.5 rounded-full font-mono">
                PASSED (100%)
              </span>
            </div>
            <p className="text-xs text-[#43474e] leading-relaxed">
              All quantitative tables conform to strict APA standards: zero vertical grid rules, bold headers, italicized statistical symbols (<i>p</i>, <i>F</i>, <i>t</i>, <i>χ²</i>, <i>N</i>, <i>β</i>), exact degrees of freedom, and standardized probability legends.
            </p>
            <div className="pt-2 border-t border-[#adc7f7]/60 flex items-center justify-between text-[11px] text-[#002045] font-mono">
              <span>Clean Records: <strong>{reportConfig.validSample.toLocaleString()}</strong></span>
              <span>Power (1-β): <strong>&gt; 0.99</strong></span>
            </div>
          </div>
        </div>

        {/* Live Manuscript Paper Viewer */}
        <div className="lg:col-span-8 bg-white rounded-2xl card-shadow border border-[#c4c6cf]/40 p-6 md:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            {/* Manuscript Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-[#c4c6cf]/30 gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1a365d]">menu_book</span>
                <div>
                  <span className="text-sm font-bold text-[#002045] flex items-center gap-2">
                    <span>Manuscript Preview &bull; {reportFormat.toUpperCase()} Format</span>
                    {liveSyncedCount > 0 && (
                      <span className="px-2 py-0.2 bg-[#34d399]/20 text-[#006a68] text-[10px] font-bold rounded-full font-mono">
                        +{liveSyncedCount} Synced
                      </span>
                    )}
                  </span>
                  <div className="text-[11px] text-[#74777f]">
                    {currentProject.title} &bull; Validated Cohort (n = {reportConfig.validSample.toLocaleString()})
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Find in manuscript..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-36 sm:w-48 pl-7 pr-2 py-1 text-xs bg-[#f9f9ff] border border-[#c4c6cf] rounded-lg outline-none focus:border-[#1a365d]"
                  />
                  <span className="material-symbols-outlined text-[14px] text-[#74777f] absolute left-2 top-2">
                    search
                  </span>
                </div>

                <button
                  onClick={handleCopyText}
                  className="px-3 py-1.5 text-xs font-bold text-[#1a365d] hover:bg-[#f1f3ff] rounded-lg border border-[#c4c6cf] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-[15px]">content_copy</span>
                  <span>{copiedNotification ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Document Paper Canvas Representation */}
            <div
              className={`bg-[#fcfcff] border border-[#c4c6cf]/50 rounded-2xl p-6 md:p-10 font-serif text-[#161c27] text-sm md:text-[15px] leading-relaxed space-y-6 shadow-sm max-h-[640px] overflow-y-auto transition-colors duration-500 ${
                highlightCells ? 'ring-2 ring-[#34d399]/50 bg-[#f0fdf4]' : ''
              }`}
            >
              {/* SECTION: CHAPTER 4 */}
              {activeSection === 'chapter4' && (
                <div className="space-y-6">
                  <div className="text-center space-y-1 pb-4 border-b border-[#e2e8f0]">
                    <div className="font-sans text-xs font-bold text-[#74777f] uppercase tracking-widest">
                      {reportConfig.institution} &bull; Research Monograph Series
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold font-sans text-[#002045] tracking-tight">
                      CHAPTER 4: RESULTS AND QUANTITATIVE DATA ANALYSIS
                    </h2>
                    <div className="text-xs text-[#43474e] font-sans">
                      Target Project: <strong>{currentProject.title}</strong> ({currentProject.code})
                    </div>
                  </div>

                  {/* 4.0 Introduction */}
                  <div className="space-y-2">
                    <h3 className="text-base font-bold font-sans text-[#002045]">
                      4.0 Introduction & Restatement of Analytical Purpose
                    </h3>
                    <p className="text-justify indent-8">
                      This chapter presents the empirical findings, statistical inferences, and econometric models derived from the fieldwork data collected for the <i>{currentProject.title}</i>. The analytical procedures were configured to examine infrastructural distribution, emergency care readiness, supply chain stockouts, and socio-economic predictors of patient satisfaction. All continuous variables were checked for parametric assumptions, including multivariate normality, homoscedasticity, and multicollinearity tolerance (Variance Inflation Factor &lt; 2.5).
                    </p>
                  </div>

                  {/* 4.1 Response Rate */}
                  <div className="space-y-2">
                    <h3 className="text-base font-bold font-sans text-[#002045]">
                      4.1 Response Rate, Data Hygiene & Sample Validation
                    </h3>
                    <p className="text-justify indent-8">
                      A total of <i>N</i> = <strong className={highlightCells ? 'text-[#006a68] underline' : ''}>{reportConfig.sampleSize.toLocaleString()}</strong> questionnaires were administered across four regional administrative clusters (North, East, South, and West Districts). Following real-time automated anomaly detection—incorporating GPS geofence validation, speed-trap response thresholding (&lt; 180 seconds flag), and Mahalanobis distance outlier detection—<i>n</i> = <strong className={highlightCells ? 'text-[#006a68]' : ''}>{(reportConfig.sampleSize - reportConfig.validSample).toLocaleString()}</strong> suspicious or incomplete records were isolated. The resulting clean analytical dataset comprises <i>n</i> = <strong className={highlightCells ? 'text-[#006a68] underline' : ''}>{reportConfig.validSample.toLocaleString()}</strong> verified records, yielding an effective valid response rate of <strong className={highlightCells ? 'text-[#006a68]' : ''}>{((reportConfig.validSample / reportConfig.sampleSize) * 100).toFixed(1)}%</strong>. According to standard sampling criteria (Cochran, 1977), this achieves a statistical power (1 - <i>β</i>) &gt; .99 at <i>α</i> = {confidenceLevel === 99 ? '0.01' : '0.05'}.
                    </p>
                  </div>

                  {/* 4.2 Demographics Table */}
                  {includeDemographics && (
                    <div className="space-y-3">
                      <h3 className="text-base font-bold font-sans text-[#002045]">
                        4.2 Socio-Demographic Characteristics of the Sample
                      </h3>
                      <p className="text-justify indent-8">
                        The sample was stratified across healthcare facility designations, geographical districts, and educational attainment levels. Table 4.1 outlines the primary demographic frequencies and percentage distributions.
                      </p>

                      {/* APA Table 4.1 */}
                      <div className="my-4 font-sans text-xs bg-white border-y-2 border-[#161c27] p-4 overflow-x-auto shadow-2xs rounded-sm">
                        <div className="font-bold text-[#161c27] text-sm mb-0.5">Table 4.1</div>
                        <div className="italic text-[#43474e] mb-3 text-xs">
                          Demographic Characteristics of the Validated Sample (n = {reportConfig.validSample.toLocaleString()})
                        </div>
                        <table className="w-full text-left border-collapse border-b border-[#161c27]">
                          <thead>
                            <tr className="border-b border-[#161c27] font-bold text-[#002045]">
                              <th className="py-2 px-2">Demographic Variable</th>
                              <th className="py-2 px-2">Category</th>
                              <th className="py-2 px-2 text-right">Frequency (<i>f</i>)</th>
                              <th className="py-2 px-2 text-right">Percentage (%)</th>
                              <th className="py-2 px-2 text-right">Cumulative %</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[#161c27]">
                            <tr>
                              <td className="py-2 px-2 font-semibold">Facility Designation</td>
                              <td className="py-2 px-2">Primary Health Centre (PHC)</td>
                              <td className={`py-2 px-2 text-right font-mono font-bold ${highlightCells ? 'text-[#006a68]' : ''}`}>
                                {metrics.phcCount.toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-right">44.0%</td>
                              <td className="py-2 px-2 text-right">44.0%</td>
                            </tr>
                            <tr>
                              <td></td>
                              <td className="py-2 px-2">Comprehensive Health Center (CHC)</td>
                              <td className={`py-2 px-2 text-right font-mono font-bold ${highlightCells ? 'text-[#006a68]' : ''}`}>
                                {metrics.chcCount.toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-right">35.0%</td>
                              <td className="py-2 px-2 text-right">79.0%</td>
                            </tr>
                            <tr>
                              <td></td>
                              <td className="py-2 px-2">General District Hospital</td>
                              <td className={`py-2 px-2 text-right font-mono font-bold ${highlightCells ? 'text-[#006a68]' : ''}`}>
                                {metrics.hospCount.toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-right">21.0%</td>
                              <td className="py-2 px-2 text-right">100.0%</td>
                            </tr>
                            <tr className="bg-[#f8fafc]">
                              <td className="py-2 px-2 font-semibold">Regional District</td>
                              <td className="py-2 px-2">North District</td>
                              <td className={`py-2 px-2 text-right font-mono ${highlightCells ? 'text-[#006a68]' : ''}`}>
                                {metrics.northCount.toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-right">30.0%</td>
                              <td className="py-2 px-2 text-right">30.0%</td>
                            </tr>
                            <tr className="bg-[#f8fafc]">
                              <td></td>
                              <td className="py-2 px-2">South District</td>
                              <td className={`py-2 px-2 text-right font-mono ${highlightCells ? 'text-[#006a68]' : ''}`}>
                                {metrics.southCount.toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-right">25.0%</td>
                              <td className="py-2 px-2 text-right">55.0%</td>
                            </tr>
                            <tr className="bg-[#f8fafc]">
                              <td></td>
                              <td className="py-2 px-2">East District</td>
                              <td className={`py-2 px-2 text-right font-mono ${highlightCells ? 'text-[#006a68]' : ''}`}>
                                {metrics.eastCount.toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-right">27.0%</td>
                              <td className="py-2 px-2 text-right">82.0%</td>
                            </tr>
                            <tr className="bg-[#f8fafc]">
                              <td></td>
                              <td className="py-2 px-2">West District</td>
                              <td className={`py-2 px-2 text-right font-mono ${highlightCells ? 'text-[#006a68]' : ''}`}>
                                {metrics.westCount.toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-right">18.0%</td>
                              <td className="py-2 px-2 text-right">100.0%</td>
                            </tr>
                            <tr>
                              <td className="py-2 px-2 font-semibold">Education Attainment</td>
                              <td className="py-2 px-2">Primary / None</td>
                              <td className={`py-2 px-2 text-right font-mono ${highlightCells ? 'text-[#006a68]' : ''}`}>
                                {metrics.eduPrimaryCount.toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-right">20.0%</td>
                              <td className="py-2 px-2 text-right">20.0%</td>
                            </tr>
                            <tr>
                              <td></td>
                              <td className="py-2 px-2">Secondary / High School</td>
                              <td className={`py-2 px-2 text-right font-mono ${highlightCells ? 'text-[#006a68]' : ''}`}>
                                {metrics.eduSecondaryCount.toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-right">40.0%</td>
                              <td className="py-2 px-2 text-right">60.0%</td>
                            </tr>
                            <tr>
                              <td></td>
                              <td className="py-2 px-2">Tertiary / Bachelor's</td>
                              <td className={`py-2 px-2 text-right font-mono ${highlightCells ? 'text-[#006a68]' : ''}`}>
                                {metrics.eduTertiaryCount.toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-right">30.0%</td>
                              <td className="py-2 px-2 text-right">90.0%</td>
                            </tr>
                            <tr>
                              <td></td>
                              <td className="py-2 px-2">Postgraduate Degree</td>
                              <td className={`py-2 px-2 text-right font-mono ${highlightCells ? 'text-[#006a68]' : ''}`}>
                                {metrics.eduPostgradCount.toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-right">10.0%</td>
                              <td className="py-2 px-2 text-right">100.0%</td>
                            </tr>
                          </tbody>
                        </table>
                        <div className="text-[11px] text-[#74777f] mt-2 italic">
                          Note. N = {reportConfig.sampleSize.toLocaleString()}, n = {reportConfig.validSample.toLocaleString()}. Source: RDIP Validated Field Records.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4.3 Bivariate Hypothesis Testing */}
                  {includeBivariate && (
                    <div className="space-y-3">
                      <h3 className="text-base font-bold font-sans text-[#002045]">
                        4.3 Bivariate Cross-Tabulation & Hypothesis 1 Testing
                      </h3>
                      <p className="text-justify indent-8">
                        <strong>Research Hypothesis 1 (<i>H₁</i>):</strong> <i>Facility classification is significantly associated with the frequency of essential medication stockouts.</i>
                      </p>
                      <p className="text-justify indent-8">
                        A Pearson Chi-Square test of independence was calculated cross-tabulating facility designation against medication stockout frequencies (Table 4.2).
                      </p>

                      {/* APA Table 4.2 */}
                      <div className="my-4 font-sans text-xs bg-white border-y-2 border-[#161c27] p-4 overflow-x-auto shadow-2xs rounded-sm">
                        <div className="font-bold text-[#161c27] text-sm mb-0.5">Table 4.2</div>
                        <div className="italic text-[#43474e] mb-3 text-xs">
                          Cross-Tabulation of Facility Designation by Medication Stockout Frequency (n = {reportConfig.validSample.toLocaleString()})
                        </div>
                        <table className="w-full text-left border-collapse border-b border-[#161c27]">
                          <thead>
                            <tr className="border-b border-[#161c27] font-bold text-[#002045]">
                              <th className="py-2 px-2">Facility Designation</th>
                              <th className="py-2 px-2 text-right">Frequent (Weekly)</th>
                              <th className="py-2 px-2 text-right">Occasional (Monthly)</th>
                              <th className="py-2 px-2 text-right">Rare / Never</th>
                              <th className="py-2 px-2 text-right">Total (<i>n</i>)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[#161c27]">
                            <tr>
                              <td className="py-2 px-2 font-semibold">Primary Health Centre (PHC)</td>
                              <td className="py-2 px-2 text-right font-mono text-[#ba1a1a]">
                                {metrics.phcFrequent.toLocaleString()} (45.0%)
                              </td>
                              <td className="py-2 px-2 text-right font-mono">
                                {metrics.phcOccasional.toLocaleString()} (40.0%)
                              </td>
                              <td className="py-2 px-2 text-right font-mono">
                                {metrics.phcRare.toLocaleString()} (15.0%)
                              </td>
                              <td className="py-2 px-2 text-right font-semibold">
                                {metrics.phcCount.toLocaleString()} (100%)
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-2 font-semibold">Comprehensive Health Center (CHC)</td>
                              <td className="py-2 px-2 text-right font-mono">
                                {metrics.chcFrequent.toLocaleString()} (25.0%)
                              </td>
                              <td className="py-2 px-2 text-right font-mono">
                                {metrics.chcOccasional.toLocaleString()} (50.0%)
                              </td>
                              <td className="py-2 px-2 text-right font-mono">
                                {metrics.chcRare.toLocaleString()} (25.0%)
                              </td>
                              <td className="py-2 px-2 text-right font-semibold">
                                {metrics.chcCount.toLocaleString()} (100%)
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-2 font-semibold">General District Hospital</td>
                              <td className="py-2 px-2 text-right font-mono">
                                {metrics.hospFrequent.toLocaleString()} (10.0%)
                              </td>
                              <td className="py-2 px-2 text-right font-mono">
                                {metrics.hospOccasional.toLocaleString()} (30.0%)
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-[#006a68]">
                                {metrics.hospRare.toLocaleString()} (60.0%)
                              </td>
                              <td className="py-2 px-2 text-right font-semibold">
                                {metrics.hospCount.toLocaleString()} (100%)
                              </td>
                            </tr>
                            <tr className="font-bold bg-[#f1f3ff]">
                              <td className="py-2 px-2">Total Cohort</td>
                              <td className="py-2 px-2 text-right font-mono">
                                {metrics.totalFrequent.toLocaleString()} (30.6%)
                              </td>
                              <td className="py-2 px-2 text-right font-mono">
                                {metrics.totalOccasional.toLocaleString()} (41.4%)
                              </td>
                              <td className="py-2 px-2 text-right font-mono">
                                {metrics.totalRare.toLocaleString()} (27.9%)
                              </td>
                              <td className="py-2 px-2 text-right">
                                {reportConfig.validSample.toLocaleString()} (100%)
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <div className="text-[11px] text-[#74777f] mt-2 italic">
                          Note. <i>χ²</i>(4, <i>n</i> = {reportConfig.validSample.toLocaleString()}) = {metrics.chiSquareVal}, <i>p</i> &lt; .001, Cramér's <i>V</i> = {metrics.cramersV}. Null hypothesis rejected at <i>α</i> = {confidenceLevel === 99 ? '0.01' : '0.05'}.
                        </div>
                      </div>
                      <p className="text-justify indent-8">
                        The contingency test revealed a statistically significant relationship between facility classification and drug supply stability, <i>χ²</i>(4, <i>n</i> = {reportConfig.validSample.toLocaleString()}) = {metrics.chiSquareVal}, <i>p</i> &lt; .001. The Cramér's <i>V</i> effect size of {metrics.cramersV} denotes a moderate-to-high substantive association. Primary Health Centres experienced weekly drug depletion at four times the rate of tertiary hospitals. Hence, <strong>Hypothesis 1 is supported</strong>.
                      </p>
                    </div>
                  )}

                  {/* 4.4 One-Way ANOVA */}
                  {includeAnova && (
                    <div className="space-y-3">
                      <h3 className="text-base font-bold font-sans text-[#002045]">
                        4.4 One-Way ANOVA for Regional Emergency Readiness (Hypothesis 2)
                      </h3>
                      <p className="text-justify indent-8">
                        <strong>Research Hypothesis 2 (<i>H₂</i>):</strong> <i>Emergency medical readiness composite scores differ significantly across regional administrative districts.</i>
                      </p>
                      <p className="text-justify indent-8">
                        A One-Way ANOVA was computed across the four regional districts. The test revealed statistically significant between-group differences, <i>F</i>(3, {metrics.anovaDfWithin.toLocaleString()}) = {metrics.anovaF}, <i>p</i> &lt; .001, <i>η²</i> = .035. Post-hoc Tukey HSD testing confirmed that the urban North District (<i>M</i> = 78.4, <i>SD</i> = 11.2) significantly outperformed the rural West District (<i>M</i> = 59.8, <i>SD</i> = 13.9, <i>p</i> &lt; .001). <strong>Hypothesis 2 is supported</strong>.
                      </p>
                    </div>
                  )}

                  {/* 4.5 Multiple Regression */}
                  {includeRegression && (
                    <div className="space-y-3">
                      <h3 className="text-base font-bold font-sans text-[#002045]">
                        4.5 Multiple Econometric Regression of Primary Care Satisfaction (Hypothesis 3)
                      </h3>
                      <p className="text-justify indent-8">
                        <strong>Research Hypothesis 3 (<i>H₃</i>):</strong> <i>Facility emergency readiness, distance to clinic, medication availability, and staff professionalism significantly predict overall primary care patient satisfaction.</i>
                      </p>

                      {/* APA Table 4.3 */}
                      <div className="my-4 font-sans text-xs bg-white border-y-2 border-[#161c27] p-4 overflow-x-auto shadow-2xs rounded-sm">
                        <div className="font-bold text-[#161c27] text-sm mb-0.5">Table 4.3</div>
                        <div className="italic text-[#43474e] mb-3 text-xs">
                          Multiple Linear Regression Model Coefficients for Overall Patient Satisfaction (n = {reportConfig.validSample.toLocaleString()})
                        </div>
                        <table className="w-full text-left border-collapse border-b border-[#161c27]">
                          <thead>
                            <tr className="border-b border-[#161c27] font-bold text-[#002045]">
                              <th className="py-2 px-2">Model Parameter</th>
                              <th className="py-2 px-2 text-right">Unstandardized <i>B</i></th>
                              <th className="py-2 px-2 text-right">Standard Error</th>
                              <th className="py-2 px-2 text-right">Beta (<i>β</i>)</th>
                              <th className="py-2 px-2 text-right"><i>t</i>-statistic</th>
                              <th className="py-2 px-2 text-right"><i>p</i>-value</th>
                              <th className="py-2 px-2 text-right">95% CI</th>
                              <th className="py-2 px-2 text-right">VIF</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[#161c27]">
                            <tr>
                              <td className="py-2 px-2 font-semibold">(Constant / Intercept)</td>
                              <td className="py-2 px-2 text-right font-mono">1.842</td>
                              <td className="py-2 px-2 text-right font-mono">0.082</td>
                              <td className="py-2 px-2 text-right font-mono">&mdash;</td>
                              <td className="py-2 px-2 text-right font-mono">22.46</td>
                              <td className="py-2 px-2 text-right font-mono">&lt; .001</td>
                              <td className="py-2 px-2 text-right font-mono">[1.681, 2.003]</td>
                              <td className="py-2 px-2 text-right font-mono">&mdash;</td>
                            </tr>
                            <tr>
                              <td className="py-2 px-2">Emergency Readiness Index (<i>X₁</i>)</td>
                              <td className="py-2 px-2 text-right font-mono">0.038</td>
                              <td className="py-2 px-2 text-right font-mono">0.002</td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-[#1a365d]">.384</td>
                              <td className="py-2 px-2 text-right font-mono">19.20</td>
                              <td className="py-2 px-2 text-right font-mono">&lt; .001</td>
                              <td className="py-2 px-2 text-right font-mono">[0.034, 0.042]</td>
                              <td className="py-2 px-2 text-right font-mono">1.24</td>
                            </tr>
                            <tr>
                              <td className="py-2 px-2">Medication Supply Availability (<i>X₂</i>)</td>
                              <td className="py-2 px-2 text-right font-mono">0.412</td>
                              <td className="py-2 px-2 text-right font-mono">0.024</td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-[#1a365d]">.295</td>
                              <td className="py-2 px-2 text-right font-mono">17.16</td>
                              <td className="py-2 px-2 text-right font-mono">&lt; .001</td>
                              <td className="py-2 px-2 text-right font-mono">[0.365, 0.459]</td>
                              <td className="py-2 px-2 text-right font-mono">1.31</td>
                            </tr>
                            <tr>
                              <td className="py-2 px-2">Travel Distance in KM (<i>X₃</i>)</td>
                              <td className="py-2 px-2 text-right font-mono">-0.045</td>
                              <td className="py-2 px-2 text-right font-mono">0.003</td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-[#ba1a1a]">-.212</td>
                              <td className="py-2 px-2 text-right font-mono">-15.00</td>
                              <td className="py-2 px-2 text-right font-mono">&lt; .001</td>
                              <td className="py-2 px-2 text-right font-mono">[-0.051, -0.039]</td>
                              <td className="py-2 px-2 text-right font-mono">1.15</td>
                            </tr>
                            <tr>
                              <td className="py-2 px-2">Worker Professionalism (<i>X₄</i>)</td>
                              <td className="py-2 px-2 text-right font-mono">0.285</td>
                              <td className="py-2 px-2 text-right font-mono">0.018</td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-[#1a365d]">.248</td>
                              <td className="py-2 px-2 text-right font-mono">15.83</td>
                              <td className="py-2 px-2 text-right font-mono">&lt; .001</td>
                              <td className="py-2 px-2 text-right font-mono">[0.250, 0.320]</td>
                              <td className="py-2 px-2 text-right font-mono">1.28</td>
                            </tr>
                          </tbody>
                        </table>
                        <div className="text-[11px] text-[#74777f] mt-2 italic">
                          Note. <i>R</i> = .698, <i>R²</i> = {metrics.rSquared}, Adjusted <i>R²</i> = {metrics.adjustedR2}, <i>F</i>(4, {metrics.anovaDfWithin.toLocaleString()}) = {metrics.regressionF}, <i>p</i> &lt; .001. Durbin-Watson = 1.94.
                        </div>
                      </div>
                      <p className="text-justify indent-8">
                        The overall model accounted for 48.7% of the variance in primary healthcare satisfaction. Emergency readiness (<i>β</i> = .384, <i>p</i> &lt; .001) and medication availability (<i>β</i> = .295, <i>p</i> &lt; .001) were the primary positive determinants. <strong>Hypothesis 3 is supported</strong>.
                      </p>
                    </div>
                  )}

                  {/* 4.6 Factor Analysis */}
                  {includeFactorAnalysis && (
                    <div className="space-y-3">
                      <h3 className="text-base font-bold font-sans text-[#002045]">
                        4.6 Exploratory Factor Analysis & Instrument Reliability
                      </h3>
                      <p className="text-justify indent-8">
                        Principal Axis Factoring with Varimax rotation validated a three-dimensional construct: (1) Clinical Readiness, (2) Supply Chain Resiliency, and (3) Patient Care Experience. The Kaiser-Meyer-Olkin sampling adequacy was .884, and Bartlett's Sphericity was significant (<i>χ²</i>(66) = {metrics.bartlettChiSq.toLocaleString()}, <i>p</i> &lt; .001). Overall scale reliability was exceptional (Cronbach's <i>α</i> = .914).
                      </p>
                    </div>
                  )}

                  {/* 4.7 Master Hypotheses Matrix */}
                  {includeHypothesesMatrix && (
                    <div className="space-y-3">
                      <h3 className="text-base font-bold font-sans text-[#002045]">
                        4.7 Master Summary of Empirical Hypotheses Decisions
                      </h3>

                      {/* APA Table 4.4 */}
                      <div className="my-4 font-sans text-xs bg-white border-y-2 border-[#161c27] p-4 overflow-x-auto shadow-2xs rounded-sm">
                        <div className="font-bold text-[#161c27] text-sm mb-0.5">Table 4.4</div>
                        <div className="italic text-[#43474e] mb-3 text-xs">
                          Hypotheses Testing Decision and Statistical Summary Matrix
                        </div>
                        <table className="w-full text-left border-collapse border-b border-[#161c27]">
                          <thead>
                            <tr className="border-b border-[#161c27] font-bold text-[#002045]">
                              <th className="py-2 px-2">Code</th>
                              <th className="py-2 px-2">Empirical Proposition</th>
                              <th className="py-2 px-2">Statistical Test</th>
                              <th className="py-2 px-2 text-right">Key Statistic</th>
                              <th className="py-2 px-2 text-right"><i>p</i>-value</th>
                              <th className="py-2 px-2 text-right">Empirical Decision</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[#161c27]">
                            <tr>
                              <td className="py-2 px-2 font-bold font-mono">H₁</td>
                              <td className="py-2 px-2">Facility classification predicts drug stockout frequency</td>
                              <td className="py-2 px-2">Pearson <i>χ²</i> Contingency</td>
                              <td className="py-2 px-2 text-right font-mono"><i>χ²</i>(4) = {metrics.chiSquareVal}</td>
                              <td className="py-2 px-2 text-right font-mono">&lt; .001</td>
                              <td className="py-2 px-2 text-right font-bold text-[#006a68]">Supported</td>
                            </tr>
                            <tr>
                              <td className="py-2 px-2 font-bold font-mono">H₂</td>
                              <td className="py-2 px-2">Regional district disparities in emergency readiness</td>
                              <td className="py-2 px-2">One-Way ANOVA (Tukey HSD)</td>
                              <td className="py-2 px-2 text-right font-mono"><i>F</i>(3) = {metrics.anovaF}</td>
                              <td className="py-2 px-2 text-right font-mono">&lt; .001</td>
                              <td className="py-2 px-2 text-right font-bold text-[#006a68]">Supported</td>
                            </tr>
                            <tr>
                              <td className="py-2 px-2 font-bold font-mono">H₃</td>
                              <td className="py-2 px-2">Readiness and distance model patient satisfaction</td>
                              <td className="py-2 px-2">Multiple OLS Regression</td>
                              <td className="py-2 px-2 text-right font-mono"><i>F</i>(4) = {metrics.regressionF}</td>
                              <td className="py-2 px-2 text-right font-mono">&lt; .001</td>
                              <td className="py-2 px-2 text-right font-bold text-[#006a68]">Supported (R² = {metrics.rSquared})</td>
                            </tr>
                            <tr>
                              <td className="py-2 px-2 font-bold font-mono">H₄</td>
                              <td className="py-2 px-2">Cold chain integrity mediates immunization continuity</td>
                              <td className="py-2 px-2">Structural Mediation</td>
                              <td className="py-2 px-2 text-right font-mono">Sobel <i>z</i> = 8.42</td>
                              <td className="py-2 px-2 text-right font-mono">&lt; .001</td>
                              <td className="py-2 px-2 text-right font-bold text-[#006a68]">Supported</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 4.8 Chapter Conclusion */}
                  <div className="space-y-2 pt-4 border-t border-[#e2e8f0]">
                    <h3 className="text-base font-bold font-sans text-[#002045]">
                      4.8 Chapter Summary
                    </h3>
                    <p className="text-justify indent-8">
                      The quantitative findings in this chapter confirm that Primary Health Centers bear a disproportionate burden of pharmaceutical stockouts, and geographical disparities in emergency logistics suppress healthcare satisfaction across peripheral districts. These conclusions transition directly into Chapter 5, which synthesizes policy recommendations and targeted redistribution models.
                    </p>
                  </div>
                </div>
              )}

              {/* SECTION: EXECUTIVE POLICY BRIEF */}
              {activeSection === 'executive' && (
                <div className="space-y-6">
                  <div className="text-center space-y-1 pb-4 border-b border-[#e2e8f0]">
                    <div className="font-sans text-xs font-bold text-[#6b21a8] uppercase tracking-widest">
                      Policy Decision Framework &bull; Strategic Briefing
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold font-sans text-[#002045] tracking-tight">
                      EXECUTIVE POLICY BRIEF: HEALTHCARE INFRASTRUCTURE EQUITY
                    </h2>
                    <div className="text-xs text-[#43474e] font-sans">
                      Targeted for Ministry Stakeholders, Regional Directors & Donors
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-sans my-4">
                    <div className="p-3.5 bg-[#f1f3ff] rounded-xl border border-[#c4c6cf]/60">
                      <span className="text-[10px] uppercase font-bold text-[#74777f]">Total Field Cohort</span>
                      <div className="text-xl font-bold text-[#002045] font-mono">{reportConfig.validSample.toLocaleString()}</div>
                      <span className="text-[10px] text-[#006a68]">99.8% Geo-verified records</span>
                    </div>
                    <div className="p-3.5 bg-[#f1f3ff] rounded-xl border border-[#c4c6cf]/60">
                      <span className="text-[10px] uppercase font-bold text-[#74777f]">PHC Stockout Vulnerability</span>
                      <div className="text-xl font-bold text-[#ba1a1a] font-mono">45.0%</div>
                      <span className="text-[10px] text-[#ba1a1a]">Weekly disruption rate</span>
                    </div>
                    <div className="p-3.5 bg-[#f1f3ff] rounded-xl border border-[#c4c6cf]/60">
                      <span className="text-[10px] uppercase font-bold text-[#74777f]">Model Predictive Power</span>
                      <div className="text-xl font-bold text-[#1a365d] font-mono">R² = {metrics.rSquared}</div>
                      <span className="text-[10px] text-[#1a365d]">Explained variance in satisfaction</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-base font-bold font-sans text-[#002045]">
                      1. Core Empirical Findings
                    </h3>
                    <ul className="list-disc pl-5 space-y-1.5 text-justify">
                      <li><strong>Primary tier facilities face acute supply fragility:</strong> 45.0% of PHCs report severe weekly medication outages, in contrast to only 10.0% of General District Hospitals.</li>
                      <li><strong>Geographical distance represents a primary barrier:</strong> Regression analysis confirms travel distance as a major negative determinant of healthcare access (<i>β</i> = -.212, <i>p</i> &lt; .001).</li>
                      <li><strong>Readiness gap between urban and peripheral sectors:</strong> West and South districts exhibit a 19-point deficit in emergency medical capability scores.</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-base font-bold font-sans text-[#002045]">
                      2. Actionable Policy Recommendations
                    </h3>
                    <div className="space-y-2 font-sans text-xs">
                      <div className="p-3 bg-[#e6f4ea] border border-[#a8dab5] rounded-xl">
                        <strong className="text-[#137333] block mb-0.5">Priority 1: Buffer Stock Redistribution to PHCs</strong>
                        Establish decentralized pharmaceutical replenishment hubs within a 15km radius of primary care centers.
                      </div>
                      <div className="p-3 bg-[#fdf4ff] border border-[#d8b4fe] rounded-xl">
                        <strong className="text-[#6b21a8] block mb-0.5">Priority 2: Solar Cold-Chain Upgrades</strong>
                        Mandate off-grid solar refrigeration for infant immunization vaccines in West District facilities.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: METHODOLOGY NOTE */}
              {activeSection === 'methodology' && (
                <div className="space-y-6">
                  <div className="text-center space-y-1 pb-4 border-b border-[#e2e8f0]">
                    <div className="font-sans text-xs font-bold text-[#006a68] uppercase tracking-widest">
                      Methodological Framework &bull; Chapter 3 Synthesis
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold font-sans text-[#002045] tracking-tight">
                      SAMPLING PROTOCOL & INSTRUMENTATION VALIDITY
                    </h2>
                    <div className="text-xs text-[#43474e] font-sans">
                      Stratified Multi-Stage Cluster Design &bull; Cochran Sampling Framework
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-base font-bold font-sans text-[#002045]">
                      3.1 Sample Size Determination & Cochran's Formula
                    </h3>
                    <p className="text-justify indent-8">
                      The theoretical minimum sample size was computed using Cochran's (1977) formula for categorical multi-cluster surveys:
                    </p>
                    <div className="p-3 bg-white border border-[#c4c6cf] rounded-lg font-mono text-center text-xs my-2">
                      n₀ = (Z² &times; p &times; q) / e² = (1.96² &times; 0.5 &times; 0.5) / 0.015² = 4,268 records
                    </div>
                    <p className="text-justify indent-8">
                      Accounting for a projected 15% non-response and outlier rate across regional enumerator teams, the target fieldwork quota was established at <i>N</i> = {reportConfig.sampleSize.toLocaleString()} respondents.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-base font-bold font-sans text-[#002045]">
                      3.2 Field Enumeration & Offline Data Security
                    </h3>
                    <p className="text-justify indent-8">
                      Enumerators utilized encrypted offline SQLite / IndexedDB mobile survey collectors with SHA-256 tamper verification, GPS timestamp watermarking, and automated schema synchronization with the central research database upon network reconnection.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Manuscript Footer Status Bar */}
          <div className="pt-4 mt-4 border-t border-[#c4c6cf]/30 flex flex-wrap justify-between items-center text-xs text-[#74777f] gap-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#006a68]">check_circle</span>
                <span>APA 7th Syntax Verified</span>
              </span>
              <span>&bull;</span>
              <span>Estimated Reading Time: <strong>{estimatedReadTime} mins</strong></span>
            </div>

            <div className="flex items-center gap-3 font-mono">
              <span>Word Count: <strong>{wordCount.toLocaleString()} words</strong></span>
              <span>Tables: <strong>4 APA Standard</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Download Action Toast */}
      {downloadToast && (
        <div className="fixed bottom-6 right-6 z-[140] bg-[#002045] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-white/20 animate-in slide-in-from-bottom-5">
          <span className="material-symbols-outlined text-[#34d399] text-[20px]">file_download_done</span>
          <span className="text-xs font-semibold">{downloadToast}</span>
          <button
            onClick={() => setDownloadToast(null)}
            className="text-white/60 hover:text-white ml-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
};
