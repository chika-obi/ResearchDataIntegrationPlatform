import React, { useState, useMemo } from 'react';
import { Project, NavSection } from '../types';

interface ProjectsViewProps {
  projects: Project[];
  onOpenCreateProject: () => void;
  onNavigate: (section: NavSection) => void;
  onSelectProject?: (project: Project) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  onOpenCreateProject,
  onNavigate,
  onSelectProject
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Draft' | 'Pending Approval'>('All');
  const [selectedProjectForModal, setSelectedProjectForModal] = useState<Project | null>(null);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.institution.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  return (
    <div className="max-w-[1280px] mx-auto p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#002045] tracking-tight">
            Active Projects
          </h1>
          <p className="text-[#43474e] text-sm md:text-base mt-1">
            Manage and monitor ongoing field research and data collection initiatives.
          </p>
        </div>
        <button
          onClick={onOpenCreateProject}
          className="bg-[#1a365d] hover:bg-[#002045] text-white px-6 py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all w-full md:w-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Create New Project</span>
        </button>
      </div>

      {/* Dashboard / Overview Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-[#43474e] uppercase tracking-wider">
              Total Active
            </span>
            <span className="material-symbols-outlined text-[#1a365d]">monitoring</span>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold text-[#002045]">12</div>
            <div className="text-xs text-[#006a68] mt-2 flex items-center font-medium">
              <span className="material-symbols-outlined text-sm mr-1">arrow_upward</span>
              <span>+2 from last quarter</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-[#43474e] uppercase tracking-wider">
              Total Responses
            </span>
            <span className="material-symbols-outlined text-[#006a68]">data_usage</span>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-bold text-[#002045]">45.2K</div>
            <div className="text-xs text-[#006a68] mt-2 flex items-center font-medium">
              <span className="material-symbols-outlined text-sm mr-1">arrow_upward</span>
              <span>+12% this week</span>
            </div>
          </div>
        </div>

        <div className="bg-[#f1f3ff] rounded-xl p-6 card-shadow border border-[#adc7f7] flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-[#002045] uppercase tracking-wider block mb-2">
              System Status
            </span>
            <div className="text-xl font-bold text-[#002045] flex items-center">
              <span className="w-3 h-3 rounded-full bg-[#006a68] mr-3 animate-pulse"></span>
              Optimal
            </div>
          </div>
          <p className="text-xs text-[#43474e] mt-4">
            All collection nodes reporting normal latency (42ms avg).
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl card-shadow border border-[#c4c6cf]/40">
        <div className="relative w-full md:w-96">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#74777f] text-[20px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects by title or institution..."
            className="w-full pl-10 pr-4 py-2 bg-[#f9f9ff] rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] text-sm outline-none transition-all"
          />
        </div>

        <div className="flex space-x-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['All', 'Active', 'Pending Approval', 'Draft'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                statusFilter === st
                  ? 'bg-[#e3e8f9] text-[#002045] border-[#adc7f7]'
                  : 'bg-white text-[#43474e] border-[#c4c6cf] hover:bg-[#f1f3ff]'
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
            className="bg-white rounded-xl card-shadow card-hover overflow-hidden flex flex-col border border-[#c4c6cf]/40 group"
          >
            <div className="p-6 flex-1 border-b border-[#c4c6cf]/40 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span
                    className={`inline-block px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider ${
                      project.status === 'Active'
                        ? 'bg-[#006a68]/10 text-[#006a68]'
                        : project.status === 'Pending Approval'
                        ? 'bg-[#f59e0b]/10 text-[#d97706]'
                        : 'bg-[#74777f]/10 text-[#74777f]'
                    }`}
                  >
                    {project.status}
                  </span>
                  <button
                    onClick={() => setSelectedProjectForModal(project)}
                    className="text-[#74777f] hover:text-[#002045] transition-colors p-1"
                  >
                    <span className="material-symbols-outlined text-[20px]">more_vert</span>
                  </button>
                </div>

                <h3 className="text-lg font-bold text-[#002045] mb-1 line-clamp-2 group-hover:text-[#1a365d] transition-colors">
                  {project.title}
                </h3>
                <p className="text-xs text-[#43474e] mb-4 font-medium">
                  {project.institution}
                </p>
                <p className="text-xs text-[#43474e] line-clamp-2 mb-4 leading-relaxed">
                  {project.description}
                </p>
              </div>

              <div className="flex items-center space-x-6 text-[#74777f] pt-4 border-t border-[#c4c6cf]/20">
                <div className="flex items-center gap-1.5" title="Active Enumerators">
                  <span className="material-symbols-outlined text-sm text-[#002045]">group</span>
                  <span className="text-xs font-bold text-[#161c27]">
                    {project.enumeratorsCount}
                  </span>
                </div>
                <div className="flex items-center gap-1.5" title="Responses Collected">
                  <span className="material-symbols-outlined text-sm text-[#002045]">
                    description
                  </span>
                  <span className="text-xs font-bold text-[#161c27]">
                    {project.responsesCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto" title="Data Quality">
                  <span className="material-symbols-outlined text-sm text-[#006a68]">verified</span>
                  <span className="text-xs font-bold text-[#006a68]">
                    {project.qualityScore}%
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#f9f9ff] flex justify-between items-center text-xs">
              <span className="text-[#74777f]">
                {project.status === 'Pending Approval' ? 'Starts: ' : 'Ends: '}
                {project.endDate}
              </span>
              <button
                onClick={() => {
                  setSelectedProjectForModal(project);
                  onSelectProject?.(project);
                }}
                className="text-[#1a365d] font-bold hover:underline flex items-center gap-0.5"
              >
                <span>View Details</span>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Project Details Modal */}
      {selectedProjectForModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#161c27]/40 backdrop-blur-xs"
            onClick={() => setSelectedProjectForModal(null)}
          />
          <div className="relative bg-white w-full max-w-xl rounded-xl shadow-2xl p-6 border border-[#c4c6cf]/50 animate-in fade-in zoom-in-95 space-y-5">
            <div className="flex justify-between items-start pb-3 border-b border-[#c4c6cf]/40">
              <div>
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#006a68]/10 text-[#006a68] uppercase">
                  {selectedProjectForModal.status}
                </span>
                <h2 className="text-xl font-bold text-[#002045] mt-2">
                  {selectedProjectForModal.title}
                </h2>
                <p className="text-xs text-[#43474e]">{selectedProjectForModal.institution}</p>
              </div>
              <button
                onClick={() => setSelectedProjectForModal(null)}
                className="text-[#74777f] hover:text-[#002045] p-1 rounded-full"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-sm text-[#161c27]">
              <p className="text-xs leading-relaxed text-[#43474e]">
                {selectedProjectForModal.description}
              </p>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-[#f1f3ff] rounded-lg text-center">
                  <div className="text-lg font-bold text-[#002045]">
                    {selectedProjectForModal.responsesCount.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-[#43474e]">Responses</div>
                </div>
                <div className="p-3 bg-[#f1f3ff] rounded-lg text-center">
                  <div className="text-lg font-bold text-[#002045]">
                    {selectedProjectForModal.enumeratorsCount}
                  </div>
                  <div className="text-[11px] text-[#43474e]">Enumerators</div>
                </div>
                <div className="p-3 bg-[#f1f3ff] rounded-lg text-center">
                  <div className="text-lg font-bold text-[#006a68]">
                    {selectedProjectForModal.qualityScore}%
                  </div>
                  <div className="text-[11px] text-[#43474e]">Quality Score</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-[#c4c6cf]/40 justify-end">
              <button
                onClick={() => {
                  setSelectedProjectForModal(null);
                  onNavigate('questionnaires');
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-[#c4c6cf] text-[#002045] hover:bg-[#f1f3ff]"
              >
                Edit Survey Schema
              </button>
              <button
                onClick={() => {
                  setSelectedProjectForModal(null);
                  onNavigate('statistical-analysis');
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1a365d] text-white hover:bg-[#002045]"
              >
                Launch Statistical Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
