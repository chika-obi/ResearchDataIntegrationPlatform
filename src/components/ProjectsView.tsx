import React, { useState, useMemo, useEffect } from 'react';
import { Project, NavSection } from '../types';
import { ProjectExportModal } from './ProjectExportModal';
import { generatePortfolioCSV, generatePortfolioJSON, downloadFile } from '../lib/projectDataExporter';

interface ProjectsViewProps {
  projects: Project[];
  onOpenCreateProject: () => void;
  onNavigate: (section: NavSection) => void;
  onSelectProject?: (project: Project) => void;
  onUpdateProject?: (project: Project) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  onOpenCreateProject,
  onNavigate,
  onSelectProject,
  onUpdateProject
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Draft' | 'Pending Approval'>('All');
  const [selectedProjectForModal, setSelectedProjectForModal] = useState<Project | null>(null);
  const [exportingProject, setExportingProject] = useState<Project | null>(null);
  const [isPortfolioMenuOpen, setIsPortfolioMenuOpen] = useState(false);
  const [activeMenuProjectId, setActiveMenuProjectId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  // Close card kebab menu or portfolio dropdown on window click
  useEffect(() => {
    const handleDocumentClick = () => {
      setActiveMenuProjectId(null);
      setIsPortfolioMenuOpen(false);
    };
    window.addEventListener('click', handleDocumentClick);
    return () => window.removeEventListener('click', handleDocumentClick);
  }, []);

  const handleExportPortfolio = (format: 'csv' | 'json') => {
    setIsPortfolioMenuOpen(false);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const options = {
      format,
      scope: 'bundle' as const,
      includeNotes: true,
      includeGps: true,
      includeEnumeratorInfo: true,
      includeObjectives: true
    };

    if (format === 'csv') {
      const content = generatePortfolioCSV(projects, options);
      downloadFile(content, `RDIP_Research_Initiatives_Portfolio_${dateStamp}.csv`, 'text/csv;charset=utf-8;');
      setToastMessage(`Downloaded portfolio dataset (${projects.length} initiatives as CSV)`);
    } else {
      const content = generatePortfolioJSON(projects, options);
      downloadFile(content, `RDIP_Research_Initiatives_Portfolio_${dateStamp}.json`, 'application/json;charset=utf-8;');
      setToastMessage(`Downloaded portfolio dataset (${projects.length} initiatives as JSON)`);
    }

    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.institution.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  const handleOpenModal = (project: Project, startEditNotes = false) => {
    setSelectedProjectForModal(project);
    setNotesDraft(project.notes || '');
    setIsEditingNotes(startEditNotes);
  };

  const handleSaveNotes = () => {
    if (!selectedProjectForModal) return;
    const updated: Project = {
      ...selectedProjectForModal,
      notes: notesDraft.trim() || undefined
    };
    setSelectedProjectForModal(updated);
    setIsEditingNotes(false);
    if (onUpdateProject) {
      onUpdateProject(updated);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#002045] tracking-tight">
            Research Initiatives & Active Projects
          </h1>
          <p className="text-[#43474e] text-sm md:text-base mt-1">
            Manage data collection protocols, contextual field notes, survey schemas, and enumerator cohorts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Portfolio Export Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsPortfolioMenuOpen(!isPortfolioMenuOpen);
              }}
              className="bg-white hover:bg-[#f1f3ff] text-[#002045] border border-[#c4c6cf] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              title="Download portfolio-wide dataset across all projects"
            >
              <span className="material-symbols-outlined text-[18px] text-[#1a365d]">download</span>
              <span>Export Portfolio</span>
              <span className="material-symbols-outlined text-[16px] text-[#74777f]">
                {isPortfolioMenuOpen ? 'arrow_drop_up' : 'arrow_drop_down'}
              </span>
            </button>

            {isPortfolioMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-[#c4c6cf]/60 py-1.5 z-50 animate-in fade-in zoom-in-95 text-xs text-[#002045]"
              >
                <div className="px-3 py-1.5 border-b border-[#c4c6cf]/30 font-bold text-[10px] text-[#74777f] uppercase tracking-wider">
                  Portfolio Dataset Export
                </div>
                <button
                  onClick={() => handleExportPortfolio('csv')}
                  className="w-full text-left px-3 py-2 hover:bg-[#f1f3ff] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#006a68]">table_chart</span>
                  <div>
                    <div className="font-bold">Download Portfolio (.CSV)</div>
                    <div className="text-[10px] text-[#74777f]">All {projects.length} initiatives in tabular format</div>
                  </div>
                </button>
                <button
                  onClick={() => handleExportPortfolio('json')}
                  className="w-full text-left px-3 py-2 hover:bg-[#f1f3ff] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#1a365d]">data_object</span>
                  <div>
                    <div className="font-bold">Download Portfolio (.JSON)</div>
                    <div className="text-[10px] text-[#74777f]">Structured JSON with sample records</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onOpenCreateProject}
            className="bg-[#1a365d] hover:bg-[#002045] text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Create New Project</span>
          </button>
        </div>
      </div>

      {/* Dashboard / Overview Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 card-shadow border border-[#c4c6cf]/50 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#43474e] uppercase tracking-wider">
              Total Active Projects
            </span>
            <span className="p-1.5 rounded-lg bg-[#1a365d]/10 text-[#1a365d]">
              <span className="material-symbols-outlined text-[20px]">monitoring</span>
            </span>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-extrabold text-[#002045]">
              {projects.filter((p) => p.status === 'Active').length}
            </div>
            <div className="text-xs text-[#006a68] mt-2 flex items-center font-bold">
              <span className="material-symbols-outlined text-sm mr-1">check_circle</span>
              <span>{projects.length} Total Registered Portfolios</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 card-shadow border border-[#c4c6cf]/50 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#43474e] uppercase tracking-wider">
              Aggregated Responses
            </span>
            <span className="p-1.5 rounded-lg bg-[#006a68]/10 text-[#006a68]">
              <span className="material-symbols-outlined text-[20px]">data_usage</span>
            </span>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-extrabold text-[#002045]">
              {projects.reduce((acc, p) => acc + (p.responsesCount || 0), 0).toLocaleString()}
            </div>
            <div className="text-xs text-[#006a68] mt-2 flex items-center font-bold">
              <span className="material-symbols-outlined text-sm mr-1">arrow_upward</span>
              <span>Verified across mobile & web nodes</span>
            </div>
          </div>
        </div>

        <div className="bg-[#f1f3ff] rounded-2xl p-5 card-shadow border border-[#adc7f7] flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-[#002045] uppercase tracking-wider block mb-2">
              Field Telemetry & Quality
            </span>
            <div className="text-xl font-bold text-[#002045] flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-[#006a68] mr-2.5 animate-pulse"></span>
              Synchronized & Compliant
            </div>
          </div>
          <p className="text-xs text-[#43474e] mt-3 leading-relaxed">
            All IRB protocols, contextual notes, and survey logic active across deployment nodes.
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-2xl card-shadow border border-[#c4c6cf]/50">
        <div className="relative w-full md:w-96">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#74777f] text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects, institutions, or contextual notes..."
            className="w-full pl-9 pr-4 py-2 bg-[#f9f9ff] rounded-xl border border-[#c4c6cf]/70 focus:border-[#1a365d] focus:ring-2 focus:ring-[#1a365d]/15 text-xs text-[#002045] outline-none transition-all"
          />
        </div>

        <div className="flex space-x-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['All', 'Active', 'Pending Approval', 'Draft'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#1a365d] text-white border-[#1a365d] shadow-2xs'
                  : 'bg-[#f9f9ff] text-[#43474e] border-[#c4c6cf]/60 hover:bg-[#e3e8f9]'
              }`}
            >
              {st === 'All' ? 'All Statuses' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <div
            key={project.id}
            className="bg-white rounded-2xl card-shadow card-hover overflow-hidden flex flex-col border border-[#c4c6cf]/50 group"
          >
            <div className="p-5 sm:p-6 flex-1 border-b border-[#c4c6cf]/30 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        project.status === 'Active'
                          ? 'bg-[#006a68]/10 text-[#006a68]'
                          : project.status === 'Pending Approval'
                          ? 'bg-[#f59e0b]/10 text-[#d97706]'
                          : 'bg-[#74777f]/10 text-[#74777f]'
                      }`}
                    >
                      {project.status}
                    </span>
                    <span className="text-[11px] font-mono text-[#74777f] font-semibold">{project.code}</span>
                  </div>

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuProjectId(activeMenuProjectId === project.id ? null : project.id);
                      }}
                      className="text-[#74777f] hover:text-[#002045] transition-colors p-1 rounded-full hover:bg-[#f1f3ff] cursor-pointer"
                      title="Project options & data export"
                    >
                      <span className="material-symbols-outlined text-[18px]">more_vert</span>
                    </button>

                    {activeMenuProjectId === project.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-[#c4c6cf]/60 py-1.5 z-30 animate-in fade-in zoom-in-95 text-xs text-[#002045]"
                      >
                        <button
                          onClick={() => {
                            setActiveMenuProjectId(null);
                            setExportingProject(project);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-[#f1f3ff] flex items-center gap-2 cursor-pointer font-bold text-[#006a68]"
                        >
                          <span className="material-symbols-outlined text-[16px]">download</span>
                          <span>Export Data (CSV / JSON)</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveMenuProjectId(null);
                            handleOpenModal(project);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-[#f1f3ff] flex items-center gap-2 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px] text-[#1a365d]">visibility</span>
                          <span>View Details & Objectives</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveMenuProjectId(null);
                            handleOpenModal(project, true);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-[#f1f3ff] flex items-center gap-2 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px] text-[#1a365d]">edit_note</span>
                          <span>Edit Contextual Notes</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="text-base font-bold text-[#002045] mb-1 line-clamp-2 group-hover:text-[#1a365d] transition-colors">
                  {project.title}
                </h3>
                <p className="text-xs text-[#43474e] mb-2.5 font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-[#74777f]">apartment</span>
                  <span>{project.institution}</span>
                </p>

                <p className="text-xs text-[#43474e] line-clamp-2 mb-3 leading-relaxed">
                  {project.description}
                </p>

                {/* Contextual Notes Callout Box */}
                {project.notes ? (
                  <div className="mb-3 p-2.5 bg-[#f1f3ff] rounded-xl border border-[#adc7f7]/60 text-xs text-[#002045] flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] text-[#1a365d] shrink-0 mt-0.5">
                      sticky_note_2
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[10px] uppercase tracking-wider text-[#1a365d]">
                          Contextual Notes
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModal(project, true);
                          }}
                          className="text-[10px] text-[#1a365d] font-bold hover:underline cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                      <p className="line-clamp-2 text-[11px] text-[#43474e] leading-snug mt-0.5">
                        {project.notes}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 py-1.5 px-2.5 bg-slate-50 border border-dashed border-[#c4c6cf]/80 rounded-xl flex items-center justify-between text-[11px] text-[#74777f]">
                    <span className="flex items-center gap-1 text-[11px]">
                      <span className="material-symbols-outlined text-[14px]">edit_note</span>
                      <span>No contextual notes</span>
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenModal(project, true);
                      }}
                      className="text-[#1a365d] font-bold hover:underline cursor-pointer"
                    >
                      + Attach Note
                    </button>
                  </div>
                )}
              </div>

              {/* Progress & Quality Metrics */}
              <div className="flex items-center justify-between text-[#74777f] pt-3 border-t border-[#c4c6cf]/20 text-xs">
                <div className="flex items-center gap-1.5" title="Active Enumerators">
                  <span className="material-symbols-outlined text-[16px] text-[#002045]">group</span>
                  <span className="font-bold text-[#161c27]">
                    {project.enumeratorsCount} Agents
                  </span>
                </div>
                <div className="flex items-center gap-1.5" title="Responses Collected">
                  <span className="material-symbols-outlined text-[16px] text-[#002045]">
                    description
                  </span>
                  <span className="font-bold text-[#161c27]">
                    {project.responsesCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1 ml-auto" title="Data Quality Score">
                  <span className="material-symbols-outlined text-[16px] text-[#006a68]">verified</span>
                  <span className="font-bold text-[#006a68]">
                    {project.qualityScore}%
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="p-3 bg-[#f9f9ff] flex justify-between items-center text-xs px-4">
              <span className="text-[#74777f] text-[11px]">
                {project.status === 'Pending Approval' ? 'Starts: ' : 'Ends: '}
                {project.endDate}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExportingProject(project);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-[#006a68] bg-[#006a68]/10 hover:bg-[#006a68]/20 border border-[#006a68]/30 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Export project details and collected data as CSV or JSON"
                >
                  <span className="material-symbols-outlined text-[15px]">download</span>
                  <span>Export</span>
                </button>
                <button
                  onClick={() => {
                    handleOpenModal(project);
                    onSelectProject?.(project);
                  }}
                  className="text-[#1a365d] font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Details</span>
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Project Details & Contextual Notes Modal */}
      {selectedProjectForModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#002045]/50 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedProjectForModal(null)}
          />
          <div className="relative bg-white w-full max-w-xl rounded-2xl shadow-2xl p-6 border border-[#c4c6cf]/60 animate-in fade-in zoom-in-95 space-y-5 my-auto max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-3.5 border-b border-[#c4c6cf]/40">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#006a68]/10 text-[#006a68] uppercase">
                    {selectedProjectForModal.status}
                  </span>
                  <span className="text-xs font-mono font-bold text-[#74777f]">
                    {selectedProjectForModal.code}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-[#002045] mt-1.5">
                  {selectedProjectForModal.title}
                </h2>
                <p className="text-xs text-[#43474e] flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-[14px]">apartment</span>
                  <span>{selectedProjectForModal.institution}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedProjectForModal(null)}
                className="text-[#74777f] hover:text-[#002045] p-1.5 rounded-full hover:bg-[#e3e8f9] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 text-xs text-[#161c27]">
              {/* Description */}
              <div>
                <h4 className="text-[11px] font-bold text-[#002045] uppercase tracking-wider mb-1">
                  Project Description & Scope
                </h4>
                <p className="leading-relaxed text-[#43474e] bg-[#f9f9ff] p-3 rounded-xl border border-[#c4c6cf]/40">
                  {selectedProjectForModal.description}
                </p>
              </div>

              {/* Dedicated Contextual Notes Editor / Viewer */}
              <div className="p-4 bg-[#f1f3ff] rounded-2xl border border-[#adc7f7] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[#002045]">
                    <span className="material-symbols-outlined text-[18px] text-[#1a365d]">sticky_note_2</span>
                    <span className="font-bold text-xs uppercase tracking-wider">
                      Contextual Notes & Research Field Protocols
                    </span>
                  </div>
                  {!isEditingNotes ? (
                    <button
                      onClick={() => {
                        setNotesDraft(selectedProjectForModal.notes || '');
                        setIsEditingNotes(true);
                      }}
                      className="text-xs font-bold text-[#1a365d] hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      <span>Edit Notes</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditingNotes(false)}
                        className="text-xs text-[#74777f] hover:underline cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNotes}
                        className="px-2.5 py-1 bg-[#1a365d] text-white rounded-lg text-xs font-bold shadow-2xs hover:bg-[#002045] cursor-pointer"
                      >
                        Save Notes
                      </button>
                    </div>
                  )}
                </div>

                {isEditingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="Attach contextual notes, IRB approval ID, sampling rules, or field constraints..."
                      className="w-full p-2.5 bg-white rounded-xl border border-[#c4c6cf] focus:border-[#1a365d] focus:ring-2 focus:ring-[#1a365d]/15 text-xs text-[#002045] outline-none resize-none leading-relaxed"
                    />
                    <p className="text-[10px] text-[#74777f]">
                      Notes are stored on the project object and visible to all research team members.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[#002045] leading-relaxed">
                    {selectedProjectForModal.notes || (
                      <span className="italic text-[#74777f]">
                        No contextual notes attached yet. Click 'Edit Notes' to document field parameters or IRB numbers.
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Research Objectives if present */}
              {selectedProjectForModal.researchObjectives && selectedProjectForModal.researchObjectives.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-[#002045] uppercase tracking-wider mb-1.5">
                    Target Research Objectives
                  </h4>
                  <ul className="space-y-1">
                    {selectedProjectForModal.researchObjectives.map((obj, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 p-2 bg-white rounded-lg border border-[#c4c6cf]/30 text-xs text-[#43474e]"
                      >
                        <span className="material-symbols-outlined text-[14px] text-[#006a68]">task_alt</span>
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Stat Highlights */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="p-3 bg-[#f9f9ff] rounded-xl text-center border border-[#c4c6cf]/40">
                  <div className="text-lg font-extrabold text-[#002045]">
                    {selectedProjectForModal.responsesCount.toLocaleString()}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-[#74777f]">Responses</div>
                </div>
                <div className="p-3 bg-[#f9f9ff] rounded-xl text-center border border-[#c4c6cf]/40">
                  <div className="text-lg font-extrabold text-[#002045]">
                    {selectedProjectForModal.enumeratorsCount}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-[#74777f]">Enumerators</div>
                </div>
                <div className="p-3 bg-[#f9f9ff] rounded-xl text-center border border-[#c4c6cf]/40">
                  <div className="text-lg font-extrabold text-[#006a68]">
                    {selectedProjectForModal.qualityScore}%
                  </div>
                  <div className="text-[10px] uppercase font-bold text-[#74777f]">Quality Score</div>
                </div>
              </div>
            </div>

            {/* Footer Navigation */}
            <div className="flex flex-wrap gap-2 pt-4 border-t border-[#c4c6cf]/40 justify-between items-center">
              <button
                onClick={() => {
                  const proj = selectedProjectForModal;
                  setExportingProject(proj);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#006a68]/10 text-[#006a68] border border-[#006a68]/30 hover:bg-[#006a68]/20 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Download structured CSV or JSON for this project"
              >
                <span className="material-symbols-outlined text-[17px]">download</span>
                <span>Export Project & Data</span>
              </button>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setSelectedProjectForModal(null);
                    onNavigate('questionnaires');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-[#c4c6cf] text-[#002045] hover:bg-[#f1f3ff] transition-colors cursor-pointer"
                >
                  Open Questionnaire Studio
                </button>
                <button
                  onClick={() => {
                    setSelectedProjectForModal(null);
                    onNavigate('statistical-analysis');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1a365d] text-white hover:bg-[#002045] transition-colors shadow-2xs cursor-pointer"
                >
                  Run Statistical Models
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Project Data Export Modal */}
      {exportingProject && (
        <ProjectExportModal
          project={exportingProject}
          isOpen={!!exportingProject}
          onClose={() => setExportingProject(null)}
          onExportSuccess={(fileName) => {
            setToastMessage(`Export generated: ${fileName}`);
            setTimeout(() => setToastMessage(null), 4000);
          }}
        />
      )}

      {/* Download Success Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[120] bg-[#002045] text-white px-4 py-3 rounded-xl shadow-2xl border border-[#adc7f7]/40 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="material-symbols-outlined text-[20px] text-[#22c55e]">check_circle</span>
          <span className="text-xs font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-white/60 hover:text-white ml-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
};
