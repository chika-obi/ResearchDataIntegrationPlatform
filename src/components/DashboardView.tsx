import React from 'react';
import { Project, NavSection } from '../types';

interface DashboardViewProps {
  projects: Project[];
  onNavigate: (section: NavSection) => void;
  onOpenCreateProject: () => void;
  onSelectProject?: (project: Project) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  onNavigate,
  onOpenCreateProject,
  onSelectProject
}) => {
  const totalResponses = projects.reduce((acc, p) => acc + p.responsesCount, 3457);

  return (
    <div className="max-w-[1280px] mx-auto p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#002045] tracking-tight">
            Welcome back, Dr. Aris Thorne
          </h1>
          <p className="text-[#43474e] text-sm md:text-base mt-1">
            Here is an overview of your active research projects and field operations.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={onOpenCreateProject}
            className="w-full md:w-auto bg-[#1a365d] hover:bg-[#002045] text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all duration-150 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Create New Project</span>
          </button>
        </div>
      </div>

      {/* Bento Grid Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Metric 1 */}
        <div
          onClick={() => onNavigate('projects')}
          className="bg-white p-5 rounded-xl border border-[#c4c6cf]/50 card-shadow hover:shadow-md transition-all cursor-pointer flex flex-col justify-between h-[130px] group"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-[#43474e] uppercase tracking-wider">
              Total Projects
            </span>
            <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#002045] transition-colors">
              folder
            </span>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#002045] tracking-tight">12</div>
            <div className="text-xs text-[#006a68] font-medium mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">arrow_upward</span>
              <span>+2 from last quarter</span>
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div
          onClick={() => onNavigate('visualizations')}
          className="bg-white p-5 rounded-xl border border-[#c4c6cf]/50 card-shadow hover:shadow-md transition-all cursor-pointer flex flex-col justify-between h-[130px] group"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-[#43474e] uppercase tracking-wider">
              Active Responses
            </span>
            <span className="material-symbols-outlined text-[#74777f] group-hover:text-[#006a68] transition-colors">
              check_circle
            </span>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#002045] tracking-tight">
              {totalResponses.toLocaleString()}
            </div>
            <div className="text-xs text-[#006a68] font-medium mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">arrow_upward</span>
              <span>+12% this week</span>
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div
          onClick={() => onNavigate('enumerators')}
          className="bg-white p-5 rounded-xl border border-[#c4c6cf]/50 card-shadow hover:shadow-md transition-all cursor-pointer flex flex-col justify-between h-[130px] relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-[#dde2f3] rounded-bl-full opacity-40 group-hover:opacity-70 transition-opacity"></div>
          <div className="flex justify-between items-start relative z-10">
            <span className="text-xs font-semibold text-[#43474e] uppercase tracking-wider">
              Offline Pending
            </span>
            <span className="material-symbols-outlined text-[#74777f]">sync_problem</span>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <span className="text-3xl font-bold text-[#002045] tracking-tight">234</span>
            <span className="bg-[#ffdcc5]/60 text-[#703700] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border border-[#ffb783]">
              Pending
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div
          onClick={() => onNavigate('data-quality')}
          className="bg-white p-5 rounded-xl border border-[#c4c6cf]/50 border-l-4 border-l-[#ba1a1a] card-shadow hover:shadow-md transition-all cursor-pointer flex flex-col justify-between h-[130px] group"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-[#43474e] uppercase tracking-wider">
              Quality Issues
            </span>
            <span className="material-symbols-outlined text-[#ba1a1a]">warning</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-[#002045] tracking-tight">7</span>
            <span className="bg-[#ffdad6] text-[#93000a] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Action Req
            </span>
          </div>
        </div>
      </div>

      {/* Recent Projects Section */}
      <div className="bg-white rounded-xl border border-[#c4c6cf]/50 card-shadow overflow-hidden">
        <div className="p-5 md:p-6 border-b border-[#c4c6cf]/40 flex justify-between items-center bg-[#f9f9ff]">
          <div>
            <h3 className="text-lg font-bold text-[#002045]">Recent Projects</h3>
            <p className="text-xs text-[#43474e] mt-0.5">
              Active field research cohorts & data collection pipelines
            </p>
          </div>
          <button
            onClick={() => onNavigate('projects')}
            className="text-[#1a365d] hover:text-[#002045] font-semibold text-xs md:text-sm flex items-center gap-1 hover:underline"
          >
            <span>View All</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f1f3ff]/60 border-b border-[#c4c6cf]/50 text-xs font-semibold text-[#43474e] uppercase tracking-wider">
                <th className="py-3 px-5">Project Name</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Progress</th>
                <th className="py-3 px-5 text-right">Responses</th>
                <th className="py-3 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c4c6cf]/30 text-sm">
              {projects.map((project) => (
                <tr
                  key={project.id}
                  onClick={() => onSelectProject?.(project)}
                  className="hover:bg-[#f1f3ff]/50 transition-colors group cursor-pointer"
                >
                  <td className="py-4 px-5">
                    <p className="font-semibold text-[#002045] group-hover:text-[#1a365d] transition-colors line-clamp-1">
                      {project.title}
                    </p>
                    <p className="text-xs text-[#43474e] mt-0.5 flex items-center gap-2">
                      <span>ID: {project.code}</span>
                      <span>•</span>
                      <span>{project.institution}</span>
                    </p>
                  </td>
                  <td className="py-4 px-5 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        project.status === 'Active'
                          ? 'bg-[#dcfce7] text-[#166534]'
                          : project.status === 'Pending Approval'
                          ? 'bg-[#fef3c7] text-[#92400e]'
                          : 'bg-[#e2e8f0] text-[#475569]'
                      }`}
                    >
                      {project.status}
                    </span>
                  </td>
                  <td className="py-4 px-5 w-48 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-[#dde2f3] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#006a68] rounded-full transition-all duration-500"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-[#43474e] w-8 text-right">
                        {project.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-5 text-right font-mono font-medium text-[#002045] whitespace-nowrap">
                    {project.responsesCount.toLocaleString()}
                  </td>
                  <td className="py-4 px-5 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('statistical-analysis');
                        }}
                        className="p-1.5 text-[#1a365d] hover:bg-[#dde2f3] rounded-lg transition-colors"
                        title="Statistical Analysis"
                      >
                        <span className="material-symbols-outlined text-[18px]">insights</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('questionnaires');
                        }}
                        className="p-1.5 text-[#43474e] hover:bg-[#dde2f3] rounded-lg transition-colors"
                        title="Open Questionnaire"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit_note</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 pt-2">
        <div
          onClick={() => onNavigate('questionnaires')}
          className="bg-white p-5 rounded-xl border border-[#c4c6cf]/40 card-shadow hover:border-[#1a365d] transition-all cursor-pointer flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-[#1a365d]/10 text-[#1a365d] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">edit_note</span>
          </div>
          <div>
            <h4 className="font-bold text-[#002045] text-sm">Questionnaire Designer</h4>
            <p className="text-xs text-[#43474e] mt-0.5">Author modular surveys & skip logic</p>
          </div>
        </div>

        <div
          onClick={() => onNavigate('statistical-analysis')}
          className="bg-white p-5 rounded-xl border border-[#c4c6cf]/40 card-shadow hover:border-[#1a365d] transition-all cursor-pointer flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-[#006a68]/10 text-[#006a68] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">psychology</span>
          </div>
          <div>
            <h4 className="font-bold text-[#002045] text-sm">Statistical Inference</h4>
            <p className="text-xs text-[#43474e] mt-0.5">Hypothesis test & AI recommendations</p>
          </div>
        </div>

        <div
          onClick={() => onNavigate('reports')}
          className="bg-white p-5 rounded-xl border border-[#c4c6cf]/40 card-shadow hover:border-[#1a365d] transition-all cursor-pointer flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-[#572900]/10 text-[#572900] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">description</span>
          </div>
          <div>
            <h4 className="font-bold text-[#002045] text-sm">Academic Report Synth</h4>
            <p className="text-xs text-[#43474e] mt-0.5">Generate Chapter 4 thesis draft & APA tables</p>
          </div>
        </div>
      </div>
    </div>
  );
};
